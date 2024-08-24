// NOTE These don't take borders into account
export function getOuterHeight (innerHeight, style) {
	if (style.box_sizing === "border-box") {
		return innerHeight;
	}
	else if (style.box_sizing === "content-box") {
		return innerHeight + style.padding_block;
	}
}

export function getInnerHeight (outerHeight, style) {
	if (style.box_sizing === "border-box") {
		return outerHeight - style.padding_block;
	}
	else if (style.box_sizing === "content-box") {
		return outerHeight;
	}
}

export function getStyle (arg, {pageBreak = true, lh = true, page} = {}) {
	if (!arg || arg instanceof Node && arg.nodeType !== 1) {
		return null;
	}

	let style = {};
	let cs = arg instanceof CSSStyleDeclaration ? arg : getComputedStyle(arg);

	// NOTE Does not handle complicated values, just single keywords.
	if (pageBreak) {
		for (let prop of ["inside", "before", "after"]) {
			let value = cs.getPropertyValue("break-" + prop);
			if (value === "auto") {
				value = cs.getPropertyValue("page-break-" + prop);
			}

			if (value !== "auto") {
				style['break_' + prop] = value;
			}
		}
	}

	if (lh) {
		style.lh = parseFloat(cs.getPropertyValue("line-height"));
	}

	if (page) {
		style.padding_block_start = parseFloat(cs.getPropertyValue("padding-block-start")) || 0,
		style.padding_block_end = parseFloat(cs.getPropertyValue("padding-block-end")) || 0,
		style.padding_block = style.padding_block_start + style.padding_block_end;
		style.box_sizing = cs.getPropertyValue("box-sizing");
		style.min_height = parseFloat(cs.getPropertyValue("min-height")) || 0;
	}

	return style;
}
