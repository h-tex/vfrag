import * as util from "./util.js";

export default function computeTargets (root = document.documentElement) {
	let info = {};
	let start = performance.now();
	let links = root.querySelectorAll("a[href^='#']:where(:not(.page-number), .page-number:not(.page > *))");

	for (let a of links) {
		// Why not querySelector? So we don’t get errors for invalid selectors
		let target = document.getElementById(a.hash.slice(1));

		if (target) {
			let pageNumber = target.closest("[data-page]").dataset.page;
			a.dataset.targetPage = pageNumber;

			if (a.matches('[data-page-target=""] *')) {
				// An empty data-page-target on a parent means we need to update that too
				// This is useful for TOCs where we want the page target on the <li>, not the <a>
				let parent = a.closest('[data-page-target=""]');
				parent.dataset.targetPage = pageNumber;
			}
		}
	}

	info.time = performance.now() - start;
	info.links = links.length;
	console.info(`Computed target pages for ${ info.links } links in ${ util.formatDuration(info.time) }`);
	return info;
}