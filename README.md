<h1><img src="logo.svg" height="100"> vfrag</h1>

Paginate a document by breaking one or more containers vertically into multiple fragments.
This is a bare-bones DIY alternative to [Paged.js](https://pagedjs.org/).

[Paged.js](https://pagedjs.org/) is an impressive piece of work, but it did not work for our use cases:
- It does some light parsing on the CSS file, which means it can be thrown by more modern CSS that it doesn't understand (e.g. [range media queries](https://gitlab.coko.foundation/pagedjs/pagedjs/-/issues/460)).
It also makes it more heavyweight, as it has to refetch all CSS files.
- It recreates every DOM node, which means it can be slow and have side effects (e.g. [dropping declarative shadow roots](https://gitlab.coko.foundation/pagedjs/pagedjs/-/issues/463)).
- Because it has to handle the general case, it is also a very complicated piece of work,
and in the end I realized we had spent more time adding workarounds to our codebase to handle its quirks than I spent writing this.

Furthermore, I wanted to do things CSS cannot currently express, such as:
- Shift certain nodes that are not in flow (e.g. `<figure>`) earlier or later to minimize empty space at the bottom of pages.

## Requirements

This is written with different requirements which likely make it unsuitable for many use cases.
It is not a drop-in replacement for Paged.js,
you will almost certainly need to do more work to get it working for your use case.

1. **Minimize DOM I/O.**
This was written to paginate an entire PhD thesis, so speed is of the essence.
DOM manipulation (especially creating new elements) should be kept at a minimum.
Anything that can be handled via CSS, should be.
Avoiding too much DOM I/O also means it’s less likely to break content it did not foresese.
2. **Do not handle the general case.**
Instead but makes several assumptions about the structure and layout of the document (see below),
as well as how fragmentation should be handled.
3. **Not a CSS polyfill.**
vfrag does not attempt to polyfill any CSS spec and does not parse any CSS.
Instead of unsupported CSS syntax that needs to be parsed,
it uses class names, CSS variables, standard (supported) CSS properties and rules, and the CSS OM.
This makes it both a lot lighter and future-proof, and allows it to do things that are not possible with CSS
(e.g. HTML in running headers, shifting certain nodes to minimize empty space, etc.).
4. **Screen media remains screen media.**
Rendering print styles on screen is a non-goal.
Any differences that affect pagination should be handled via CSS selectors (`.pagination-root *`).
and `page-break-*` or `break-*` CSS properties should be specified on screen media as well
(they have no effect so there is no reason to scope them to `print` media).
5. **Static**
This is a static view, intended to create a paged view that can be printed shortly after it is generated.
Monitoring content changes and updating the pagination is a non-goal,
though we do plan to provide an API so that library users can do this.

## How it works

At a high level, all that vfrag does is break down containers into fragments (fragmentation)
that best fit within a given height (hence the name vfrag = vertical fragmentation).
A _pagination root_ is provided as an element (defaults to `document.documentElement`),
and sections to be paginated are specified by a CSS selector (default `.page, .vfrag-page`).

Each section is assumed to be a separate part of the book (e.g. chapter, appendix, etc.),
with separate heading hierarchy.
Sections are fragmented in parallel, and page numbers are assigned in a continuous sequence at the end.

The page size is specified as an aspect ratio (defaults to `8.5/11`, i.e. US letter) rather than a width and height to be independent from sizing.
Using that and the element’s computed style, a target content height is calculated.
Then, nodes are progressively consumed until the target height is met, and the container is split into fragments.
Nodes that do not fit whole are fragmented (unless they have `page-break-inside: avoid` or `widows` and `orphans` values that add up to more than their height).
In general, CSS `page-break-*`, `break-*`, `widows`, `orphans` CSS properties are respected.

Fragments are created by shallow cloning of the source element, then inserted before it.
Certain element types need fixup or different styling based on the fragment index:
- `ol`: The `start` attribute is used to ensure the numbering remains correct.
- `details`: The `summary` element is also cloned (deeply) to avoid having the browser default of `Details` and styled in a faded way.
- `li`: Any non-first fragment has its `list-style-type` set to `none`.
- `code`: Empty lines are trimmed from the beginning of non-first fragments and the end of non-last fragments.

Certain nodes (by default `figure, .shiftable`) can be _shifted_ earlier or later to reduce empty space,
but they can never be shifted to another section or past another shiftable
(eliminating a common LaTeX pain point where figures can end up in seemingly random places).

## Usage

Assuming your containers to be paginated have a class of `.section`:

```js
import vfrag from "node_modules/vfrag/src/index.js";

vfrag(".section");
```

Or with a named argument, which also allows you to specify options:

```js
vfrag({ sections: ".section", aspectRatio: 210/297 /* A4 */ });
```

Named imports are also available (the default export is the same as `paginateAll()`):

```js
import { paginate, paginateAll } from "node_modules/vfrag/src/index.js";

paginateAll({ sections: ".section", aspectRatio: 210/297 /* A4 */ });
```

To also add a `data-target-page` attribute to all local links (for TOC generation, cross-references etc):

```js
import vfrag, { computeTargets } from "node_modules/vfrag/src/index.js";
paginateAll(/* … */).then(computeTargets);
```

You can optionally specify a `root` element for `computeTargets()`, but it’s not worth it for performance,
as it’s a pretty fast operation (processing ~2K links takes about 16 ms on my 2021 MBP).

## Configuration

You can also optionally specify options as a second argument of any main function (`paginate()`, `paginateAll()`, `consumeUntil()`).
The available options are:

### `paginateAll()` (default export)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sections` | `string` | `".page"` | CSS selector for which container(s) to paginate. |
| `root` | `Element` | `document.documentElement` | The root element to query for fragmentation containers and to apply the `.paginated` class to. |

### `paginate()` and `paginateAll()`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `aspectRatio` | `number` | `8.5/11` | Aspect ratio of the pages. This will be used to determine the target height (width will be unaffected). |
| `startAt` | `number` | `1` | The index of the first page to start at. |
| `renderEvery` | `number` | `20` | If greater than 0, render incremental results every `renderEvery` pages within a section. |
| `askEvery` | `number` | `200` | If greater than 0, will ask the user every `askEvery` pages if they want to continue. |

### `consumeUntil()` and `paginate()` and `paginateAll()`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `shiftables` | `string` | `"figure:not(unshiftable)"` | Children that are _allowed_ to be shifted down, after some of their siblings to the next page to minimize empty space at the bottom of pages. Shiftables do not shift in a way that would move them to another section, or after other shiftables. |
| `debug` | `boolean` | `false` | If true will output elements with `class=placeholder` that can be rendered to show empty space on each page. |
| `verbose` | `boolean` | `false` | If true, will output additional info messages to the console. Note that this may slow things down a fair bit. |

### `consumeUntil()` only

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `startAtIndex` | `number` | `0` | The index of the first child node to start at. |
| `stopAt` | `function` | - | Stop at a node that passes a given test |

## Limitations & Assumptions

- Measures dimensions in original container, so any spacing that is changed via structural tree pseudos will not be accounted for
(e.g. margins that are removed if an element is `:first-child`).
- Since vfrag has no access to the browser's hyphenation algorithm, fragments can only end in whole words.

## Styling hooks

### Attributes

| Name | On | Value | Description |
|------|----|-------|-------------|
| `data-fragment` | * | Number | The index of the fragment, starting from `1`. |
| `data-page` | * | Number | The index of the page, starting from `1`. |

### Classes

| Class | On | Description |
|-------|----|-------------|
| `.pagination-root` | Root | Added to the root element. |
| `.vfrag-page` | Page | Added to each page if the `sections` option is different than `.page, .vfrag-page`. |
| `.whole` | Section | Fragmentation has not yet started.
| `.paginating` | Section | Fragmentation is in progress.
| `.paginated` | Section | Fragmentation is complete.
| `.fragment` | * | Elements that have been fragmented (including pages)
| `.last` | Fragments | Added to the last fragment.
| `.page-number` | Page numbers | Added to page number elements.
| `.running-header` | Page headers | Added to running headers.

### CSS variables

| Name | On | Type | Description |
|------|----|------|-------------|
| `--page-number` | Page | `<integer>` | The page number. |
| `--pages` | Pagination Root | `<integer>` | The total number of pages. |
| `--pages-left` | Pagination Root | `<integer>` | The (approx.) number of pages left to paginate. |
| `--empty-lines` | Non-last Page | `<number>` | The number of empty lines at the bottom of the page. |


## Future plans

- [ ] [Method to join fragments back together](https://github.com/h-tex/vfrag/issues/8)
- [ ] [Method to repaginate specific pages](https://github.com/h-tex/vfrag/issues/9)

