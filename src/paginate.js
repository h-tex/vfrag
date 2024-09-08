import * as util from "./util.js";
import consumeUntil from "./consumeUntil.js";
import fragmentElement from "./fragmentElement.js";

// Paginate by breaking down .page into multiple .page elements
export default async function paginate (container, options = {}) {
	let info = { pages: 1, empty_lines: [] };

	if (options.stopped) {
		return info;
	}

	let totals = options.totals ??= {pages: 0, pagesLeft: 0, empty_lines: []};
	options.totals.pages++; // account for container
	let timers = options.timers ??= {consume: new util.Timer(), DOM: new util.Timer(), async: new util.Timer() };

	timers.consume.start();

	let {width, height} = container.getBoundingClientRect();
	let style = util.getStyle(container);
	let target_page_height = width / options.aspectRatio;

	let target_content_height = util.getInnerHeight(target_page_height, style);
	let remaining_content_height = util.getInnerHeight(height, style);
	let nodeIndex = 0;
	let pages = [];

	let pendingPages = [];

	info.pageDetails = pages;

	while (remaining_content_height > target_content_height) {
		// Add nodes to the nodes array until the page is full
		options.startAtIndex = nodeIndex;
		options.asyncTimer = timers.async;
		let consumed = await consumeUntil(target_content_height, container, options);

		if (consumed.nodes.length > 0) {
			pendingPages.push(consumed);
			nodeIndex += consumed.nodes.length;
			remaining_content_height -= consumed.nodes.height;
		}

		info.pagesLeft = Math.ceil(remaining_content_height / target_content_height) - 1;

		if (consumed.nodes.length === 0) {
			let remainingNodes = container.childNodes.length - nodeIndex;

			if (remainingNodes > 0) {
				console.warn("Cannot paginate", container, info.pages > 0 ? ` further (${ info.pages } pages done, ~${ info.pagesLeft } left)` : `(~${ info.pagesLeft } pages left)`);
			}
			else {
				// We consumed everything, we don’t actually need a fragment here
				pendingPages.pop();
				info.pages--;
				totals.pages--;
			}

			break;
		}

		info.pages++;
		totals.pages++;

		if (info.pages > 0) {
			if (options.renderEvery > 0 && info.pages % options.renderEvery === 0) {
				timers.async.start();
				await util.domChange(() => {
					timers.async.pause();
					let ret = renderPages(pendingPages);
					timers.async.start();
					return ret;
				});
				timers.async.pause();

				// Reset for next iteration
				nodeIndex = 0;

				height = container.getBoundingClientRect().height;
				remaining_content_height = util.getInnerHeight(height, style);
			}

			if (options.askEvery > 0 && info.pages % options.askEvery === 0) {
				if (!confirm(`Paginated ${ totals.pages } pages. Continue?`)) {
					options.stopped = true;
					break;
				}
			}
		}
	}

	// Render any remaining pages
	await renderPages(pendingPages);

	return info;

	async function renderPages (pendingPages) {
		// Update page stats
		timers.async.pause();
		timers.consume.pause();

		await util.domChange(() => {
			// Now actually fragment the container (in a document fragment to avoid reflows)
			timers.DOM.start();

			// Save position in the DOM
			let marker = document.createComment(`${ container.id ?? container.data.id ?? container.nodeName }`);
			container.replaceWith(marker);

			let docFragment = document.createDocumentFragment();
			docFragment.append(container);

			let consumed;
			while (consumed = pendingPages.shift()) {
				let page;
				if (consumed.nodes) {
					pages.push(consumed);

					page = fragmentElement(container, consumed);

					let { emptyLines } = consumed;
					page.style.setProperty("--empty-lines-text", `"${ emptyLines.toLocaleString() }"`);
					page.style.setProperty("--empty-lines", emptyLines);

					if (emptyLines > 2.5) {
						page.classList.add("empty-space-" + (emptyLines > 6 ? "l" : "m"));
					}
				}
				else {
					// Last page
					page = container;
				}
			}

			marker.replaceWith(docFragment);
			container.dispatchEvent(new CustomEvent("fragmented", { bubbles: true, detail: info }));
			timers.DOM.pause();
		});

		timers.async.start();
	}
}
