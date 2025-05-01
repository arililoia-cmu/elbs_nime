// elbs_ui.js -- conductor web app main file
//
// Ari Liloia and Roger B. Dannenberg
// Aug 2022

// common setup functions
function ui_setup() {
    hlines(30);  // restrict number of lines retained
    hprecision(3);  // limit floating point precision for status output
    sched_init();
    const AudioContextConstructor =
            window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextConstructor();

    mouse_drag = new Mouse_drag();

    o2ws_method_new("/gdc/chat", "ss", true, 
                    chat_handler, null); 
    // info entered into sign area
    o2ws_method_new("/gdc/infoentered", "ii", true, 
                    gdc_infoentered_handler, null);
    // all info about clients in elbs
    client_init();  // general GDC client initialization
    valid_credentials_entered = false;
    print("ui_setup COMPLETED");
}


// common drawing functions
//
function ui_draw(player_or_conductor) {
    if (audioContext.state == "suspended") {
        audioContext.resume();
    }

    client_state_poll();
    background(background_color);
}


class Mouse_drag {
    constructor() {
        this.clients = [];  // list of all possible mouse event consumers
        this.mouse_drag_handler = null;
    }

    add_client(client) {
        this.clients.push(client);
    }

    mouse_pressed() {
        this.start_x = mouseX;
        this.start_y = mouseY;
        for (const client of this.clients) {
            // print("check contains on", client)
            if (client.contains(mouseX, mouseY)) {
                this.mouse_drag_handler = client;
                client.start_drag();
                return;
            }
        }
    }

    mouse_dragged() {
        if (this.mouse_drag_handler) {
            this.mouse_drag_handler.dragged(mouseX - this.start_x,
                                            mouseY - this.start_y);
        }
    }

    mouse_released() {
        if (this.mouse_drag_handler) {
            this.mouse_drag_handler.end_drag();
            this.mouse_drag_handler = null;
        }
    }
}


function mousePressed() {
    mouse_drag.mouse_pressed();
    gridd.mouse_pressed();
    setup_ensemble_info.mouse_pressed();
    after_stopped.mouse_pressed();
    if (user_type == PERFORMER){
        if (scrolling_view.contains(mouseX, mouseY)){
            scrolling_view.mouse_pressed();
        }
    }
    
//    return false;  -- interferes with HTML text box
}


function mouseDragged() {
    mouse_drag.mouse_dragged();
}


function mouseReleased() {
    mouse_drag.mouse_released();
    gridd.mouse_released();
    after_stopped.mouse_released();
    if (user_type == PERFORMER){
        scrolling_view.mouse_released();
    }
//    return false;
}


// a web page refered to these kinds of buttons as "chips". I don't know
// if that common lingo or not.
class Chip_choice {
    constructor(x, y, w, action) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.next_x = x;
        this.next_y = y;
        this.chips = [];
        this.selection = null;
        this.action = action;
        this.unselected_color = "lightgray";
    }

    // add a labeled selectable button to the list
    add(label, w) {
        // layout: add to existing line or start new one
        if ((this.next_x - this.x) + w > this.w) {
            this.next_x = this.x;  // new row starts at x
            this.next_y = this.next_y + 22;  // new row below current row
        }
        this.chips.push({label: label, x: this.next_x, y: this.next_y,
                         w: w, selected: false, enabled: true});
        this.next_x += w + 2;
    }

    select(label) {
        for (let chip of this.chips) {
            chip.selected = (chip.label == label);
            print(chip.label, ".selected->", chip.selected);
        }
        this.selection = label;
        print("selection", label);
    }

    set_enabled(label, enabled) {
        for (let chip of this.chips) {
            chip.enabled = enabled;
        }
    }

    draw() {
        noStroke();
        // show the area allocated to Chip_choice:
        // rect(this.x, this.y - 15, this.w, 20);
        for (let chip of this.chips) {
            fill(chip.selected ? 100 : this.unselected_color);
            circle(chip.x + 10, chip.y - 5, 20);
            rect(chip.x + 10, chip.y - 15, chip.w - 20, 20);
            circle(chip.x + chip.w - 10, chip.y - 5, 20);
            fill(chip.selected ? "white" : "black");
            text(chip.label, chip.x + 10, chip.y);
        }
        fill(0);
    }

    contains(x, y) {
        return x >= this.x && x <= this.x + this.w &&
               y >= this.y - 15 && y <= this.next_y + 5;
    }

    start_drag() { }

    // movement during mousedown aborts selection
    dragged(dx, dy) {
        if (Math.abs(dx) + Math.abs(dy) > 5) {
            mouse_drag.mouse_drag_handler = null;
        }
    }

    // at end, if we are over an enabled button, select it; otherwise, we
    // keep the old label.
    end_drag() {
        let final_label = this.selection;
        for (const chip of this.chips) {
            print("search", chip.label);
            if (mouseX > chip.x && mouseX < chip.x + chip.w &&
                mouseY > chip.y - 15 && mouseY < chip.y + 5 && chip.enabled) {
                final_label = chip.label;
                print("found", chip.label);
                break;
            }
        }
        // Important! action is called before changing this.selection
        if (this.action && this.selection != final_label) {
            this.action(final_label);
        }
        this.select(final_label);
    }
}


class Hslider { // horizontal slider with label, range is 0 to 1
    constructor(x, y, w, label, init_val, callback) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.tw = 55;  // width of text area
        this.label = label;
        this.val = init_val;
        this.callback = callback;
        mouse_drag.add_client(this);
        this.callback(this, init_val);
    }

    draw() {
        let x = this.x;
        let y = this.y;
        let w = this.w;
        let tw = this.tw;

        fill(0);
        noStroke();
        textSize(15);
        text(this.label, x, y);

        y -= 5;  // raise the slider a bit to center on text
        stroke(0);
        strokeWeight(2);
        line(x + tw, y, x + w, y);
        strokeWeight(0);
        fill("darkgreen");
        ellipse(this.get_x(), y, 12, 12);
    }

    get_x() { return map(this.val, 0, 1, this.x + this.tw, this.x + this.w); }

    get_val(x) { return map(x, this.x + this.tw, this.x + this.w, 0, 1); }

    contains(x, y)  {
        let ret = abs(this.get_x() - x) < 10 &&
                  y >= this.y - 12 && y <= this.y + 2;
        // console.log("contains: " + ret);
        return ret;
    }

    start_drag()    { this.start_x = this.get_x();
                      console.log("start drag"); }

    dragged(dx, dy) {
        let x = this.start_x + dx;
        x = max(x, this.x + this.tw);
        x = min(x, this.x + this.w);
        this.val = this.get_val(x);
        this.callback(this, this.val);
        console.log("dragged");
    }

    end_drag()  { }
}



class Output_ctrl {
    constructor(x, y, w) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.chips = new Chip_choice(col2 + 20, y, w - (col2 + 20) - 5,
                                     my_drums);
        for (let i = 1; i < DRUM_URLS.length; i++) {
            this.chips.add(DRUM_URLS[i][2], DRUM_URLS[i][3]);
        }
        this.chips.select("Conga");
        mouse_drag.add_client(this);
    }

    draw() {
        let x = this.x;
        let y = this.y;
        textSize(15);
        fill(0);
        text("My Drums: ", x, y);
        this.chips.draw();
    }

    contains(x, y)  {
        return this.chips.contains(x, y);
    }
    start_drag()    { this.chips.start_drag(); }
    dragged(dx, dy) { this.chips.dragged(dx, dy); }
    end_drag()      { this.chips.end_drag(); }
}


// thanks to heavy.ai for "Dutch Field" color palette:
// const USER_COLORS = ["#e60049", "#0bb4ff", "#50e991", "#e6d800", "#9b19f5",
//                      "#ffa300", "#dc0ab4", "#b3d4ff", "#00bfa0"];

// thanks to heavy.ai for "Spring Pastels" color palette:
const USER_COLORS = ["#fd7f6f", "#7eb0d5", "#b2e061", "#bd7ebe", "#ffb55a",
                     "#ffee65", "#beb9db", "#fdcce5", "#8bd3c7"]
      
// listener states
const LS_NORMAL = 0; // unlocked
const LS_DRAGGING = 1; // unlocked
const LS_UNCONFIRMED = 2; // unlocked
const LS_COUNTDOWN = 3; // locked

class Userinfo_table {
    constructor(x, y, h) {
        this.x = x;
        this.y = y;
        this.h = h;
        this.usernames = [];
        this.admin_statuses = [];
        this.IDs = [];
        this.user_types = [];
        this.x_gc = [];
        this.y_gc = [];
        this.listener_states = [];
        this.listener_countdown_end_times = [];
        this.listener_countdown_start_times = [];

        this.id_map = {};

        // information that can be deduced from
        // other information in the table but is cached for ease of used
        this.num_listeners = 0;
        this.num_composers = 0;
        this.num_performers = 0;
    }

    get_info_string(){
        let info_string = "";
        for (let i=0; i<this.IDs.length; i++){
            info_string += this.IDs[i] + ": " + this.user_types[i] + " at " 
                + this.x_gc[i] + ", " + this.y_gc[i] + "\n";
        }
        return info_string;
    }

    initialize_userinfo_table_after_voting_complete(IDs_, x_gc_, y_gc_, usernames_, usertypes_){

        this.id_map = {};

        this.IDs = IDs_;
        this.x_gc = new Array(this.IDs.length);
        this.y_gc = new Array(this.IDs.length);
        this.usernames = new Array(this.IDs.length);
        this.user_types = new Array(this.IDs.length);
        this.listener_states = new Array(this.IDs.length).fill(0);
        this.listener_countdown_start_times 
            = new Array(this.IDs.length).fill(0);
        this.listener_countdown_end_times 
            = new Array(this.IDs.length).fill(0);

        let num_l = 0;
        let num_p = 0;
        let num_c = 0; 

        for (let i = 0; i < this.IDs.length; i += 1) {
            this.id_map[this.IDs[i]] = i;
            this.x_gc[i] = x_gc_[i]
            this.y_gc[i] = y_gc_[i];
            this.usernames[i] = usernames_[i];
            this.user_types[i] = parseInt(usertypes_[i]);
            if (this.user_types[i] == COMPOSER){
                num_c += 1;
            }
            if (this.user_types[i] == PERFORMER){
                num_p += 1;
            }
            if (this.user_types[i] == LISTENER){
                num_l += 1;
            }
            // TODO - remove references to admin status
            // or make it the default
            this.admin_statuses[i] = true;
        }

        if ((num_l != this.num_listeners) || (num_c != this.num_composers) || (num_p != this.num_performers)){
            while(true){
                showMessage("ERROR!!" + num_c + "," + num_l + "," + num_p + " != " + this.num_composers + "," + this.num_listeners + "," + this.num_performers);
            }
        }

        for (let i = 0; i < this.IDs.length; i += 1) {
            console.log("ID: " + this.IDs[i] + ": " + this.x_gc[i] + ", " + this.y_gc[i]);
        }
    }

    update_listener_position(ID, nl_xgc, nl_ygc){
        const l_index = this.id_map[ID];
        this.x_gc[l_index] = nl_xgc;
        this.y_gc[l_index] = nl_ygc;
    }

    get_listener_state(ID){
        const l_index = this.id_map[ID];
        return this.listener_states[l_index];
    }

    set_listener_state(ID, nls){
        const l_index = this.id_map[ID];
        this.listener_states[l_index] = nls;
    }

    get_listener_countdown_end_time(ID){
        const l_index = this.id_map[ID];
        return this.listener_countdown_end_times[l_index];
    }

    set_listener_countdown_end_time(ID, nlt){
        const l_index = this.id_map[ID];
        this.listener_countdown_end_times[l_index] = nlt;
    }

    get_listener_countdown_start_time(ID){
        const l_index = this.id_map[ID];
        return this.listener_countdown_start_times[l_index];
    }

    set_listener_countdown_start_time(ID, nlt){
        const l_index = this.id_map[ID];
        this.listener_countdown_start_times[l_index] = nlt;
    }

    get_user_type(user_ID){
        let j = this.id_map[user_ID];
        return this.user_types[j];
    }

    get_x_gc(user_ID){
        let j = this.id_map[user_ID];
        return this.x_gc[j];
    }

    get_y_gc(user_ID){
        let j = this.id_map[user_ID];
        return this.y_gc[j];
    }

    get_size(){
        return this.IDs.length;
    }
    
    // for sanity checking / initializing grid
    is_self(user_ID){
        if ((user_ID == o2ws_bridge_id) 
            && (this.get_user_type(user_ID) == user_type)){
                return true;
        }
        return false;
    }

    // TODO: get rid of / change this
    draw() {
        noStroke();
        fill(light_background);
        rect(this.x, this.y, SPACING * 10, this.h);
        textSize(20);
        fill(0);
        text("Players", this.x + 4, this.y + 20);
        textSize(TEXTSZ);
        for (let i = 0; i < this.usernames.length; i++) {
            let y = this.y + 20 + SPACING + i * SPACING;
            let yt = y + TEXTSZ * 0.3;  // y for text
            fill(USER_COLORS[i % USER_COLORS.length]);
            ellipse(this.x + SPACING * 0.5, y, SPACING * 0.8);
            fill(0);
            text(this.IDs[i], this.x + SPACING * 1.5, yt);
            text(this.usernames[i] + (this.admin_statuses[i] ?
                                      " (leader)" : ""),
                 this.x + SPACING * 3, yt);
        }
    }
}

// should there be a max chat length allowed?
var chat_entered = "";
class Chat_window {
    // y is not really the top of the chat. y is the baseline of the
    // top line of text.
    constructor(x, y, chat_width, chat_height) {
        this.x = x;
        this.y = y;
        this.w = chat_width;
        this.h = chat_height;

        // number of chat lines to save / display in the window
        // add 0.6 because we extend about 0.7 text_size above this.y
        // (y is the baseline of the top line of text, not the top of text)
        this.num_lines = Math.floor((this.h - 25) / SPACING);
        this.chat_window_chats = new Array(this.num_lines).fill("");

        // create input and button
        this.entry = createInput("");
        this.entry.size(this.w - 70);
        this.entry.input(this.chat_entered);
        this.entry.elt.addEventListener('focusin', this);
        this.entry.elt.addEventListener('focusout', this);
        this.button = createButton('send');
        this.button.parent("sketch01");
        this.button.mousePressed(this.send_button_pressed);
        // note: text entry appears above left of x, y position:
        this.entry.position(x + 10, y + this.h - 17);
        this.button.position(x + this.w - 50, y + this.h - 25);

        // initially hide these tools
        this.button.hide();
        this.entry.hide();
    }

    handleEvent(event) {
        switch (event.type) {
            case 'focusin':
                keypress_for_drums_suppress += 1;
                break;
            case 'focusout':
                print("focusout");
                keypress_for_drums_suppress -= 1;
                break;
        }
    }


    send_button_pressed() {
        // server filters out empty strings,
        // figures out the username of the sender
        o2ws_send_start("/gdc/chat", 0.0, "s", true);
        o2ws_add_string(chat_entered);
        o2ws_send_finish();
    }


    chat_entered() {
        chat_entered = this.value();
    }


    show() {
        this.entry.show();
        this.button.show();
    }


    update(sender_name, msg) {
        msg = sender_name + ": " + msg;
        // guess how many characters per line by assuming character width
        // on average is 1/2 the font size:
        let line_len = Math.floor(this.w / (TEXTSZ * 0.5));
        let num_lines_for_message = Math.ceil(msg.length / line_len);

        for (let i = 0; i < num_lines_for_message; i++) {
            // remove first element of array
            this.chat_window_chats.shift();
            let startpoint = i * line_len;
            let segment = msg.slice(startpoint, startpoint + line_len);
            this.chat_window_chats.push(segment);
        }
    }


    // chat_window_chats contains all lines from top to bottom (or null
    // if there is no text to display)
    draw() {
        noStroke();
        fill(light_background);
        rect(this.x, this.y, this.w, this.h);
        textSize(TEXTSZ);
        fill(0);
        for (let i = 0; i < this.num_lines; i++) {
            noStroke();
            text(this.chat_window_chats[i],
                 this.x + 3,
                 this.y + 20 + (i * SPACING));
        }
    }
}



class Tempo_ctrl {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        // this.bpm = sched_bps * 60;
        this.bpm = Math.floor(78);
        this.locked = true;
        if (user_type == COMPOSER) {
            mouse_drag.add_client(this);
        }
    }

    draw() {
        let x = this.x;
        let y = this.y;
        // player does not have enough responsibility to be "locked" but
        // the tempo slider is greyed out to warn the player when a tempo
        // change is pending
        if (this.locked) {
            fill(200);
        } else {
            fill(255);
        }
        stroke(180);
        strokeWeight(1.5);
        rect(x + 60, y - 16, 40, 20);
        noStroke();
        textSize(15);
        fill(0);
        text("Tempo:", x, y);
        text("" + Math.round(this.bpm), x + 67,  y);
    }

    contains(x, y) {
        return x >= this.x + 60 && x <= this.x + 100 &&
               y >= this.y - 16 && y <= this.y;
    }

    start_drag() {
        this.start_bpm = this.bpm;
        this.start_y = mouseY;
    }

    dragged(dx, dy) {
        if (this.lock) {
            return;
        }
        if (Math.abs(dx) > 50) {
            this.bpm = this.start_bpm;
            mouse_drag.mouse_drag_handler = null;
            return;
        }
        this.bpm = this.start_bpm + Math.round(-dy);
        this.bpm = max(min(this.bpm, MAX_TEMPO), MIN_TEMPO);
    }

    end_drag() {
        // set sched_rbase and sched_bbase to do sched_time_to_beat and
        // sched_beat_to_time calculations
        if(!this.lock) {
            sched_bbase = get_beat();
            sched_rbase = o2ws_time_get();
            let time_for_tempo_change = o2ws_time_get() +  MAX_NET_DELAY;
            let beat_for_tempo_change = sched_time_to_beat(time_for_tempo_change);
            beat_for_tempo_change = Math.ceil(beat_for_tempo_change);
            // have to send both time and beat for tempo change -
            // sched_time_to_beat and sched_beat_to_time use
            // sched_bbase and sched_rbase in their calculations. When
            // we send the timemap message, we calculate a new
            // sched_bbase (beat_for_tempo_change) and a new
            // sched_rbase (time_for_tempo_change) setting timemap
            // sets both these values if we only send the beat for the
            // tempo change and use sched_beat_to_time to calculate
            // the time for the tempo change, we'll be using the
            // sched_bbase and sched_rbase from the first tempo
            time_for_tempo_change = sched_beat_to_time(beat_for_tempo_change);
            o2ws_send_start("/gdc/timemap", 0, "ittd", true);
            o2ws_add_int32(tempo_epoch);
            o2ws_add_time(time_for_tempo_change);
            o2ws_add_time(beat_for_tempo_change);
            o2ws_add_double(tempo_ctrl.bpm / 60.0);
            o2ws_send_finish();
        }
    }
}


class Drum_light {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.count = 0;
    }

    hit() {
        this.count = 40;
    }

    draw() {
        let x = this.x;
        let y = this.y;
        fill(255);
        stroke(120);
        strokeWeight(1);
        if (this.count > 0) {
            this.count -= 1;
            fill(200);
        }
        circle(x, y, 20);
        noStroke();
        fill(0);
    }
}


class Status_msg {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.msg = "";
    }

    draw() {
        return; // using hprint.js instead
    }

    setStatus(msg) {
        hprintln(msg);
    }
}


class Beat_lights {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    draw() {
        let x = this.x;
        let y = this.y;
        let b = get_beat();
        let ib = Math.floor(b);
        let bfrac = b - ib;
        let lightup = -1;
        if (client_state == "playing" && bfrac < 0.5) {
            lightup = ib % gdc_cycle_beats;
        }
        strokeWeight(1);
        stroke(120);

        let sbw_over_8_ish = ((SB_WIDTH - 20) / 8) 
        let circle_size = sbw_over_8_ish * 0.6
        for (let i = 0; i < gdc_cycle_beats; i++) {
            fill(255)
            if (lightup == i) {
                fill(204, 102, 255);
            }
            circle(x + (i * sbw_over_8_ish), y, circle_size);
        }
        noStroke();
        strokeWeight(0);
        fill(0);
    }
}


class Signin_entry {
    constructor(text, has_password) {
        this.text = text;
        this.has_password = has_password;

        this.un_entry = createInput("");
        this.un_entry.size(75);
        this.un_entry.input(this.un_entered); 
        this.un_entry.parent("sketch01");
        this.un_entry.position(95, 110);

        if (this.has_password) {
            this.pw_var = "";
            this.pw_entry = createInput("");
            this.pw_entry.size(75);
            this.pw_entry.input(this.pw_entered); 
            this.pw_entry.parent("sketch01");
            this.pw_entry.position(95 , 135);
        }

        this.button = createButton('submit info');
        this.button.parent("sketch01");
        this.button.mousePressed(this.button_pressed);  
        this.button.position(95, this.has_password ? 165 : 140);
    }

    pw_entered() {
        pw_entered = this.value();
    }

    un_entered() {
        un_entered = this.value();
    }

    button_pressed() {
        o2ws_send_start("/gdc/infoentered", 0.0, "ssi", true);
        o2ws_add_string(pw_entered);
        o2ws_add_string(un_entered);
        o2ws_add_int32(user_type);
        o2ws_send_finish();        
   }

   set_text(text_){
        this.text = text_;
   }

    draw() {
        noStroke();
        fill(0);
        textSize(15);
        text(this.text, 12, 90);
        textSize(15);
        
        // todo: make this less messy
        
        if (!valid_credentials_entered){
            text("Username:", 12, 124);
            text("Password:", 12,  149);
        }

        if (setup_ensemble_info.check_ready()){
            if (client_voted){
                this.set_text("Waiting for other clients to vote to start...");
            }else{
                this.set_text("Vote to start the session");
            }
        }
        else if (client_validated_by_server){
            this.set_text("Waiting for other clients to connect...");
        }else{
            if (!valid_credentials_entered){
                this.set_text("Enter a username and password.");
            }else{
                if (!o2ws_clock_synchronized){
                    this.set_text("Local clock synchronizing\nwith server clock...");
                }else{
                    this.set_text("Estimating maximum round-trip\ntime with server...");
                }
            }
        }
        
    }

    remove() {
        if (this.has_password) {
            this.pw_entry.remove();
        }
        this.un_entry.remove();
        this.button.remove();
    }

    hide(){
        this.pw_entry.hide();
        this.un_entry.hide();
        this.button.hide();
    }
}

// set timer to send mix volumes changed info

// called by Hslider when there is a change:
function mydrum_set_gain(src, gain) {
    mydrum_gain_value = gain;
    if (client_state == "ready" || client_state == "playing") {
        print(gain);
        mydrum_gain.gain.value = gain;  // set Web Audio node
    }
}

function others_set_gain(src, gain) {
    others_gain_value = gain;
    if (client_state == "ready" || client_state == "playing") {
        print(gain);
        others_gain.gain.value = gain;  // set Web Audio node
    }
}

function beat_set_gain(src, gain) {
    beat_gain_value = gain;
    if (client_state == "ready" || client_state == "playing") {
        print(gain);
        beat_gain.gain.value = gain;  // set Web Audio node
    }
}


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


function onError() {
    console.log("Error (decodeAudioData?)");
}


function preload() {
    drum_buffers = [ [], [] ];
     // i = left or right drum
      // j = mydrum_index
    for (let i = 0; i < drum_buffers.length; i++) {
        for (let j = 0; j < DRUM_URLS.length; j++) {
            drum_buffers[i][j] = null;
        }
    }
    for (let i = 0; i < drum_buffers.length; i++) {
        for (let j = 0; j < DRUM_URLS.length; j++) {
            let request = new XMLHttpRequest();
            request.open('GET', DRUM_URLS[j][i], true);
            request.responseType = 'arraybuffer';
            request.onload = function() {
                audioContext.decodeAudioData(request.response,
                        function(buffer) {
                            drum_buffers[i][j] = buffer;
                        }, onError);
            }
            request.send();
        }
    }

    audio_loop = false;
    let loop_request = new XMLHttpRequest();
    loop_request.open('GET', "/sounds/wwry.mp3", true);
    loop_request.responseType = 'arraybuffer';
    loop_request.onload = function() {
        audioContext.decodeAudioData(loop_request.response,
                function(buffer) {
                    audio_loop = buffer;
                }, onError);
    }
    loop_request.send();
}


function my_drums(label) {
    // iterate through
    for (let i = 1; i < DRUM_URLS.length; i++) {
        if (label == DRUM_URLS[i][2]) {
            my_drum_index = i;
            return;
        }
    }
    print("ERROR: unknown drum sound selected: " + label);
}


// When input focus is acquired by chat box or other input,
// increment keypress_for_drums_suppress; decrement to restore
// drumming when you lose focus.
var keypress_for_drums_suppress = 0; 

// for some reason, we get an initial key_pressed() just from reloading
// a web page, so wait 2s before accepting any key press.

// modified this so the user could enter a password before all key
// presses start defaulting to drum hits

var last_drum_played = 0;


function keyPressed() {
    if (millis() > 2000 && valid_credentials_entered && (keypress_for_drums_suppress == 0)) {
        if (key_presses_play_drums) {
            let pn = performance.now();
            let diff = pn - last_drum_played;
            // showMessage("diff: " + diff +"\n");
            if (diff > 20){
                if (LEFT_SIDE_KEYS.has(key)) {
                    play_drum(drum_buffers[0][my_drum_index], 0, mydrum_gain,
                              o2ws_bridge_id);
                    my_drum_hit(false);
                }
                if (RIGHT_SIDE_KEYS.has(key)) {
                    play_drum(drum_buffers[1][my_drum_index], 0, mydrum_gain,
                              o2ws_bridge_id);
                    my_drum_hit(true);
                }
                last_drum_played = pn;
                // by this point we assume o2ws_websocket defined
                clearTimeout(nop_timeout);
                nop_timeout = setTimeout(function() {
                    o2ws_websocket.send(JSON.stringify({type: 'NOP'}));
                    showMessage("sent NOP message\n");
                }, 900);
                
            }
        }
    }
}