import paginate from "./paginate.js";
import * as util from "./util.js";

/**
 * @typedef {Object} PaginationStats
 * @property {number} pages - Number of pages
 * @property {number} time - Time taken in milliseconds
 */

const DEFAULT_OPTIONS = {
	startAt: 1,
	aspectRatio: 8.5 / 11,
	root: document.documentElement,
	sections: ".page, .vfrag-page",
	askEvery: 200,
	renderEvery: 20,
	running: {
		headers: {
			maxLevels: 2,
			separator: "&raquo;",
		},
		pageNumbers: true
	},
};

/**
 * Paginate multiple containers in a continuous sequence, with styling hooks on the root.
 * @param { string} selector
 * @param { object | string } options
 * @param { string | Array<Element> } [options.sections=".page"]
 * @param { Element } [options.root=document.documentElement]
 * @param { boolean } [options.sync=false]
 * @returns {PaginationStats | Promise<PaginationStats>}
 */
export default async function paginateAll (options = {}) {
	if (typeof options === "string") {
		options = {sections: options};
	}

	for (let option in DEFAULT_OPTIONS) {
		options[option] ??= DEFAULT_OPTIONS[option];
	}

	options.renderEvery = Math.min(options.askEvery, options.askEvery);

	let timer = util.timer();
	timer.start();

	options.root.classList.add("vfrag-root", "paginated", "paginating");

	if (options.debug) {
		options.root.classList.add("vfrag-debug");
		options.root.style.setProperty("--page-aspect-ratio-image", `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ options.aspectRatio } 1"><rect width="100%" height="100%" fill="white" /></svg>')`);
	}

	let sections = options.root.querySelectorAll(options.sections);

	await util.nextFrame();

	options.root.addEventListener("fragmented", event => {
		if (event.target.matches?.(options.sections)) {
			let info = event.detail;
			let pagesDone = options.totals.pages;
			options.root.style.setProperty("--page-count", pagesDone);
			options.root.style.setProperty("--approx-pages-left", info.pagesLeft);
		}
	});

	let done = [];

	for (let section of sections) {
		if (!section.matches(DEFAULT_OPTIONS.sections)) {
			// We need some kind of styling hook here
			section.classList.add("vfrag-page");
		}

		let sectionDone = paginate(section, options);

		done.push(sectionDone);
	}

	let sectionInfo = await Promise.all(done);
	let timers = options.timers;
	let emptyLines = sectionInfo.flatMap(info => info.pageDetails.map(consumed => consumed.emptyLines));

	// Pagination finished, assign page numbers
	timers.DOM.start();
	let pages = options.root.querySelectorAll(options.sections);
	for (let i = 0; i < pages.length; i++) {
		let pageNumber = i + options.startAt;
		let page = pages[i];

		page.style.setProperty("--page-number", pageNumber);
		page.dataset.page = pageNumber;
	}
	timers.DOM.pause();

	let totalTime = new util.Timer(timers.consume + timers.DOM);

	console.info(`Paginated ${ sections.length } sections into ${ options.totals.pages } pages in ${ totalTime } (total: ${ timer.end() }, consume: ${ timers.consume }, DOM: ${ timers.DOM }).`
	+ ` Empty lines: ${ util.average(emptyLines)?.toLocaleString() } avg, ${ Math.max(...emptyLines).toLocaleString() } max.`);
	options.root.classList.remove("paginating");
	options.root.classList.add("done");

	options.root.dispatchEvent(new CustomEvent("paginated",{ bubbles: true, detail: options.totals }));

	return options.totals;
}
