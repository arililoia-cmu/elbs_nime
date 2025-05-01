// Check if AudioWorklet is available. 
let isAudioWorkletAvailable = false; 
let audioContext = null;
let media_stream = null;

let isAudioWorkletAvailable_ = false;
let hasAudioWorkletDetected_ = false; 
function _detectAudioWorklet() {
  if (hasAudioWorkletDetected_) 
    return isAudioWorkletAvailable_; 

  const OfflineAudioContextConstructor =
      window.OfflineAudioContext || window.webkitOfflineAudioContext; 
  let context = new OfflineAudioContextConstructor(1, 1, 10000); 
  isAudioWorkletAvailable_ = Boolean(
      context && context.audioWorklet &&
      typeof context.audioWorklet.addModule === 'function');
  hasAudioWorkletDetected_ = true; 
  return isAudioWorkletAvailable_; 
}


function gotStream(stream) {
    media_stream = stream;
}

const audio_init = () => {
  console.log("use_audio.js: audio_init");
    const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext; 
    audioContext = new AudioContextConstructor(); 
    print("audio_init: audioContext " + audioContext + " state " + audioContext.state);
  try {
    navigator.mediaDevices.getUserMedia({audio: true})
    .then(gotStream);
  } catch (err) {
    console.log("navigator.mediaDevices.getUserMedia() failed");
  }
  isAudioWorkletAvailable = _detectAudioWorklet(); 
};

document.documentElement.classList.remove('was-render-pending'); 
