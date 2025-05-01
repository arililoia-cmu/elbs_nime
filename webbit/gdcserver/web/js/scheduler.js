// scheduler.js -- schedule future events using beats
//
// Roger B. Dannenberg
// July 2022

// API:
//  sched_init() - initialize the scheduler; cancel any pending events.
//  sched_set_timemap(real_base, beat_base, sched_bps) - set linear mapping from
//      time to beat such that beat_base happens at real_base and tempo
//      is sched_bps. Uses o2ws_time_get() for real time. Precondition is
//      o2ws_clock_synchronized. Must be called before scheduling.
//  sched_time_to_beat(time) - map time to beat
//  sched_beat_to_time(beat) - map beat to time
//  sched_cause(beat, function, p1, p2, ...) - call
//      function(p1, p2, ...) at the given beat time. When function is
//      called, sched_beat is set to the scheduled beat time.

// pending_events is an array of objects containing:
//    beat: the beat time of the event
//    time_advance: how many seconds in advance of beat to wake up
//    fn: the function to call
//    parameters: an array of parameters to pass to fn
// beats are sorted in increasing order
var pending_events
var sched_rbase, sched_bbase, sched_bps;
var sched_beat = 0;  // part of the API: the current logical beat when
    // a scheduled event is dispatched

const NEVER = 1e+10;  // far in the future because tempo is zero

// get the real beat time. This is not the logical or scheduled beat,
// but the "real" beat mapped from real time:
function get_beat() {
    return sched_time_to_beat(o2ws_time_get());
}


function sched_init() {
    // this information is sent from server
    // set sched_bps to 100 so that the initial value on the tempo
    // slider is not NaN
    //sched_bps = (78) / 60.0;
    sched_bps = 1.3;
    pending_events = [];
}


// sched_bps is part of API - has to know what tempo is to know when to stop

function sched_set_timemap(real_base, beat_base, bps_) {
    sched_rbase = real_base;
    sched_bbase = beat_base;
    sched_bps = bps_;
    if (pending_events.length > 0) {
        sched_wakeup_at(pending_events[0].beat);
    }
}


function sched_time_to_beat(time) {
    return sched_bbase + (time - sched_rbase) * sched_bps;
}


function sched_beat_to_time(beat) {
    if (sched_bps == 0) {  // music has stopped, future beat will never happen
        return NEVER;  // return a very big number to avoid NaNs
    }
    return sched_rbase + (beat - sched_bbase) / sched_bps;
}

var sched_wakeup_id = 0;
var sched_timer_id = null;


function sched_wakeup_at(beat) {
    sched_wakeup_id += 1;
    let time = sched_beat_to_time(beat);
    let delay = time - o2ws_time_get();
    // console.log("schedule_wakeup_at beat " + beat + " delay " + delay);
    if (sched_timer_id != null) {  // cancel already scheduled wakeup
        clearTimeout(sched_timer_id);
    }
    if (delay < 0.0) {  // we're late! run the function NOW
        sched_wakeup(sched_wakeup_id, beat);
        return;
    }
//    console.log("    setTimeout sched_wakeup id " + sched_wakeup_id + " beat " + beat +
//                " delay ms " + Math.trunc(delay * 1000));
    // not sure we need max(1, delay) here, but very small delays seem
    // to just run without delay, stop time from advancing, and possibly
    // cause an infinite loop, so max(1, delay) seems safer. Also, we
    // round up because when we wake up, we want it to be time to
    // schedule something at beat, not before beat.
    sched_timer_id = setTimeout(sched_wakeup,
                                Math.max(1, Math.ceil(delay * 1000)),
                                sched_wakeup_id, beat);
}

// dispatch events that are pending at or very near the given beat
function sched_wakeup(id, beat) {
//    console.log("sched_wakeup id " + id + " expecting " + sched_wakeup_id + 
//                " beat " + beat);
    if (id != sched_wakeup_id) {  // somehow, this is not the currently
        return;                   // scheduled wakeup event.
    }
    // run anything (past) ready to run
    while (pending_events.length > 0 &&
           pending_events[0].beat <=  beat) {
        let event = pending_events.shift();  // remove first/next event
        sched_beat = event.beat;  // make the current logical beat available
//        console.log("    dispatch " + event.fn.name + " at " + sched_beat);
        event.fn.apply(null, event.parameters);
    }
    if (pending_events.length > 0) {  // set timeout for next event
        let event = pending_events[0];
//        console.log("    call sched_wakeup_at " + event.beat);
        sched_wakeup_at(event.beat);
    }
}

function sched_cause(beat, fn, ... args) {
    // console.log("sched_cause: beat = " + beat);
    // precondition: if an event is pending, a setTimeout callback will
    //    use sched_wakeup to dispatch it, so we do not need to request
    //    a wakeup if the next event does not change
    // insert event by bubbling from the end
    pending_events.push(null);
    let insert_loc = pending_events.length - 1;
    while (insert_loc > 0 && pending_events[insert_loc - 1].beat > beat) {
        pending_events[insert_loc] = pending_events[insert_loc - 1];
        insert_loc -= 1;
    }
    pending_events[insert_loc] = {beat: beat, fn: fn, parameters: args};
    if (insert_loc == 0) {  // the new event is the NEXT event
        sched_wakeup_at(beat);
    }
}
