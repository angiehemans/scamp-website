import styles from "./UseCases.module.css";

const personas = [
  {
    label: "Designers",
    title: "Full control over your design.",
    body: "You care about the craft — the exact padding, the right line-height, the typographic detail. Scamp gives you both visual controls and direct CSS access on the same canvas, so you design what actually ships instead of what a tool can mock up.",
    outcomes: [
      "Pixel-level visual controls plus raw CSS editing",
      "Responsive breakpoints and semantic HTML tags",
      "Theme tokens shared across every page",
    ],
  },
  {
    label: "Designers using AI",
    title: "Your AI works on real design files.",
    body: "You want to use Claude Code, Cursor, or other agents in your workflow — but only if they operate on the real thing. Scamp's built-in terminal runs any CLI agent against your actual design files, and the canvas updates the moment the agent saves.",
    outcomes: [
      "Terminal opens in your project folder",
      "AI reads and writes the same files you edit",
      "Canvas hot-reloads on every agent save",
    ],
  },
  {
    label: "Designer-developers & devs",
    title: "Handoff is just a pull request.",
    body: "You cross between design and code, or you're a developer who sketches. Every page in Scamp is a .tsx and .module.css file on disk — commit it, review it, and ship it like any other component. No Dev Mode, no re-implementation.",
    outcomes: [
      "Plain TSX + CSS Modules in your repo",
      "Open a Scamp project in VS Code at any time",
      "No proprietary format, no export step",
    ],
  },
];

export default function UseCases() {
  return (
    <section id="use-cases" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>Who is it for</p>
          <h2 className={styles.headline}>
            Built for designers who want control.
          </h2>
          <p className={styles.body}>
            Scamp is a design tool first — made for designers who want full
            authorship over how their work renders, and want handoff and AI
            workflows to stop being a bottleneck. Designer-developers and
            developers are welcome too.
          </p>
        </div>

        <div className={styles.grid}>
          {personas.map((p) => (
            <article key={p.label} className={styles.card}>
              <p className={styles.persona}>{p.label}</p>
              <h3 className={styles.cardTitle}>{p.title}</h3>
              <p className={styles.cardBody}>{p.body}</p>
              <ul className={styles.outcomes}>
                {p.outcomes.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
