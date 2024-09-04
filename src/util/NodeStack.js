export default class NodeStack {
	#all;
	#weak;
	#lengthStrong;

	constructor (container) {
		this.container = container;
		this.range = container.ownerDocument.createRange();
		this.range.setStart(container, 0);
		this.range.setEnd(container, 0);
		this.#all = [];
		this.#lengthStrong = 0;

		// these shouldn't trigger anything by themselves, but should be taken along for the ride if a node after them gets moved
		// and should never be the last node in the stack in the final state
		// This is just an array of booleans describing the values in #all
		this.#weak = [];
	}

	get last () {
		return this.#all.at(-1);
	}

	get lastStrong () {
		return this.#all.at(-1 - this.#weak.slice().reverse().indexOf(false));
	}

	get length () {
		return this.#all.length;
	}

	get lengthStrong () {
		return this.#lengthStrong;
	}

	[Symbol.iterator] () {
		return this.#all[Symbol.iterator]();
	}

	#heights = [];

	get height () {
		return this.#heights[this.#heights.length - 1] ??= this.range.getBoundingClientRect().height;
	}

	#update () {
		if (this.last) {
			this.range.setEndAfter(this.last);
		}
		else {
			this.range.setEnd(this.container, 0);
		}
	}

	pushWeak (...nodes) {
		this.#weak.push(...nodes.map(_ => true));
		this.#heights.push(...nodes.map(_ => undefined));
		let ret = this.#all.push(...nodes);
		this.#update();
		return ret;
	}

	push (...nodes) {
		this.#lengthStrong += nodes.length;
		this.#weak.push(...nodes.map(_ => false));
		this.#heights.push(...nodes.map(_ => undefined));
		let ret = this.#all.push(...nodes);
		this.#update();
		return ret;
	}

	popWeak () {
		let ret = [];

		while (this.#weak.at(-1)) {
			this.#weak.pop();
			this.#all.pop();
			this.#heights.pop();
		}

		this.#update();

		return ret;
	}

	pop () {
		let ret = this.#all.pop();
		let wasWeak = this.#weak.pop();
		this.#heights.pop();
		if (!wasWeak) {
			this.#lengthStrong--;
		}

		this.#update();

		return ret;
	}
}
