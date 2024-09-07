import * as util from "./util.js";
import consumeUntil from "./consumeUntil.js";
import fragmentElement from "./fragmentElement.js";

// Paginate by breaking down .page into multiple .page elements
export default async function paginate (container, options = {}) {
	let info = { pages: 1, empty_lines: [] };

	if (options.stopped) {
		return info;
	}

	let totals = options.totals ??= {pages: 0, empty_lines: []};
	let timers = options.timers ??= {consume: new util.Timer(), DOM: new util.Timer(), async: new util.Timer() };
	let aspectRatio = options.aspectRatio ??= 8.5/11;

	timers.consume.start();

	let {width, height} = container.getBoundingClientRect();
	let style = util.getStyle(container);
	let target_page_height = width / aspectRatio;
	container.style.setProperty("--target-page-height", target_page_height + "px");

	let target_content_height = util.getInnerHeight(target_page_height, style);
	let remaining_content_height = util.getInnerHeight(height, style);
	let nodesProcessed = 0;
	let pages = [];
	let pendingPages = [];
	let { startAt = totals.pages + 1 } = options;
	let pageNumber = startAt;

	while (remaining_content_height > target_content_height) {
		// Add nodes to the nodes array until the page is full
		options.startAtIndex = nodesProcessed;
		options.asyncTimer = timers.async;
		let consumed = await consumeUntil(target_content_height, container, options);

		if (consumed.nodes.length > 0) {
			pendingPages.push(consumed);
			nodesProcessed += consumed.nodes.length;
		}

		let pages_done = pendingPages.length + pages.length;

		if (consumed.nodes.length === 0) {
			let approx_pages_left = Math.ceil(remaining_content_height / target_content_height);
			console.warn("Cannot paginate", container, pages_done > 0 ? ` further (${ pages_done } pages done, ~${ approx_pages_left } left)` : `(~${ approx_pages_left } pages left)`);
			break;
		}

		remaining_content_height -= consumed.nodes.height;

		if (pages_done > 0) {
			if (options.renderEvery > 0 && pages_done % options.renderEvery === 0) {
				timers.async.start();
				await util.domChange(() => {
					timers.async.pause();
					renderPages();
					timers.async.start();
				});
				timers.async.pause();

				// Reset for next iteration
				pendingPages = [];
				nodesProcessed = 0;

				height = container.getBoundingClientRect().height;
				remaining_content_height = util.getInnerHeight(height, style);
			}

			if (options.askEvery > 0 && pages_done % options.askEvery === 0) {
				if (!confirm(`Paginated ${ totals.pages } pages. Continue?`)) {
					options.stopped = true;
					break;
				}
			}
		}
	}

	// Render any remaining pages
	renderPages();

	info.pages = pages;
	totals.empty_lines.push(...info.empty_lines);

	return info;

	async function renderPages () {
		timers.consume.pause();

		// Now actually fragment the container (in a document fragment to avoid reflows)
		timers.DOM.start();

		// Save position in the DOM
		let marker = document.createComment(`${ container.id ?? container.data.id ?? container.nodeName }`);
		container.replaceWith(marker);

		let docFragment = document.createDocumentFragment();
		docFragment.append(container);

		// Update page stats
		info.pages += pendingPages.length;
		totals.pages += pendingPages.length;

		options.root.style.setProperty("--page-count", totals.pages);
		options.root.style.setProperty("--pages", `"${totals.pages}"`);

		let consumed;
		while (consumed = pendingPages.shift()) {
			let page = container;
			let { emptyLines } = consumed;
			info.empty_lines.push(emptyLines);

			if (remaining_content_height > 0) {
				// Not the last page, create a new page
				page = fragmentElement(container, consumed);
				page.style.setProperty("--empty-lines-text", `"${ emptyLines.toLocaleString() }"`);

				if (emptyLines > 2.5) {
					page.classList.add("empty-space-" + (emptyLines > 6 ? "l" : "m"));
				}
			}

			page.style.setProperty("--empty-lines", emptyLines);

			// Add page number
			pageNumber++;
			page.style.setProperty("--page-number", pageNumber);
			page.dataset.page = pageNumber;

			page.insertAdjacentHTML("beforeend", `<a href="#${ page.id }" class="page-number">${ pageNumber }</a>`);

			page.classList.add("pagination-done");
		}

		marker.replaceWith(docFragment);

		timers.DOM.pause();
	}
}
