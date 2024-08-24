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
	if (fragment.matches("ol")) {
		// Continue <ol> from same number
		let start = original.start || 1;
		original.start = start + nodes.length;
	}
	else if (fragment.matches("details")) {
		// Open <details> elements
		fragment.prepend(original.querySelector("summary").cloneNode(true));
	}

	return fragment;
}
