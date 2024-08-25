import * as util from "./util.js";

export default function computeTargets (root = document.documentElement) {
	let info = {};
	let start = performance.now();
	let links = root.querySelectorAll("a[href^='#']:not(.page-number)");

	for (let a of links) {
		// Why not querySelector? So we don’t get errors for invalid selectors
		let target = document.getElementById(a.hash.slice(1));

		if (target) {
			let targetPage = target.closest("[data-page]");
			a.dataset.targetPage = targetPage.dataset.page;
		}
	}

	info.time = performance.now() - start;
	info.links = links.length;
	console.info(`Computed target pages for ${ info.links } links in ${ util.formatDuration(info.time) }`);
	return info;
}