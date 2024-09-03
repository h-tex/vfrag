const readyElements = new WeakSet();
const loadElements = ["embed", "iframe", "img", "input", "script", "source", "track", "video", "link", "style", "object"];
const loadElementContainers = ["figure", "section", "div", "article", "details"];
const loadElementSelector = loadElements.join(", ");

// Sufficient (but not necessary) conditions for elements to be considered loaded
const loaded = {
	style: node => node.sheet?.cssRules,
	link: node => node.sheet?.cssRules,
	img: node => node.complete,
	video: node => node.readyState >= 3,
	audio: node => node.readyState >= 3,
	object: node => !!node.getSVGDocument(),
}

export default async function ready (node, options) {
	if (options?.force) {
		readyElements.delete(node);
	}

	if (!node || node.nodeType !== Node.ELEMENT_NODE || readyElements.has(node)) {
		return true;
	}

	let tag = node.nodeName.toLowerCase();

	let isLoadElement = loadElements.includes(tag);
	if (isLoadElement || loadElementContainers.includes(tag)) {
		if (!(tag in loaded) || !loaded[tag](node)) { // Already loaded?
			if (isLoadElement) {
				await new Promise((resolve, reject) => {
					node.addEventListener("load", resolve, {once: true});
					node.addEventListener("error", reject, {once: true});
				}).finally(evt => {});
			}
			else {
				// Elements that don't load resources themselves, but their descendants might
				let resources = node.querySelectorAll(loadElementSelector);
				if (resources.length > 0) {
					await Promise.allSettled(Array.prototype.map.call(resources, n => ready(n, options)));
				}

			}
		}

		readyElements.add(node);
	}

	return true;
}
