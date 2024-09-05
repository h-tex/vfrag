// NOTE These don't take borders into account
export function getOuterHeight (innerHeight, style) {
	if (style.box_sizing === "border-box") {
		return innerHeight;
	}
	else if (style.box_sizing === "content-box") {
		return innerHeight + style.padding_block_start + style.padding_block_end;
	}
}

export function getInnerHeight (outerHeight, style) {
	if (style.box_sizing === "border-box") {
		return outerHeight - (style.padding_block_start + style.padding_block_end);
	}
	else if (style.box_sizing === "content-box") {
		return outerHeight;
	}
}

const styles = new WeakMap();
const categoricalProperties = ["position", "display", "box-sizing", "page-break-before", "page-break-inside", "page-break-after"];
const lengthProperties = ["padding-block-start", "padding-block-end", "min-height", "line-height"];

export function getStyle (node) {
	if (!node || node instanceof Node && node.nodeType !== 1) {
		return null;
	}

	let style = styles.get(node);

	if (style) {
		return style;
	}

	style = {};
	let cs = node instanceof CSSStyleDeclaration ? node : getComputedStyle(node);

	for (let cssProperty of categoricalProperties) {
		let property = cssProperty.replace(/^page-/, "").replaceAll("-", "_");
		let value = cs.getPropertyValue(cssProperty);

		if (value !== "auto") {
			style[property] = value;
		}
	}

	for (let cssProperty of lengthProperties) {
		let property = cssProperty.replaceAll("-", "_");
		style[property] = parseFloat(cs.getPropertyValue(cssProperty)) || 0;
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

export function nextFrame () {
	if (document.hidden) {
		// rAF doesn’t run when the document is hidden
		return new Promise(resolve => setTimeout(resolve, 16));
	}

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

import Timer from "./util/Timer.js";
export { Timer };

export function timer () {
	let ret = new Timer();
	ret.start();
	return ret;
}

export { default as ready } from "./util/ready.js";

export { default as NodeStack } from "./util/NodeStack.js";
