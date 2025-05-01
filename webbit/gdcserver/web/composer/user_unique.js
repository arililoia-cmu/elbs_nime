const user_type = COMPOSER;
const composer_node_size = traversing_hit_size * 3;

const background_color_vals = [255, 200, 200];
const light_background_vals = [255, 240, 240];
const SLN_9 = 9.0 * Math.log(9.0); // 9ln9
const my_node_size = 1.5 * cell_size;

class Stop_start {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        mouse_drag.add_client(this);

        this.about_to = false;
        this.playing = false;
    }

    set_state(about_to, playing){
        this.about_to = about_to;
        this.playing = playing;
    }

    draw() {

        // background
        fill(255);
        stroke(128);
        strokeWeight(2);

        const x = this.x;
        const y = this.y;
        rect(x, y, 75, 40);    

        if (this.about_to && this.playing){
            fill(0);
            rect(x + 10, y + 10, 20, 20);
            fill(250, 250, 0);
        }

        else if (this.about_to && !this.playing){
            fill(250, 250, 0);
            rect(x + 10, y + 10, 20, 20);
            fill(0);
        }

       else if (!this.about_to && this.playing){
            fill(0);
            if (this.in_stop(mouseX, mouseY)){ strokeWeight(5); }
            rect(x + 10, y + 10, 20, 20);
            strokeWeight(2);
            fill(0, 250, 0);
        }

        else if (!this.about_to && !this.playing){
            fill(250, 0, 0);
            rect(x + 10, y + 10, 20, 20);
            fill(0);
            if (this.in_start(mouseX, mouseY)){ strokeWeight(5); }
        }

        triangle(x + 45, y + 10, x + 45, y + 30, x + 62, y + 20);

        strokeWeight(1);
        fill(0);  // restore black
    }

    in_stop(x, y) {
        return x >= this.x + 10 && x <= this.x + 30 &&
               y >= this.y + 10 && y <= this.y + 30;
    }

    in_start(x, y) {

        return x >= this.x  + 45 && x <= this.x + 62 &&
                y >= this.y + 10 && y <= this.y + 30;

    }

    contains(x, y) {
        return this.in_stop(x, y) || this.in_start(x, y);
    }

    start_drag() {  }

    dragged(dx, dy) {
        // allow only a few pixel movement before release
        if (Math.abs(dx) + Math.abs(dy) > 2) {
            // restore active state
            this.mouse_drag_handler = null;
        }
    }

    end_drag() {
        if (client_state == "0.0") {return;}
        if (this.in_start(mouseX, mouseY)) {
            this.start();
        } else if (this.in_stop(mouseX, mouseY)) {
            this.stop();
        }
    }

    start() {
        print("Stop_start start: client_state " + client_state);
        if (client_state == "ready") {
            // allow time to propagate before starting:
            let time_to_start = o2ws_time_get() + MAX_NET_DELAY;
            let beat_to_start = sched_time_to_beat(time_to_start);
            // round up to next cycle of 8 beats minus 0.5 beats:
            beat_to_start = Math.ceil((beat_to_start + 0.5)/ gdc_cycle_beats) *
                            gdc_cycle_beats - 0.5;

            // then we have to send the tempo change message
            // server will send /gdc/timemap to everyone
            o2ws_send_start("/gdc/start", 0.0, "ittd", true);
            o2ws_add_int32(tempo_epoch);
            o2ws_add_time(o2ws_time_get() + MAX_NET_DELAY);
            o2ws_add_time(beat_to_start);
            o2ws_add_double(tempo_ctrl.bpm / 60.0);
            o2ws_send_finish();
        }
    }

    stop() {
        if (client_state == "playing") {
            // client_state = "ready";
            // server will send /gdc/timemap to everyone
            o2ws_send_start("/gdc/stop", 0.0, "it", true);
            let time_for_stop = o2ws_time_get() +  MAX_NET_DELAY;
            let beat_for_stop = sched_time_to_beat(time_for_stop);
            beat_for_stop = Math.ceil(beat_for_stop);
            o2ws_add_int32(tempo_epoch);
            o2ws_add_time(beat_for_stop);
            o2ws_send_finish();
        }
    }
}

// unique to composer: mixer options
// controls "mine" and "beat"
class Mixer{

    constructor(x_start, y_start, m_width){
            
        this.x_start = x_start;
        this.y_start = y_start;
   
        this.mydrum_ctrl =  new Hslider(x_start, y_start, m_width, "Mine", 0.5, mydrum_set_gain);
        this.beat_ctrl = new Hslider(x_start, y_start + 18, m_width, "Beat", 0.5, beat_set_gain);

        this.m_width = m_width + 20;
    }

    draw(){

        fill(0);
        noStroke();
        textSize(12);
        text("Volume controls:", this.x_start, this.y_start -  18);

        this.beat_ctrl.draw();
        this.mydrum_ctrl.draw();

        stroke("gray");
        strokeWeight(1);
        noFill();
        rect(this.x_start - 8, this.y_start - 36, this.m_width, 64);

    }
}

// For use by the composer class.
// Reacts to being clicked on by the composer. 
class DrawnConnection{
    // takes in array of joints    
    // keep track of the beats at which notes have been sent
    // given current beat should be able to draw the notes at any pointdd
  
    constructor(joints, dest_ID){
      // joints includes source and destination node
      this.joints = joints;
      this.dest_ID = dest_ID;
      this.length = this.joints.length;
      this.clicked_inside = false;
      this.traversing_hits = [];
  
      // generate x and y displacements
      this.x_displacements = new Array(this.length-1).fill(1);
      this.y_displacements = new Array(this.length-1).fill(1);
  
      for (let i=1; i<this.length; i++){
        let prev_j = this.joints[i-1];
        let curr_j = this.joints[i];
        this.x_displacements[i-1] = Math.sign(curr_j.jx - prev_j.jx);
        this.y_displacements[i-1] = Math.sign(curr_j.jy - prev_j.jy);
      }
   
    }
   
    register_traversing_hit(my_played_beat){
      // let before = this.traversing_hits.length;
      this.traversing_hits.push(my_played_beat);
      this.traversing_hits.sort();
      if (this.traversing_hits.length > 50){
        this.remove_traversed_hits_dc();
      }
      // showMessage("before = " + before + " after = " + this.traversing_hits.length + "\n");
    }
  
    set_clicked_inside(val){
      this.clicked_inside = val;
    }
    
    get_clicked_inside(){
      return this.clicked_inside;
    }
    
    get_last_joint(){
      return this.joints.at(-1);
    }
  
    get_dest_ID(){
      return this.dest_ID;
    }
  
    contains(x, y){
      let is_contained = false;
          
      let distance_from_start_point = Math.sqrt(
        Math.pow(x - this.joints[0].jx, 2) +
        Math.pow(y - this.joints[0].jy, 2)
      );
  
      if (distance_from_start_point < node_radius/2){
        return false;
      }
      
      let distance_from_end_point = Math.sqrt(
        Math.pow(x - this.joints.at(-1).jx, 2) +
        Math.pow(y - this.joints.at(-1).jy, 2)
      );
    
      if (distance_from_end_point < node_radius/2){
        return false;
      }
      
      for (let i=0; i<this.length-1; i++){
        if (point_on_line_with_thickness(x, 
                                         y, 
                                         this.joints[i].jx, 
                                         this.joints[i].jy, 
                                         this.joints[i+1].jx, 
                                         this.joints[i+1].jy, 
                                         connection_width)
           ){
          is_contained = true;
          
          break;
        }
      }
      return is_contained;
    }
  
    remove_traversed_hits_dc(){
      if (this.traversing_hits.length > 0){
        let b = get_beat();
        this.traversing_hits = this.traversing_hits.filter(
          element => 
          (element + this.length + 12) > b);
      }
    }
  
    
    draw(){


      // connection itself
      stroke(0);

      // make larger if connectoin is being hovered over
      if (this.contains(mouseX, mouseY)){
        strokeWeight(connection_width * 2);
      }else{
        strokeWeight(connection_width);
      }

      // draw first line starting slightly further from starting
      // node so text not intersected
      line(
        this.joints[0].jx + (0.33 * this.x_displacements[0] * cell_size), 
        this.joints[0].jy + (0.33 * this.y_displacements[0] * cell_size), 
        this.joints[1].jx, 
        this.joints[1].jy
      );

      for (let i=1; i<this.length-1; i++){
            line(this.joints[i].jx, 
                 this.joints[i].jy, 
                 this.joints[i+1].jx, 
                 this.joints[i+1].jy);  
      }
      strokeWeight(connection_width);
  
      // draw traversing hits  
      // bdiff: beat difference, or time since display beat.
      // ph_cl: traversing hit current link. which line segment in the 
      // drawnconnection is the hit on?
      // since_display_beat: beats since the hit's initial display time
      // through_rolling_motion: how displaced the hit is from the
      // composer node. function e^((4/5)(9lnx - 9ln9)) describes how far the
      // hit is through its motion, from 0 to 1. 
      // circlex, circley: positions of circles

      noStroke();
      let b = get_beat(); 
     
      for (let i=this.traversing_hits.length-1; i>=0; i--){

        let bdiff = b*1.0 - this.traversing_hits[i]*1.0;
        if (bdiff < 0.0) {return;}
        let ph_cl = Math.floor(bdiff);

        if (ph_cl <= 8){
          let through_rolling_motion = Math.exp(9*Math.log(bdiff) - SLN_9);     
          let circlex = (1.0 * this.joints[0].jx) + (cell_size * through_rolling_motion * this.x_displacements[0]);
          let circley = (1.0 * this.joints[0].jy) + (cell_size * through_rolling_motion * this.y_displacements[0]);
          let hit_size = my_node_size - ((my_node_size-traversing_hit_size)/9.0)*bdiff;
          let r_val = Math.max(0, 255 * ((bdiff/3) - 2));
          let gb_val = Math.max(0, (255 * (1 - (bdiff/6))));
          fill(r_val, gb_val, gb_val);
          circle(circlex, circley, hit_size);
        }

        else if ((ph_cl < (this.joints.length + 8)) && (ph_cl > 8)){
          let eff_phcl = ph_cl - 8;
          let through = (bdiff % 1.0 + 1.0) % 1.0;
          let circlex = (1.0 * this.joints[eff_phcl].jx) + (cell_size * through * this.x_displacements[eff_phcl]);
          let circley = (1.0 * this.joints[eff_phcl].jy) + (cell_size * through * this.y_displacements[eff_phcl]);
          fill(255, 0, 0);
          circle(circlex, circley, traversing_hit_size);
        }
      }

    }
    
    display(){
      for (let i=0; i<this.length; i++){
        print(this.joints[i].jx + " " + this.joints[i].jy);
      }
    }
    
    
  }
  
  
  class DrawingConnection{
      constructor(root_x, root_y){
        this.root_x = root_x;
        this.root_y = root_y;
        this.root_joint = new DrawingConnectionJoint(root_x, root_y);
        this.joints = [this.root_joint];
        this.mouse_dragging_connection = false;
      }

      splice_drawing_connection_joints(){
        this.joints.splice(1);
      }

      get_mouse_dragging_connection(){
        return this.mouse_dragging_connection;
      }
    
      set_mouse_dragging_connection(mdc_val){
        this.mouse_dragging_connection = mdc_val;
        if (this.mouse_dragging_connection){
          this.joints.push(new DrawingConnectionJoint(
            this.joints[this.joints.length - 1].jx, 
            this.joints[this.joints.length - 1].jy
          ))
        }
      }
  
      draw(){
        stroke(0);
        fill(0);
        
        if (this.mouse_dragging_connection){
          // lji : last joint index
          // let lji = this.joints.length - 1;
          let stg_mx = snap_to_grid_x(mouseX);
          let stg_my = snap_to_grid_y(mouseY);
          showMessage("stg_mx: " + stg_mx + " stg_my " + stg_my + "\n");
          
          if (this.joints.length == 1){
            this.joints.push(new DrawingConnectionJoint(
            this.joints[0].jx, 
            this.joints[0].jy
            ))
          }
          
          let lji = this.joints.length - 1;
          
          
          // if we are not on a diagonal 
          let xdist = abs(this.joints[lji-1].jx - stg_mx)
          let ydist = abs(this.joints[lji-1].jy - stg_my)
          if (
            ((stg_mx == this.joints[lji-1].jx) ^ (this.joints[lji-1].jy == stg_my)) &
            (xdist == 0 || xdist == cell_size) &
            (ydist == 0 || ydist == cell_size)
          ) {
  
              // check to see if the line we're trying to draw
              // intersects with any existing line
              let intersects = false;
              let intersect_index = 0
              for (intersect_index; intersect_index<lji; intersect_index++){
               
                let x_same = (stg_mx == this.joints[intersect_index].jx);
                let y_same = (stg_my == this.joints[intersect_index].jy);
                if (x_same & y_same){
                  intersects = true; 
                  break;
                }
              } 
              
              if (intersects){
                this.joints.splice(intersect_index+1)
              }else{
                this.joints[lji].set_xy(stg_mx, stg_my);
                this.joints.push(new DrawingConnectionJoint(
                  stg_mx, stg_my
                )); 
              } 
          }
        
          lji = this.joints.length - 1;
          strokeWeight(3);
          for (let i=0; i<lji; i++){
            line(this.joints[i].jx, this.joints[i].jy, this.joints[i+1].jx, this.joints[i+1].jy);  
          }
        
        }else{
          stroke(150);
          fill(150);
          let lji = this.joints.length - 1;
          strokeWeight(3);
          for (let i=0; i<lji; i++){
            line(this.joints[i].jx, this.joints[i].jy, this.joints[i+1].jx, this.joints[i+1].jy);  
          }


        }
      }
    
      get_joints(){
        return this.joints;
      }
    
  }

