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
			this.range.setStart(container, 0);
			this.range.setEnd(container, 0);
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

	heightAt (nodeOrIndex) {
		let index = nodeOrIndex > 0 ? nodeOrIndex : nodeOrIndex < 0 ? this.length + nodeOrIndex : this.indexOf(nodeOrIndex);
		let node = this[index];

		if (!node) {
			throw new Error("Node not in stack:", nodeOrIndex);
		}

		if (this.heights[index] === undefined) {
			// We need to calculate it
			this.range.setEndAfter(node);
			this.heights[index] = this.range.getBoundingClientRect().height;
			this.#update();
		}

		return this.heights[index];
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
			ret.push(this.pop());
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
}
