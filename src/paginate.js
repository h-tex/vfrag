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
	let target_content_height = util.getInnerHeight(target_page_height, style);
	let remaining_content_height = util.getInnerHeight(height, style);
	let nodesProcessed = 0;
	let pages = [];

	while (remaining_content_height > target_content_height) {
		// Add nodes to the nodes array until the page is full
		options.startAtIndex = nodesProcessed;
		options.asyncTimer = timers.async;
		let consumed = await consumeUntil(target_content_height, container, options);

		if (consumed.nodes.length > 0) {
			pages.push(consumed);
			nodesProcessed += consumed.nodes.length;
			remaining_content_height -= consumed.nodes.height;
		}
		else {
			let approx_pages_left = Math.ceil(remaining_content_height / target_content_height);
			console.warn("Cannot paginate", container, pages.length > 0 ? ` further (${pages.length} pages done, ~${ approx_pages_left } left)` : `(~${ approx_pages_left } pages left)`);
			break;
		}

		if (totals.pages > 0 && options.askEvery > 0 && totals.pages % options.askEvery === 0) {
			if (!confirm(`Paginated ${ totals.pages } pages. Continue?`)) {
				options.stopped = true;
				break;
			}
		}
	}

	timers.consume.pause();
	timers.consume.total -= timers.async.total;

	// Now actually fragment the container (in a document fragment to avoid reflows)
	timers.DOM.start();

	// Save position in the DOM
	let marker = document.createComment(`${ container.id ?? container.data.id ?? container.nodeName }`);
	container.replaceWith(marker);

	let docFragment = document.createDocumentFragment();
	docFragment.append(container);

	let { startAt = totals.pages + 1 } = options;

	// Update page stats
	info.pages = pages.length;
	totals.pages += info.pages;

	options.root.style.setProperty("--page-count", totals.pages);
	options.root.style.setProperty("--pages", `"${totals.pages}"`);

	for (let i = 0; i<pages.length; i++) {
		let consumed = pages[i];
		let page = container;

		if (consumed !== pages.at(-1)) {
			// Not the last page, create a new page
			let { emptyLines } = consumed;
			page = fragmentElement(container, consumed);

			info.empty_lines.push(emptyLines);
			page.style.setProperty("--empty-lines", emptyLines);
			page.style.setProperty("--empty-lines-text", `"${ emptyLines.toLocaleString() }"`);

			if (emptyLines > 2.5) {
				page.classList.add("empty-space-" + (emptyLines > 6 ? "l" : "m"));
			}
		}

		// Add page number
		let pageNumber = startAt + i;
		page.style.setProperty("--page-number", pageNumber);
		page.dataset.page = pageNumber;

		page.insertAdjacentHTML("beforeend", `<a href="#${ page.id }" class="page-number">${ pageNumber }</a>`);

		page.classList.add("pagination-done");
	}

	marker.replaceWith(docFragment);

	totals.empty_lines.push(...info.empty_lines);
	timers.DOM.pause();

	return info;
}
