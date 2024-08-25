import * as util from "./util.js";
import consumeUntil from "./consumeUntil.js";
import fragmentElement from "./fragmentElement.js";
const MAX_PAGES = 300;
const supportsViewTransitions = Boolean(document.startViewTransition);

function makePaginator (container, options) {
	let {startAt = (+options.totals?.pages || 0) + 1, aspectRatio = 8.5/11} = options;
	let w = container.offsetWidth;
	let id = container.id;
	let style = util.getStyle(container, {page: true, pageBreak: false});
	let min_page_height = Math.ceil(util.getOuterHeight(style.min_height, style));
	let target_page_height = w / aspectRatio;
	let target_content_height = util.getInnerHeight(target_page_height, style);
	let h;
	let page = startAt;
	let info = {pages: 1, time: 0};

	function fragmentPage (nodes) {
		let timeStart = performance.now();
		info.pages++;

		newPage.id = "page-" + page;
		let newPage = fragmentElement(container, nodes);
		newPage.dataset.page = page;

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
		info.time += performance.now() - timeStart;
	}

	return {
		paginator: (function* () {
			for (; (w / (h = container.offsetHeight)) <= aspectRatio && h > min_page_height; page++) {
				let timeStart = performance.now();
				// Add nodes to the nodes array until the page is full
				let nodes = consumeUntil(target_content_height, container);

				if (nodes.length === 0) {
					// This typically happens when there is a very large item that cannot be fragmented, e.g. a very large figure
					// This is usually the first child, but not always, e.g. it may be preceded by an element with break-after: avoid
					// such as a heading. Let’s just manually add until we find that item
					// TODO handle this better, e.g. by making the item smaller
					for (let child of container.childNodes) {
						nodes.push(child);

						if (child.getBoundingClientRect?.().height > target_content_height) {
							console.warn("Overly large element that can't be split", child);
							break;
						}
					}
				}

				info.time += performance.now() - timeStart;

				if (nodes.length > 0) {
					let newPage = fragmentPage(nodes);
					yield newPage;
				}
				else {
					h = container.offsetHeight;
					console.warn("Cannot paginate", container, ". Height: ", h , ">", min_page_height);
					return;
				}

				if (page > MAX_PAGES) {
					console.warn("Exceeded max page limit of ", MAX_PAGES);
					return;
				}
			}
		})(),
		info: info,
	};
}

// Paginate by breaking down .page into multiple .page elements
export default function paginate (container, options = {}) {
	let {info, paginator} = makePaginator(container, options);
	let doneCallback = () => {
		container.id = "page-" + info.pages;

		if (options.totals) {
			options.totals.pages += info.pages;
			options.totals.time += info.time;
		}

		return info;
	};

	if (options.sync || !supportsViewTransitions) {
		for (let page of paginator);
		return doneCallback();
	}
	else {
		return (async () => {
			let done = false;
			while (!done) {
				await document.startViewTransition(() => done = paginator.next().done).finished;
			}
			return doneCallback();
		})();
	}
}
