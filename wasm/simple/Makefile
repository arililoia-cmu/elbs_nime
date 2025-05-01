DEPS = audio_processor.cc

build: $(DEPS)
	@emcc --bind -O1 \
	  -s WASM=1 \
		-s BINARYEN_ASYNC_COMPILATION=0 \
		-s SINGLE_FILE=1 \
		audio_processor.cc \
		-o audio-processor.wasmmodule.js \
		--post-js ../lib/em-es6-module.js

clean:
	@rm -f audio-processor.wasmmodule.js
