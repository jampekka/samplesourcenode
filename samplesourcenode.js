// TODO: Where to load this?

class SampleSourceNode_ extends AudioWorkletNode {
	constructor(context, options) {
		// TODO: We should probably await, but no can do on a constructor of course
		// TODO: Configure outputs based on the input sample
		
		let buffer = options.buffer;
		let channels = [];
		for(let i=0; i < buffer.numberOfChannels; ++i) {
			channels.push(buffer.getChannelData(i));
		}

		super(context, "sample-source-node-processor", {
			processorOptions: {buffer_data: channels},
			outputChannelCount: [channels.length],
		});

		for(let [k, v] of this.parameters.entries()) {
			this[k] = v
		}
	}

	start() {
		// TODO: API for asking the node start/stop state
		this.port.postMessage({"type": "start"});
	}

	stop() {
		this.port.postMessage({"type": "stop"});
	}
}

async function SampleSourceNode(context, options) {
	// Probably has to be done only once?
	// Hack the source code out of the function below. Having it in
	// a separate script is painful for distribution.
	
	let workerBlob = new Blob(
    		[__PROCESSOR_SOURCE_HACK__.toString().replace(/^function .+\{?|\}$/g, '')],
    		{ type:'text/javascript' });
	let url = URL.createObjectURL(workerBlob);
	await context.audioWorklet.addModule(url)
	return new SampleSourceNode_(context, options);
}

function __PROCESSOR_SOURCE_HACK__() {
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
}

