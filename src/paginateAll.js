
import paginate from "./paginate.js";

export default function paginateAll (selector = ".page", options = {}) {
	let {
		root = document.documentElement,
	} = options;
	let info = {pages: 0, time: 0};
	let sections = [...root.querySelectorAll(selector)];

	for (let section of sections) {
		let pageInfo = paginate(section, {...options, startAt: info.pages});
		info.pages += pageInfo.pages;
		info.time += pageInfo.time;
	}

	root.style.setProperty("--page-count", info.pages);
	root.style.setProperty("--pages", `"${info.pages}"`);

	console.info(`Paginated ${ sections.length } sections into ${ info.pages } pages in ${ Math.round(info.time) } ms`);

	return info;
}
