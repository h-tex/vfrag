import getStyle from "./util/getStyle.js";
export { getStyle };

export function getInnerHeight (outerHeight, style) {
	let padding = style.padding_block_start + style.padding_block_end;
	let border = style.border_block_start_width + style.border_block_end_width;
	return outerHeight - padding - border;
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
		return range.getBoundingClientRect().height;
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

	if (node.nodeType === Node.ELEMENT_NODE && !isShiftable(node, options)) {
		let style = getStyle(node);

		return style.break_inside !== "avoid";
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

export function getHeadingLevel (h) {
	if (h?.computedRole === "heading") {
		if (h.ariaLevel) {
			return h.ariaLevel;
		}
	}

	let tag = h.nodeName;
	if (tag.length === 2 && tag[0] === "H" && tag[1] >= 1) {
		return parseInt(tag[1]);
	}
}
