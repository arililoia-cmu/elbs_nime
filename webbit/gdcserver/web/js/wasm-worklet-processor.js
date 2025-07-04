/**
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

 import Module from './audio-processor.wasmmodule.js';
 import { RENDER_QUANTUM_FRAMES, MAX_CHANNEL_COUNT, HeapAudioBuffer }
 from './wasm-audio-helper.js';
 
 var block_count = 0;
 
 
 /**
  * A simple demonstration of WASM-powered AudioWorkletProcessor.
  *
  * @class WASMWorkletProcessor
  * @extends AudioWorkletProcessor
  */
 class WASMWorkletProcessor extends AudioWorkletProcessor {
     /**
      * @constructor
      */
     constructor() {
         super();
 
         // Allocate the buffer for the heap access. Start with stereo,
         // but it can be expanded up to 32 channels.
         this._heapInputBuffer = new HeapAudioBuffer(Module, 
                 RENDER_QUANTUM_FRAMES, 2, MAX_CHANNEL_COUNT);
         this._heapOutputBuffer = new HeapAudioBuffer(Module, 
                 RENDER_QUANTUM_FRAMES, 2, MAX_CHANNEL_COUNT);
         this._kernel = new Module.Audio_processor();
     }
 
     /**
      * System-invoked process callback function.
      * @param  {Array} inputs Incoming audio stream.
      * @param  {Array} outputs Outgoing audio stream.
      * @param  {Object} parameters AudioParam data.
      * @return {Boolean} Active source flag.
      */
     process(inputs, outputs, parameters) {
         // Use the 1st input and output only to make the example
         // simpler. |input| and |output| here have the similar
         // structure with the AudioBuffer interface. (i.e. An array of
         // Float32Array)
         let input = inputs[0];
         let output = outputs[0];
 
         // For this given render quantum, the channel count of the
         // node is fixed and identical for the input and the output.
         let channelCount = input.length;
 
         // Prepare HeapAudioBuffer for the channel count change in the
         // current render quantum.
         this._heapInputBuffer.adaptChannel(channelCount);
         this._heapOutputBuffer.adaptChannel(channelCount);
 
         // Copy-in, process and copy-out.
         for (let channel = 0; channel < channelCount; ++channel) {
             this._heapInputBuffer.getChannelData(channel).set(input[channel]);
         }
 
         this._kernel.process(this._heapInputBuffer.getHeapAddress(),
                              this._heapOutputBuffer.getHeapAddress(),
                              channelCount);
 /* DEBUG
         block_count += 1;
         if (block_count % 100 == 0) {
             let rms = this._kernel.testfn();
             this.port.postMessage("rms " + rms);
         }
 */
         let block = this._kernel.get_hit();
         if (block != 0) {
             let rms = this._kernel.get_rms();
             this.port.postMessage("hit " + rms + " " + block);
         }
 
         for (let channel = 0; channel < channelCount; ++channel) {
           output[channel].set(this._heapOutputBuffer.getChannelData(channel));
         }
 
         return true;
     }
 }
 
 
 registerProcessor('wasm-worklet-processor', WASMWorkletProcessor);
 