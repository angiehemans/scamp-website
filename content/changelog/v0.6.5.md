---
version: "Unreleased"
description: "Sign-in arrives, the start screen gets a visual refresh, and the canvas starts rendering your page's real stylesheet instead of an approximation of it."
order: 24
---

### Sign in to a Scamp account `upcoming`

- An account panel at the foot of the start-screen sidebar. Signing in opens your browser, you approve there, and the app picks the result up on its own
- Signed in, the panel shows your name, email, and a sign-out link
- Everything is optional — Scamp works exactly the same signed out, never prompts you on launch, and there's nothing to dismiss
- Your session lasts 30 days and renews whenever you use it, so it expires from disuse rather than on a clock
- If your OS can't store the sign-in securely, the panel tells you so plainly rather than quietly forgetting you. [Accounts](/docs/accounts)

### A refreshed start screen `upcoming`

- **Project thumbnails.** Each card shows a picture of the project's home page, recaptured whenever you save. Projects without one show their artboard color in the same space, so the grid stays even. Thumbnails live in `<project>/.scamp/preview.png`
- The default projects folder moved from a block of sidebar chrome to a folder icon beside the **Projects** heading — hover for the path, click to change it
- Project names are shown the way you read them: `my-portfolio` displays as "My Portfolio", with the folder name still on hover and used unchanged on disk
- **"Last opened" now stays readable past a day.** It steps through minutes, hours, days, weeks, months and years, where a project opened last week previously showed a bare "14:32" with no date. [Getting Started](/docs/getting-started)

### The canvas renders your page's real stylesheet `upcoming`

- `::before` and `::after`, `:nth-child`, and any hand-written selector now show up on the canvas
- Previously they were parsed, preserved and written back to your files, yet stayed invisible while you designed — which mattered most for agent-written CSS, since `agent.md` recommends `::before` for decorative touches
- Component instances get their own scoped copy, so one instance's styles can't leak into another or into the page around them. [Components](/docs/components)

### Breakpoints resolve against the artboard `upcoming`

- Breakpoints now resolve against the artboard, not the app window. A 390px frame fires your mobile breakpoint no matter how wide the Scamp window is, so what you see at each size is what a browser at that size will do. [Breakpoints](/docs/breakpoints)

### Export a project as HTML `upcoming`

- A new **Export HTML** button in the project header writes every page as plain `.html` + `.css` into a folder you choose — no build step and no dependencies
- Pages keep their routes (`about/index.html`), links between them are rewritten to work both on a static host and straight off disk, and images are copied into `assets/`
- `theme.css` comes along so every token still resolves
- Component instances are flattened into ordinary markup, each with its own copy of the component's styles, so per-instance sizing and text survive
- You pick a location and Scamp creates a folder there named after the project — re-exporting reuses it, and a name held by anything Scamp didn't write is stepped over rather than overwritten
- The button reports progress and the result — a spinner while writing, a green count when it lands, and a red **Export failed** with the reason on hover — so an export that declines to run can't be mistaken for one that did nothing. [Export](/docs/export)

### Semantic color tokens accept a literal value `upcoming`

- A semantic row could only be pointed at a primitive; a hand-written value showed as "— custom —" and couldn't be edited
- Rows now use the same color control as the properties panel, so you can map to a primitive, type a value, or use the picker and eyedropper
- The picker offers primitives only — pointing one semantic token at another would put a reference cycle two clicks away. [Colors](/docs/colors)

### An image's Source is editable `upcoming`

- It was a read-only filename, and the only way to change it was **Replace**, which imports from your assets — so there was no route to an image you hadn't imported, including one at an absolute URL
- It's now a text field that commits on Enter or blur. [Elements](/docs/elements)

### Changes `upcoming`

- **Scamp runs as a single instance.** Opening it again focuses the window you already have rather than starting a second copy. Required by sign-in, which needs one known place for the browser to hand its result back to
- **The Image section moved** to directly after Element in the properties panel, matching what Typography already does for text — the thing you opened the panel for now leads the style sections. It used to sit twelfth, below Background, Border, Shadows and Filters
- **Background no longer offers "Set background image" on an `<img>`**, where it read as a second source competing with the element's own. It still appears if a background image is already set, so one added elsewhere stays removable, and it's untouched for every other element. [Properties Panel](/docs/properties-panel)

### Fixes `upcoming`

- **Boxes drawn inside a flex or grid container keep the size you drew.** They were being clamped against the parent, so a box drawn to fill a container came out smaller than the drag that made it
- **Fill height works in a flex row.** It emitted `height: 100%`, which resolves against an `auto`-height container and computed to zero — the element simply vanished. It now emits `align-self: stretch`, and the Size panel still reads **Fill**
- **Links and buttons keep your page's styles.** The canvas reset for semantic tags was overriding styling you'd set on `<a>` and `<button>`
- **Duplicate CSS declarations are still flagged when they change nothing.** A property repeated with the same winning value produced identical code, so the warning was dropped — which is exactly the case where the duplicate has no other symptom to notice it by
- **Animated elements no longer stretch the artboard.** Mid-animation positions were being counted as canvas extent, so the scrollable area grew and shrank while an animation played
- **`position: absolute` survives on a flex or grid child.** It was being discarded on parse and then deleted from your file on the next save
- **`position: sticky` renders at rest on the canvas.** A real sticky element stuck to the canvas viewport, so it drifted away from where it sits in the page as you panned, and its coordinates were read as scroll offsets. Your generated CSS is unchanged — this only affects the canvas
- **Grid gaps round-trip** through the shorthand without drifting
- **Gradient backgrounds render on the canvas**, not just in preview
- **Tooltips raised by a click no longer stick open**
- Sign-in's **loopback listener no longer hangs** when closing
