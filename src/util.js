// NOTE These don't take borders into account
export function getOuterHeight (innerHeight, style) {
	if (style.box_sizing === "border-box") {
		return innerHeight;
	}
	else if (style.box_sizing === "content-box") {
		return innerHeight + style.padding_block;
	}
}

export function getInnerHeight (outerHeight, style) {
	if (style.box_sizing === "border-box") {
		return outerHeight - style.padding_block;
	}
	else if (style.box_sizing === "content-box") {
		return outerHeight;
	}
}

const styles = new WeakMap();
export function getStyle (node, {pageBreak = true, lh = true, page} = {}) {
	if (!node || node instanceof Node && node.nodeType !== 1) {
		return null;
	}

	let style = styles.get(node);

	if (style) {
		return style;
	}

	style = {};
	let cs = node instanceof CSSStyleDeclaration ? node : getComputedStyle(node);

	style.position = cs.getPropertyValue("position");

	// NOTE Does not handle complicated values, just single keywords.
	if (pageBreak) {
		for (let prop of ["inside", "before", "after"]) {
			let value = cs.getPropertyValue("break-" + prop);
			if (value === "auto") {
				value = cs.getPropertyValue("page-break-" + prop);
			}

			if (value !== "auto") {
				style['break_' + prop] = value;
			}
		}
	}

	if (lh) {
		style.lh = parseFloat(cs.getPropertyValue("line-height"));
	}

	if (page) {
		style.padding_block_start = parseFloat(cs.getPropertyValue("padding-block-start")) || 0,
		style.padding_block_end = parseFloat(cs.getPropertyValue("padding-block-end")) || 0,
		style.padding_block = style.padding_block_start + style.padding_block_end;
		style.box_sizing = cs.getPropertyValue("box-sizing");
		style.min_height = parseFloat(cs.getPropertyValue("min-height")) || 0;
	}

	styles.set(node, style);
	return style;
}

function findHighestValue (low, high, f, upperBound) {
	let left = low;
	let right = high;
	let best = -1; // Initialize to -1 or any value indicating no valid result found

	while (left <= right) {
		let mid = Math.floor((left + right) / 2);
		let result = f(mid);

		if (result <= upperBound) {
			best = mid;  // Update the best found value
			left = mid + 1;  // Continue searching to the right
		}
		else {
			right = mid - 1;  // Search to the left
		}
	}

	return best;  // Returns the highest value found where f(x) <= h
}

/**
 * Binary search for the maximum valid offset within a text node
 */
export function findMaxOffset (node, range, target_content_height) {
	// Use binary search to find the *maximum* offset that gives the target height
	let bestOffset = findHighestValue(0, node.textContent.length, mid => {
		range.setEnd(node, mid);
		return getHeight(range, {force: true});
	}, target_content_height);
;

	range.setEnd(node, 0);

	return bestOffset;
}

export function getId (id, {page, fragment}) {
	if (fragment === 1) {
		return id;
	}

	// TODO check if unique?
	return id + "-" + fragment;
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

export function nextFrame () {
	return new Promise(requestAnimationFrame);
}

const heights = new WeakMap();
/**
 * Get an element or range’s bounding rect height and cache it
 * @param {Element | Range} element
 */
export function getHeight (element, options) {
	let height = heights.get(element);

	if ((height === undefined || options?.force) && element.getBoundingClientRect) {
		height = element.getBoundingClientRect().height;
		heights.set(element, height);
	}

	return height;
}

export function average (arr) {
	if (arr.length === 0) {
		return;
	}

	return arr.reduce((a, b) => a + b) / arr.length;
}

export class Timer {
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
}

export function timer () {
	let ret = new Timer();
	ret.start();
	return ret;
}

const readyElements = new WeakSet();
const loadElements = ["embed", "iframe", "img", "input", "script", "source", "track", "video", "link", "style", "object"];
const loadElementContainers = ["figure", "section", "div", "article", "details"];
const loadElementSelector = loadElements.join(", ");

// Sufficient (but not necessary) conditions for elements to be considered loaded
const loaded = {
	style: node => node.sheet?.cssRules,
	link: node => node.sheet?.cssRules,
	img: node => node.complete,
	video: node => node.readyState >= 3,
	audio: node => node.readyState >= 3,
	object: node => !!node.getSVGDocument(),
}

export async function ready (node, options) {
	if (options?.force) {
		readyElements.delete(node);
	}

	if (!node || node.nodeType !== Node.ELEMENT_NODE || readyElements.has(node)) {
		return true;
	}

	let tag = node.nodeName.toLowerCase();

	let isLoadElement = loadElements.includes(tag);
	if (isLoadElement || loadElementContainers.includes(tag)) {
		if (!(tag in loaded) || !loaded[tag](node)) { // Already loaded?
			if (isLoadElement) {
				await new Promise((resolve, reject) => {
					node.addEventListener("load", resolve, {once: true});
					node.addEventListener("error", reject, {once: true});
				}).finally(evt => {});
			}
			else {
				// Elements that don't load resources themselves, but their descendants might
				let resources = node.querySelectorAll(loadElementSelector);
				if (resources.length > 0) {
					await Promise.allSettled(Array.prototype.map.call(resources, n => ready(n, options)));
				}

			}
		}

		readyElements.add(node);
	}

	return true;
}
