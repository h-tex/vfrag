import * as util from "./util.js";
import fragmentElement from "./fragmentElement.js";

export const DEFAULT_FRAGMENTABLES = "ol, ul, dl, div, p, details, section, .fragmentable";
export const DEFAULT_SHIFTABLES = "figure:not(.dont-shift), .shiftable";

let H1_to = Object.fromEntries(Array.from({length: 6}, (_, i) => ["H" + (i + 1), i === 0 ? /^H1$/ : RegExp(`^H[1-${ (i + 1) }]$`)]));

/**
 * Return an array of child nodes (or parts thereof) that fit within the target height.
 * @sideeffect May split exactly one text node.
 * @sideeffect May split certain block elements
 * @param {number} target_content_height
 * @param {Element} container
 * @returns {Array<Node>}
 */
export default async function consumeUntil (target_content_height, container, options = {}) {
	options.fragmentables ??= DEFAULT_FRAGMENTABLES;
	options.shiftables ??= DEFAULT_SHIFTABLES;
	options.startAt ??= 0;

	const nodes = new util.NodeStack(container);

	// Account for rounding errors
	target_content_height++;

	let container_style = util.getStyle(container);
	let lh = container_style.line_height;

	// Reason for stopping
	let breaker;

	if (container_style.text_wrap === "balance" || container_style.text_wrap === "pretty") {
		container.style.textWrap = "initial";
	}

	for (let i = options.startAt; i < container.childNodes.length; i++) {
		let child = container.childNodes[i];

		if (options.stopAt) {
			if (i >= options.stopAt) {
				// Stop at index
				breaker = "stop-at";
				break;
			}
			else if (typeof options.stopAt === "function" && options.stopAt(child, i, container)) {
				// Stop at callback
				breaker = "stop-at";
				break;
			}
		}

		if (!util.affectsLayout(child)) {
			// Comment nodes, empty text nodes, positioned or hidden elements etc.
			nodes.pushWeak(child);
			continue;
		}

		if (H1_to.H6.test(child.nodeName)) {
			let level = Number(child.nodeName[1]);
			options.openHeadings ??= [];
			while (options.openHeadings.length > level) {
				options.openHeadings.pop();
			}
			options.openHeadings.push(child);
		}

		let style = util.getStyle(child);

		if (style) {
			if (i > 0 && style.break_before === "always") {
				breaker = "break-before-always";
				break;
			}
		}

		options.totals.timer.pause();
		await util.ready(child);
		options.totals.timer.start();

		// Does it fit whole?
		let fitsWhole = false;
		nodes.push(child);

		if (target_content_height >= nodes.height) {
			fitsWhole = true;
		}
		else {
			// Adding this child node would exceed the target height, abort mission!
			nodes.pop();
		}

		if (fitsWhole) {
			if (style?.break_after === "always") {
				breaker = "break-after-always";
				break;
			}
			else if (style?.break_after === "avoid") {
				// Convert to weak node
				nodes.pop();
				nodes.pushWeak(child);
			}

			if (nodes.height >= target_content_height) {
				// We've reached the target height, no need to process further
				breaker = "full";
				break;
			}
		}
		else if (util.isFragmentable(child, options)) {
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
			else { // element
				let remaining_height = target_content_height - nodes.height;
				let empty_lines = remaining_height / lh;

				// TODO use CSS widows and orphans rather than these hardcoded values
				if (empty_lines >= 2) {
					let child_height = util.getHeight(child, {force: true});
					let child_lines = child_height / lh;

					if (child_lines >= 3.99) {
						child.normalize();
						let consumed = await consumeUntil(Math.min(remaining_height, child_height - 2 * lh), child, options);

						if (consumed.nodes.length > 0) {
							// Why not just depend on the height calculation?
							// Because some types of fragmentation produce fragments that have a certain minimum height anyway,
							// e.g. fragmenting <details> produces another <summary> too
							let remaining = [...child.childNodes].slice(consumed.nodes.length);

							if (consumed.nodes.lengthStrong > 0 && remaining.filter(util.affectsLayout).length > 0) {
								// child.classList.add("mark");
								let fragment = fragmentElement(child, consumed);

								nodes.push(fragment);
							}
						}
					}
				}
			}

			// If we've reached the point of fragmenting a node, we definitely can't fit more
			breaker = "fragmentation";
			break;
		}
		else if (nodes.height === 0) {
			// This is an item that is larger than the available space by itself and can't be fragmented
			// Take it because it has to go somewhere but don’t try to fit anything else
			nodes.push(child);

			console.warn("Overly large element:", child, `(${util.getHeight(child, {force: 1})} > ${target_content_height})`);

			breaker = "oversized";
			break;
		}
		else if (util.isShiftable(child, options)) {
			// This element can be shifted up/down, i.e. doesn’t depend on the content flow
			// We only shift when it’s not the first (layout-affecting) node in the page (which is taken care of by the previous condition)

			// Should we shift it up or down? Let’s examine both and see what produces better results.

			// We cannot shift it up beyond its heading, or another shiftable
			let heading = options.openHeadings?.at(-1);
			let minIndex = nodes.findLastIndex((n, i) => i === 0 || n === heading || n.matches?.(options.shiftables));

			let height = util.getHeight(child, {force: true});

			// Try shifting up first
			let up = {};
			up.index = Math.max(minIndex, nodes.indexOfHeight(target_content_height - height));

			up.go = minIndex < up.index && up.index < nodes.length;
			up.next = up.go ? nodes.find((n, j) => j > up.index && util.affectsLayout(n)) : undefined;
			up.go &&= Boolean(up.next);

			let consumeOptions = {
				...options,
				startAt: i + 1,
				// We cannot shift beyond a heading with level <= of heading or another shiftable
				stopAt: n => H1_to[heading?.nodeName]?.test(n.nodeName) || util.isShiftable(n, options),
			};

			if (up.go) {
				// We can shift it up
				up.emptySpace = target_content_height - nodes.heightAt(up.index) - height;

				if (up.emptySpace > 1) {
					// We may still need to fragment something
					up.consumed = await consumeUntil(up.emptySpace, container, consumeOptions);
				}
			}
			else {
				up.emptySpace = Infinity;
			}

			// Now try shifting down
			let down = {};

			down.emptySpace = target_content_height - nodes.height;
			down.consumed = await consumeUntil(down.emptySpace, container, consumeOptions);
			down.go = down.consumed.nodes.length > 0;

			if (down.go) {
				down.emptySpace -= down.consumed.nodes.height;
			}
			else {
				down.emptySpace = Infinity;
			}

			if (!(up.go || down.go)) {
				// Shifting is not an option
				breaker = "no-shift";
				break;
			}

			// Is shifting up better?
			let shift = up.emptySpace < down.emptySpace ? up : down;
			if (shift === up) {
				while (nodes.length > up.index) {
					nodes.pop();
				}
				nodes.last.after(child);
				nodes.push(child);

			}
			else {
				// Shift down (i.e. to next page)
				down.consumed.nodes.last.after(child);
			}

			if (shift.consumed.nodes.length > 0) {
				nodes.append(shift.consumed.nodes);
				breaker = shift.consumed.breaker;
			}
			else {
				breaker = "shift";
			}

			// Reparenting will force it to reload which can throw off future measurements
			await util.ready(child, {force: true});
			break;
		}
	}

	nodes.popWeak();

	if (container.style.textWrap === "initial") {
		// Restore original value.
		// ASSUMPTION text-wrap was not specified as an inline style.
		container.style.textWrap = "";
	}

	let remaining_height = target_content_height - nodes.height;

	let empty = Math.max(0, remaining_height);
	let emptyLines = empty / lh;

	return { nodes, empty, emptyLines, breaker };
}

