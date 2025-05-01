export const audio_setup = async (context, logger, stream) => {
  await context.audioWorklet.addModule('wasm-worklet-processor.js'); 
  // const oscillator = new OscillatorNode(context); 
  const audio_input = context.createMediaStreamSource(stream);
  const bypasser = new AudioWorkletNode(context, 'wasm-worklet-processor'); 
  // bypasser.port.onmessage = (m) => { console.log("msg " + m.data); }
  // oscillator.connect(bypasser).connect(context.destination); 
  // oscillator.start(); 
  audio_input.connect(bypasser).connect(context.destination);
};
