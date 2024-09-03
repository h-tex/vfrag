import * as util from "./util.js";
import fragmentElement from "./fragmentElement.js";

export const DEFAULT_FRAGMENTABLES = "ol, ul, dl, div, p, details, section";
export const DEFAULT_SHIFTABLES = "figure:not(.dont-shift)";

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
export default async function consumeUntil (target_content_height, container, options) {
	let fragmentables = options?.fragmentables || DEFAULT_FRAGMENTABLES;
	let shiftables = options?.shiftables || DEFAULT_SHIFTABLES;

	const nodes = [];
	const range = document.createRange();
	range.setStart(container, 0);
	range.setEnd(container, 0);

	let container_style = util.getStyle(container, {pageBreak: false});
	let last_node_style;
	let current_height = 0;
	let remaining_height = target_content_height;
	let lh = container_style.lh;

	// these shouldn't trigger anything by themselves, but should be taken along for the ride if a node after them gets moved
	let maybeNodes = [];

	// Element being shifted down
	let shiftable;

	function takeNode (child, style = last_node_style) {
		// Empty maybeNodes into nodes, then push child
		nodes.push(...maybeNodes.splice(0, maybeNodes.length), child);
		range.setEndAfter(child);

		if (style) {
			if (style.break_after === "always") {
				return false;
			}
		}
	}

	function fitsWhole (child) {
		range.setEndAfter(child);
		let previous_current_height = current_height;
		current_height = util.getHeight(range, {force: true});
		remaining_height = target_content_height - current_height;

		if (remaining_height >= -1) {
			return true;
		}

		// Adding this child node would exceed the target height, abort mission!
		range.setEndBefore(child);
		current_height = previous_current_height;
		remaining_height = target_content_height - current_height;
		return false;
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

		if (shiftable) {
			// We’re shifting a node down to make space, should we stop?
			if (child.matches("h1, h2, h3, h4, h5, h6, " + shiftables)) {
				// No more shifting
				break;
			}
		}

		options.totals.timer.pause();
		await util.ready(child);
		options.totals.timer.start();

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
		let fits = fitsWhole(child);

		// Attempt to include the whole child node
		let isFragmentable = child.matches?.(fragmentables);
		if (fits || nodes.length === 0 && style && !isFragmentable) {
			// Either fits or this is a very large item that won't fit anywhere
			takeNode(child);

			if (!fits) {
				// This is a very large item that won't fit anywhere, don’t try to fit anything else
				console.warn("Overly large element:", child, `(${util.getHeight(child)} > ${target_content_height})`);
				break;
			}
		}
		else {
			// Not enough space to add this whole

			// Can we fragment it?
			if (child.nodeType === Node.TEXT_NODE) {
				// Handle text nodes: find the maximum offset that fits within the target height
				let maxOffset = util.findMaxOffset(child, range, target_content_height);

				if (maxOffset > 0) {
					// adjust so we're not breaking words halfway
					let text = child.textContent;
					while (maxOffset > 0 && /\p{Letter}/vg.test(text[maxOffset])) {
						maxOffset--;
					}

					if (maxOffset > 0) {
						child.splitText(maxOffset);
						takeNode(child);
					}
				}
			}
			else if (child.matches(shiftables)) {
				// What if we shift it down?
				shiftable = child;
				child._nextSibling = child.nextSibling;
				child.remove();
				continue;
			}
			else if (isFragmentable) {
				let empty_lines = remaining_height / lh;

				if (empty_lines >= 2 && style.break_inside !== "avoid") {
					let child_height = util.getHeight(child, {force: true});
					let child_lines = child_height / lh;

					if (child_lines >= 3.99) {
						child.normalize();
						let {nodes: children} = await consumeUntil(Math.min(remaining_height, child_height - 2 * lh), child, options);

						if (children.length > 0) {
							let remaining = [...child.childNodes].slice(children.length);

							if (children.filter(isNotBlank).length > 0 && remaining.filter(isNotBlank).length > 0) {
								// child.classList.add("mark");
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

	if (shiftable) {
		// Restore the shiftable node
		let lastNode = nodes.at(-1);

		if (lastNode) {
			lastNode.after(shiftable);
		}
		else {
			// No nodes were added, put it back where it was
			shiftable._nextSibling.before(shiftable);
		}

		// Reparenting will force it to reload which can throw off future measurements
		await util.ready(shiftable, {force: true});
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

	range.setEndAfter(nodes.at(-1));
	current_height = util.getHeight(range, {force: true});
	remaining_height = target_content_height - current_height;

	let empty = Math.max(0, remaining_height);
	let emptyLines = empty / lh;

	return { nodes, range, empty, emptyLines };
}

