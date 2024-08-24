import * as util from "./util.js";
import consumeUntil from "./consumeUntil.js";
import fragmentElement from "./fragmentElement.js";
const MAX_PAGES = 300;

// Paginate by breaking down .page into multiple .page elements
export default function paginate (container, options = {}) {
	let {startAt = 1, aspectRatio = 8.5/11} = options;
	let timeStart = performance.now();
	let w = container.offsetWidth;
	let style = util.getStyle(container, {page: true, pageBreak: false});

	let min_page_height = Math.ceil(util.getOuterHeight(style.min_height, style));
	let target_page_height = w / aspectRatio;
	let target_content_height = util.getInnerHeight(target_page_height, style);
	let h;
	let page = startAt;

	for (; (w / (h = container.offsetHeight)) <= aspectRatio && h > min_page_height; page++) {
		// Add nodes to the nodes array until the page is full
		let nodes = consumeUntil(target_content_height, container);

		if (nodes.length === 0 && container.firstChild.getBoundingClientRect().height > target_content_height) {
			// Overly large element that can't be split
			console.warn("Overly large element that can't be split", container.firstChild);
			nodes = [container.firstChild];
		}

		if (nodes.length > 0) {
			let newPage = fragmentElement(container, nodes, {type: "page"});
			newPage.id = "page-" + page;

			let pageNumber = Object.assign(document.createElement("a"), {
				href: "#" + newPage.id,
				className: "page-number",
				textContent: page,
			});

			container.before(newPage);
			let range = document.createRange();
			range.selectNodeContents(newPage);

			let page_content_height = range.getBoundingClientRect().height;
			newPage.append(pageNumber);

			let empty_content_height = target_content_height - page_content_height;
			let lines = empty_content_height / style.lh;

			if (lines > 1 && options.debug) {
				let placeholder = Object.assign(document.createElement("div"), {
					className: "placeholder",
					style: `height: ${empty_content_height}px; --lines: ${ lines };`,
					textContent: `Empty space: ${lines} lines`,
				});
				newPage.append(placeholder);
			}
		}
		else {
			h = container.offsetHeight;
			console.warn("Cannot paginate", container, ". Height: ", h , ">", min_page_height);
			break;
		}

		if (page > MAX_PAGES) {
			console.warn("Exceeded max page limit of ", MAX_PAGES);
			break;
		}
	}

	container.id = "page-" + page;

	let info = {
		pages: page - startAt,
		time: performance.now() - timeStart,
	};

	if (options.totals) {
		options.totals.pages += info.pages;
		options.totals.time += info.time;
	}

	return info;
}
