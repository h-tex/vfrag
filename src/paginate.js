import * as util from "./util.js";
import consumeUntil from "./consumeUntil.js";
import fragmentElement from "./fragmentElement.js";
const MAX_PAGES = 600;
const supportsViewTransitions = Boolean(document.startViewTransition);

// Paginate by breaking down .page into multiple .page elements
export default async function paginate (container, options = {}) {
	options.totals ??= {pages: 0, timer: new util.Timer(), asyncTimer: util.timer(), empty_lines: []};
	options.totals.timer.start();

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
	let doTransition = options.animation && supportsViewTransitions;

	/**
	 * Add page number, and empty content
	 * @param {*} page
	 * @param {*} param1
	 */
	function pageFinished (page, number) {
		// Update page stats
		info.pages++;
		options.totals.pages++;
		options.root.style.setProperty("--page-count", options.totals.pages);
		options.root.style.setProperty("--pages", `"${options.totals.pages}"`);

		// Add page number
		page.dataset.page = number;

		let pageNumber = Object.assign(document.createElement("a"), {
			href: "#" + page.id,
			className: "page-number",
			textContent: number,
		});

		page.append(pageNumber);

		page.classList.add("pagination-done");
	}

	function fragmentPage (nodes, emptyLines) {
		options.totals.timer.start();

		let newPage = fragmentElement(container, nodes);

		info.empty_lines.push(emptyLines);
		newPage.style.setProperty("--empty-lines", emptyLines);
		newPage.style.setProperty("--empty-lines-text", `"${ emptyLines.toLocaleString() }"`);

		if (emptyLines > 2.5) {
			newPage.classList.add("empty-space-" + (emptyLines > 6 ? "l" : "m"));
		}

		pageFinished(newPage, page);

		options.totals.timer.pause();
	}

	for (; (w / (h = container.offsetHeight)) <= aspectRatio && h > min_page_height; page++) {
		// Add nodes to the nodes array until the page is full
		let {nodes, emptyLines} = await consumeUntil(target_content_height, container, options);

		if (nodes.length === 0) {
			// This typically happens when there is a very large item that cannot be fragmented, e.g. a very large figure
			// This is usually the first child, but not always, e.g. it may be preceded by an element with break-after: avoid
			// such as a heading. Let’s just manually add until we find that item
			// TODO handle this better, e.g. by making the item smaller
			for (let child of container.childNodes) {
				nodes.push(child);

				if (util.getHeight(child) > target_content_height) {
					console.warn("Overly large element that can't be split:", child, `(${util.getHeight(child)} > ${target_content_height})`);
					break;
				}
			}
		}

		if (nodes.length > 0) {
			options.totals.timer.pause();

			if (doTransition) {
				await document.startViewTransition(() => fragmentPage(nodes, emptyLines)).finished;
			}
			else {
				await fragmentPage(nodes, emptyLines);
				await util.nextFrame();
			}

			options.totals.timer.start();
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

	pageFinished(container, page);

	options.totals.empty_lines.push(...info.empty_lines);
	options.totals.timer.pause();

	return info;
}
