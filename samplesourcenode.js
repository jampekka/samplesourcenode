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
	await context.audioWorklet.addModule('sample-source-node-processor.js')
	return new SampleSourceNode_(context, options);
}
