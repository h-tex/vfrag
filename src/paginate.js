import * as util from "./util.js";
import consumeUntil from "./consumeUntil.js";
import fragmentElement from "./fragmentElement.js";

// Paginate by breaking down .page into multiple .page elements
export default async function paginate (container, options = {}) {
	let info = { pages: 1 };

	if (options.stopped) {
		return info;
	}

	let totals = options.totals ??= { pages: 0, pagesLeft: 0 };
	let timers = options.timers ??= {consume: new util.Timer(), DOM: new util.Timer(), async: new util.Timer() };

	let headings = new WeakMap([...container.querySelectorAll("h1, h2, h3, h4, h5, h6, [role=heading]")].map(h => {
		let c = h;
		while (c.parentElement !== container) {
			c = c.parentElement;
		}
		return [c, h];
	}));

	options = { ...options, headings, openHeadings: [] };

	options.totals.pages++; // account for container

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
					let ret = renderPages();
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
	await renderPages();
	addRunningElements(container, options);

	return info;

	// scope vars: timers, container, info, pages, pendingPages
	async function renderPages () {
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
				pages.push(consumed);

				let page = fragmentElement(container, consumed);
				page.vfrag = consumed;

				let { emptyLines } = consumed;
				if (options.debug) {
					page.style.setProperty("--empty-lines-text", `"${ emptyLines.toLocaleString() }"`);
				}

				page.style.setProperty("--empty-lines", emptyLines);

				if (emptyLines > 2.5) {
					page.classList.add("empty-space-" + (emptyLines > 6 ? "l" : "m"));
				}

				requestIdleCallback(() => {
					addRunningElements(page, options);
				});

				let detail = { page, consumed };
				container.dispatchEvent(new CustomEvent("newpage", { bubbles: true, detail }));
			}

			marker.replaceWith(docFragment);
			container.dispatchEvent(new CustomEvent("fragmented", { bubbles: true, detail: info }));
			timers.DOM.pause();
		});

		timers.async.start();
	}
}

function addRunningElements (page, options) {
	// Running headers
	let openHeadings = page.vfrag?.openHeadings ?? options.openHeadings ?? [];
	if (options.running.headers && openHeadings.length > 0) {
		let dummy = document.createElement("div");
		let header = document.createElement("nav");
		header.classList.add("running-header");
		let {maxLevels = 2, separator = '&raquo;' } = options.running.headers;
		let content = openHeadings.slice(0, maxLevels).map(h => {
			dummy.innerHTML = h.innerHTML;

			// Drop presentational elements
			for (let presentational of dummy.querySelectorAll("[role=presentation], [aria-hidden=true], [hidden]")) {
				presentational.remove();
			}

			// Unwrap links
			for (let a of dummy.querySelectorAll("a")) {
				let replacement = document.createElement("ex-a");
				// Copy attributes
				for (let attr of a.attributes) {
					replacement.setAttribute(attr.name, attr.value);
				}

				replacement.append(...a.childNodes);
				a.replaceWith(replacement);
			}

			return `<a href="#${ h.id }">${ dummy.innerHTML }</a>`;
		}).join(` ${ separator } `);

		header.innerHTML = content;
		page.append(header);
	}

	// Page numbers
	if (options.running.pageNumbers) {
		page.insertAdjacentHTML("beforeend", `<a href="#${ page.id }" class="page-number running-footer"></a>`);
	}
}
