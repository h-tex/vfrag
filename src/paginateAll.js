import paginate from "./paginate.js";
import * as util from "./util.js";

/**
 * @typedef {Object} PaginationStats
 * @property {number} pages - Number of pages
 * @property {number} time - Time taken in milliseconds
 */

const DEFAULT_OPTIONS = {
	root: document.documentElement,
	sections: ".page, .vfrag-page",
	askEvery: 200,
	renderEvery: 20,
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
		if (!(option in options)) {
			options[option] = DEFAULT_OPTIONS[option];
		}
	}

	options.renderEvery = Math.min(options.askEvery, options.askEvery);

	options.root.classList.add("paginated", "paginating");
	options.root.classList.toggle("vfrag-debug", options.debug);

	let sections = options.root.querySelectorAll(options.sections);

	await util.nextFrame();

	for (let section of sections) {
		if (!section.matches(DEFAULT_OPTIONS.sections)) {
			// We need some kind of styling hook here
			section.classList.add("vfrag-page");
		}

		await util.domChange(() => paginate(section, options));
	}

	let timers = options.timers;
	let totalTime = new util.Timer(timers.consume + timers.DOM);
	let totalTimeAsync = new util.Timer(totalTime + timers.async);

	console.info(`Paginated ${ sections.length } sections into ${ options.totals.pages } pages in ${ totalTime } (total: ${ totalTimeAsync }, consume: ${ timers.consume }, DOM: ${ timers.DOM }).`
	+ ` Empty lines: ${ util.average(options.totals.empty_lines)?.toLocaleString() } avg, ${ Math.max(...options.totals.empty_lines).toLocaleString() } max.`);
	options.root.classList.remove("paginating");
	options.root.classList.add("done");

	return options.totals;
}
