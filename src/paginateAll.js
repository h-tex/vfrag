import paginate from "./paginate.js";

let supportsViewTransitions = Boolean(document.startViewTransition);
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
	let root = options.root ?? document.documentElement;
	let sections = options.sections ?? ".page";
	sections = typeof sections === "string" ? root.querySelectorAll(sections) : sections;

	options.totals ??= {pages: 0, time: 0};
	let doneArr = [];
	let done;

	root.classList.add("paginated");

	for (let section of sections) {
		options.startAt = options.totals.pages + 1;

		if (options.sync || !supportsViewTransitions) {
			paginate(section, options);
		}
		else {
			doneArr.push(document.startViewTransition(() => paginate(section, options)).finished);
			done ??= Promise.all(doneArr);
		}
	}

	let doneCallback = () => {
		root.style.setProperty("--page-count", options.totals.pages);
		root.style.setProperty("--pages", `"${options.totals.pages}"`);
		console.info(`Paginated ${ sections.length } sections into ${ options.totals.pages } pages in ${ Math.round(options.totals.time) } ms`);
		return options.totals;
	};

	return options.sync ? doneCallback() : done.then(doneCallback);
}
