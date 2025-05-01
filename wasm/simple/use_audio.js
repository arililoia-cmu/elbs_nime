// Check if AudioWorklet is available. 
export let isAudioWorkletAvailable = false; 
export let audioContext = null;
export let media_stream = null;

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

export const audio_init = () => {
  const AudioContextConstructor =
      window.AudioContext || window.webkitAudioContext; 
  audioContext = new AudioContextConstructor(); 
  try {
    navigator.mediaDevices.getUserMedia({audio: true})
    .then(gotStream);
  } catch (err) {
    console.log("navigator.mediaDevices.getUserMedia() failed");
  }
  isAudioWorkletAvailable = _detectAudioWorklet(); 
};

document.documentElement.classList.remove('was-render-pending'); 
