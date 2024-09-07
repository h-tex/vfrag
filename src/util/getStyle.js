const styles = new WeakMap();
const categoricalProperties = [
	"position", "display", "box-sizing",
	"page-break-before", "page-break-inside", "page-break-after",
	"text-wrap",

];
const numericalProperties = [
	"padding-block-start", "padding-block-end",
	"min-height",
	"line-height",
	"orphans", "widows",
];

export default function getStyle (node) {
	if (!node || node instanceof Node && node.nodeType !== 1) {
		return null;
	}

	let style = styles.get(node);

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
