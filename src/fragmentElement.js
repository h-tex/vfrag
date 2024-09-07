export const fixup = {
	ol (original, fragment, nodes) {
		// Continue <ol> from same number
		let start = original.start || 1;
		original.start = start + nodes.length;
	},

	details (original, fragment, nodes) {
		let originalSummary = original.querySelector(":scope > summary");
		let fragmentSummary = fragment.querySelector(":scope > summary");

		if (originalSummary && fragmentSummary) {
			// Nothing to do here
			return;
		}

		// Clone <summary> if exists, or create one (so it can be hidden)
		let summary = originalSummary || fragmentSummary || document.createElement("summary");
		let summaryClone = summary.cloneNode(true);

		if (!originalSummary) {
			original.prepend(summaryClone);
		}

		if (!fragmentSummary) {
			fragment.prepend(summaryClone);
		}
	},

	code (original, fragment, nodes) {
		if (original.firstChild?.nodeValue?.[0] === "\n") {
			// Prevent empty lines at the top of fragments
			original.firstChild.nodeValue = original.firstChild.nodeValue.replace(/^\n+/, "");
		}
	}
}

export default function fragmentElement (original, consumed) {
	let fragment = original.cloneNode(false);
	fragment.append(...consumed.nodes);

	// Keep track
	fragment.fragmentedFrom = original;

	if (!original.fragments) {
		// This is the first fragment
		original.fragments = [];
		original.classList.add("fragment", "fragment-last");

		if (original.id) {
			original.dataset.originalId = original.id;
		}
	}

	original.fragments.push(fragment);

	// Add styling/script hooks
	fragment.classList.add("fragment", "breaker-" + (consumed.breaker || "unknown"));
	fragment.classList.remove("fragment-last");

	let fragmentIndex = original.fragments.length;
	fragment.dataset.fragment = fragmentIndex;
	original.dataset.fragment = fragmentIndex + 1;

	// Prevent duplicate ids
	if (original.dataset.originalId) {
		// The first fragment kets to keep the id, whereas evey subsequent fragment gets a new id
		let originalId = original.dataset.originalId;
		fragment.id = fragmentIndex > 1 ? `${ originalId }-${ fragmentIndex }` : originalId;
		// Yes this means we'll change this every time, but we can't know if this is the last invocation
		original.id = `${ originalId }-${ fragmentIndex + 1 }`;
	}

	// Special handling for certain elements
	for (let selector in fixup) {
		if (fragment.matches(selector)) {
			fixup[selector](original, fragment, consumed.nodes);
		}
	}

	if (original.parentNode) {
		original.before(fragment);
	}

	return fragment;
}
