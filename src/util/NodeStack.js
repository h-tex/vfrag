export default class NodeStack {
	#all;
	#weak;
	#lengthStrong;

	constructor () {
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

	pushWeak (...nodes) {
		this.#weak.push(...nodes.map(_ => true));
		return this.#all.push(...nodes);
	}

	push (...nodes) {
		this.#lengthStrong += nodes.length;
		this.#weak.push(...nodes.map(_ => false));
		return this.#all.push(...nodes);
	}

	popWeak () {
		let ret = [];

		while (this.#weak.at(-1)) {
			this.#weak.pop();
			this.#all.pop();
		}

		return ret;
	}

	pop () {
		let ret = this.#all.pop();
		let wasWeak = this.#weak.pop();

		return ret;
	}
}
