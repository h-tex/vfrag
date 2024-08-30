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

/**
 * Binary search for the maximum valid offset within a text node
 */
export function findMaxOffset(node, range, target_content_height) {
	let low = 0;
	let high = node.textContent.length;
	let bestOffset = 0;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);

		// Extend the original range temporarily to the midpoint of the text node
		range.setEnd(node, mid);
		const height = getHeight(range);

		if (height === target_content_height) {
			bestOffset = mid;
			break;
		}
		else if (height < target_content_height) {
			bestOffset = mid;
			low = mid + 1;
		}
		else {
			high = mid - 1;
		}
	}

	// Reset the range to its previous end point
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
	return arr.reduce((a, b) => a + b) / arr.length;
}
