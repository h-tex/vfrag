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
	options.root.classList.add("paginated");
	let sections = options.sections ?? ".page";
	sections = typeof sections === "string" ? options.root.querySelectorAll(sections) : sections;

	options.totals ??= {pages: 0, time: 0};
	// options.sync ??= true;

	let done;
	for (let section of sections) {
		if (options.sync) {
			paginate(section, options);
		}
		else {
			done = (done ?? Promise.resolve()).then(() => paginate(section, options));
		}
	}

	let doneCallback = () => {
		console.info(`Paginated ${ sections.length } sections into ${ options.totals.pages } pages in ${ util.formatDuration(options.totals.time) }`);
		return options.totals;
	};

	return options.sync ? doneCallback() : done.then(doneCallback);
}
