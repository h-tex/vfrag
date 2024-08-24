import * as util from "./util.js";
import consumeUntil from "./consumeUntil.js";
const MAX_PAGES = 300;

// Paginate by breaking down .page into multiple .page elements
export default function paginate (container, {startAt = 0, aspectRatio = 8.5/11} = {}) {
	let timeStart = performance.now();
	let w = container.offsetWidth;
	let style = util.getStyle(container, {page: true, pageBreak: false});

	let min_page_height = Math.ceil(util.getOuterHeight(style.min_height, style));
	let target_page_height = w / aspectRatio;
	let target_content_height = util.getInnerHeight(target_page_height, style);
	let h, page = startAt;

	for (; (w / (h = container.offsetHeight)) <= aspectRatio && h > min_page_height; page++) {
		// Add nodes to the nodes array until the page is full
		let nodes = consumeUntil(target_content_height, container);

		if (nodes.length === 0 && container.firstChild.getBoundingClientRect().height > target_content_height) {
			// Overly large element that can't be split
			console.warn("Overly large element that can't be split", container.firstChild);
			nodes = [container.firstChild];
		}

		if (nodes.length > 0) {
			let newPage = container.cloneNode();
			newPage.classList.add("fragment");
			newPage.id = "page-" + (page + 1);
			newPage.dataset.page = page + 1;

			let pageNumber = Object.assign(document.createElement("a"), {
				href: "#" + newPage.id,
				className: "page-number",
				textContent: page + 1,
			});

			newPage.append(...nodes);
			container.before(newPage);
			let range = document.createRange();
			range.selectNodeContents(newPage);

			let page_content_height = range.getBoundingClientRect().height;
			newPage.append(pageNumber);

			let empty_content_height = target_content_height - page_content_height;
			let lines = empty_content_height / style.lh;

			if (lines > 1) {
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

	container.id = "page-" + (page + 1);

	return {
		pages: page + 1 - startAt,
		time: performance.now() - timeStart,
	};
}
