// elbs_client.js -- shared code for composer, performner and listener web apps
// Ari Liloia 
// October 2024

// DRUM_URLS[0] is the "metronome" drum
var DRUM_URLS = [["/sounds/stortromme.mp3", "/sounds/stortromme.mp3",
                  null, null],
                 ["/sounds/conga_left.wav", "/sounds/conga_right.wav",
                  "Conga", 70],
                 ["/sounds/loconga_left.wav", "/sounds/loconga_right.wav",
                  "Low Conga", 90],
                 ["/sounds/hibongo_left.wav", "/sounds/hibongo_right.wav",
                  "High Bongo", 100],
                 ["/sounds/lobongo_left.wav", "/sounds/lobongo_right.wav",
                  "Low Bongo", 95]];

// ********* GENERAL ***********
// startup sequence using client_state:
//    "init" => wait for audioContext to be running;
//              use watime as local clock reference
//    "syncing" => wait for clock sync
//    "ready" => able to schedule events in global o2 time
//    "playing" => playing metronome drums

var client_state = "init";  // see README.md for more state machine info

var valid_credentials_entered = false;
var timemap_set = false; 
var client_voted = false;
var client_validated_by_server = false;

var voting_over_grid_initialized = false;

// this is for safety - fix this later after
// all the tempo stuff is resolved
var MAX_TEMPO = 114;
var MIN_TEMPO = 42;

var gdc_client_username = "";
var tempo_epoch = 0;  // see README.md for Starting, Stopping Changing Tempo
var gdc_cycle_beats = 8;  // number of beats per cycle
var MAX_NET_DELAY = 2.4;
var LATENCY = 0.05;

// key presses are enabled when we get a timemap, allowing us to record beats
// Keyboard must be selected as Input for
var key_presses_play_drums = false;

var COMPOSER = 1;
var LISTENER = 2;
var PERFORMER = 3;

var rtt_send_times_dict = {};
var received_indices_dict = new Set();
const num_rtts_to_send = 20;
var reported_rtts = new Array(num_rtts_to_send-1);

var RTO_lower_bound = 100;
var timeoutID;

function send_rtt_test(rtt_index){
    if (client_validated_by_server) {return;}
    o2ws_send_start("!elbs/rtttest", 0, "i", true);
    o2ws_add_int32(rtt_index);
    rtt_send_times_dict[rtt_index] = new Date().getTime();
    showMessage("rtttest: sending RTT test " + rtt_index + " at time " + rtt_send_times_dict[rtt_index] + "\n");
    o2ws_send_finish();
}

function elbs_rtttest_handler(timestamp, typespec, info){
    let now = new Date().getTime();
    let rtt_index = o2ws_get_int32();
    let report_rtt = now - rtt_send_times_dict[rtt_index];
    reported_rtts[rtt_index] = report_rtt;
    if ( rtt_index >= num_rtts_to_send){ 
        const min_rtt = Math.min(...reported_rtts.filter(value => value > 0));
        showMessage("rtttest: reporting min TT " + min_rtt / 2.0 + "\n");
        o2ws_send_start("!elbs/registertt", 0, "d", true);
        // send transmission time - divide by 2
        o2ws_add_double(min_rtt / 2.0);
        o2ws_send_finish();
        return; 
    }
    setTimeout(function () {
        send_rtt_test(rtt_index + 1);
    }, 10 * (rtt_index + 1));
}

// test for conditions that change state and start drumming
function client_state_poll() {
    // print("client_state_poll " + client_state);
    if (client_state == "playing") {
        if (sched_bps == 0) {
            client_state = "ready";
            schedule_drums_id += 1;  // cancel metronome drumming
        }
    } else if (client_state == "init") {
        // poll context here because it does not switch to "running" immediately
        // after calling audioContext.resume():
        if (audioContext.state == "running") {
            o2ws_set_time_reference(get_watime_reliably);
            audio_initialize_nodes();
            client_state = "syncing";
        }
    } else if (client_state == "syncing") {
        if (timemap_set && o2ws_clock_synchronized && client_validated_by_server){
            /* && mode_info_initialized */
            // what happens if the correct password has been entered,
            // but the time for which the mode was scheduled to start 
            // has already passed? (i.e. it took too long for the 
            // client to enter the correct password)
            // check to see if the mode start time is still valid
            // if not, calculate the beat that begins the next mode cycle
            // and start the mode then
            /* start_schedule_mode(); // defined in gdcmodes.js.  */
            // TODO: should this be moved? outside if statement,
            print("client_state_poll: changing to ready state");
            client_state = "ready";
        }
    } else if (client_state == "ready") {
        if (sched_bps > 0) {
            client_state = "playing";
            start_schedule_drums(); 
        }
    } 
}


// handle status callback from o2ws
function o2ws_status_msg(message) {
    let t = o2ws_time_get(),
        tstr = t.toFixed(3),
        bstr = sched_time_to_beat(t).toFixed(2);
    showMessage("Status@(" + tstr + "s,b" + bstr + "): " + message + "\n");
}


// handle error callback from o2ws
function o2ws_on_error(message) {
    showMessage(message);
}


function client_init() {
    o2ws_status_msgs_enable = true;
    o2ws_clock_msgs_enable = false; // filter out clock ping msg printing
    showMessage("Connecting...");
    o2ws_initialize("gdc");
    o2ws_method_new("/gdc/timemap", "ittd", true, timemap_handler, null);
    o2ws_method_new("/elbs/clientupdateclasses", "iii", true, elbs_clientupdateclasses_handler, null);
    o2ws_method_new("/elbs/clientvoteconfirmed", "i", true, elbs_clientvoteconfirmed_handler, null);
    o2ws_method_new("/elbs/rtttest", "i", true, elbs_rtttest_handler, null);
    o2ws_method_new("/elbs/everyonevoted", "sssss", true, elbs_everyonevoted_handler, null);
    o2ws_method_new("/elbs/sessioninterrupt", "", true, elbs_sessioninterrupted_handler, null);
    o2ws_method_new("/elbs/listenerposchanged", "iiit", true, elbs_listenerposchanged_handler, null);
    o2ws_method_new("/elbs/midisgenerating", "i", true, elbs_midisgenerating_handler, null);
    o2ws_method_new("/elbs/midisready", "s", true, elbs_midisready_handler, null);
    o2ws_method_new("/elbs/validated", "", true, elbs_validated_handler, null);

    o2ws_method_new("/elbs/thdm", "it", true, elbs_thdm_handler, null); //
    if (user_type == PERFORMER){
        o2ws_method_new("/elbs/ctocp", "iiit", true, elbs_c2cp_hit_handler, null);
    }

    if (user_type == LISTENER){
        o2ws_method_new("/elbs/lphit", "iiit", true, elbs_listener_performer_hit_handler, null);
        o2ws_method_new("/elbs/blmm", "s", true, elbs_bad_listener_move_message_handler, null);
    }else{
        o2ws_method_new("/elbs/phdm", "it", true, elbs_phdm_handler, null); //
    }

    if (user_type == COMPOSER){
        o2ws_method_new("/elbs/bdcm", "s", true, elbs_bad_drawing_connection_handler, null); //
    }

}


// print the time every second (useful to know if we are still alive)
// see initial call to showTime() in client_init() below
function showTime() {
      setTimeout(showTime, 1000);
      showMessage("show time: " + o2ws_time_get());
}


function showMessage(text) {
    console.log(text);
    hprint(text);
}


// ********** WEB AUDIO **********
// there are 3 faders for my drum, other drums, beat drums.
// there are also initial values for the faders in case the user
// adjusts gain before the gain nodes can be created. E.g., 
// when mydrum_gain is created, it's initial gain is set to
// mydrum_gain_value, which holds the current slider value.
var mydrum_gain_value = 0.5;
var others_gain_value = 0.5;
var beat_gain_value = 0.5;


function audio_initialize_nodes() {
    mydrum_gain = audioContext.createGain();
    //mydrum_gain.gain.value = mydrum_gain_value;
    mydrum_gain.connect(audioContext.destination);

    others_gain = audioContext.createGain();
    //others_gain.gain.value = others_gain_value;
    others_gain.connect(audioContext.destination);

    beat_gain = audioContext.createGain();
    //beat_gain.gain.value = beat_gain_value;
    beat_gain.connect(audioContext.destination);
}


// play "metronome" drum on beats. id insures only one instance of this
// "process" is active (only one scheduled call to schedule_drums).
// Also terminates when client_state is not "playing"
var schedule_drums_id = 0;


function start_schedule_drums() {
    schedule_drums_id += 1;
    // run schedule 1/4 beat ahead of ideal beat time so allow for delays
    sched_cause(Math.ceil(get_beat()) + 0.75,
                schedule_drums, schedule_drums_id);
}


function schedule_drums(id)
{      
    if (id != schedule_drums_id) return;
    if (client_state != "playing") return;
    if (sched_bps == 0.0) {  // we stopped. Don't play anything more.
        return;
    }
    // note that sched_beat is 0.25 beats before the desired downbeat
    // the bass drum sound attack is about 25ms after the soundfile starts,
    // so we want to schedule 25ms early:
    let beat = sched_time_to_beat(sched_beat_to_time(sched_beat + 0.25) -
                                  0.025);
    // -1 => no ID
    play_drum(drum_buffers[0][0], beat, beat_gain, -1);
    // just in case we get behind, we'll skip to the next beat
    let next_beat = Math.ceil(get_beat() + 0.5) - 0.25;  // 0.25 early
    // print("schedule_drums: get_beat()", get_beat(), "sched_beat", sched_beat,
    //       "next_beat", next_beat, "now", o2ws_time_get());
    sched_cause(next_beat, schedule_drums, id);
}


// play a sound at the given o2 time. drum_snd is a Web Audio buffer
// provided to the callback passed to decodeAudioData.
// beat is the "ideal" beat time or zero for immediate play start.
// Assume beat is slightly after the current time (get_beat()).
// beat should never be far in the future. If it is slightly in
// the past, we'll play immediately (as soon as possible).
// id is the player's id, used to send "hit" event to scoreview
function play_drum(drum_snd, beat, gain_node, id)
{
    let source = audioContext.createBufferSource();
    if (!gain_node) {
        gain_node = others_gain;
    }
    source.buffer = drum_snd;
    source.connect(gain_node);
    let watime = 0;
    // if called directly from keydown, play immediately
    let when = (beat > 0 ? sched_beat_to_time(beat) : 0);
    if (when == NEVER) {
        print("play_drum: skip because tempo is zero");
        return;  // tempo has stopped, so ignore this
    } else if (when > 0) {
        watime = o2_to_watime(when);
    }
    // print("play_drum start at " + when + " local time " + get_watime());

    if (watime < get_watime()) {
        print("fixing watime");
        watime = get_watime();
    }
    source.start(watime);
    if (id >= 0) {  // not the metronome drum
        // note: no printing for metronome drum
        print("play_drum: ", id, "time", o2ws_time_get(), "beat", beat,
              "watime", watime);
        // scoreview.drumhit(id, beat);
    }

}


// ********* MESSAGE HANDLERS *********

function real_tempo_change(next_tempo_epoch, time, beat, bps) {
    tempo_epoch = next_tempo_epoch;
    sched_set_timemap(time, beat, bps);
    tempo_ctrl.locked = false;
    timemap_set = true;
}


// helper function for controlling tempo: 
//    sets tempo and releases tempo_ctrl.lock
function tempo_change(next_tempo_epoch, time, beat, bps) {
    let now = o2ws_time_get();
    print("tempo_change @", o2ws_time_get(), "epoch", next_tempo_epoch,
          "time", time, "beat", beat, "bps", bps);
    if (sched_bps == 0) {
        if (now < time) {
            setTimeout(tempo_change, (time - now) * 1000,
                       next_tempo_epoch, time, beat, bps);
            return;
        }  // else fall through and set timemap
    } else if (sched_time_to_beat(now) < beat) {
        print("    scheduling tempo_change: now", now, "now->beat",
              sched_time_to_beat(now), "beat", beat);
        // don't schedule a call back to tempo_change() -- there are subtle
        // timing issues. We could wake up 1ms early and immediately
        // reschedule, a rescheduling loop stops time from advancing,
        // turning it into an infinite loop.
        sched_cause(beat, real_tempo_change, next_tempo_epoch, time, beat, bps);
        return;
    }
    real_tempo_change(next_tempo_epoch, time, beat, bps);

}


// /gdc/timemap epoch time beat bps
//     message is sent when you first connect to the server,
//     initializes your tempo and client_state.
function timemap_handler(timestamp, address, typespec, info) {
    
    let next_tempo_epoch = o2ws_get_int32();
    let time = o2ws_get_time();
    let beat = o2ws_get_time();
    let bps = o2ws_get_double();
    tempo_ctrl.locked = true;

    if ((sched_bps > 0.0) && (bps <= 0.0) && (client_state == "playing")){
        stop_start.set_state(true, false);
        sched_cause(beat, function(){ 
            stop_start.set_state(false, false); 
            key_presses_play_drums = false;
        });
    }

    else if ((sched_bps <= 0.0) && (bps > 0.0) && (client_state == "ready")){
        stop_start.set_state(true, true);
        sched_cause(beat, function(){ 
            stop_start.set_state(false, true); 
            if (user_type != LISTENER){
                key_presses_play_drums = true;
            }
        });
    }
    
    if (bps > 0) {
        tempo_ctrl.bpm = bps * 60;
    } 

    print("timemap_handler: epoch ", next_tempo_epoch, "time_base",
          time, "beat_base", beat, "bps", bps, "sched_bps", sched_bps,
          "now", o2ws_time_get() /*, xstring */);

    

    tempo_change(next_tempo_epoch, time, beat, bps);
}


function elbs_validated_handler(timestamp, typespec, info) {
    client_validated_by_server = true;
    if (timemap_set && o2ws_clock_synchronized) { client_state = "ready"; }
}

function elbs_midisgenerating_handler(timestamp, typespec, info) {
    const error_code = o2ws_get_int32();
    // if error_code = 0 implicit
    let settext = "Session has been stopped. Once server " +
        "finishes downloading MIDI files, they can be downloaded."
    if (error_code == 1){
        settext = "Session has been interrupted after one user disconnected. Once server " +
         "finishes downloading MIDI files, they can be downloaded."
    }

    after_stopped.set_text(settext);
    chat_window.update("Server", settext);
    after_stopped.set_visible(true);
}

function downloadFile(midiFileName) {
    let request = new XMLHttpRequest();
    request.open('POST', midiFileName, true);
    request.setRequestHeader('Content-Type', 'audio/midi');
    request.responseType = 'blob';
    request.send();
}

function elbs_midisready_handler(timestamp, typespec, info) {
    midi_file_names_string = o2ws_get_string(); 
    const midi_file_names = midi_file_names_string.split(",").slice(0, -1);
    after_stopped.set_midis_list(midi_file_names);
    chat_window.update("Server", "MIDI files downloadable - if MIDI files cannot be opened," +
        " try a browser that allows insecure resources. Session has ended");
    client_state = "finished";
    // set sched bps to 0, this step only happens after the ensemble is stopped anyway
    sched_bps = 0.0;
}

function elbs_clientvoteconfirmed_handler(timestamp, typespec, info) {
    client_voted_ = o2ws_get_int32(); 
    // 1 if client vote was registered, 0 if not
    if (client_voted_ == 0){
        client_voted = false;
        signin_entry.set_text("Vote to start the session.");
    }else{
        client_voted = true;
        signin_entry.set_text("Wait for others to vote to start the session.");
    }
}

function elbs_sessioninterrupted_handler(timestamp, typespec, info){

}

// todo: don't declare this as a separate function
function unlock_listener_last(listener_ID){
    //userinfo_table.unlock_listener(listener_ID);
    userinfo_table.set_listener_state(listener_ID, LS_NORMAL);
}

function elbs_listenerposchanged_handler(timestamp, typespec, info){
    const listener_ID = o2ws_get_int32();
    const nl_xgc = o2ws_get_int32();
    const nl_ygc = o2ws_get_int32();
    const listener_countdown_end_time = o2ws_get_time();

    // update in userinfo table
    userinfo_table.update_listener_position(
        listener_ID, nl_xgc, nl_ygc);
    //userinfo_table.lock_listener(listener_ID, unlock_at_beat);
    userinfo_table.set_listener_countdown_end_time(
        listener_ID, listener_countdown_end_time);
    userinfo_table.set_listener_countdown_start_time(
        listener_ID, get_beat());

    // schedule unlock musically 
    //sched_cause(unlock_at_beat, unlock_listener_last, listener_ID);
    userinfo_table.set_listener_state(listener_ID, LS_COUNTDOWN);
    sched_cause(listener_countdown_end_time, unlock_listener_last, listener_ID);
}


function elbs_everyonevoted_handler(timestamp, typespec, info) {

    if (voting_over_grid_initialized == false){

        IDs_string = o2ws_get_string();
        x_gc_string = o2ws_get_string();
        y_gc_string = o2ws_get_string();

        usernames_string = o2ws_get_string();
        usertypes_string = o2ws_get_string();

        let IDs = IDs_string.split(".");
        let x_gc = x_gc_string.split(".");
        let y_gc = y_gc_string.split(".");

        let usernames = usernames_string.split(".");
        let usertypes = usertypes_string.split(".");

        // because there is a terminating ".", pop the empty elements:
        if (IDs.length > 0 && IDs[IDs.length - 1] == "") {
            IDs.pop();
            x_gc.pop();
            y_gc.pop();
            usernames.pop();
            usertypes.pop();
        }

        console.log("IDs: " + IDs);
        // update positions of all users in the user table.
        userinfo_table.initialize_userinfo_table_after_voting_complete(
            IDs, x_gc, y_gc, usernames, usertypes
        );
        
        showMessage("ensemble voting over\n");
        gridd.initialize_grid();
        voting_over_grid_initialized = true;
        // initialize the grid here
        
    }

    tempo_ctrl.bpm = Math.floor(78);
}


function elbs_c2oc_hit_handler(timestamp, typespec, info) {
    if (voting_over_grid_initialized){
        const sender_id = o2ws_get_int32();
        const played_beat_plus_hval = o2ws_get_time();
        // for audio: do nothing

        // for visuals: register the start beat with every drawnconnectiondisplay 
        // where the source ID is also the sender ID
        gridd.drawn_connections_display.register_traversing_hit(sender_id, played_beat_plus_hval);
    }
}


// for if we are an "active" performer - the performer is attached via
// a drawnconnectiondisplay to the composer that sent the hit
function elbs_c2cp_hit_handler(timestamp, typespec, info){

    if (voting_over_grid_initialized){
        let sender_id = o2ws_get_int32();
        let di_to_play = o2ws_get_int32();
        // TODO - why do we need performer_distance thing? 
        // we can just add them before sending. confirm this once everything else is fixed.
        let performer_distance = o2ws_get_int32();
        let played_beat = o2ws_get_time();
        
        let left_or_right = di_to_play % 2;
        let label_index = (di_to_play - left_or_right) / 2;

        sched_cause((played_beat*1.0 + performer_distance*1.0 + 1.0 + 4.0) - 0.25, 
            elbs_scheduled_hit, label_index, left_or_right, sender_id);

        // and because we're a performer we only have display drawnconnections
        // so we iterate through the drawnconnections and register as appropriate
        gridd.drawn_connections_display.register_traversing_hit(sender_id, played_beat);
        
    }
}


// function elbs_c2oc_hit_handler(timestamp, typespec, info) {
//     if (voting_over_grid_initialized){
//         const sender_id = o2ws_get_int32();
//         const played_beat_plus_hval = o2ws_get_time();
//         // for audio: do nothing

//         // for visuals: register the start beat with every drawnconnectiondisplay 
//         // where the source ID is also the sender ID
//         gridd.drawn_connections_display.register_traversing_hit(sender_id, played_beat_plus_hval);
//     }
// }

function elbs_thdm_handler(timestamp, typespec, info){
    if (voting_over_grid_initialized){
        const sender_id = o2ws_get_int32();
        const played_beat = o2ws_get_time();
        gridd.drawn_connections_display.register_traversing_hit(sender_id, played_beat);
    }
}

function elbs_bad_drawing_connection_handler(){
    var server_message = o2ws_get_string();
    gridd.drawing_connection.splice_drawing_connection_joints();
    chat_window.update("Server", server_message);
}

function elbs_bad_listener_move_message_handler(){
    var server_message = o2ws_get_string();
    userinfo_table.set_listener_state(o2ws_bridge_id, LS_NORMAL);
    chat_window.update("Server", server_message);
}

// handler for the listener to register performer hits
function elbs_listener_performer_hit_handler(){

    var sender_id = o2ws_get_int32();
    var di_to_play = o2ws_get_int32();
    var listener_distance = o2ws_get_int32();
    var played_beat = o2ws_get_time();

    // audio: if we are unlocked, keep track of the last beat played
    const liq_state = userinfo_table.get_listener_state(o2ws_bridge_id);
    if (liq_state == LS_NORMAL || liq_state == LS_DRAGGING){
        listener_latest_beat = played_beat;
    }

    let left_or_right = di_to_play % 2;
    let label_index = (di_to_play - left_or_right) / 2;
    // TODO: check this? 
    sched_cause((played_beat*1.0 + listener_distance*1.0 + 4.0) - 0.25, 
        elbs_scheduled_hit, label_index, left_or_right, sender_id);

    // visuals: register propagating hit
    // display beat gets passed as argument
    //gridd.all_propagating_hits.register_other_propagating_hit(sender_id, played_beat + 4.0);
    gridd.all_ph_centers.register_other_ph(played_beat+4.0, sender_id);
    // gridd.all_ph  
}

function elbs_phdm_handler(){
    var sender_id = o2ws_get_int32();
    var played_beat = o2ws_get_time();
    // display beat gets passed as argument
    //gridd.all_propagating_hits.register_other_propagating_hit(sender_id, played_beat + 4.0);
    gridd.all_ph_centers.register_other_ph(played_beat+4.0, sender_id);
}
  

function elbs_scheduled_hit(label_index, left_or_right, sender_id) {
    console.log("chit: elbs_scheduled_hit entered")
    let play_at_beat = sched_beat + 0.25;
    // decide whether or not to play drum based on the step of the
    // current mode in which it is scheduled to be played

    if (user_type == PERFORMER){
        if (gridd.drawn_connections_display.check_if_connection_exists(sender_id, o2ws_bridge_id)){
            play_drum(drum_buffers[left_or_right][label_index], play_at_beat,
                others_gain, sender_id);   
        }else{
            console.log("connection does not exist")
        }
        return;
    }else if (user_type == LISTENER){
        const listener_state = userinfo_table.get_listener_state(o2ws_bridge_id);
        if (listener_state == LS_NORMAL || listener_state == LS_DRAGGING){
            play_drum(drum_buffers[left_or_right][label_index], play_at_beat,
                others_gain, sender_id); 
        }
        return;
    }
    else{
        play_drum(drum_buffers[left_or_right][label_index], play_at_beat,
            others_gain, sender_id); 
    }
    
}



function elbs_clientupdateclasses_handler(timestamp, typespec, info){
    // if the classes are updated, any voting gets nullified
    client_voted = false;

    let num_composers_ = o2ws_get_int32();
    let num_listeners_ = o2ws_get_int32();
    let num_performers_ = o2ws_get_int32();

    userinfo_table.num_composers = num_composers_;
    userinfo_table.num_listeners = num_listeners_;
    userinfo_table.num_performers = num_performers_;
}


function scheduled_hit(is_conductor, label_index, left_or_right, sender_id) {
    let play_at_beat = sched_beat + 0.25;
    play_drum(drum_buffers[left_or_right][label_index], play_at_beat,
        others_gain, sender_id);
}


function o2_to_watime(time) {
    return time - o2ws_global_minus_local;
}


// get_watime() is not reliable -- sometimes it returns the same value
// over and over, maybe when called after a short delay or when the
// main thread is busy. Use o2ws_local_time() instead, but we need
// to synchronize to get_watime() as follows:
// Keep the offset from o2ws_local_time to get_watime in a variable.
// Whenever it has been >1s since last_sync_time, recalculate the
// offset until we get two consistent readings in a row. Limit the
// change to offset by 10ms in case get_watime is bogus -- 10ms will
// be small enough that things should keep working if get_watime was
// wrong, and should get us on track eventually if get_watime was right.

var last_sync_time = -99;
var local_time_offset = 0; // watime() - o2ws_local_time()

function get_watime_reliably() {
    let elapsed_time = 1.0;
    var lto;
    let local = o2ws_time_from_date();
    if (local - last_sync_time > 1) {  // do synchronization
        while (elapsed_time > 0.001) { // all this must run in 1ms
            let audio = get_watime();
            if (last_sync_time == -99) { // first time assume watime is correct
                lto = audio - local;
            } else {
                let new_offset = audio - local;
                if (new_offset - local_time_offset > 0.01) {
                    lto = local_time_offset + 0.01;
                } else if (new_offset - local_time_offset < -0.01) {
                    lto = local_time_offset - 0.01;
                } else {
                    lto = new_offset;
                }
            }
            let local2 = o2ws_time_from_date();
            elapsed_time = local2 - local;
            local = local2;
        }
        local_time_offset = lto;
    }
    return local + local_time_offset;
}


function get_watime() {
    return audioContext.currentTime;
}

var pw_entered = "";
var un_entered = "";


function chat_handler(timestamp, address, typespec, info) {
    let sender_username = o2ws_get_string();
    let sender_message = o2ws_get_string();
    chat_window.update(sender_username, sender_message);
}


function gdc_infoentered_handler(timestamp, address, typespec, info) {
    var is_password = o2ws_get_int32();
    var is_valid_username = o2ws_get_int32();
    print("gdc_infoentered_handler", is_password, is_valid_username);
    if (is_valid_username && is_password) {
        valid_credentials_entered = true;
        signin_entry.hide();
        pw_entered = "";
        chat_window.show();
        return;
    } else {
        if (!is_password) {
            signin_entry.pw_entry.value("Incorrect Password");
        }
        if (!is_valid_username) {
            signin_entry.un_entry.value("No empty strings or '.'s");
        }
    }
}


var last_drum_hit_time = 0;  // filter multiple hits within 10ms

function send_nop_message(){
    o2ws_send_start("!elbs/nop", 0, "", true);
    o2ws_send_finish();
}

// assumes all players have access to same sound bank
// drum hit defaults to my_drum_index when called with no arguments
// drum_hit -> my_drum_hit: 
var interval_ID;

function my_drum_hit(is_right) {
    // ignore if drum was hit withing 10 msec
    console.log("my drum hit")
    let now = o2ws_time_get();
    let beat = sched_time_to_beat(now);
    // accept the new hit if clock goes backward or if 10 msec has passed:
    if (now >= last_drum_hit_time && now < last_drum_hit_time + 0.01) {
        return;
    }
    last_drum_hit_time = now;

    // send hit to server
    // bijection
    let di_to_send = my_drum_index * 2;
    if (is_right) {
        di_to_send = (my_drum_index * 2) + 1;
    }

    // todo - if we are stopped (sched_bps < 0.0) do not register traversing hit.
    // setting lower bound on RTO - 
    // console.log(RTO_lower_bound)
    // console.log(timeoutID)
    if (voting_over_grid_initialized){

        if (user_type == COMPOSER){
            gridd.drawn_connections.register_traversing_hit(beat);
            o2ws_send_start("!elbs/chit", 0, "iit", true);
            o2ws_add_int32(o2ws_bridge_id);
            o2ws_add_int32(di_to_send);
            o2ws_add_time(beat);
            o2ws_send_finish();
            o2ws_status_msg("composer my_drum_hit: beat " + beat);

        }
        else if (user_type == PERFORMER){
            // beat played = display beat
            //gridd.all_propagating_hits.register_own_propagating_hit(o2ws_bridge_id, beat);
            gridd.all_ph_centers.register_own_ph(beat);
            o2ws_send_start("!elbs/phit", 0, "iit", true);
            o2ws_add_int32(o2ws_bridge_id);
            o2ws_add_int32(di_to_send);
            o2ws_add_time(beat);
            o2ws_send_finish();
            o2ws_status_msg("composer my_drum_hit: beat " + beat);
        }

    }
}



class Clickable {
    constructor(x, y, w, h, label, init_val, callback) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h
        this.label = label;
        this.val = init_val
        this.callback = callback
        mouse_drag.add_client(this)
        this.callback(this, init_val)
    }

    draw() {  // default is a box with an X when val is true
        stroke(128);
        strokeWeight(2);
        fill(255);
        let x = this.x, y = this.y, w = this.w, h = this.h;
        rect(x, y, w, h);
        if (this.val) {
            stroke(0);
            line(x + 2, y + 2, x + w - 2, y + h - 2);
            line(x + w - 2, y + 2, x + 2, y + h - 2);
        }
        textSize(15);
        noStroke();
        fill(0);
        text(this.label, x + w + 6, y + 12);
    }
        
    contains(x, y) {
        let ret = x >= this.x && x <= this.x + this.w &&
                  y >= this.y && y <= this.y + this.h;
        return ret;
    }

    start_drag() { }

    dragged(dx, dy) { }

    end_drag() {
        if (this.contains(mouseX, mouseY)) {
            this.val = !this.val;
            this.callback(this, this.val);
        }
    }
}


class Button {
    constructor(x, y, w, h, label, action) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h
        this.label = label;
        this.action = action
        this.dragging = false
        mouse_drag.add_client(this)
    }

    draw() {  // default is a box with an X when val is true
        stroke(128);
        strokeWeight(2);
        fill(this.dragging ? color(128, 255, 128) : 255);
        let x = this.x, y = this.y, w = this.w, h = this.h;
        rect(x, y, w, h);
        textSize(12);
        noStroke();
        fill(0);
        text(this.label, x + 6, y + 12);
    }
        
    contains(x, y) {
        let ret = x >= this.x && x <= this.x + this.w &&
                  y >= this.y && y <= this.y + this.h;
        return ret;
    }

    start_drag() { 
        this.dragging = true
    }

    dragged(dx, dy) { }

    end_drag() {
        if (this.contains(mouseX, mouseY)) {
            this.action(this);
        }
        this.dragging = false;
    }
}





class SetupEnsembleInfo{
  
    constructor(x,y){
      this.x = x;
      this.y = y;
      this.w = 400;
      this.h = 250;
      this.circle_size = 30;
      this.button_x = this.x + 18;
      this.button_y = this.y + 170;
      this.button_width = 260;
      this.button_height = 50;
    }

    mouse_pressed(){
        if (this.contains(mouseX, mouseY) && this.check_ready() && !client_voted){
            o2ws_send_start("!elbs/votetostart", 0.0, "");
            o2ws_send_finish();
        }
    }
    
    contains(x,y){
      return x >= this.button_x && x <= this.button_x + this.button_width &&
          y >= this.button_y && y <= this.button_y + this.button_height;
    }
    
    check_ready(){
        return userinfo_table.num_composers >= 1 && 
            userinfo_table.num_listeners >= 1 && 
            userinfo_table.num_performers >= 1;
    }


    draw(){

        noStroke();
        textSize(27);
        fill(255);
        rect(this.x, this.y, this.w, this.h);

        fill(composer_color);
        circle(this.x + 30, this.y + 30, 30);
        
        fill(0);
        text("Composers: " + userinfo_table.num_composers, this.x + 60, this.y + 40);

        fill(performer_color);
        circle(this.x + 30, this.y + 80, 30);
        fill(0);
        text("Performers: " + userinfo_table.num_performers, this.x + 60, this.y + 90);

        fill(listener_color);
        circle(this.x + 30, this.y + 130, 30);
        fill(0);
        text("Listeners: " + userinfo_table.num_listeners, this.x + 60, this.y + 140);
        if (this.check_ready() && !client_voted && valid_credentials_entered){
            fill(150);
            stroke(0);
            strokeWeight(3);
            rect(this.button_x, this.button_y, this.button_width, this.button_height);
            noStroke();
            fill(0);
            signin_entry.set_text("Vote to start the session.");
            text("Confirm Ensemble", this.button_x + 18, this.button_y + 34);
        }

    }
    
    
}