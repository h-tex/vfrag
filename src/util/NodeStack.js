/**
 * A class to manage stacks of nodes for pagination managing both strongly and weakly held nodes.
 * Weakly held nodes that are not followed by a strongly held node are removed at the end.
 * Not all array methods are implemented, avoid modifying the array with anything other than push, pop, and splice
 */
export default class NodeStack extends Array {
	#lengthStrong;

	constructor (container) {
		if (typeof container === "number") {
			super(container);
		}
		else {
			super();
			this.container = container;
		}

		if (this.container) {
			this.range = this.container.ownerDocument.createRange();
			this.#update();
		}

		this.#lengthStrong = 0;

		// these shouldn't trigger anything by themselves, but should be taken along for the ride if a node after them gets moved
		// and should never be the last node in the stack in the final state
		// This is just an array of booleans describing the values in #all
		this.weak = [];
	}

	get last () {
		return this.at(-1);
	}

	get lastStrong () {
		return this.at(-1 - this.weak.slice().reverse().indexOf(false));
	}

	get lengthStrong () {
		return this.#lengthStrong;
	}

	heights = [];

	get height () {
		if (this.length === 0) {
			return 0;
		}

		return this.heightAt(-1);
	}

	heightAt (relativeIndex) {
		let index = relativeIndex < 0 ? this.length + relativeIndex : relativeIndex < this.length ? relativeIndex : -1;

		if (index === -1) {
			throw new Error(`Cannot resolve index ${relativeIndex} in array of length ${this.length}`);
		}

		let node = this[index];

		if (this.heights[index] === undefined) {
			// We need to calculate it
			this.range.setEndAfter(node);
			this.heights[index] = this.range.getBoundingClientRect().height;
			this.#update(); // restore range
		}

		return this.heights[index];
	}

	/**
	 * Find the last index that gives us a total height <= maxHeight
	 */
	indexOfHeight (maxHeight) {
		for (let i = this.length - 1; i >= 0; i--) {
			if (this.heightAt(i) <= maxHeight) {
				return i;
			}
		}

		return -1;
	}

	#update () {
		if (this.length === 0) {
			// Clear range start and end
			this.range.setStart(this.container, 0);
			this.range.setEnd(this.container, 0);
			return;
		}

		this.range.setStartBefore(this[0]);
		this.range.setEndAfter(this.last);
	}

	pushWeak (...nodes) {
		this.weak.push(...nodes.map(_ => true));
		this.heights.push(...nodes.map(_ => undefined));
		let ret = super.push(...nodes);
		this.#update();
		return ret;
	}

	push (...nodes) {
		this.#lengthStrong += nodes.length;
		this.weak.push(...nodes.map(_ => false));
		this.heights.push(...nodes.map(_ => undefined));
		let ret = super.push(...nodes);
		this.#update();
		return ret;
	}

	popWeak () {
		let ret = [];

		while (this.length > 0 && this.weak.at(-1)) {
			this.weak.pop();
			ret.push(super.pop());
			this.heights.pop();
		}

		this.#update();

		return ret;
	}

	pop () {
		let ret = super.pop();
		let wasWeak = this.weak.pop();
		this.heights.pop();

		if (!wasWeak) {
			this.#lengthStrong--;
		}

		this.#update();

		return ret;
	}

	splice (start, deleteCount, ...nodes) {
		let weak = this.weak.splice(start, deleteCount, ...nodes.map(_ => false));
		this.heights.splice(start, deleteCount, ...nodes.map(_ => undefined));
		let ret = super.splice(start, deleteCount, ...nodes);
		ret.weak = weak;

		this.#lengthStrong += nodes.length - weak.filter(w => !w).length;
		this.#update();
		return ret;
	}

	append (nodeStack) {
		this.push(...nodeStack);
		this.weak.push(...nodeStack.weak);
		this.heights.push(...nodeStack.weak.map(_ => undefined));
		this.#lengthStrong += nodeStack.lengthStrong;
		this.#update();
	}
}
