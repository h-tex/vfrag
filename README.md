# <img src="logo.svg" style="width: 1em"> vfrag

Paginate a document by breaking one or more containers vertically into multiple fragments.
This is a bare-bones DIY alternative to [Paged.js](https://pagedjs.org/).

[Paged.js](https://pagedjs.org/) is an impressive piece of work, but it did not work for our use cases:
- It does some light parsing on the CSS file, which means it can be thrown by more modern CSS that it doesn't understand (e.g. [range media queries](https://gitlab.coko.foundation/pagedjs/pagedjs/-/issues/460)).
It also makes it more heavyweight, as it has to refetch all CSS files.
- It recreates every DOM node, which means it can be slow and have side effects (e.g. [dropping declarative shadow roots](https://gitlab.coko.foundation/pagedjs/pagedjs/-/issues/463).
- Because it has to handle the general case, it is also a very complicated piece of work,
and in the end I realized we had spent more time adding workarounds to our codebase to handle its quirks than I spent writing this.

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
3. **No CSS parsin.**
This means it does not attempt to polyfill any Paged Media spec.
Instead of unsupported CSS syntax that needs to be parsed,
it uses class names, CSS variables, standard (supported) CSS properties and rules, and the CSS OM.
4. **Screen media remains screen media.**
Rendering print styles on screen is a non-goal.
Any differences that affect pagination should be handled via CSS selectors (`.paginated *`).
and `page-break-*` or `break-*` CSS properties should be specified on screen media as well
(they have no effect so there is no reason to scope them to `print`).
5. **Static**
This is a static view, intended to create a paged view that can be printed shortly after it is generated.
Updating the pagination if the content changes is a non-goal.

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
| `sections` | `string` or `Array<Element>` | `".page"` | The container(s) to paginate. |
| `root` | `Element` | `document.documentElement` | The root element to query for fragmentation containers and to apply the `.paginated` class to. |
| `sync` | `boolean` | `false` | If true, everything will be done synchronously (which also means no view transition) |

### `paginate()` and `paginateAll()`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `aspectRatio` | `number` | `8.5/11` | Aspect ratio of the pages. This will be used to determine the target height (width will be unaffected). |
| `startAt` | `number` | `1` | The index of the first page to start at. |

### `consumeUntil()` and `paginate()` and `paginateAll()`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fragmentainables` | `string` | `"ol, ul, dl, div, p, details, section"` | Children that are _allowed_ to be fragmented further. CSS properties like `break-inside: avoid` will still be respected, it’s just that children *not* matching this selector will not even be considered for fragmentation regardless of their break properties. |
| `debug` | `boolean` | `false` | If true will output elements with `class=placeholder` that can be rendered to show empty space on each page. |
| `verbose` | `boolean` | `false` | If true, will output additional info messages to the console. Note that this may slow things down a fair bit. |

## Limitations & Assumptions

- Only simple values for `page-break-*` and `break-*` are supported (`auto`, `avoid` and `always`).
- Measures dimensions in original container, so any spacing that is changed via structural tree pseudos will not be accounted for
(e.g. margins that are removed if an element is `:first-child`).

## Styling hooks

- `.paginated` class is added to the root element.
- Every fragment created (i.e. not the source element) has a `.fragment` class
- Every fragment (including the source element) has a `data-fragment` attribute with the fragment index.
- Page numbers are added via `<a href="#page-N" class="page-number">N</a>` elements.
- `--page-count` (`<number>`) and `--pages` (`<string>`) CSS variables are set on the root element.

## Future plans

- [ ] Shift certain nodes (e.g. `<figure>`) later to minimize empty space at the bottom of pages.
- [ ] Method to join fragments back together.
- [ ] Method to repaginate specific pages

## Fragmentation Algorithm

- Children of the root container are moved to pages by splitting the container into fragments up to a given aspect ratio (`8.5/11`, i.e. US letter by default, customize via the `aspectRatio` option).
- Fragments are created by shallow cloning. Certain element types have certain rules about how they are fragmented:
  - `ol`: The `start` attribute is used to ensure the numbering remains correct.
  - `details`: The `summary` element is also cloned (deeply) to avoid having the browser default of `Notes`.
- The container to be fragmented is split by moving children to a previous fragment until the aspect ratio is met.
While this is counter to the mental model of fragmentation which is that a container is progressively split into subsequent fragments,
it minimizes DOM I/O since nodes only have to be moved once.
- Most children are just moved to the right fragment and left alone (essentially assumed to have `break-inside: avoid`).
Certain children are recursively fragmented (by default `ol, ul, dl, div, p, details, section`).
To prevent widows and orphans, children are only fragmented if the number of empty lines is >= 2 and their length is >= 4 lines.
- The `page-break-*` and `break-*` CSS properties are respected.
- Text nodes are fragmented using binary search, only when on the boundary