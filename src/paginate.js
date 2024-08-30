import * as util from "./util.js";
import consumeUntil from "./consumeUntil.js";
import fragmentElement from "./fragmentElement.js";
const MAX_PAGES = 300;
const supportsViewTransitions = Boolean(document.startViewTransition);


function makePaginator (container, options) {
	options.totals ??= {pages: 0, time: 0, empty_lines: []};
	let {startAt = options.totals.pages + 1, aspectRatio = 8.5/11} = options;
	let w = container.offsetWidth;
	let id = container.id;
	let style = util.getStyle(container, {page: true, pageBreak: false});
	let min_page_height = Math.ceil(util.getOuterHeight(style.min_height, style));
	let target_page_height = w / aspectRatio;
	let target_content_height = util.getInnerHeight(target_page_height, style);
	let h;
	let page = startAt;
	let info = {pages: 1, time: 0, empty_lines: []};

	/**
	 * Add page number, and empty content
	 * @param {*} page
	 * @param {*} param1
	 */
	function pageFinished (page, {number, fragment, isLast}) {
		// Update page stats
		info.pages++;
		options.totals.pages++;
		options.root.style.setProperty("--page-count", options.totals.pages);
		options.root.style.setProperty("--pages", `"${options.totals.pages}"`);

		// Make a new id (the old one will be duplicate)
		page.id = util.getId(id, {number, fragment});

		// Add page number
		page.dataset.page = number;

		let pageNumber = Object.assign(document.createElement("a"), {
			href: "#" + page.id,
			className: "page-number",
			textContent: number,
		});

		// Insert new page before source
		container.before(page);

		// Calculate empty space
		let range = document.createRange();
		range.selectNodeContents(page);

		let page_content_height = util.getHeight(range);
		page.append(pageNumber);

		let empty_content_height = Math.max(0, target_content_height - page_content_height);
		let empty_lines = empty_content_height / style.lh;

		page.style.setProperty("--empty-lines", empty_lines);
		page.style.setProperty("--empty-lines-text", `"${ empty_lines.toLocaleString() } empty lines"`);

		if (!isLast) {
			info.empty_lines.push(empty_lines);

			if (empty_lines > 2.5) {
				page.classList.add("empty-space-" + (empty_lines > 6 ? "l" : "m"));
			}
		}

		page.classList.add("pagination-done");
	}

	function fragmentPage (nodes) {
		let timeStart = performance.now();

		let newPage = fragmentElement(container, nodes);
		let fragment = container.fragments.length;
		pageFinished(newPage, {number: page, fragment});
		let pageTime = performance.now() - timeStart;
		// console.log("Done: Page", page, "took", util.formatDuration(pageTime));
		info.time += pageTime;
	}

	return {
		paginator: (function* () {
			for (; (w / (h = container.offsetHeight)) <= aspectRatio && h > min_page_height; page++) {
				let timeStart = performance.now();
				// Add nodes to the nodes array until the page is full
				let nodes = consumeUntil(target_content_height, container, options);

				if (nodes.length === 0) {
					// This typically happens when there is a very large item that cannot be fragmented, e.g. a very large figure
					// This is usually the first child, but not always, e.g. it may be preceded by an element with break-after: avoid
					// such as a heading. Let’s just manually add until we find that item
					// TODO handle this better, e.g. by making the item smaller
					for (let child of container.childNodes) {
						nodes.push(child);

						if (util.getHeight(child) > target_content_height) {
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

			pageFinished(container, {
				number: page,
				fragment: container.fragments?.length ?? 1,
				isLast: true,
			});

			options.totals.time += info.time;
			options.totals.empty_lines.push(...info.empty_lines);
		})(),
		info,
	};
}

// Paginate by breaking down .page into multiple .page elements
export default function paginate (container, options = {}) {
	let {info, paginator} = makePaginator(container, options);

	if (options.sync) {
		for (let page of paginator);
		return info;
	}
	else {
		return (async () => {
			let done = false;
			while (!done) {
				if (!options.animation || !supportsViewTransitions) {
					await util.nextFrame();
					done = paginator.next().done;
				}
				else {
					await document.startViewTransition(() => done = paginator.next().done).finished;
				}
			}
			return info;
		})();
	}
}
