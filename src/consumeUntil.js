import * as util from "./util.js";

const FRAGMENTAINABLES = "ol, ul, dl, div, p, details, section";

/**
 * Return an array of child nodes (or parts thereof) that fit within the target height.
 * @sideeffect May split exactly one text node.
 * @sideeffect May split certain block elements
 * @param {number} target_content_height
 * @param {Element} container
 * @returns {Array<Node>}
 */
export default function consumeUntil (target_content_height, container) {
	const nodes = [];
	const range = document.createRange();
	range.setStart(container, 0);
	range.setEnd(container, 0);

	let container_style = util.getStyle(container, {pageBreak: false});
	let last_node_style;

	for (let i = 0; i < container.childNodes.length; i++) {
		let child = container.childNodes[i];

		if (child.nodeType === Node.COMMENT_NODE) {
			continue; // Skip comment nodes
		}

		// Attempt to include the whole child node
		range.setEndAfter(child);
		const currentHeight = range.getBoundingClientRect().height;

		if (currentHeight > target_content_height) {
			// Adding this child node would exceed the target height
			range.setEndBefore(child);

			if (child.nodeType === Node.TEXT_NODE) {
				// Handle text nodes: find the maximum offset that fits within the target height
				const maxOffset = findMaxOffset(child, range, target_content_height);
				if (maxOffset > 0) {
					child.splitText(maxOffset);
					nodes.push(child); // Include the fitting portion of the text node
					range.setEndAfter(child);
				}
			}
			else if (child.matches(FRAGMENTAINABLES)) {
				let content_height = range.getBoundingClientRect().height;
				let empty_content_height = target_content_height - content_height;
				let empty_lines = empty_content_height / container_style.lh;
				let style = util.getStyle(child);


				if (empty_lines > 2 && style.break_inside !== "avoid" && child.getBoundingClientRect().height / style.lh >= 4) {
					let children = consumeUntil(empty_content_height, child);

					if (children.length > 0) {
						let [fragment, original] = fragmentElement(child, children);

						nodes.push(fragment);
						last_node_style = null;
					}
				}
			}
			// TODO L shift <p> after <figure> if <figure> is too big (unless <figure> has a class that it should not be shifted)
		}
		// Include the whole node if it fits or exactly matches the height
		else if (child.nodeType === Node.TEXT_NODE) {
			nodes.push(child);
		}
		else {
			let style = util.getStyle(child);

			if (style.break_before === "always") {
				range.setEndBefore(child);
				break;
			}

			nodes.push(child);
			last_node_style = style ?? last_node_style;

			if (style?.break_after === "always") {
				break;
			}
		}

		if (currentHeight >= target_content_height) {
			break; // Stop processing as we've reached the exact height limit
		}
	}

	if (last_node_style?.break_after === "avoid") {
		// We are breaking after a node that should not be broken after.
		// Move to next page
		let lastNode;
		do {
			lastNode = nodes.pop();
		}
		while (lastNode && lastNode.nodeType !== 1);

		// console.info("Avoiding break after", lastNode);
	}

	return nodes;
}

// Binary search for the maximum valid offset within a text node
function findMaxOffset(node, range, target_content_height) {
	const tempRange = document.createRange();
	let low = 0;
	let high = node.textContent.length;
	let bestOffset = 0;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);

		// Extend the original range temporarily to the midpoint of the text node
		range.setEnd(node, mid);
		const height = range.getBoundingClientRect().height;

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

function fragmentElement (original, children) {
	let fragment = original.cloneNode(false);

	fragment.classList.add("fragment")
	fragment.fragmentedFrom = original;
	// TODO prevent duplicate ids
	fragment.append(...children);

	// Special handling for certain elements
	if (fragment.matches("ol")) {
		// Continue <ol> from same number
		let start = original.start || 1;
		original.start = start + children.length;
	}
	else if (fragment.matches("details")) {
		// Open <details> elements
		fragment.prepend(original.querySelector("summary").cloneNode(true));
	}

	return [fragment, original];
}
