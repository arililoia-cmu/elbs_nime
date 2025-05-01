// grid.js -- grid ui web app main file
//
// Ari Liloia
// July 2023

// gx, gy refer to x, y on grid
// px, py refer to x, y on canvas
let mult_factor = 0.5;
const roll_x = 4;

const canvas_width = 1060;

const cell_size = 36;
const node_radius = Math.round(2*cell_size/3);



// the bottom left coordinate (p5js coordinate system (0,0) is top left screen corner)
// of the actual grid is (grid_x, grid_y) 
const GRID_OUTLINE_X = 15;
const GRID_OUTLINE_Y = 15;
const GRID_X = GRID_OUTLINE_X + node_radius;
const GRID_Y = GRID_OUTLINE_Y + node_radius;
const test_lat_val = 4.0;


// the server assumes a square grid, but i'm keeping cells_wide and cells_high
// on the client side in case i need to change it. 
const CELLS_WIDE = 19;
const CELLS_HIGH = 19;


const draw_rect_1 = GRID_X + (CELLS_WIDE * cell_size);
const draw_rect_2 = GRID_Y + (CELLS_HIGH * cell_size);



// p5js canvas
const canvas_height = (2 * GRID_Y) + (cell_size * CELLS_HIGH);

// values for testing movement and size of composer hit
const r_testval = 100;
const traversing_hit_size = 10;
const RECIP_25 = 1.0/25.0; // 1/5^2
const SLN_5 = 5.0 * Math.log(5.0); // 5ln5
const multer = Math.sqrt(2.0*Math.pow(cell_size,2.0))

let mult_factor_grow = 1.1;
let connection_width = 3;

// for state of grid
var voting_over_grid_initialized = false;

// draw rectangles over the grid before drawing other UI elements
// so that it looks like propagating hits disappear after 
// going off the grid
function draw_rectangles(){
  fill(background_color);
  stroke(background_color);
  rect(0, 0, GRID_OUTLINE_X, canvas_height);
  rect(0, 0, canvas_width, GRID_OUTLINE_Y);
  // let hb = GRID_OUTLINE_X + (CELLS_WIDE * cell_size);
  let hb = (cell_size*CELLS_WIDE) + (3*node_radius);
  rect(hb, 0, canvas_width - hb, canvas_height);
  // let hl = (GRID_OUTLINE_Y + (CELLS_HIGH * cell_size))
  let hl = (cell_size*CELLS_HIGH) +  + (3*node_radius);
  rect(0, hl, canvas_width, GRID_OUTLINE_Y);
}


// HANDLERS

// register grid handlers
function grid_setup(){
  o2ws_method_new("/elbs/newdc", "ssii", true, elbs_newdc_handler, null); 
  o2ws_method_new("/elbs/removedc", "ii", true, elbs_removedc_handler, null); 
  
}

// receiving this message - we assume this is not the user that 
// decided to delete the connection, so we only have to iterate through
// display drawn connections
function elbs_removedc_handler(timestamp, address, typespec, info){
  if (!voting_over_grid_initialized){ return; }
  const src_ID = o2ws_get_int32();
  const dst_ID = o2ws_get_int32();
  if ((src_ID == o2ws_bridge_id) && (user_type == COMPOSER)){
    gridd.drawn_connections.remove(dst_ID);
  }
  else{
    gridd.drawn_connections_display.remove(src_ID, dst_ID);
  }

}

function elbs_newdc_handler(timestamp, address, typespec, info) {

  if (!voting_over_grid_initialized){ return; }
  const x_gcs_string = o2ws_get_string();
  const y_gcs_string = o2ws_get_string();
  const src_ID = o2ws_get_int32();
  const dst_ID = o2ws_get_int32();

  let x_gcs = x_gcs_string.split(".");
  let y_gcs = y_gcs_string.split(".");
  if (x_gcs.length > 0 && x_gcs[x_gcs.length - 1] == "") {
    x_gcs.pop();
    y_gcs.pop();
  }

  // generate joints list
  let joints_list = [];
  for (let i=0; i<x_gcs.length; i++){
    joints_list.push(new DrawingConnectionJoint(
      grid_to_draw_coord(x_gcs[i], GRID_X),
      grid_to_draw_coord(y_gcs[i], GRID_Y)
    ))
  }

  // if we are the composer - create a new drawnconnection
  if ((src_ID == o2ws_bridge_id) && (user_type == COMPOSER)){
    gridd.drawing_connection.splice_drawing_connection_joints();
    gridd.drawn_connections.add(joints_list, dst_ID);

  }
  // if not - create a new drawnconnectiondisplay
  else{
    gridd.drawn_connections_display.add(joints_list, src_ID, dst_ID);
  }

}


// HELPER MATH FUNCTIONS

function point_within_circle_with_radius(x_point, y_point, x, y, r){
  let distance = dist(x_point, y_point, x, y);
  return distance <= r;
}


function snap_to_grid_x(pixel_coord){
  let coord = (pixel_coord - GRID_X) / cell_size;
  let snapped = (Math.round(coord) * cell_size) + GRID_X;
  if (snapped < GRID_X){
    return GRID_X;
  }
  
  if (snapped > (GRID_X + (cell_size * CELLS_WIDE))){
    return (GRID_X + (cell_size * CELLS_WIDE));
  }
  return snapped;
}

function snap_to_grid_y(pixel_coord){
  let coord = (pixel_coord - GRID_Y) / cell_size;
  let snapped = (Math.round(coord) * cell_size) + GRID_Y;
  if (snapped < GRID_Y){
    return GRID_Y;
  }
  
  if (snapped > (GRID_Y + (cell_size * CELLS_HIGH))){
    return (GRID_Y + (cell_size * CELLS_HIGH));
  }
  return snapped;
}

function grid_to_draw_coord(grid_coord, cornerpiece){
    return 1.0*(cornerpiece) + (cell_size * grid_coord)*1.0
}


function draw_to_grid_coord(draw_coord, cornerpiece){
  return parseInt(((1 * draw_coord) - (1 * cornerpiece)) / cell_size);

}

function point_on_line_with_thickness(x_point, y_point, x1, y1, x2, y2, h){

    var is_within_x = false;
    var is_within_y = false;
    if ((x1 == x2) && (y1 != y2)){
      is_within_x = (x1-h <= x_point) && (x_point <= x1+h);      
      is_within_y = (Math.min(y1, y2) <= y_point) && (y_point <= Math.max(y1, y2));
      return is_within_x && is_within_y
    }
    if ((x1 != x2) && (y1 == y2)){
      is_within_x = (Math.min(x1, x2) <= x_point) && (x_point <= Math.max(x1, x2));
      is_within_y = (y1-h <= y_point) && (y_point <= y1+h);
      return is_within_x && is_within_y
    }
    return false;  
}

function calculate_manhattan_distance(x1, y1, x2, y2){
  let x_dist = abs(x1 - x2);
  let y_dist = abs(y1 - y2);
  return x_dist + y_dist; 
}


// CLASSES




// display node (also used as performer node)
// references the userinfo_table instead of duplicating state
class FakeNode{

  constructor(ID_){
    this.ID = ID_;
    this.text_size =  node_radius / (1 + this.ID.toString().length/3);
  }

  contains(){
    let px = grid_to_draw_coord(userinfo_table.get_x_gc(this.ID), GRID_X);
    let py = grid_to_draw_coord(userinfo_table.get_y_gc(this.ID), GRID_Y);
    let distance = Math.sqrt(
      Math.pow(mouseX - px, 2) +
      Math.pow(mouseY - py, 2)
    );
    return distance < node_radius;
  }

  get_px(){
    let px = grid_to_draw_coord(userinfo_table.get_x_gc(this.ID), GRID_X);
    return px;
  }

  get_py(){
    let py = grid_to_draw_coord(userinfo_table.get_y_gc(this.ID), GRID_Y);
    return py;
  }

  get_ID(){
    return this.ID;
  }


  draw(){
    let px = grid_to_draw_coord(userinfo_table.get_x_gc(this.ID), GRID_X);
    let py = grid_to_draw_coord(userinfo_table.get_y_gc(this.ID), GRID_Y);
    let fakenode_usertype = userinfo_table.get_user_type(this.ID);

    noStroke();

    textSize(this.text_size);
    let text_height = textAscent() + textDescent();
    let text_width = textWidth(this.ID);
    
    switch (fakenode_usertype){

      case COMPOSER:
        fill(composer_color);
        circle(px, py, node_radius);
        fill(composer_color_t);
        text(this.ID, px - text_width/2, py + text_height/3);
        break;

      case PERFORMER:
        (this.ID == o2ws_bridge_id) ? fill(0) : fill(performer_color);
        if (user_type ==  COMPOSER && mouseIsPressed && this.contains()){
          circle(px, py, node_radius * mult_factor_grow);
        }else{
          circle(px, py, node_radius);
        }
        (this.ID == o2ws_bridge_id) ? fill(user_color_t) : fill(performer_color_t);
        text(this.ID, px - text_width/2, py + text_height/3);
        break;
      
      case LISTENER:
        const listener_state = userinfo_table.get_listener_state(this.ID);
        if (listener_state == LS_COUNTDOWN){
            const difference = get_beat() - 
              userinfo_table.get_listener_countdown_start_time(this.ID);
            const duration = userinfo_table.get_listener_countdown_end_time(this.ID)
              - userinfo_table.get_listener_countdown_start_time(this.ID)
            const fraction = TWO_PI * Math.min(1.0, (difference / duration));
            stroke(0);
            fill(0);
            circle(px, py, node_radius);
            noStroke();
            stroke(150);
            fill(150);
            arc(px, py, node_radius, node_radius,  -HALF_PI,
              fraction - HALF_PI);
            
        }else{
            fill(listener_color);
            circle(px, py, node_radius);
            fill(listener_color_t);
            text(this.ID, px - text_width/2, py + text_height/3);
        }
        break;
    }    

  }

}

// // listener states
// const LS_NORMAL = 0; // unlocked
// const LS_DRAGGING = 1; // unlocked
// const LS_UNCONFIRMED = 2; // unlocked
// const LS_COUNTDOWN = 3; // locked

class ListenerNode{
  constructor(ID){
    this.ID = ID;
    this.text_size =  node_radius / (1 + this.ID.toString().length/3);
    this.dragging_px = grid_to_draw_coord(userinfo_table.get_x_gc(this.ID), GRID_X);
    this.dragging_py = grid_to_draw_coord(userinfo_table.get_y_gc(this.ID), GRID_Y);
  }

  contains(){
    let px = grid_to_draw_coord(userinfo_table.get_x_gc(this.ID), GRID_X);
    let py = grid_to_draw_coord(userinfo_table.get_y_gc(this.ID), GRID_Y);
    let distance = Math.sqrt(
      Math.pow(mouseX - px, 2) +
      Math.pow(mouseY - py, 2)
    );
    return distance < node_radius;
  }

  // this is for when mouse is clicked
  mouse_pressed(){
    if (this.contains(mouseX, mouseY) && 
          userinfo_table.get_listener_state(this.ID) == LS_NORMAL){
            userinfo_table.set_listener_state(this.ID, LS_DRAGGING);
    }
  }

  mouse_released(){
    //this.was_clicked_inside = false;
    if (!(userinfo_table.get_listener_state(this.ID) == LS_DRAGGING)){
      return;
    }

    stroke(0);
    fill(0);

    let px = grid_to_draw_coord(userinfo_table.get_x_gc(this.ID), GRID_X);
    let py = grid_to_draw_coord(userinfo_table.get_y_gc(this.ID), GRID_Y);

    if ((this.dragging_px == px) && (this.dragging_py == py)){
      showMessage("unsuccessful drag carried out\n");
      userinfo_table.set_listener_state(this.ID, LS_NORMAL);
      return;
    }

    let ln_condition1 = this.dragging_px <= GRID_X;
    let ln_condition2 = this.dragging_px >= GRID_X + 
          (cell_size * CELLS_WIDE);
    let ln_condition3 = this.dragging_py <= GRID_Y;
    let ln_condition_4 = this.dragging_py >= GRID_Y + 
          (cell_size * CELLS_HIGH);
    if (ln_condition1 || ln_condition2 || ln_condition3 || ln_condition_4){
      showMessage("unsuccessful drag carried out\n");
      userinfo_table.set_listener_state(this.ID, LS_NORMAL);
      return;
    }

    const nl_x_gc = draw_to_grid_coord(this.dragging_px, GRID_X);
    const nl_y_gc = draw_to_grid_coord(this.dragging_py, GRID_Y);

    o2ws_send_start("!elbs/changelistenerpos", 0.0, "iiit", true);
    o2ws_add_int32(this.ID);
    o2ws_add_int32(nl_x_gc);
    o2ws_add_int32(nl_y_gc);
    o2ws_add_time(Math.max(listener_latest_beat, get_beat()));
    o2ws_send_finish();

    showMessage("could-be successful drag carried out - now waiting for response\n");

    userinfo_table.set_listener_state(this.ID, LS_UNCONFIRMED);
    return;

  }

  // TODO: SHOULDN'T HAVE THIS
  get_ID(){
    return this.ID;
  }

  // TODO: SHOULDN'T HAVE THIS
  get_px(){
    let px = grid_to_draw_coord(userinfo_table.get_x_gc(this.ID), GRID_X);
    return px;
  }
  
  // TODO: SHOULDN'T HAVE THIS
  get_py(){
    let py = grid_to_draw_coord(userinfo_table.get_y_gc(this.ID), GRID_Y);
    return py;
  }

  draw(){
    const my_listener_state = userinfo_table.get_listener_state(this.ID);
    const px = grid_to_draw_coord(userinfo_table.get_x_gc(this.ID), GRID_X);
    const py = grid_to_draw_coord(userinfo_table.get_y_gc(this.ID), GRID_Y);

    switch (my_listener_state){

      case LS_NORMAL:

          // draw the node w/ text, if we're hovering 
          // over it draw it slightly larger
          
          stroke(0);
          fill(0);
          if (this.contains()){
              circle(px, py, node_radius * mult_factor_grow);
          }else{
              circle(px, py, node_radius);
          }
          fill(user_color_t);
          textSize(this.text_size);
          let text_height = textAscent() + textDescent();
          let text_width = textWidth(this.ID);
          text(this.ID, px - text_width/2, py + text_height/3);
          break;
      
      case LS_DRAGGING:
        
          // draw where node used to be
          stroke(150);
          fill(150);
          circle(px, py, node_radius * mult_factor_grow);

          // calculate new position of node
          this.dragging_px = snap_to_grid_x(mouseX);
          this.dragging_py = snap_to_grid_y(mouseY);

          // draw where we want to move node
          stroke(0)
          fill(0);
          circle(this.dragging_px, this.dragging_py, node_radius * mult_factor_grow);

          break;
      
      case LS_UNCONFIRMED:

          // draw where node used to be
          stroke(150);
          fill(150);
          circle(px, py, node_radius);

          // draw where we want to move node
          stroke(0)
          fill(0);
          circle(this.dragging_px, this.dragging_py, node_radius);

          break;
      
      case LS_COUNTDOWN:

          const difference = get_beat() - 
              userinfo_table.get_listener_countdown_start_time(this.ID);
          const duration = userinfo_table.get_listener_countdown_end_time(this.ID)
            - userinfo_table.get_listener_countdown_start_time(this.ID)
          const fraction = TWO_PI * Math.min(1.0, (difference / duration));
          stroke(0);
          fill(0);
          circle(px, py, node_radius);
          stroke(150);
          fill(150);
          arc(px, py, node_radius, node_radius,  -HALF_PI,
            fraction - HALF_PI);

          break;

    }
  }



}


class ComposerNode{
  
  constructor(ID){
    this.ID = ID;
    this.px = grid_to_draw_coord(userinfo_table.get_x_gc(this.ID), GRID_X);
    this.py = grid_to_draw_coord(userinfo_table.get_y_gc(this.ID), GRID_Y);
    this.text_size =  node_radius / (1 + this.ID.toString().length/3);
  }
  
  contains(){
    let distance = Math.sqrt(
      Math.pow(mouseX - this.px, 2) +
      Math.pow(mouseY - this.py, 2)
    );
    return distance < node_radius/2;
  }
  
  get_ID(){
    return this.ID;
  }
  
  get_px(){
    return this.px;
  }
  
  get_py(){
    return this.py;
  }
  
  draw(){
    stroke(0);
    fill(0);
    strokeWeight(0);
    if (this.contains(mouseX, mouseY)){
      circle(this.px, this.py, node_radius * mult_factor_grow);
    }else{
      circle(this.px, this.py, node_radius);
    }
    fill(user_color_t);
    textSize(this.text_size);
    let text_height = textAscent() + textDescent();
    let text_width = textWidth(this.ID);
    text(this.ID, this.px - text_width/2, this.py + text_height/3);
  }
  
}


// CONNECTION DRAWING CLASSES

class DrawingConnectionJoint{
  constructor(jx, jy){
    this.jx = jx;
    this.jy = jy;
  }
  
  set_xy(jx_, jy_){
    this.jx = jx_;
    this.jy = jy_;
  }

}


// could be moved to composer unique
class AllDrawnConnections{
  constructor(){
    this.connections = [];
    this.mouse_pressed_within_connection = true;
  }

  add(joints_list, dest_ID){
    this.connections.push(new DrawnConnection(joints_list, dest_ID));
  }
  

  draw(){
    fill(0);
    stroke(0)
    for (let i=0; i<this.connections.length; i++){
      this.connections[i].draw()
    }
  }
  
  mouse_pressed(){
    for (let i=0; i<this.connections.length; i++){
        if (this.connections[i].contains(mouseX, mouseY)){
          this.connections[i].set_clicked_inside(true);
          break;
        }
    } 
  }


  remove(dest_ID){
    for (let i=0; i<this.connections.length; i++){
      if (this.connections[i].dest_ID == dest_ID){
        this.connections.splice(i,1);
        break;
      }
    }
  }
  
  mouse_released(){
    // find the index we clicked inside that has our mouse
    let dcremove_index = this.connections.findIndex(
      connection => 
        connection.contains(mouseX, mouseY) &&
        connection.get_clicked_inside()
    )
    if (dcremove_index != -1){
        o2ws_send_start("!elbs/removedc", 0.0, "i", true);
        o2ws_add_int32(this.connections[dcremove_index].get_dest_ID());
        o2ws_send_finish();
        this.connections.splice(dcremove_index, 1);
    }

    for (let i=0; i<this.connections.length; i++){
      this.connections[i].set_clicked_inside(false);
    }
  }
  
  check_joint_is_endpoint(last_joint){
    for (let i=0; i<this.connections.length; i++){
      let conn_last_joint = this.connections[i].get_last_joint();
      if (conn_last_joint.jx == last_joint.jx && 
          conn_last_joint.jy == last_joint.jy){
        return true;
      }
    }
    return false;
  }

  register_traversing_hit(my_played_beat){
    for (let i=0; i<this.connections.length; i++){
      this.connections[i].register_traversing_hit(my_played_beat);
    }
  }

}


class AllDrawnConnectionsDisplay{
  constructor(){
    this.connections = [];
    this.visible = true;
  }
  
  add(joints, src_ID, dest_ID){
    this.connections.push(new DrawnConnectionDisplay(joints, src_ID, dest_ID));
  }

  remove(src_ID, dest_ID){
    for (let i=0; i<this.connections.length; i++){
      if ((this.connections[i].src_ID == src_ID) && (this.connections[i].dest_ID == dest_ID)){
        this.connections.splice(i, 1);
        break;
      }
    }

  }

  set_visible (t_or_f){
    this.visible = t_or_f;
  }
  
  draw(){
    if (!this.visible){return;}
    fill(composer_color);
    for (let i=0; i<this.connections.length; i++){
      this.connections[i].draw()
    }

  }

  check_if_connection_exists(src_ID_, dest_ID_){
    let num_conns = this.connections.length;
    for (let i=0; i<num_conns; i++){
      if ((this.connections[i].get_src_ID() == src_ID_) 
          && (this.connections[i].get_dest_ID() == dest_ID_)){
            return true;
      }
    }
    return false;
    
  }

  register_traversing_hit(sender_id, played_beat){
    const num_connections = this.connections.length;
    for (let i=0; i<num_connections; i++){
      this.connections[i].register_traversing_hit(sender_id, played_beat);
    }
  }
 
}


class AfterStopped{
  constructor(){
      this.x = grid_to_draw_coord(1, GRID_X);
      this.y = grid_to_draw_coord(1, GRID_Y);
      this.stop_dialog_width = cell_size * (CELLS_WIDE - 2);
      this.stop_dialog_height = cell_size * (CELLS_HIGH - 2);
      this.buttons_list = [];
      this.lines_list = [];
      this.visible = false;
      this.display_lines = true;
      this.text_size = 20;
      this.num_lines = Math.floor((this.stop_dialog_height - 44)) / (this.text_size + 5);
  }

  mouse_pressed(){
    if (this.display_lines){ return; }
    showMessage("mouse pressed: ")
    const llen = this.buttons_list.length;
    for (let i=0; i<llen; i++){
      this.buttons_list[i].mouse_pressed();
    }
  }


  mouse_released(){
    if (this.display_lines){ return; }
    const llen = this.buttons_list.length;
    for (let i=0; i<llen; i++){
      this.buttons_list[i].mouse_released();
    }
  }

  set_text(message){
    this.text_size = 20;
    this.lines_list = [];
    let line_len = Math.floor(this.stop_dialog_width / (this.text_size * 0.65));
    let num_lines_for_message = Math.ceil(message.length / line_len);
    for (let i = 0; i < num_lines_for_message; i++) {
        let startpoint = i * line_len;
        let segment = message.slice(startpoint, startpoint + line_len);
        showMessage("segment: " + segment + "\n");
        this.lines_list.push(segment);
    }
    this.display_lines = true;
  }

  set_midis_list(midis_list){
    
    // calculate new textsize
    textSize(100); 
    const desiredHeight = Math.min(
      (this.stop_dialog_height - this.y) / (2 * midis_list.length),
      this.stop_dialog_height / 20
    );

    while (textAscent() + textDescent() > desiredHeight) {
        textSize(textSize() - 1);
    }
    this.text_size = textSize();
    
    for (let i=0; i<midis_list.length; i++){
      this.buttons_list.push(new MIDIFileDownloadButton(
        this.x + 30, this.y + 30  + (desiredHeight * i * 1.5), desiredHeight, midis_list[i]));
    }
    this.display_lines = false;
  
  }

  set_visible(t_or_f){
    this.visible = t_or_f;
  }

  draw(){
    if (!this.visible) {return;}
    strokeWeight(20);
    stroke(255,0,0);
    fill(255,255,0);
    rect(this.x, this.y, this.stop_dialog_width, this.stop_dialog_height);
    // if we've already set the midis list and we're using this
    // class to display download buttons and the like 
    fill(255,0,0);
    if (this.display_lines){
      console.log(this.lines_list)
      for (let i = 0; i < this.num_lines; i++) {
        noStroke();
        textSize(this.text_size);
        if (this.lines_list[i] == null){continue;}
        let textx = 1.0*this.x + 30;
        let texty = 1.0*this.y + 55 + 1.0*(i * (this.text_size + 5))
        text(this.lines_list[i],textx, texty);
      } 
    }
    // if we have entered midi files we display those
    else{
      if (this.buttons_list.length == 0){return;}
      textSize(this.text_size);
      for (let i=0; i<this.buttons_list.length; i++){
        this.buttons_list[i].draw();
      }
    }
  }
}

class MIDIFileDownloadButton{
  constructor(x,y, w, filename){
    this.x = x;
    this.y = y;
    this.w = w;
    this.pressed = false;
    this.filename = filename;
  }

  contains(x, y){
    return x > this.x && x < this.x+this.w &&
      y > this.y && y < this.y + this.w;
  }

  get_midi_file(){
    showMessage("get midi file: " + this.filename + "\n");
    downloadFile(this.filename);
  }

  mouse_pressed(){
    if (this.contains(mouseX, mouseY) && !this.pressed){
      showMessage("mouse pressed inside : " + this.filename);
      this.pressed = true;
    }else{
      showMessage("mosue at " + mouseX + " " + mouseY + "not pressed inside");
    }
  }

  mouse_released(){
    if (this.contains(mouseX, mouseY) && this.pressed){
      showMessage("mouse released inside : " + this.filename);
      this.get_midi_file();
      this.pressed = false;
    }
  }



  draw(){
      fill(255);
      stroke(0)
      if (this.contains(mouseX, mouseY)){
      strokeWeight(1.5 * this.w/20) 
      }else{
        strokeWeight(this.w/20) 
      }

      const x = this.x;
      const y = this.y;
      const w = this.w;
      rect(x, y, w, w, 5);
      line(x + w/2, y + w/5, x + w/2, y + 3*w/5);
      line(x + w/2, y + 3*w/5, x + w/3, y + 2*w/5);
      line(x + w/2, y + 3*w/5, x + 2*w/3, y + 2*w/5);
      line(x + w/5, y + 4*w/5, x + 4*w/5, y + 4*w/5);
      line(x + w/5, y + 4*w/5, x + w/5, y + 3*w/5)
      line(x + 4*w/5, y + 4*w/5, x + 4*w/5, y + 3*w/5);
      fill(0);
      noStroke();
      fill(255, 0, 0);
      text(this.filename, x + (1.5*w), y+(w*0.9))  
  }
}

class DrawnConnectionDisplay{

  constructor(joints, src_ID, dest_ID){
    // set arguments
    this.joints = joints;
    this.length = this.joints.length;
    this.src_ID = src_ID;
    this.dest_ID = dest_ID;

    // generate displacements
    this.x_displacements = new Array(this.length-1).fill(1);
    this.y_displacements = new Array(this.length-1).fill(1);
    for (let i=1; i<this.length; i++){
      let prev_j = this.joints[i-1];
      let curr_j = this.joints[i];
      this.x_displacements[i-1] = Math.sign(curr_j.jx - prev_j.jx);
      this.y_displacements[i-1] = Math.sign(curr_j.jy - prev_j.jy);
    }

    //set up traversing hits
    this.traversing_hits = [];
  }

  get_last_joint(){
    return this.joints.at(-1);
  }

  get_src_ID(){
    return this.src_ID;
  }

  get_dest_ID(){
    return this.dest_ID;
  }

  register_traversing_hit(sender_id, played_beat){
    if (sender_id != this.src_ID){ return; }

    switch (user_type){
      case COMPOSER:
        this.traversing_hits.push(played_beat + 4.0);
        break;
      case PERFORMER:
        if (this.dest_ID == o2ws_bridge_id){
            this.traversing_hits.push(played_beat + 4.0);
        }else{
            this.traversing_hits.push(played_beat + 8.0);
        }
        break;
      case LISTENER:
        this.traversing_hits.push(played_beat + 8.0);
        break;
    }

    if (this.traversing_hits.length > 50){
      this.remove_traversed_hits_dcd()
    }

  }

  remove_traversed_hits_dcd(){
    // let before = this.traversing_hits.length;
    if (this.traversing_hits.length > 0){
      let b = get_beat();
      this.traversing_hits = this.traversing_hits.filter(
        element => 
        (element + this.length + 7) > b);
    }
    // showMessage("before = " + before + " after = " + this.traversing_hits.length + "\n");
  }

  draw(){

    // pick color
    stroke(composer_color);
    
    // draw lines
    strokeWeight(connection_width);
    for (let i=0; i<this.length-1; i++){
        line(this.joints[i].jx, 
             this.joints[i].jy, 
             this.joints[i+1].jx, 
             this.joints[i+1].jy);  
    }

    // draw traversing hits
    let b = get_beat(); 

 

    switch(user_type){
        case COMPOSER:
            const tlv2p1 = 4.0;
            for (let i=0; i<this.traversing_hits.length; i++){
      
                let ph_cl = Math.floor(b*1.0 - this.traversing_hits[i]*1.0); 
          
                if ((ph_cl >= 0) && (ph_cl <= tlv2p1)){
                  let my_x = b*1.0 - this.traversing_hits[i]*1.0;
                  let through_1 = Math.exp((5.0*Math.log(my_x)) - SLN_5);
                  let circlesize = traversing_hit_size + ((RECIP_25 * Math.pow(my_x - 5.0, 2.0)) + 1.0);            
                  let circlex = (1.0 * this.joints[0].jx) + (cell_size * through_1 * this.x_displacements[0]);
                  let circley = (1.0 * this.joints[0].jy) + (cell_size * through_1 * this.y_displacements[0]);
                  
                  let through = ((b*1.0 - this.traversing_hits[i])*1.0 % 1.0 + 1.0) % 1.0;
                  
                  var gb_var;
                  if (ph_cl == 0 && through < 0.33){
                    gb_var = 255.0 * (1.0 - (3.0*through));
                  }
                  if (ph_cl == this.length-1 && through > 0.66){
                    gb_var = 255.0 * 3.0 * (through - 0.66);
                  }
                  else{
                    gb_var = 0;
                  }
                  fill(255, gb_var, gb_var);
                  circle(circlex, circley, circlesize);
                }

                else if ((ph_cl < (this.joints.length + tlv2p1)) && (ph_cl >= tlv2p1)){
                  var eff_phcl = ph_cl - tlv2p1;
                  let through = ((b*1.0 - this.traversing_hits[i])*1.0 % 1.0 + 1.0) % 1.0;
                  let circlex = (1.0 * this.joints[eff_phcl].jx) + (cell_size * through * this.x_displacements[eff_phcl]);
                  let circley = (1.0 * this.joints[eff_phcl].jy) + (cell_size * through * this.y_displacements[eff_phcl]);
                  let circlesize = traversing_hit_size;

                  var gb_var;
                  if (ph_cl == 0 && through < 0.33){
                    gb_var = 255.0 * (1.0 - (3.0*through));
                  }
                  if (ph_cl == this.length-1 && through > 0.66){
                    gb_var = 255.0 * 3.0 * (through - 0.66);
                  }
                  else{
                    gb_var = 0;
                  }

                  fill(255, gb_var, gb_var);
                  circle(circlex, circley, circlesize);
                }

                

            }
            break;

        case PERFORMER:
            for (let i=0; i<this.traversing_hits.length; i++){
                let ph_cl = Math.floor(b*1.0 - this.traversing_hits[i]*1.0); 
                // showMessage(ph_cl);
                if ((ph_cl < this.joints.length) && (ph_cl >= 0)){
                  let through = (((b*1.0 - this.traversing_hits[i]*1.0) * sched_bps) % sched_bps) / sched_bps; // B
                  let circlex = (1.0 * this.joints[ph_cl].jx) + (cell_size * through * this.x_displacements[ph_cl]);
                  let circley = (1.0 * this.joints[ph_cl].jy) + (cell_size * through * this.y_displacements[ph_cl]);
                  let circlesize = traversing_hit_size;
                  
                  var gb_var;
                  if (ph_cl == 0 && through < 0.33){
                    gb_var = 255.0 * (1.0 - (3.0*through));
                  }
                  if (ph_cl == this.length-1 && through > 0.66){
                    gb_var = 255.0 * 3.0 * (through - 0.66);
                  }
                  else{
                    gb_var = 0;
                  }
                  
                  fill(255, gb_var, gb_var);
                  circle(circlex, circley, circlesize);
                }
                
            }    
            break;
        
        case LISTENER:
            for (let i=0; i<this.traversing_hits.length; i++){
                let ph_cl = Math.floor(b*1.0 - this.traversing_hits[i]*1.0); 
                // showMessage(ph_cl);
                if ((ph_cl < this.joints.length) && (ph_cl >= 0)){
                  let through = (((b*1.0 - this.traversing_hits[i]*1.0) * sched_bps) % sched_bps) / sched_bps; // B
                  let circlex = (1.0 * this.joints[ph_cl].jx) + (cell_size * through * this.x_displacements[ph_cl]);
                  let circley = (1.0 * this.joints[ph_cl].jy) + (cell_size * through * this.y_displacements[ph_cl]);
                  let circlesize = traversing_hit_size;
                  
                  var gb_var;
                  if (ph_cl == 0 && through < 0.33){
                    gb_var = 255.0 * (1.0 - (3.0*through));
                  }
                  if (ph_cl == this.length-1 && through > 0.66){
                    gb_var = 255.0 * 3.0 * (through - 0.66);
                  }
                  else{
                    gb_var = 0;
                  }
                  
                  fill(255, gb_var, gb_var);
                  circle(circlex, circley, circlesize);

                }
                
            }   
            break;
    }


    

  }



}

class OtherPHCenter{
  constructor(ID){
    this.ID = ID;
    this.center_px = grid_to_draw_coord(userinfo_table.get_x_gc(this.ID), GRID_X);
    this.center_py = grid_to_draw_coord(userinfo_table.get_y_gc(this.ID), GRID_Y);
    this.display_beats = [];
  }

  get_ID(){
    return this.ID;
  }

  register_display_beat(d_beat){
    this.display_beats.push(d_beat);
    if (this.display_beats.length > 50){
      let current_beat = get_beat();
      this.display_beats = this.display_beats.filter(
        element => 
        (element + 50) > current_beat);
    }
      
  }

  draw_other_phc(current_beat){

    let dblen = this.display_beats.length;
    if (dblen == 0){ return; }
    
     // rotate geometry
    push();
    rectMode(CENTER);
    translate(this.center_px, this.center_py);
    rotate(QUARTER_PI);

    // calculate parameters of propagating hit
    let weight;
    let size;
    let rg;

    for (let i=0; i<this.display_beats.length; i++){

      let bdiff = current_beat*1.0 - this.display_beats[i]*1.0;
      if (bdiff < 0.0){ continue; }

      if (bdiff < 1.0){
        let through_1 = ((2/3)*bdiff) + (1/3)
        weight = 3.0 - (2.0 * through_1);
        size =  through_1*multer;
        rg = Math.floor(255 - 128*(bdiff));  
      }
      
      else{
        weight = 1.0;
        size = (bdiff)*multer;
        rg = 128;
      }

      stroke(rg,rg,255);
      strokeWeight(weight);
      rect(0,0,size, size);

    }

    // set rectangle geometry back to default mode, corner
    pop();
    rectMode(CORNER);    

  }
}



class AllPHCenters{
  constructor(){
    this.other_phcs = [];
    this.own_phs = [];
    this.ophcs_len = 0;
    this.visible = true;
    this.my_px = grid_to_draw_coord(userinfo_table.get_x_gc(o2ws_bridge_id), GRID_X);
    this.my_py = grid_to_draw_coord(userinfo_table.get_y_gc(o2ws_bridge_id), GRID_Y);
  }

  set_visible(tf){
    this.visible = tf;
  }

  register_other_phc(ID){
    this.other_phcs.push(new OtherPHCenter(ID));
    this.ophcs_len += 1;
  }

  register_other_ph(display_beat, ID){
    for (let i=0; i<this.ophcs_len; i++){
      if (this.other_phcs[i].get_ID() == ID){
        this.other_phcs[i].register_display_beat(display_beat);
        return;
      }
    }
  }

  register_own_ph(display_beat){
    this.own_phs.push(display_beat);
    if (this.own_phs.length > 50){
      let current_beat = get_beat();
      this.own_phs = this.own_phs.filter(
        element => 
        (element + 50) > current_beat);
    }
  }


  draw_own_phs(current_beat){
    let phs_len = this.own_phs.length;
    if (phs_len == 0){ return; }

    push();
    rectMode(CENTER);

    translate(this.my_px, this.my_py);
    rotate(QUARTER_PI);

    let weight;
    let size;
    let rval;
    let gval;
    let bval;

    const ph_swm = 2;
    const ph_ew = 2;


    for (let i=0; i<phs_len; i++){
      let bdiff = current_beat*1.0 - this.own_phs[i]*1.0;
      if (bdiff < 0.0){ continue; }

      rval = 0;
      gval = 0;
      bval = 255;
      weight = 3;

      if (bdiff < 5.0){
        weight = (ph_swm - (bdiff - 4.0)*(ph_swm-1)) * ph_ew;
        size = (0.25 + (0.15 * bdiff)) * multer;
        rval = 255.0 * Math.max(0.2, 1.0-bdiff)
        gval = 255.0 * Math.max(Math.min(0.5 - (0.25*(bdiff-1)), 0.5),0.2);
      }else{
        weight = ph_ew;
        size = size = (bdiff-4.0) * multer;  
      }

      stroke(rval,gval,bval);
      strokeWeight(weight);
      rect(0,0,size, size);
  
    }

    // reset geometry
    pop();
    rectMode(CORNER);

  }

  draw(){
    if (!this.visible){return;}
    noFill();
    const current_beat = get_beat();
    for (let i=0; i<this.ophcs_len; i++){
      this.other_phcs[i].draw_other_phc(current_beat);
    }
    if (user_type == PERFORMER){
      this.draw_own_phs(current_beat);
    }
  }
}


class Grid{

  constructor(){
    
    // TODO: make fake nodes and fake nodes dict one class?
    this.fake_nodes = [];
    this.drawing_connection;
    this.drawn_connections;
    this.my_node;
    this.drawn_connections_display; 
    //this.all_propagating_hits; 
    this.all_ph_centers;
  
  }

  initialize_grid(){

    this.all_ph_centers = new AllPHCenters();
    this.drawn_connections_display = new AllDrawnConnectionsDisplay();

    for (let i=0; i<userinfo_table.get_size(); i++){
      // check to see if the user in the table itself represents the user
      let one_userID = userinfo_table.IDs[i];
      // TODO: add && (user_type == COMPOSER) condition to this if statement.
      // as we debug the display, we'll say that every user_type is also a composer
      if (userinfo_table.is_self(one_userID)){

        let user_px = grid_to_draw_coord(userinfo_table.get_x_gc(one_userID), GRID_X);
        let user_py = grid_to_draw_coord(userinfo_table.get_y_gc(one_userID), GRID_Y);
        
        if (user_type == COMPOSER){
          this.my_node = new ComposerNode(one_userID);
          this.drawing_connection = new DrawingConnection(user_px, user_py);
          this.drawn_connections = new AllDrawnConnections();
        }

        else if (user_type == LISTENER){
          this.my_node = new ListenerNode(one_userID);
        }

        else if (user_type == PERFORMER){
          this.fake_nodes.push(new FakeNode(one_userID));
        }
      }

      else{
        this.fake_nodes.push(new FakeNode(one_userID));
        // put a phc if it's a performer
        if (userinfo_table.get_user_type(one_userID) == PERFORMER){
          this.all_ph_centers.register_other_phc(one_userID);
        }
      }

    }
    showMessage("grid initialized \n");

  }
    
  
  // DRAW FUNCTIONS
  
  draw_grid(){

    strokeWeight(1);
    noFill();
    stroke(200);
    for (let i=GRID_X; i<=draw_rect_1; i+=cell_size){
      line(i, GRID_Y, i, draw_rect_2);
    }
    for (let i=GRID_Y; i<=draw_rect_2; i+=cell_size){
      line(GRID_X, i, draw_rect_1, i);
    }
  
  }
  

  mouse_pressed(){
    if ((voting_over_grid_initialized) && (client_state == "playing")){

      switch (user_type){

        case COMPOSER:
          if (this.my_node.contains(mouseX, mouseY)){
            this.drawing_connection.set_mouse_dragging_connection(true);
          }
          this.drawn_connections.mouse_pressed();
          break;

        case LISTENER:
          this.my_node.mouse_pressed();
          break;
      }
    }
  }

  // generate grid coordinates for a new drawnconnection
  generate_drawing_connection_coords_and_send(joints, dest_user_ID){

    let x_coords = [];
    let y_coords = [];
    // can remove this for loop with an array transform
    for (let i=0; i<joints.length; i++){
      x_coords.push(draw_to_grid_coord(joints[i].jx, GRID_X));
      y_coords.push(draw_to_grid_coord(joints[i].jy, GRID_Y));
    }
    const grid_x_string = x_coords.join(".");
    const grid_y_string = y_coords.join(".");
    o2ws_send_start("!elbs/newdc", 0.0, "ssi", true);
    o2ws_add_string(grid_x_string);
    o2ws_add_string(grid_y_string);
    o2ws_add_int32(dest_user_ID);
    o2ws_send_finish();
  }

  
  mouse_released(){

    if (voting_over_grid_initialized){
      switch (user_type){
        case COMPOSER:

          // if we are in the process of drawing a connection
          if (this.drawing_connection.get_mouse_dragging_connection()){
              // check if last joint is valid 
              let fc_idx = -1;
              for (let i=0; i<this.fake_nodes.length; i++){
                if (this.fake_nodes[i].contains(mouseX,mouseY)){
                  let fn_id = this.fake_nodes[i].get_ID();
                  if (userinfo_table.get_user_type(fn_id) == PERFORMER){
                    fc_idx = i;
                    break;
                  }
                }
              }

              // if last joint is valid
              if (fc_idx >= 0){
                // get the joints
                let finished_connection = this.drawing_connection.get_joints().slice();
                // check to see if we haven't already drawn a line to this node
                let last_joint_is_already_endpoint =   
                    this.drawn_connections.check_joint_is_endpoint(finished_connection.at(-1));
                
                if ((finished_connection.at(-1).jx == this.fake_nodes[fc_idx].get_px()) &&          
                    (finished_connection.at(-1).jy == this.fake_nodes[fc_idx].get_py()) &&
                    last_joint_is_already_endpoint == false){
                    finished_connection.pop();
                    // send the joints list and the dest user ID for a new drawn connection
                    console.log("newdc: this.fake_nodes[fc_idx].get_ID() = " 
                        + this.fake_nodes[fc_idx].get_ID());
                    this.generate_drawing_connection_coords_and_send(finished_connection, 
                        this.fake_nodes[fc_idx].get_ID());
                } 
    
                this.drawing_connection.set_mouse_dragging_connection(false);
                this.drawn_connections.mouse_released();
    
              }else{
                // if the last joint is not valid
                this.drawing_connection.set_mouse_dragging_connection(false);
                this.drawing_connection.splice_drawing_connection_joints();

              }

          }else{
            // if we are not in the middle of drawing a connection
            this.drawn_connections.mouse_released();

          }

          break; 


        case LISTENER:

          this.my_node.mouse_released();
          break;

      }

    }
    return;
    
  }

  
  draw(){

    if (voting_over_grid_initialized){
      // draw background
      fill(255);
      // draw white square behind grid
      rect(GRID_OUTLINE_X, GRID_OUTLINE_Y, (cell_size*CELLS_WIDE) + (2*node_radius), (cell_size*CELLS_HIGH) +  + (2*node_radius));
      // draw grid
      rect(GRID_X, GRID_Y, cell_size*CELLS_WIDE, cell_size*CELLS_HIGH);
      
      // draw everything black and white
      this.draw_grid()
      // draw everything with user color
      if (user_type == COMPOSER){
        this.drawing_connection.draw();
        this.my_node.draw();
        this.drawn_connections.draw();
      }

      if (user_type == LISTENER){
        this.my_node.draw();
      }
      
      // draw things with other colors
      this.drawn_connections_display.draw();

      for (let i=0; i<this.fake_nodes.length; i++){
        this.fake_nodes[i].draw();
      }

      //this.all_propagating_hits.draw();
      this.all_ph_centers.draw();

    }
  }
}




