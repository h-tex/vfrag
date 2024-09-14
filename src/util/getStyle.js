const styles = new WeakMap();

const categoricalProperties = [
	"position", "display", "float", "box-sizing",
	"page-break-before", "page-break-inside", "page-break-after",
	"text-wrap", "white-space-collapse",
	"--float",
];

const numericalProperties = [
	"padding-block-start", "padding-block-end",
	"margin-block-start", "margin-block-end",
	"border-block-start-width", "border-block-end-width",
	"min-height", "height",
	"line-height",
	"orphans", "widows",
];

/**
 * Cache and return the computed style of a node.
 * @param {Element} node
 * @param {boolean} [force=false] - Force a recalculation of the style even if it is cached.
 *                                  Why a boolean trap? For performance.
 * @returns
 */
export default function getStyle (node, force) {
	if (!node || node instanceof Node && node.nodeType !== Node.ELEMENT_NODE) {
		return null;
	}

	let style = force ? undefined : styles.get(node);

	if (style) {
		return style;
	}

	style = {};
	let cs = node instanceof CSSStyleDeclaration ? node : getComputedStyle(node);

	for (let cssProperty of categoricalProperties) {
		let property = cssProperty.replace(/^page-/, "").replaceAll("-", "_");
		let value = cs.getPropertyValue(cssProperty);

		if (value !== "auto") {
			style[property] = value;
		}
	}

	for (let cssProperty of numericalProperties) {
		let property = cssProperty.replaceAll("-", "_");
		style[property] = parseFloat(cs.getPropertyValue(cssProperty)) || 0;
	}

	styles.set(node, style);
	return style;
}
