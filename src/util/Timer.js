
export default class Timer {
	constructor () {
		this.total = 0;
	}

	get currentTime () {
		return this.running ? performance.now() - this.startTime : 0;
	}

	get running () {
		return this.startTime !== undefined;
	}

	start () {
		this.startTime = performance.now();
	}

	pause () {
		this.total += this.currentTime;
		this.startTime = undefined;
		return this.total;
	}

	end () {
		this.pause();
		return formatDuration(this.total);
	}
}

export function formatDuration (ms) {
	if (ms < 1000) {
		return (ms < 1 ? +ms.toPrecision(2) : Math.round(ms)) + " ms";
	}

	let seconds = ms / 1000;
	if (seconds < 60) {
		return +seconds.toFixed(1) + " s";
	}

	let minutes = seconds / 60;
	return +minutes.toFixed(1) + " min";
}
