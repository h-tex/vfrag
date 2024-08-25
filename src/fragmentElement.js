const fixup = {
	ol (original, fragment, nodes) {
		// Continue <ol> from same number
		let start = original.start || 1;
		original.start = start + nodes.length;
	},

	details (original, fragment, nodes) {
		// Clone <summary> if exists, or create one (so it can be hidden)
		let summary = original.querySelector(":scope > summary")?.cloneNode(true) ?? document.createElement("summary");
		fragment.prepend(summary);
	}
}

export default function fragmentElement (original, nodes, {type = "fragment"} = {}) {
	let fragment = original.cloneNode(false);
	fragment.append(...nodes);

	// Keep track
	fragment.fragmentedFrom = original;
	original.fragments ??= [];
	original.fragments.push(fragment);

	// Add styling/script hooks
	fragment.classList.add("fragment")
	fragment.dataset[type] = original.fragments.length;
	original.dataset[type] = original.fragments.length + 1;

	// TODO prevent duplicate ids

	// Special handling for certain elements
	for (let selector in fixup) {
		if (fragment.matches(selector)) {
			fixup[selector](original, fragment, nodes);
		}
	}

	return fragment;
}
