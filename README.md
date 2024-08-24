# Paginate

Paginate a document by breaking one or more containers vertically into multiple fragments.
This is a bare-bones DIY alternative to [Paged.js](https://pagedjs.org/).

[Paged.js](https://pagedjs.org/) is an impressive piece of work, but it did not work for our use cases:
- It does some light parsing on the CSS file, which means it can be thrown by more modern CSS that it doesn't understand (e.g. [range media queries](https://gitlab.coko.foundation/pagedjs/pagedjs/-/issues/460)).
It also makes it more heavyweight, as it has to refetch all CSS files.
- It recreates every DOM node, which means it can be slow and have side effects (e.g. [dropping declarative shadow roots](https://gitlab.coko.foundation/pagedjs/pagedjs/-/issues/463).
- Because it has to handle the general case, it is also a very complicated piece of work,
and in the end I realized we had spent more time adding workarounds to our codebase to handle its quirks than I spent writing this.

## Requirements

This is written with different requirements
which likely make it unsuitable for many use cases
and mean you will likely need to do more work to get it to work for your use case.

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
This only handles one thing: breaking a container into enough vertical fragments with a given aspect ratio.
That’s it.
Rendering print styles on screen is a non-goal.
Any differences that affect pagination should be handled via CSS selectors (`.paginated *`).
and `page-break-*` or `break-*` CSS properties should be specified on screen media as well (there is no reason to limit them to `print`).
5. **Static**
This is a static view, intended to create a paged view that can be printed shortly after it is generated.
Updating the pagination if the content changes is a non-goal.

## Fragmentation algorithm

- Children of the root container are moved to pages by splitting the container into fragments up to a given aspect ratio (`8.5/11`, i.e. US letter by default, customize via the `aspectRatio` option).
- Certain children are recursively fragmented (by default `ol, ul, dl, div, p, details, section`).
Any others are left whole (essentially assumed to have `break-inside: avoid`).

## Limitations & Assumptions

- The container to be paginated expects flexbox layout with `flex-flow: column;`.
It may work for other layouts but it has not been tested.
- Measures dimensions in original container, so any spacing that is changed via structural tree pseudos will not be accounted for
