// Renders each dither gradient variant in headless Chromium and saves the
// result as a PNG in public/dither/. Safari loads those PNGs instead of
// building the effect at runtime — see the @supports block at the bottom of
// components/DitherGradient/DitherGradient.module.css.
//
// Run with `npm run build:dither`. Re-run whenever you change a variant's
// --glow / --burn / --mask, otherwise Safari keeps showing the old snapshot.
//
// The CSS is read straight out of the component stylesheets rather than
// duplicated here, so the snapshots always match what Chrome actually renders.
// The Safari @supports block is stripped before rendering: it must not be able
// to influence the capture, or the snapshots would be of the fallback.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "public", "dither");

// Grain is high-frequency noise, which is exactly what image compression is
// worst at: as lossless PNGs these come to ~5 MB total. WebP with alpha at this
// quality lands around a tenth of that with no visible difference in a
// background wash. Safari has supported WebP since 14 / iOS 14.
// Set to null to emit lossless PNGs instead.
const WEBP_QUALITY = 0.35;
const EXT = WEBP_QUALITY === null ? "png" : "webp";

// Capture size. The images are stretched to each section with
// `background-size: 100% 100%`, so this is about grain resolution and file
// size, not layout. Bigger = finer grain and heavier files.
const WIDE = { width: 1440, height: 900 };
// Narrow captures trip the max-width: 640px media query, which widens --rx.
const NARROW = { width: 430, height: 900 };

// Variants and whether they need a separate narrow capture. Mirrors the
// media query at the bottom of DitherGradient.module.css.
const VARIANTS = [
  { name: "bottom", narrow: false },
  { name: "topFade", narrow: false },
  { name: "pageTop", narrow: false },
  { name: "topRight", narrow: true },
  { name: "topCenter", narrow: true },
  { name: "bottomLeft", narrow: true },
  { name: "bottomCenter", narrow: true },
  { name: "bottomWhite", narrow: true },
  { name: "center", narrow: true },
  { name: "centerBlue", narrow: true },
  { name: "accentTopCenter", narrow: true },
];

/**
 * Remove the Safari @supports block so the capture is always of the real
 * dodge/burn effect. Brace-matched rather than regexed, since the block
 * contains nested rules.
 */
function stripSafariBlock(css) {
  const marker = "@supports (background: -webkit-named-image(i))";
  let at = css.indexOf(marker);
  while (at !== -1) {
    const open = css.indexOf("{", at);
    if (open === -1) break;
    let depth = 0;
    let i = open;
    for (; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    css = css.slice(0, at) + css.slice(i + 1);
    at = css.indexOf(marker);
  }
  return css;
}

const readCss = (p) => stripSafariBlock(readFileSync(join(ROOT, p), "utf8"));

const ditherCss = readCss("components/DitherGradient/DitherGradient.module.css");
const heroCss = readCss("components/Hero/Hero.module.css");

/** A bare page holding one layer at the exact capture size. */
function page(css, classNames, { width, height }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #stage { position: relative; width: ${width}px; height: ${height}px; }
  ${css}
</style></head>
<body><div id="stage"><div class="${classNames}"></div></div></body></html>`;
}

const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const written = [];

// A scratch page used only to transcode PNG buffers to WebP, so this needs no
// native image dependency.
const encoder = await browser.newPage();
async function toWebp(png) {
  const dataUrl = await encoder.evaluate(
    async ([b64, q]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      return c.toDataURL("image/webp", q);
    },
    [png.toString("base64"), WEBP_QUALITY],
  );
  if (!dataUrl.startsWith("data:image/webp")) {
    throw new Error("WebP encoding unavailable in this Chromium build");
  }
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function shoot(css, classNames, size, name) {
  const ctx = await browser.newContext({
    viewport: size,
    // 1x: these are soft background washes, and 2x roughly quadruples the file
    // size of noise, which does not compress.
    deviceScaleFactor: 1,
  });
  const p = await ctx.newPage();
  await p.setContent(page(css, classNames, size), { waitUntil: "load" });
  // omitBackground keeps the alpha channel so the mask's falloff stays
  // transparent and the image composites over the section background exactly
  // as the live layer does. This relies on #stage having no background of its
  // own: an element screenshot captures whatever is painted beneath it too.
  const png = await p.locator("#stage > div").screenshot({
    omitBackground: true,
  });
  await ctx.close();

  const file = `${name}.${EXT}`;
  const path = join(OUT_DIR, file);
  writeFileSync(path, WEBP_QUALITY === null ? png : await toWebp(png));
  written.push([file, statSync(path).size]);
}

for (const v of VARIANTS) {
  await shoot(ditherCss, `layer ${v.name}`, WIDE, kebab(v.name));
  if (v.narrow) {
    await shoot(
      ditherCss,
      `layer ${v.name}`,
      NARROW,
      `${kebab(v.name)}-narrow`,
    );
  }
}

// The hero has its own copy of the technique, under a different class name.
await shoot(heroCss, "bgGradient", WIDE, "hero");

await browser.close();

const total = written.reduce((n, [, size]) => n + size, 0);
for (const [file, size] of written) {
  console.log(`  ${file.padEnd(30)} ${(size / 1024).toFixed(0)} KB`);
}
console.log(
  `build-dither: wrote ${written.length} PNGs to public/dither/ (${(total / 1024 / 1024).toFixed(2)} MB total)`,
);
