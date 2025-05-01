const user_type = LISTENER;

var listener_latest_beat = 0.0;

const background_color_vals = [200, 255, 200];
const light_background_vals = [240, 255, 240];

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
        
        this.others_ctrl = new Hslider(x_start, y_start, m_width, "Others", 0.5, others_set_gain);
        this.beat_ctrl = new Hslider(x_start, y_start + 18, m_width, "Beat", 0.5, beat_set_gain);
        this.m_width = m_width + 20;
        
    }

    draw(){

        fill(0);
        noStroke();
        textSize(12);
        text("Volume controls:", this.x_start, this.y_start -  18);
        
        this.others_ctrl.draw()
        this.beat_ctrl.draw()

        stroke("gray");
        strokeWeight(1);
        noFill();
        rect(this.x_start - 8, this.y_start - 36, this.m_width, 64);

    }
}

