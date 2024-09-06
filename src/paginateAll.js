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
	options.askEvery ??= 200;

	options.root.classList.add("paginated", "paginating");
	let sections = options.sections ?? ".page";
	sections = typeof sections === "string" ? options.root.querySelectorAll(sections) : sections;

	for (let section of sections) {
		await paginate(section, options);
	}

	console.info(`Paginated ${ sections.length } sections into ${ options.totals.pages } pages in ${ options.totals.timer.end() } (total: ${ options.totals.asyncTimer.end() }).`
	+ ` Empty lines: ${ util.average(options.totals.empty_lines)?.toLocaleString() } avg, ${ Math.max(...options.totals.empty_lines).toLocaleString() } max.`);
	options.root.classList.remove("paginating");
	options.root.classList.add("done");

	return options.totals;
}
