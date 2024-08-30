import * as util from "./util.js";
import fragmentElement from "./fragmentElement.js";

export const DEFAULT_FRAGMENTAINABLES = "ol, ul, dl, div, p, details, section";
export const DEFAULT_MOVABLES = "figure:not(.immovable)";

function isBlank (node) {
	return node.nodeType === Node.TEXT_NODE && node.textContent.trim() === "";
}

function isNotBlank (node) {
	return !isBlank(node);
}

/**
 * Return an array of child nodes (or parts thereof) that fit within the target height.
 * @sideeffect May split exactly one text node.
 * @sideeffect May split certain block elements
 * @param {number} target_content_height
 * @param {Element} container
 * @returns {Array<Node>}
 */
export default function consumeUntil (target_content_height, container, options) {
	let fragmentainables = options?.fragmentainables || DEFAULT_FRAGMENTAINABLES;
	let movables = options?.movables || DEFAULT_MOVABLES;

	const nodes = [];
	const range = document.createRange();
	range.setStart(container, 0);
	range.setEnd(container, 0);

	let container_style = util.getStyle(container, {pageBreak: false});
	let last_node_style;
	let current_height  = 0;
	let remaining_height = target_content_height;
	let lh = container_style.lh;

	// these shouldn't trigger anything by themselves, but should be taken along for the ride if a node after them gets moved
	let maybeNodes = [];

	function takeNode (child, style = last_node_style) {
		// Empty maybeNodes into nodes, then push child
		nodes.push(...maybeNodes.splice(0, maybeNodes.length), child);
		if (child.parentNode) {
			range.setEndAfter(child);
		}

		if (style?.break_after === "always") {
			return false;
		}
	}

	function takeNodes (children, style = last_node_style) {
		// Empty maybeNodes into nodes, then push child
		nodes.push(...maybeNodes.splice(0, maybeNodes.length), ...children);
		let last = children[children.length - 1];
		if (last.parentNode) {
			range.setEndAfter(last);
		}

		if (style?.break_after === "always") {
			return false;
		}
	}

	function fitsWhole (child) {
		range.setEndAfter(child);
		let previous_current_height = current_height;
		current_height = util.getHeight(range, {force: true});
		remaining_height = target_content_height - current_height;
		let ret = remaining_height >= 0;

		if (remaining_height < 0) {
			// Adding this child node would exceed the target height, abort mission!
			range.setEndBefore(child);
			current_height = previous_current_height;
			remaining_height = target_content_height - current_height;
		}

		return ret;
	}

	for (let i = 0; i < container.childNodes.length; i++) {
		let child = container.childNodes[i];

		if (child.nodeType === Node.COMMENT_NODE) {
			maybeNodes.push(child);
			continue; // Skip comment nodes
		}
		else if (isBlank(child)) {
			maybeNodes.push(child);
			continue; // Skip empty text nodes
		}

		let style = util.getStyle(child);
		last_node_style = style ?? last_node_style;

		if (style) {
			if (i > 0 && style.break_before === "always") {
				range.setEndBefore(child);
				break;
			}
			if (style.break_after === "avoid"
				|| ["absolute", "fixed"].includes(style.position)
			) {
				maybeNodes.push(child);
				continue;
			}
		}

		// Attempt to include the whole child node
		if (fitsWhole(child)) {
			takeNode(child);
		}
		else {
			// Not enough space to add this whole

			// Can we fragment it?
			if (child.nodeType === Node.TEXT_NODE) {
				// Handle text nodes: find the maximum offset that fits within the target height
				const maxOffset = util.findMaxOffset(child, range, target_content_height);
				// TODO adjust so we're not breaking words halfway
				if (maxOffset > 0) {
					child.splitText(maxOffset);
					takeNode(child);
				}
			}
			// else if (child.matches(movables)) {
			// 	// What if we shift it down?
			// 	let nextSibling = child.nextSibling;
			// 	child.remove();
			// 	let siblings = consumeUntil(remaining_height, container);

			// 	// Drop anything from any headings or other movables onwards
			// 	let hIndex = siblings.findIndex(node => node.matches?.("h1, h2, h3, h4, h5, h6, " + movables));
			// 	if (hIndex > -1) {
			// 		siblings = siblings.slice(0, hIndex);
			// 	}

			// 	if (siblings.filter(isNotBlank).length > 0) {
			// 		// There are elements to move!
			// 		takeNodes(siblings);
			// 		siblings.at(-1).after(child);
			// 		console.log("moved", child, "down", siblings);
			// 	}
			// 	else {
			// 		// Nice try but nope, restore the child
			// 		nextSibling.before(child);
			// 	}
			// }
			else if (child.matches(fragmentainables)) {
				let empty_lines = remaining_height / lh;

				if (empty_lines > 2 && style.break_inside !== "avoid") {
					let child_height = util.getHeight(child, {force: true});
					let child_lines = child_height / lh;

					if (child_lines >= 4) {
						let children = [...consumeUntil(Math.min(remaining_height, child_height - 2 * lh), child, options)];
						// console.log(child, empty_lines, child_lines, children);

						if (children.length > 0) {
							let remaining = [...child.childNodes].slice(children.length);

							if (children.filter(isNotBlank).length > 0 && remaining.filter(isNotBlank).length > 0) {
								let fragment = fragmentElement(child, children);
								last_node_style = null;
								takeNode(fragment);
							}
						}
					}
				}
			}

			break;
		}

		if (remaining_height < 1) {
			// We've reached the target height, no need to process further
			break;
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

		if (options?.verbose) {
			console.info("Avoiding break after", lastNode);
		}
	}

	return nodes;
}

