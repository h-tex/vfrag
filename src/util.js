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

import Timer from "./util/Timer.js";
export { Timer };

export function timer () {
	let ret = new Timer();
	ret.start();
	return ret;
}

export { default as ready } from "./util/ready.js";
