class SampleSourceNodeProcessor extends AudioWorkletProcessor {
	constructor(options) {
		super()
		this.buffer_data = options.processorOptions.buffer_data;

		this.start_i = currentFrame;
		this.loopEnd_i = this.buffer_data[0].length;

		/*
		this.start_asap = false;
		this.port.onmessage = (msg) => {
			let t = msg.type;
			if(t == "start_asap") {
				this.start_asap = true;
			}
		};*/
	}

	static get parameterDescriptors() {
		// TODO: Could be a-rate
		// TODO: Using negative values for disabling these. A bit ugly
		// but makes things simpler.
		return [
			{name: "startAt", defaultValue: -1.0, automationRate: 'k-rate'},
			{name: "loopEnd", defaultValue: -1.0, automationRate: 'k-rate'},
		]
	}

	process(inputs, outputs, parameters) {
		//console.log("Processing", {inputs, outputs, parameters});
		//console.log({currentFrame, currentTime, sampleRate});
		

		let output = outputs[0];
		let startAt = parameters.startAt[0];
		if(startAt < 0 || startAt > currentTime + outputs.length[0]*sampleRate) {
			// TODO: We skip playing rest of the buffer.
			// TODO: We could return false here, but I don't know if this
			// can be revived?
			
			return true;
		}

		let loopEnd = parameters.loopEnd[0];
		
		let startAt_i = Math.round(startAt*sampleRate);
		let loopEnd_i = Math.round(loopEnd*sampleRate);

		for(let ch=0; ch < outputs.length; ++ch) {
			let out = output[ch];
			let buf = this.buffer_data[ch];
			for(let i=0; i < out.length; ++i) {
				let source_i = startAt_i + currentFrame + i;
				// Loop back the buffer if we are looping
				if(loopEnd_i > 0) {
					source_i = source_i % loopEnd_i;
				}

				// Can this get missed if we drop frames?
				// Can we drop frames?
				// Is this expensive here?
				// We can miss the first play in the loop?
				// Should we try to pre-empt the event latency?
				if(source_i == 0 && ch == 0) {
					this.port.postMessage({
						type: "sample_start",
						playbackTime: currentTime + sampleRate*i
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
