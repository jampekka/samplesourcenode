class SampleSourceNodeProcessor extends AudioWorkletProcessor {
	constructor(options) {
		super()
		this.buffer_data = options.processorOptions.buffer_data;

		this.start_i = currentFrame;
		this.loopEnd_i = this.buffer_data[0].length;
		
		this.startTime = -1;
		this.startPending = false;
		this.port.onmessage = (msg) => {
			let t = msg.data.type;
			if(t == "start") {
				this.startPending = true;
				// Multiple starts will restart?
				// Do we want this?
				this.start_i = -1;

			}

			if(t == "stop") {
				this.startPending = false;
				this.start_i = -1;
			}
		};
	}

	static get parameterDescriptors() {
		// TODO: Could be a-rate
		// TODO: Using negative values for disabling these. A bit ugly
		// but makes things simpler.
		return [
			// startAt as a param gets complicated when we want
			// to start exactly on a process call. And automating it is not
			// really needed ATM.
			//{name: "startAt", defaultValue: -1.0, automationRate: 'k-rate'},
			{name: "loopEnd", defaultValue: -1.0, automationRate: 'k-rate'},
		]
	}

	process(inputs, outputs, parameters) {
		let output = outputs[0];
		if(this.startPending) {
			this.start_i = currentFrame;
			this.startPending = false;
		}

		let startAt_i = this.start_i;
		if(startAt_i < 0 || startAt_i > currentFrame + outputs.length[0]) {
			// TODO: We skip playing rest of the buffer.
			// TODO: We could return false here, but I don't know if this
			// can be revived?
			
			return true;
		}

		let loopEnd = parameters.loopEnd[0];
		
		let loopEnd_i = Math.round(loopEnd*sampleRate);

		for(let ch=0; ch < outputs.length; ++ch) {
			let out = output[ch];
			let buf = this.buffer_data[ch];
			for(let i=0; i < out.length; ++i) {
				let source_i = currentFrame - startAt_i + i;
				// Loop back the buffer if we are looping
				if(loopEnd_i > 0) {
					source_i = source_i % loopEnd_i;
				}
				
				// Can this get missed if we drop frames?
				// Can we drop frames?
				// Is this expensive here?
				// Should we try to pre-empt the event latency?
				if(source_i == 0 && ch == 0) {
					// Get performance.now or something?
					// Or do we get this in the message event?
					this.port.postMessage({
						type: "sample_start",
						playbackTime: currentTime + sampleRate*i,
					});
				}
				
				if(source_i < buf.length) {
					out[i] += buf[source_i];
				}
			}
		}

		return true;
	}
}

registerProcessor("sample-source-node-processor", SampleSourceNodeProcessor);
