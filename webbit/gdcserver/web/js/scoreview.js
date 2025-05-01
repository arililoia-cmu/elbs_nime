// scoreview.js -- display a "score" or transcript to visualize drumming
//
// Roger B. Dannenberg
// September 2022

const BEATW = 30

// clear out the measure starting at the measure after beat
// when beat becomes the beat after the current display,
// advance mode_start_beat to beat
//
function scoreview_tick(beat, tick_id) {
    if (tick_id != scoreview.tick_id) {  // this tick process was cancelled
        return;
    }
    scoreview.mode_check();  // make sure table has the right size
    let beat_offset = beat - scoreview.mode_start_beat;
    let eighths = scoreview.notes.length;
    // if index will be beyond array, increase mode_beat_start
    let i = Math.round(beat_offset * 2);
    while (i >= eighths) {
        scoreview.mode_start_beat += gdc_cycle_beats * gdc_mode_steps *
                                     scoreview.periods;
        beat_offset = beat - scoreview.mode_start_beat;
        i = Math.round(beat_offset * 2);
    }
    // print("scoreview_tick", get_beat(), beat, scoreview.mode_start_beat,
    //      beat_offset, i, Math.floor((beat - scoreview.mode_start_beat) * 2));
    for (let j = 8; j < 16; j += 1) {  // clear the beats 1 bar ahead
        scoreview.notes[(i + j) % scoreview.notes.length].fill(false);
        // print("scoreview clear", (i + j) % scoreview.notes.length,
        //       scoreview.notes.length);
    }
    sched_cause(beat + 4, scoreview_tick, beat + 4, tick_id);
}


class Scoreview {
    constructor(y) {
        this.enabled = false;
        this.orig_h = y;
        this.y = y + 20;  // leave 20 pixel margin above transcription
        this.update();
        this.mode_start_beat = 0;
        this.tick_id = 0;
        this.update();
    }

    // call this when client_state becomes "ready" to finish construction:
    start() {
        this.mode_start_beat = calculate_mode_start_beat(sched_beat,
                                    gdc_mode_steps, gdc_cycle_beats);
        // start clearing display one measure ahead
        // when do we hit the next measure?
        let beat = get_beat();
        let next_measure = Math.floor(beat * 0.25) * 4 + 4;
        this.tick_id += 1;  // cancel any previously scheduled callbacks
        sched_cause(next_measure, scoreview_tick, next_measure + 4,
                    this.tick_id);
    }

    // check for mode change and update scoreview if needed
    mode_check() {
        let eighths = gdc_cycle_beats * gdc_mode_steps * this.periods * 2;
        if (eighths != scoreview.notes.length) {
            this.update();  // recompute table
        }
    }

    update() {
        let parts = Math.max(1, userinfo_table.IDs.length);
        let eighths = gdc_cycle_beats * gdc_mode_steps * 2;
        this.periods = (eighths < 32 ? 2 : 1);  // show 2 if periods are short
        eighths *= this.periods;
        print("scoreview update", eighths, this.periods)
        this.notes = new Array(eighths);
        for (let i = 0; i < eighths; i++) {
            this.notes[i] = new Array(parts).fill(false);
        }
    }

    drumhit(id, beat) {
        let part = userinfo_table.id_map[id];
        if (beat == 0) {
            beat = get_beat();
        }
        let i = Math.round((beat - this.mode_start_beat) * 2);
        if (i == this.notes.length) {  // rounded up on last eighth!
            i = 0;  // special case: we rounded up to the next mode_start_beat
        }
        if (i < 0 || i >= this.notes.length) {
            print("ERROR! bad index in drumhit", i, beat, this.mode_start_beat);
        } else {
            this.notes[i][part] = true;
            o2ws_status_msg("scoreview beat " + beat + " i " + i +
                            " part ", part);
        }
    }

    draw() {
        const LABELW = 50   // width of labels at left
        const PARTH = 30    // height of each part
        let parts = userinfo_table.IDs.length;
        let bottom = this.y + 40 + PARTH * parts;
        let w = LABELW + BEATW * gdc_cycle_beats * gdc_mode_steps *
                         this.periods;
        noStroke();
        fill(light_background);
        rect(0, this.orig_h - 20, width, 20);
        fill(128);
        text(this.enabled ? "Click to collapse transcription" :
                            "Click to open transcription view...",
             10, this.orig_h - 5);
        mouse_drag.add_client(this);
        if (!this.enabled) return;
        fill(115, 153, 0);  // dark green for table
        rect(10, this.y, w, 40 + PARTH * parts);
        fill(180);  // transcription area is gray
        rect(10 + LABELW, this.y + 40, w - LABELW, PARTH * parts);
        stroke(255);
        strokeWeight(1);
        // left vertical line after names
        line(10 + LABELW, this.y, 10 + LABELW, bottom)

        // labels and separators between parts
        textSize(12);
        for (let part = 0; part < parts; part++) {
            let y = this.y + 40 + PARTH * part;
            noStroke();
            // truncate name to fit into limited space
            fill(255);
            text(userinfo_table.usernames[part].substr(0, 9), 12, y + 12);
            if (userinfo_table.admin_statuses[part]) {
                text("(leader)", 12, y + 25);
            }
            stroke(255);
            line(0, y, 10 + w, y);

            // draw hits from recorded notes; each i is 1/2 beat
            noStroke();
            for (let i = 0; i < this.notes.length; i++) {
                if (this.notes[i][part]) {
                    fill(USER_COLORS[part % USER_COLORS.length]);
                    rect(60 + i * (BEATW * 0.5), y, BEATW * 0.5 - 1, 30);
                }
            }
        }

        // beat lines
        stroke(255);
        for (let x = 10 + LABELW; x < w; x += BEATW) {
            line(x, this.y + 20, x, bottom);
        }

        // bar lines
        let bar_num = 0;
        for (let x = 10 + LABELW; x < w; x += BEATW * 4) {
            noStroke();
            fill(255);
            text("" + (bar_num + 1), x + 55, this.y + 15);
            bar_num = (bar_num + 1) % (gdc_cycle_beats * gdc_mode_steps / 4);
            stroke(255);
            line(x, this.y, x, this.y + 20);
        }

        // top horizontal line after measure numbers
        strokeWeight(2);
        line(10 + LABELW, this.y + 20, 10 + w, this.y + 20);
    }

    contains(x, y)  { print("contains", x, y);
                      return this.orig_h - 20 < y && y < this.orig_h; }
    start_drag()    { }
    dragged(dx, dy) {
        if (Math.abs(dx) + Math.abs(dy) > 5) {
            mouse_drag.mouse_drag_handler = null;
        }
    }

    end_drag() {
        if (this.enabled) {
            this.enabled = false;
            resizeCanvas(width, this.orig_h);
        } else {
            this.enabled = true;
            resizeCanvas(width, this.orig_h + 300);
        }
    }
}
