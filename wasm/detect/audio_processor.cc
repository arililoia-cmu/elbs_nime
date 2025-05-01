
#include "emscripten/bind.h"

using namespace emscripten;

const unsigned kRenderQuantumFrames = 128;
const unsigned kBytesPerChannel = kRenderQuantumFrames * sizeof(float);


class Audio_processor {
  public:
    float prev_sumsq, prev_rms;
    bool ready;

    float avg, std, var, noisefloor;
    const float nfthreshold = 20;

    // first butterworth filter (a)
    // b0 b1 b2 a0 a1 a2 captured from NYQ:BIQUAD-M:
    // 0.994934 -1.98987 0.994934 1.13119 -1.97973 0.868807
    const float a0ra = 1.0 / 1.13119;
    const float b0a = 0.994934 * a0ra;
    const float b1a = -1.98987 * a0ra;
    const float b2a = 0.994934 * a0ra;
    const float a1a = 1.97973 * a0ra;
    const float a2a = -0.868807 * a0ra;
    float z1a = 0.0;
    float z2a = 0.0;

    // second butterworth filter (b)
    // b0 b1 b2 a0 a1 a2 captured from NYQ:BIQUAD-M:
    // 0.994934 -1.98987 0.994934 1.05434 -1.97973 0.945661
    const float a0rb = 1.0 / 1.05434;
    const float b0b = 0.994934 * a0rb;
    const float b1b = -1.98987 * a0rb;
    const float b2b = 0.994934 * a0rb;
    const float a1b = 1.97973 * a0rb;
    const float a2b = -0.945661 * a0rb;
    float z1b = 0.0;
    float z2b = 0.0;    

    int blocks;  // block counter
    static const int peaks_max = 4;
    struct {
        int block;
        float rms;
    } peaks[peaks_max];  // queue of up to 4 peak times
    int peaks_i;   // index into queue

    float hit_rms;  // holds peak rms for retrieval by get_rms()
    
    Audio_processor() { 
        ready = true; 
        prev_sumsq = 0; prev_rms = 0; hit_rms = -100;
        avg = 0; std = 1; var = 1; noisefloor = 1.0;
        peaks_i = 0; blocks = 0; }

    void Process(uintptr_t input_ptr, uintptr_t output_ptr,
                 unsigned channel_count) {
        float* input_buffer = reinterpret_cast<float*>(input_ptr);
        float* output_buffer = reinterpret_cast<float*>(output_ptr);
        float sumsq = 0;
        // Bypasses the data. By design, the channel count will always
        // be the same for |input_buffer| and |output_buffer|.
        float* destination = output_buffer;
        float* source = input_buffer;
        for (int i = 0; i < kRenderQuantumFrames; i++) {
            float *samp_ptr = source + i;

            // apply first highpass filter:
            float z0 = *samp_ptr + a1a * z1a + a2a * z2a;
            float out = z0 * b0a + z1a * b1a + z2a * b2a;
            z2a = z1a;
            z1a = z0;

            // apply second highpass filter:
            z0 = out + a1b * z1b + a2b * z2b;
            out = z0 * b0b + z1b * b1b + z2b * b2b;
            z2b = z1b;
            z1b = z0;
            sumsq += out * out;
        }

// DEBUG:
        memcpy(destination, source, sizeof(float) * kRenderQuantumFrames);

        float rms = (sumsq + prev_sumsq) / (kRenderQuantumFrames * 2);
        rms = sqrt(rms);
        prev_sumsq = sumsq;  // save half window sum for use next time

        // peak detection based on experiments with Nyquist. Could
        // benefit from more test data and some optimization of
        // parameters.  Algorithm: High-pass the input with a 4th
        // order filter at 1000hz.  (This is to remove low-frequency
        // booms that can appear at or below the RMS rate: the
        // positive peaks of low frequency sines look like drum hits.)
        //
        // Compute RMS using 256-sample windows, overlap 50%. (see above)
        // Compute the slope of the RMS signal.
        // Take the maximum of the slope and zero (no negative slope values).
        // Call this signal S. We're looking for peaks in S when RMS is well
        // above the noise floor, so next we calculate noise floor:
        //
        // Initially noisefloor is 1.0. When RMS is less, decrease
        // noisefloor to the maximum of noisefloor * 0.5 and the
        // actual RMS. We assume that if we hear anything quiet, it's
        // a strong indicator that the noisefloor is in that range, so
        // we want to cut the noisefloor quickly, but we do not
        // directly set noisefloor to a lower RMS, because in
        // practice, background noise RMS fluctuates and sometimes
        // (maybe through destructive cancellation?)  RMS for one
        // window can be abnormally low. By never cutting noisefloor
        // by more than half, we would need 3 very low readings in a
        // row even to reduce the noisefloor to less than 1/4. When
        // RMS is greater, increase by 1.001, so we get a very slow
        // rising noisefloor estimate if the background noise
        // increases.
        //
        // When the slope rises above the average positive slope by
        // more than 3 standard deviations AND if RMS is greater than
        // 10 times the noisefloor, we call it a "hit":
        // If S - avg > std * 3 && RMS > noisefloor * 20, output a
        // "hit" and don't output another hit until S - avg < std.
        //
        // Then update avg and std and noisefloor:
        //     At each sample, update noisefloor:
        //         if RMS < noisefloor: noisefloor =
        //                              max(RMS, noisefloor * nfthreshold)
        //         elif RMS > noisefloor: noisefloor *= 1.001
        //     At each sample, update average:
        //         avg = 0.99 * avg + 0.01 * S
        //     At each sample, update standard deviation:
        //         diff2 = (S - avg) ** 2
        //         // limit diff2, especially when there's a hit, which
        //         // gives a large value:
        //         diff2 = min(max(var * 2, 0.0001), diff2)
        //         var = 0.99 * var + 0.01 * diff2
        //         std = sqrt(var)
        // 
        // 
        if (rms < noisefloor) {
            noisefloor = noisefloor * 0.5;
            if (noisefloor < rms) {
                noisefloor = rms;
            }
        } else if (rms > noisefloor) {
            noisefloor *= 1.001;
        }

        float s = rms - prev_rms;  // compute slope of rms
        if (s < 0) s = 0;          // max(rms, 0)
        prev_rms = rms;      // save for next time
        float diff = s - avg;
        if (ready) {
            if (diff > std * 3 && rms > noisefloor * nfthreshold) {
                output_hit();
                ready = false;    // disable more hits until peak subsides
            }
        } else if (diff < std) {
            ready = true;  // peak subsided, so reenable peak detection
        }
        avg = 0.99 * avg + 0.01 * s;
        float diff2 = diff * diff;
        float maxdiff2 = var * 2;
        if (maxdiff2 < 0.0001F) maxdiff2 = 0.0001F;  // not too small
        if (diff2 > maxdiff2) diff2 = maxdiff2;
        var = 0.99 * var + 0.01 * diff2;
        std = sqrt(var);
        blocks += 1;  // block counter
    }        

    void output_hit() {
        if (peaks_i >= peaks_max) {  // make room
            get_hit();
        }
        peaks[peaks_i].block = blocks;
        peaks[peaks_i].rms = prev_rms;
        peaks_i++;
    }

    // get_hit returns hit time if any. Since I don't know how
    // to return multiple values to JavaScript, the time (block
    // number) and rms are returned by separate functions.
    // Call get_hit() first. If it returns 0, there is no hit.
    // If it returns a block count > 0, there is a hit and as
    // a side effect, hit_rms is set and can be retrieved with
    // the get_rms() function.
    long get_hit() {
        if (peaks_i == 0) {
            return 0;
        }
        hit_rms = (int) (20 * log10(peaks[0].rms));
        long result = peaks[0].block;
        peaks_i--;
        memmove(peaks, peaks + 1, sizeof(peaks[0]) * peaks_i);
        return result;
    }

    int get_rms() { return hit_rms; }

    float testfn() { return prev_rms; }

};




EMSCRIPTEN_BINDINGS(CLASS_Audio_processor) {
  class_<Audio_processor>("Audio_processor")
      .constructor()
      .function("process",
                &Audio_processor::Process,
                allow_raw_pointers())
      .function("get_hit", &Audio_processor::get_hit)
      .function("get_rms", &Audio_processor::get_rms)
      .function("testfn", &Audio_processor::testfn)
      ;
}

