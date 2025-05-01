
#include "emscripten/bind.h"

using namespace emscripten;

const unsigned kRenderQuantumFrames = 128;
const unsigned kBytesPerChannel = kRenderQuantumFrames * sizeof(float);


class Audio_processor {
  public:
    
    Audio_processor() { }


    void Process(uintptr_t input_ptr, uintptr_t output_ptr,
                 unsigned channel_count) {
        float* input_buffer = reinterpret_cast<float*>(input_ptr);
        float* output_buffer = reinterpret_cast<float*>(output_ptr);
        float sumsq = 0;
        // Bypasses the data. By design, the channel count will always
        // be the same for |input_buffer| and |output_buffer|.
        float* destination = output_buffer;
        float* source = input_buffer;
        memcpy(destination, source, sizeof(float) * kRenderQuantumFrames);
    }        
};




EMSCRIPTEN_BINDINGS(CLASS_Audio_processor) {
  class_<Audio_processor>("Audio_processor")
      .constructor()
      .function("process",
                &Audio_processor::Process,
                allow_raw_pointers())
      ;
}

