import paginate from "./paginate.js";
import * as util from "./util.js";

/**
 * @typedef {Object} PaginationStats
 * @property {number} pages - Number of pages
 * @property {number} time - Time taken in milliseconds
 */

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

	options.root ??= document.documentElement;
	options.askEvery ??= 5;
	options.renderEvery ??= 15;
	options.renderEvery = Math.min(options.askEvery, options.askEvery);

	options.root.classList.add("paginated", "paginating");
	let sections = options.sections ?? ".page";
	sections = typeof sections === "string" ? options.root.querySelectorAll(sections) : sections;

	await util.nextFrame();

	for (let section of sections) {
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
