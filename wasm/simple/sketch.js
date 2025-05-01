// play some timed drums with shared function to play from buffer

var DRUM_URL = "stortromme.mp3";
var wactx;  // web audio context
var drum_buffer = null;


function onError() {
    console.log("Error (decodeAudioData?)");
}


function preload() {
    var request = new XMLHttpRequest();
    request.open('GET', DRUM_URL, true);
    request.responseType = 'arraybuffer';

    request.onload = function() {
        wactx.decodeAudioData(request.response, function(buffer) {
                drum_buffer = buffer;
            }, onError);
    }
    request.send();
}


function setup() {
    createCanvas(320, 240);
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        wactx = new AudioContext();
    } catch (e) {
        alert("Web Audio API is not supported in this browser");
    }
}

function draw() {
    background(200, 200, 255);
    fill("white");
    rect(10, 20, 50, 50);
    rect(70, 20, 50, 50);
    if (!playing) fill("lightgreen");
    rect(130, 20, 50, 50);
    if (playing) fill(255, 96, 96);
    else fill("white");
    rect(190, 20, 50, 50);
    fill(0);
    text("Drum", 20, 40);
    text("Delay", 80, 40);
    text("Start", 140, 40);
    text("Stop", 200, 40);
    text('Try serving with "python -m http.server"', 10, 100);
}

function mousePressed() {
    console.log("mousePressed " + mouseX + " " + mouseY);
    if (mouseY > 20 && mouseY < 70) {
        if (mouseX < 10) {
            return;
        } else if (mouseX < 60) {
            drum_hit(1);
        } else if (mouseX < 70) {
            return;
        } else if (mouseX < 120) {
            drum_hit(2);
        } else if (mouseX < 130) {
            return;
        } else if (mouseX < 180) {
            drum_hit(3);
        } else if (mouseX < 190) {
            return;
        } else if (mouseX < 240) {
            drum_hit(4);
        }
    }
}


function play_drum(when)
{
    let source = wactx.createBufferSource();
    source.buffer = drum_buffer;
    source.connect(wactx.destination);
    source.start(when);
}


let playing = false;
let next_play_time = null;

function schedule_drums()
{
    if (!playing) return;
    let now = wactx.currentTime;
    let delay = next_play_time - now;
    if (delay < 0.25) {
        play_drum(next_play_time);
        next_play_time = wactx.currentTime + 0.5;
        schedule_drums();
    } else {
        setTimeout(schedule_drums, delay * 1000);
    }
}


// box 1 plays a sound
// box 2 plays a sound with delay
// box 3 starts playing a drum sequence
// box 4 stops the sequence
//
function drum_hit(n) {
    if (n == 1) {
        print("Drum hit (" + n + "): at time " + wactx.currentTime);
        play_drum(0);
    } else if (n == 2) {
        print("Delayed drum hit (" + n + "): at time " + wactx.currentTime);
        play_drum(wactx.currentTime + 1.0);
    } else if (n == 3) {
        if (playing) {
            print("Already playing.");
        } else {
            playing = true;
            next_play_time = wactx.currentTime;
            schedule_drums();
        }
    } else if (n == 4) {
        playing = false;
    }
}
