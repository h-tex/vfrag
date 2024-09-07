import getStyle from "./getStyle.js";

const TIMEOUT = 5000;
const readyElements = new WeakMap();
const loadElements = ["embed", "iframe", "img", "input", "script", "source", "track", "video", "link", "style", "object"];
const loadElementContainers = ["figure", "section", "div", "article", "details"];
const loadElementSelector = loadElements.join(", ");

// Sufficient (but not necessary) conditions for elements to be considered loaded
export const alreadyLoaded = {
	style: node => node.sheet?.cssRules,
	link: node => node.sheet?.cssRules,
	img: node => node.complete,
	video: node => node.readyState >= 3,
	audio: node => node.readyState >= 3,
	object: node => !!node.getSVGDocument(),
}

export default function ready (node, force) {
	if (force) {
		readyElements.delete(node);
	}

	if (!node || node.nodeType !== Node.ELEMENT_NODE) {
		return true;
	}

	if (readyElements.has(node)) {
		return readyElements.get(node);
	}

	let tag = node.nodeName.toLowerCase();

	let isLoadElement = loadElements.includes(tag);

	if (isLoadElement || loadElementContainers.includes(tag)) {
		let isAlreadyLoaded = alreadyLoaded[tag]?.(node);
		let loaded = true;

		if (!isAlreadyLoaded) {
			if (isLoadElement) {
				loaded = new Promise((resolve, reject) => {
					node.addEventListener("load", resolve, {once: true});
					node.addEventListener("error", reject, {once: true});
					setTimeout(reject, TIMEOUT); // ensure a hanging download doesn't throw everything off
				}).catch(_ => _); // make resolved
			}
			else {
				// Elements that don't load resources themselves, but their descendants might
				let resources = node.querySelectorAll(loadElementSelector);
				if (resources.length > 0) {
					loaded = Promise.allSettled(Array.prototype.map.call(resources, n => ready(n, force)));
				}
			}

			if (loaded instanceof Promise) {
				loaded = loaded.then(_ => {
					readyElements.set(node, true);

					// Ensure reparenting won’t affect measurements
					if (isLoadElement) {
						let style = getStyle(node, true);
						node.style.minHeight = Math.max(style.height, style.min_height) + "px";
					}
				});
			}
		}

		readyElements.set(node, loaded);
		return loaded;
	}

	return true;
}
