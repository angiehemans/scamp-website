# Scamp Marketing Website — PRD & Copywriting

---

## Overview

A single-page marketing website for Scamp built with Next.js. Dark theme only. The goal is to communicate what Scamp is, why it's different, and get developers to download it or star it on GitHub. Design direction is taken from vercel.com/products/previews — large typographic hero, feature sections with short punchy headers, clean minimal UI, generous whitespace, subtle interactive elements.

---

## Stack

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | Next.js (App Router)                               |
| Styling    | CSS Modules + CSS custom properties for theming    |
| Theme      | Dark only — no light mode toggle                   |
| Fonts      | Geist Sans + Geist Mono (from `geist` npm package) |
| Deployment | Vercel                                             |

---

## Color Tokens

All colors defined as CSS custom properties on `:root` in `app/globals.css`. Never hardcode hex values in component styles — always reference a token.

```css
:root {
  /* Backgrounds */
  --color-bg-base: #0a0a0a;
  --color-bg-surface: #111111;
  --color-bg-elevated: #1a1a1a;
  --color-bg-overlay: #222222;

  /* Borders */
  --color-border-subtle: #1f1f1f;
  --color-border-default: #2e2e2e;
  --color-border-strong: #3d3d3d;

  /* Text */
  --color-text-primary: #ededed;
  --color-text-secondary: #888888;
  --color-text-tertiary: #555555;
  --color-text-inverse: #0a0a0a;

  /* Brand */
  --color-brand: #ffffff;
  --color-brand-subtle: rgba(255, 255, 255, 0.06);
  --color-brand-hover: rgba(255, 255, 255, 0.9);

  /* Accent */
  --color-accent: #5c6ac4;
  --color-accent-hover: #6d7de0;
  --color-accent-subtle: rgba(92, 106, 196, 0.12);

  /* Feedback */
  --color-success: #2ea043;
  --color-warning: #d29922;
  --color-error: #f85149;

  /* Syntax (for code blocks) */
  --color-syntax-bg: #141414;
  --color-syntax-comment: #555555;
  --color-syntax-string: #a8d8a8;
  --color-syntax-keyword: #7eb8da;
  --color-syntax-property: #e8c88a;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;
  --space-10: 128px;

  /* Typography scale */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 2rem;
  --text-4xl: 2.75rem;
  --text-5xl: 3.75rem;
  --text-6xl: 5rem;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

---

## Page Structure

```
<Nav />
<Hero />
<LogoBar />         ← "open source and free, forever"
<FeatureOne />      ← Design → Code
<FeatureTwo />      ← Bidirectional sync
<FeatureThree />    ← Built-in terminal + agent
<FeatureFour />     ← Your files, your folder
<Download />        ← CTA with platform links
<Footer />
```

---

## Components & Copywriting

---

### `<Nav />`

Sticky top nav. Minimal — logo left, two links right. No hamburger menu on mobile, links collapse gracefully.

```
[Scamp]                          [GitHub ↗]  [Download]
```

- Logo: wordmark "Scamp" in Geist Sans, semibold, `--color-text-primary`
- GitHub link: opens `https://github.com/[org]/scamp` in a new tab, small external arrow icon
- Download button: pill shaped, white background, dark text, scrolls to `#download` section on click

---

### `<Hero />`

Full-viewport height. Centered text. Subtle animated gradient or noise texture on the background — keep it restrained, not distracting. Large typographic treatment, same rhythm as Vercel's hero.

**Eyebrow label (small caps, `--color-text-tertiary`):**

```
Open source · Free · Local-first
```

**Headline (largest text on the page, `--color-text-primary`):**

```
Sketch layouts.
Ship real code.
```

**Subheading (`--color-text-secondary`, max-width ~560px, centered):**

```
Scamp is a local design tool for developers. Draw rectangles, set flex layouts, and style elements — your design saves as real TSX and CSS Modules files you actually own.
```

**CTA buttons (two, side by side):**

```
[Download for Mac]    [View on GitHub ↗]
```

- Primary: white pill button, `--color-text-inverse`, links to `#download`
- Secondary: ghost button with `--color-border-default` border, links to GitHub

**Below CTAs — platform pills (small, subtle):**

```
Also available for  [Windows]  [Linux]
```

**Hero visual:**
A static or lightly animated screenshot of the Scamp app UI — canvas with a few nested rectangles selected, the CSS editor panel open showing raw CSS. Dark app chrome on dark page background, subtle glow/shadow to lift it. Keep it real — show actual Scamp output, not a stylised mockup.

---

### `<LogoBar />`

A thin full-width section between Hero and features. No logos (it's open source, no customers to show). Instead, a single centered line.

**Text (`--color-text-tertiary`, small, monospace):**

```
Free and open source — MIT licensed. Your files stay on your machine.
```

Thin top and bottom borders using `--color-border-subtle`.

---

### `<FeatureOne />` — Design → Code

Left: text block. Right: animated code snippet showing TSX + CSS output updating as a rectangle is drawn.

**Section label (eyebrow):**

```
Real output
```

**Headline:**

```
Your design is the code.
```

**Body:**

```
Every rectangle you draw becomes a real div. Every style you set becomes a real CSS class. Scamp doesn't export or compile — it just writes files. Open your project in any editor and the code is already there, exactly as you'd write it yourself.
```

**Code block visual (right side) — two tabs: TSX and CSS:**

TSX tab:

```tsx
export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="a1b2" className={styles.rect_a1b2}>
        <div data-scamp-id="c3d4" className={styles.rect_c3d4} />
      </div>
    </div>
  );
}
```

CSS tab:

```css
.rect_a1b2 {
  display: flex;
  flex-direction: row;
  gap: 16px;
  padding: 24px;
  width: 400px;
  height: 300px;
  background: #f0f0f0;
  border-radius: 8px;
}

.rect_c3d4 {
  width: 100px;
  height: 100px;
  background: #3b82f6;
}
```

---

### `<FeatureTwo />` — Bidirectional Sync

Right: text block. Left: visual showing a file being edited externally (in a terminal or editor) and the canvas updating.

**Section label (eyebrow):**

```
Bidirectional sync
```

**Headline:**

```
Edit code, see it live.
Edit visually, see the code.
```

**Body:**

```
Scamp watches your project files. Edit the CSS in your editor, run a coding agent, or change a value directly in the terminal — Scamp picks up the change and updates the canvas instantly. No import step, no sync button. The files are always the source of truth.
```

**Visual:**
Split view — left side shows a terminal with a diff of a CSS file being edited, right side shows the Scamp canvas with a rectangle visually updating its background color. An animated connecting line or pulse effect between the two to communicate the live sync.

---

### `<FeatureThree />` — Terminal + Agent

Full-width feature. Darker background (`--color-bg-surface`) to break the rhythm. Terminal screenshot front and center.

**Section label (eyebrow):**

```
Built-in terminal
```

**Headline:**

```
Run your agent.
Right here.
```

**Body:**

```
Scamp has a built-in terminal that opens in your project folder. Run Claude Code, Aider, or any coding agent you already use. The agent reads your project's instructions file, edits your layout files, and Scamp reloads the canvas automatically. No copy-pasting. No context switching.
```

**Sub-points (three small callouts below body, in a row):**

```
Opens in your project folder
──────────────────────────
No setup. The terminal starts
in the right place every time.
```

```
Reads agent.md automatically
──────────────────────────
Your project conventions are
always in the agent's context.
```

```
Canvas reloads on every save
──────────────────────────
Agent edits show up on the
canvas without touching it.
```

**Visual:**
Screenshot of the Scamp terminal panel open at the bottom with a coding agent running, canvas visible above it showing a component being modified in real time.

---

### `<FeatureFour />` — Your Files, Your Folder

**Section label (eyebrow):**

```
Local-first
```

**Headline:**

```
No cloud. No account.
Just a folder.
```

**Body:**

```
Scamp saves to wherever you tell it. Put your project inside an existing git repo, a client folder, or anywhere on your machine. Every page is just a TSX file and a CSS Modules file. You can open them in VS Code, commit them to GitHub, hand them to a teammate, or ship them directly — no export, no lock-in.
```

**Three-column detail grid below body:**

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  Works with git     │  │  No account needed  │  │  Standard file      │
│                     │  │                     │  │  format             │
│  Your project is    │  │  Download and open  │  │  TSX and CSS        │
│  a real folder.     │  │  a project. That's  │  │  Modules. Nothing   │
│  Commit, branch,    │  │  it. No login, no   │  │  proprietary,       │
│  and PR like normal.│  │  subscription.      │  │  nothing custom.    │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

---

### `<Download />` — id="download"

Full-width section. Centered. This is the main conversion point.

**Headline:**

```
Download Scamp.
```

**Subheading (`--color-text-secondary`):**

```
Free and open source. No account required.
```

**Download buttons — three platform cards, side by side:**

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│                      │  │                      │  │                      │
│  macOS               │  │  Windows             │  │  Linux               │
│                      │  │                      │  │                      │
│  Apple Silicon       │  │  Windows 10+         │  │  .deb / .AppImage    │
│  macOS 12+           │  │  x64                 │  │  x64                 │
│                      │  │                      │  │                      │
│  [Download .dmg]     │  │  [Download .exe]     │  │  [Download .deb]     │
│                      │  │                      │  │  [Download .AppImage]│
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

- Cards: `--color-bg-surface` background, `--color-border-default` border, `--radius-lg`
- Download buttons: ghost style with border, icon for each platform (Apple, Windows, Linux penguin)
- On hover: card lifts slightly (`box-shadow`), button border brightens

**Below the cards — version and source links:**

```
v1.0.0  ·  Release notes  ·  View source on GitHub ↗
```

(`--color-text-tertiary`, small, monospace)

**Below that — build from source (for Linux/power users):**

```
Or build from source:
```

```bash
git clone https://github.com/[org]/scamp
cd scamp && npm install && npm run build
```

Code block styled with `--color-syntax-bg` background.

---

### `<Footer />`

Minimal. Two rows.

**Row 1 — three columns:**

```
Scamp                    Resources                 Community
─────                    ─────────                 ─────────
A local design tool      Documentation             GitHub ↗
for developers.          Changelog                 Star on GitHub ↗
                         Release notes             Open an issue ↗
MIT License.
```

**Row 2 — copyright line:**

```
© 2026 Scamp. Open source under the MIT License.
```

`--color-text-tertiary`, `--color-border-subtle` top border.

---

## Technical Notes for Claude Code

### File structure

```
scamp-site/
├── app/
│   ├── layout.tsx          # root layout, font setup, metadata
│   ├── page.tsx            # assembles all sections
│   └── globals.css         # all CSS tokens defined here
├── components/
│   ├── Nav/
│   │   ├── Nav.tsx
│   │   └── Nav.module.css
│   ├── Hero/
│   │   ├── Hero.tsx
│   │   └── Hero.module.css
│   ├── LogoBar/
│   ├── FeatureOne/
│   ├── FeatureTwo/
│   ├── FeatureThree/
│   ├── FeatureFour/
│   ├── Download/
│   └── Footer/
└── public/
    └── screenshots/        # app screenshots for feature visuals
```

### Rules

- All colors via CSS custom properties — no hardcoded hex values in component styles
- All spacing via CSS custom properties — no hardcoded px values
- Dark theme only — no `prefers-color-scheme` media queries needed
- No third-party UI libraries — CSS Modules only
- No JavaScript animations — CSS transitions and `@keyframes` only
- Images use Next.js `<Image />` component with explicit width/height
- All download links are `<a href>` tags pointing to GitHub releases — format: `https://github.com/[org]/scamp/releases/latest/download/Scamp-[version]-[platform].[ext]`
- Nav download button scrolls to `#download` on the same page — no separate download page needed
- Meta title: `Scamp — Sketch layouts. Ship real code.`
- Meta description: `A local-first design tool for developers. Draw layouts visually, get real TSX and CSS Modules files. Free and open source.`

### Responsive breakpoints

- Mobile: < 768px — stack all feature sections vertically, single-column download cards
- Tablet: 768px–1024px — two-column download cards
- Desktop: > 1024px — full layout as described above

### Performance

- No external fonts — use the `geist` npm package which bundles fonts locally
- Screenshots should be WebP format, appropriately sized
- No analytics scripts in the initial build — add later if needed
