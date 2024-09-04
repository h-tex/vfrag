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

	const nodes = new util.NodeStack(container);

	// Account for rounding errors
	target_content_height++;

	let container_style = util.getStyle(container, {pageBreak: false});
	let last_node_style;
	let lh = container_style.lh;

	// Element being shifted down
	let shiftable;

	function takeNode (child, style = last_node_style) {
		if (child !== nodes.last) {
			nodes.push(child);
		}

		if (style) {
			if (style.break_after === "always") {
				return false;
			}
		}
	}

	function fitsWhole (child) {
		nodes.push(child);

		if (target_content_height >= nodes.height) {
			return true;
		}

		// Adding this child node would exceed the target height, abort mission!
		nodes.pop();
		return false;
	}

	for (let i = 0; i < container.childNodes.length; i++) {
		let child = container.childNodes[i];

		if (child.nodeType === Node.COMMENT_NODE || isBlank(child)) {
			// Skip comment nodes and empty text nodes
			nodes.pushWeak(child);
			continue;
		}

		if (shiftable) {
			// We’re shifting a node down to make space, should we stop?
			if (child.matches(shiftables)) {
				// Can't shift beyond another shiftable
				break;
			}
		}

		if (/^H[1-6]$/i.test(child.nodeName)) {
			let level = Number(child.nodeName[1]);
			options.openHeadings ??= [];
			while (options.openHeadings.length > level) {
				options.openHeadings.pop();
			}
			options.openHeadings.push(child);

			if (shiftable) {
				let shiftableLevel = shiftable._heading ? Number(shiftable._heading.nodeName[1]) : 0;

				if (level <= shiftableLevel) {
					// Can't shift to a different section, what is this, LaTeX?
					break;
				}
			}
		}

		let style = util.getStyle(child);
		last_node_style = style ?? last_node_style;

		if (style) {
			if (i > 0 && style.break_before === "always") {
				break;
			}

			if (["absolute", "fixed"].includes(style.position)
				|| style.display === "none"
			) {
				// These do not affect layout
				nodes.pushWeak(child);
				continue;
			}
		}

		options.totals.timer.pause();
		await util.ready(child);
		options.totals.timer.start();

		if (fitsWhole(child)) {
			if (style?.break_after === "always") {
				break;
			}
			else if (style?.break_after === "avoid") {
				nodes.pop();
				nodes.pushWeak(child);
			}

			if (nodes.height >= target_content_height) {
				// We've reached the target height, no need to process further
				break;
			}
		}
		else { // Doesn't fit whole, what else can we do?
			if (child.nodeType === Node.TEXT_NODE) {
				// Handle fragmenting text nodes: find the maximum offset that fits within the target height
				let maxOffset = util.findMaxOffset(child, nodes.range, target_content_height);

				if (maxOffset > 0) {
					// adjust so we're not breaking words halfway
					let text = child.textContent;
					while (maxOffset > 0 && /\p{Letter}/vg.test(text[maxOffset])) {
						maxOffset--;
					}

					if (maxOffset > 0) {
						child.splitText(maxOffset);
						nodes.push(child);
					}
				}
			}
			else if (child.matches(fragmentables) && style.break_inside !== "avoid") {
				// We can maybe fragment it

				let remaining_height = target_content_height - nodes.height;
				let empty_lines = remaining_height / lh;

				if (empty_lines >= 2) {
					let child_height = util.getHeight(child, {force: true});
					let child_lines = child_height / lh;

					if (child_lines >= 3.99) {
						child.normalize();
						let {nodes: children} = await consumeUntil(Math.min(remaining_height, child_height - 2 * lh), child, options);

						if (children.length > 0) {
							let remaining = [...child.childNodes].slice(children.length);

							if (children.lengthStrong > 0 && remaining.filter(isNotBlank).length > 0) {
								// child.classList.add("mark");
								let fragment = fragmentElement(child, children);

								last_node_style = null;
								nodes.push(fragment);
							}
						}
					}
				}
			}
			else if (nodes.lengthStrong === 0) {
				// This is a very large item that won't fit anywhere, don’t try to fit anything else
				nodes.push(child);

				console.warn("Overly large element:", child, `(${util.getHeight(child, {force: 1})} > ${target_content_height})`);
			}
			else if (child.matches(shiftables)) {
				// What if we shift it down?
				// We only shift when it’s not the first element in the page
				shiftable = child;
				child._heading = options.openHeadings?.at(-1);
				child._nextSibling = child.nextSibling;
				child.remove();
				continue;
			}

			// If we've reached the point of fragmenting a node, we definitely can't fit more
			break;
		}
	}

	if (shiftable) {
		// Restore the shiftable node
		let lastNode = nodes.lastStrong;

		if (lastNode) {
			lastNode.after(shiftable);
			nodes.popWeak();
		}
		else {
			// No nodes were added, put it back where it was
			shiftable._nextSibling.before(shiftable);
		}

		// Reparenting will force it to reload which can throw off future measurements
		await util.ready(shiftable, {force: true});
	}

	nodes.popWeak();

	let remaining_height = target_content_height - nodes.height;

	let empty = Math.max(0, remaining_height);
	let emptyLines = empty / lh;

	return { nodes, empty, emptyLines };
}

