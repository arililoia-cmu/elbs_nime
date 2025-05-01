// sketch.js -- composer web app main file
//
// Ari Liloia and Roger B. Dannenberg
// July 2022
// var user_type = COMPOSER;

var drum_buffers = null;
var stop_start; // start/stop control (sometimes) object
var beat_lights; // blink on beats to show we are running

var next_play_time = null;
var drum_gain = null;
var drum_gain_value = 0.5;

var o2time_offset;  // linear mapping from o2ws time to beat
var beat_offset;      // linear mapping from o2ws time to beat
var bps = 0.0;  

const col2 = 70;
const col3 = 920;
var my_drum_index = 1;

var audio_available_msg = "";
var audio_selected_msg = "";
var is_first_click = true;
var mouse_drag = null;  // object to manage mouse interactions

// UI VARIABLES
const TEXTSZ = 15;
const SPACING = 20;
const TABLEX = 560

// sidebar
const SIDEBAR_Y = GRID_OUTLINE_Y;

const SB_START_X = (cell_size*CELLS_WIDE) + (4*node_radius);
const SB_ROW1_Y = GRID_OUTLINE_Y;
const SB_WIDTH = 270;
const SB_ROW2_Y = SB_ROW1_Y + 30;
const SB_ROW3_Y = SB_ROW2_Y + 90;
const SB_ROW4_Y = SB_ROW3_Y + 60;
const SB_ROW5_Y = SB_ROW4_Y + 30;
const SB_ROW6_Y = SB_ROW5_Y + 100;

var composer_color;
var performer_color;
var listener_color;

var composer_color_t;
var performer_color_t;
var listener_color_t;
var user_color_t;

var background_color;
var light_background;

var gridd;

function setup() {
    print("conductor setup: gdc_cycle_beats", gdc_cycle_beats);
    
    composer_color_t = color(120, 0, 0);
    performer_color_t = color(0, 0, 120);
    listener_color_t = color(0, 120, 0);
    user_color_t = color(255);

    composer_color = color(255, 0, 0);
    performer_color = color(0, 0, 255);
    listener_color = color(0, 255, 0);

    background_color = color(background_color_vals);
    light_background = color(light_background_vals);
    p5js_canvas = createCanvas(canvas_width, canvas_height);
    p5js_canvas.parent("sketch01");  // know who your parent is
    ui_setup();

    gridd = new Grid();
    after_stopped = new AfterStopped();
    after_stopped.set_text("N/A");
    grid_setup();    

    output_ctrl = new Output_ctrl(10, 230, TABLEX - 50);

    mixer = new Mixer(SB_START_X, SB_ROW3_Y, 206);

    beat_lights = new Beat_lights(SB_START_X, SB_ROW2_Y + 35);
   
    stop_start = new Stop_start(SB_START_X, SB_ROW1_Y);
    tempo_ctrl = new Tempo_ctrl(SB_START_X + (SB_WIDTH/2), SB_ROW1_Y + 20);
    
    setup_ensemble_info = new SetupEnsembleInfo(300, 40);
    
    userinfo_table = new Userinfo_table(TABLEX, 10, height - 45);
    // chat window: x, y, chat_width, chat_height

    if (user_type == PERFORMER){
        scrolling_view = new Scrolling_view(SB_START_X,SB_ROW4_Y - 5);
        chat_window = new Chat_window(SB_START_X, SB_ROW5_Y, SB_WIDTH, 300);
    }else{
        chat_window = new Chat_window(SB_START_X, SB_ROW4_Y, SB_WIDTH, SB_ROW5_Y + 30);
    }

    // output_ctrl = new Output_ctrl(10, 230, TABLEX - 30);
    // status_msg = new Status_msg(10, 300);
    signin_entry = new Signin_entry("Enter username and password below:", true);

    o2ws_method_new("/elbs/typequery", "", true,
        typequery_handler, null);

    console.log("all handlers installed");
}




// right after connecting to the server, we get a "typequery" message where
// we're asked what type we are
function typequery_handler(timestamp, address, typespec, info) {
    console.log("tq_slay");
}


function after_login_draw() {
     
    gridd.draw();
    draw_rectangles();
    // showMessage(client_state);
   
    stop_start.draw();   
    // output_ctrl.draw();

    beat_lights.draw();
    tempo_ctrl.draw();
    // countdown.draw();

    mixer.draw();
    // userinfo_table.draw();
    chat_window.draw();

    if (user_type == PERFORMER){
        scrolling_view.draw();
    }

}


function draw() { 

  
    ui_draw("Conductor");  // common draw 
    textSize(30);
    if (!client_validated_by_server || !voting_over_grid_initialized){
        setup_ensemble_info.draw();
        signin_entry.draw();
        chat_window.draw();
    }else{
        after_login_draw();   
    }

    after_stopped.draw();

}



