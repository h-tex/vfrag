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
export default function paginateAll (options = {}) {
	if (typeof options === "string") {
		options = {sections: options};
	}
	options.root ??= document.documentElement;
	options.root.classList.add("paginated", "paginating");
	let sections = options.sections ?? ".page";
	sections = typeof sections === "string" ? options.root.querySelectorAll(sections) : sections;

	options.totals ??= {pages: 0, time: 0, asyncTime: 0, empty_lines: []};
	let startTime = performance.now();
	// options.sync ??= true;

	let paginator = (function* () {
		for (let section of sections) {
			let result = paginate(section, options);
			yield result;
		}

		let total = performance.now() - startTime;
		console.info(`Paginated ${ sections.length } sections into ${ options.totals.pages } pages in ${ util.formatDuration(options.totals.time) } (total: ${ util.formatDuration(total) }).`
		+ ` Empty lines: ${ util.average(options.totals.empty_lines).toLocaleString() } avg, ${ Math.max(...options.totals.empty_lines).toLocaleString() } max.`);
		options.root.classList.remove("paginating");
		options.root.classList.add("done");
	})();

	if (options.sync) {
		for (let sectionResult of paginator);
		return options.totals;
	}
	else {
		return (async () => {
			for (let sectionResult of paginator) {
				await sectionResult;
			}
			return options.totals;
		})();
	}
}
