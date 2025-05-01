const user_type = PERFORMER;

var min_composer_distance = 8;

const background_color_vals = [200, 200, 255];
const light_background_vals = [240, 240, 255];

class Scrolling_view{
    constructor(vb_x, vb_y){

        this.x = GRID_X + cell_size;
        this.y = GRID_Y + cell_size;
        this.h = cell_size * (CELLS_HIGH - 2);
        this.w = cell_size * (CELLS_WIDE - 2);
        this.step_size = 20;
        this.visible = false;
        this.vb_x = vb_x;
        this.vb_y = vb_y;
        this.clicked_inside = false;
        this.vb_w = 100;
        this.vb_h = 25;
    
    }
    
    contains(mouseX, mouseY){
      return mouseX >= this.vb_x && mouseX <= this.vb_x + this.vb_w &&
              mouseY >= this.vb_y && mouseY <= this.vb_y + this.vb_h;
  
    }
  
    mouse_pressed(){
      if (this.contains(mouseX, mouseY)){
        this.clicked_inside = true;
      }
    }
  
    mouse_released(){
      if (this.clicked_inside){
        this.visible = !this.visible;
        gridd.all_ph_centers.set_visible(!this.visible);
        gridd.drawn_connections_display.set_visible(!this.visible);
      }
      this.clicked_inside = false;
    }
  
    draw(){
        
        if (this.contains(mouseX, mouseY)){
            strokeWeight(2);
        }else{
            strokeWeight(1);
        }
        stroke(2);
        fill(150);
        rect(this.vb_x, this.vb_y, this.vb_w, this.vb_h);

        fill(0);
        noStroke();
        textSize(12);
        text("Scrolling View", this.vb_x + 10, this.vb_y + 16);

        if (!voting_over_grid_initialized || !this.visible){ return;}
        
        if (this.visible){
          stroke(250,0,0)
          strokeWeight(20);
          fill(255,255,50);
          rect(this.x, this.y, this.w, this.h);
          
          const spacing = 80;
          const bars_width = ((this.w - spacing) / (min_composer_distance))
          const bars_start = this.x + (spacing / 2)
          const performer_lines_width = (userinfo_table.num_performers) - spacing;
          const performer_lines_start = this.y + (spacing / 2)

          stroke(0);
          strokeWeight(2);
          for (let i=0; i<(min_composer_distance + 1); i++){
            line(bars_start + (bars_width * i), this.y + (spacing / 2), 
                bars_start + (bars_width * i), this.y + this.h - spacing);
          }
          

          // draw traversing hits from drawnconnectiondisplay
          for (let h = 0; h<gridd.drawn_connections_display.connections.length; h++){
            let t_hits = gridd.drawn_connections_display.connections[h].traversing_hits;
            const performer_line_y = (1.0 * performer_lines_start) + (performer_lines_width * h);
            const drawn_connection_length = gridd.drawn_connections_display.connections[h].joints.length - 1;
            const to_subtract = drawn_connection_length - min_composer_distance;
            for (let i=0; i<t_hits.length; i++){
                let b = get_beat(); 
                for (let i=0; i<t_hits.length; i++){
                    let ph_cl = Math.floor(b*1.0 - t_hits[i]*1.0) - to_subtract; 
                    if ((ph_cl < min_composer_distance) && (ph_cl >= 0)){
                        let through = (((b*1.0 - t_hits[i]*1.0) * sched_bps) % sched_bps) / sched_bps;
                        let circ_x = (bars_width * ph_cl) + (bars_width * through) + bars_start;
                        circle(circ_x, performer_line_y, 10);
                    }
                }
            }
          }
            
        }
        noStroke(0);
        noFill(0);
      }
            
  
}


class Stop_start{

    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.about_to = false;
        this.playing = false
    }

    set_state(about_to, playing){
        this.about_to = about_to;
        this.playing = playing;
    }

    draw(){

        fill(255);
        stroke(128);
        strokeWeight(2);

        const x = this.x;
        const y = this.y;
        rect(x, y, 40, 40); 

        if (this.about_to){
            fill(255,255,0)
        }else{
            if (this.playing){
                fill(0,255,0)
            }else{
                fill(255,0,0)
            }
        }

        stroke(180);
        if (this.playing){
            triangle(this.x + 10, this.y + 10, this.x + 10, this.y + 30, this.x + 30, this.y + 20);
        }else{
            strokeWeight(1);
            rect(this.x + 10, this.y + 10, 20, 20);
        }

        fill(0);
        stroke(0);

    }

}


class Mixer{

    constructor(x_start, y_start, m_width){

        this.x_start = x_start;
        this.y_start = y_start;

        this.mydrum_ctrl = new Hslider(x_start, y_start, m_width, "Mine", 0.5, mydrum_set_gain);
        this.others_ctrl = new Hslider(x_start, y_start+18, m_width, "Others", 0.5, others_set_gain);
        this.beat_ctrl = new Hslider(x_start, y_start+36, m_width, "Beat", 0.5, beat_set_gain);

        this.m_width = m_width + 20;
        
    }

    draw(){

        fill(0);
        noStroke();
        textSize(12);
        text("Volume controls:", this.x_start, this.y_start -  18);
        
        this.others_ctrl.draw()
        this.beat_ctrl.draw()
        this.mydrum_ctrl.draw()

        stroke("gray");
        strokeWeight(1);
        noFill();
        rect(this.x_start - 8, this.y_start - 36, this.m_width, 80);

    }
}


