
export default class Timer {
	constructor (total = 0) {
		this.total = total;
	}

	get currentTime () {
		return this.running ? performance.now() - this.startTime : 0;
	}

	get running () {
		return this.startTime !== undefined;
	}

	toString () {
		return Timer.formatMs(this.valueOf());
	}

	valueOf () {
		return this.total + this.currentTime;
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
		return this.toString();
	}

	static formatMs (ms) {
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
}
