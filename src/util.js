import getStyle from "./util/getStyle.js";
export { getStyle };

// NOTE doesn't take borders into account
export function getInnerHeight (outerHeight, style) {
	return outerHeight - (style.padding_block_start + style.padding_block_end);
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

/** Nodes that do not affect layout */
export function affectsLayout (node) {
	if (!node || node.nodeType === Node.COMMENT_NODE) {
		return false;
	}

	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent.trim() !== "";
	}

	let style = getStyle(node);

	if (["absolute", "fixed"].includes(style.position) || style.display === "none") {
		return false;
	}

	return true;
}

export function isFragmentable (node, options) {
	if (node.nodeType === Node.TEXT_NODE) {
		return true;
	}

	if (options.fragmentables && node.nodeType === Node.ELEMENT_NODE) {
		let style = getStyle(node);

		if (node.matches(options.fragmentables) && style.break_inside !== "avoid") {
			return true;
		}
	}

	return false;
}

export function isShiftable (node, options) {
	if (node.nodeType !== Node.ELEMENT_NODE) {
		return false;
	}

	return node.matches(options.shiftables);
}

const SUPPORTS_VIEW_TRANSITIONS = Boolean(document.startViewTransition);
export async function domChange (fn) {
	if (SUPPORTS_VIEW_TRANSITIONS) {
		return document.startViewTransition(fn).finished;
	}
	else {
		await fn();
		return util.nextFrame();
	}
}
