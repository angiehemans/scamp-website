import type { Metadata } from "next";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import styles from "./changelog.module.css";

export const metadata: Metadata = {
  title: "Changelog — Scamp",
  description:
    "What's new in Scamp. Release history and upcoming features for the local-first design tool for developers.",
};

function Badge({ type }: { type: "shipped" | "to-do" }) {
  return (
    <span
      className={`${styles.badge} ${type === "shipped" ? styles.badgeShipped : styles.badgeTodo}`}
    >
      {type === "shipped" ? "shipped" : "to-do"}
    </span>
  );
}

export default function ChangelogPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <h1 className={styles.title}>Changelog</h1>
            <p className={styles.subtitle}>
              What&apos;s new and what&apos;s next for Scamp.
            </p>
          </header>

          {/* v0.2.0 */}
          <section className={styles.release}>
            <h2 className={styles.version}>v0.2.0</h2>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>
                WYSIWYG properties panel <Badge type="shipped" />
              </h3>
              <ul className={styles.list}>
                <li>
                  Full visual properties panel alongside the raw CSS editor —
                  users can switch between the two at any time using the CSS /
                  Visual toggle at the top of the panel
                </li>
                <li>
                  Changes in either panel stay in sync — edits in the visual
                  panel update the CSS editor and vice versa
                </li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>
                Remove layout section from text elements <Badge type="shipped" />
              </h3>
              <ul className={styles.list}>
                <li>
                  The flex/layout section is hidden in the properties panel when
                  a text element is selected
                </li>
                <li>Padding controls remain visible for text elements</li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>
                Shorthand box property inputs <Badge type="shipped" />
              </h3>
              <ul className={styles.list}>
                <li>
                  Padding, margin, border, and border-radius inputs accept CSS
                  shorthand format
                </li>
                <li>
                  Accepted formats: <code>x</code>, <code>x x</code>,{" "}
                  <code>x x x x</code> — spaces or commas both work
                </li>
                <li>Parsed values shown as a resolved preview on blur</li>
                <li>
                  Invalid input reverts to the previous value without crashing
                </li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>
                Undo / redo <Badge type="shipped" />
              </h3>
              <ul className={styles.list}>
                <li>
                  <code>Cmd+Z</code> / <code>Ctrl+Z</code> to undo
                </li>
                <li>
                  <code>Cmd+Shift+Z</code> / <code>Ctrl+Shift+Z</code> to redo
                </li>
                <li>
                  History covers canvas changes and properties panel edits
                </li>
                <li>50 step limit</li>
                <li>
                  External file edits clear the undo history for that page
                </li>
                <li>
                  Implemented via <code>zundo</code> Zustand middleware
                </li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>
                Project color swatches <Badge type="shipped" />
              </h3>
              <ul className={styles.list}>
                <li>
                  Color picker swatches default to a built-in neutral palette
                </li>
                <li>
                  Once the project has any colors in its CSS files, swatches
                  switch to colors used in the project
                </li>
                <li>
                  Colors extracted from CSS modules at load time and on every
                  file change
                </li>
                <li>
                  Swatches ordered by frequency of use, duplicates removed
                </li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>
                Project themes and CSS variable tokens <Badge type="shipped" />
              </h3>
              <ul className={styles.list}>
                <li>
                  Each project gets a <code>theme.css</code> file with CSS
                  custom properties
                </li>
                <li>
                  Token picker in the WYSIWYG panel lets users insert{" "}
                  <code>{"var(--token-name)"}</code> as a value
                </li>
                <li>
                  Token swatches show the resolved color, not just the variable
                  name
                </li>
                <li>
                  CodeMirror CSS editor shows token autocomplete suggestions
                </li>
                <li>
                  Theme panel for adding, renaming, and deleting tokens
                </li>
                <li>
                  <code>theme.css</code> watched by chokidar — changes
                  hot-reload into the token picker
                </li>
                <li>Deleting a token that is in use shows a warning</li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>
                Element naming and layers panel <Badge type="shipped" />
              </h3>
              <ul className={styles.list}>
                <li>
                  Elements can be renamed — name becomes the CSS class prefix
                  (e.g. &quot;Hero Card&quot; →{" "}
                  <code>hero-card_a1b2</code>)
                </li>
                <li>
                  Unnamed elements default to <code>rect_</code> or{" "}
                  <code>text_</code>
                </li>
                <li>
                  Layers panel in the left sidebar shows the full element tree
                  for the active page, indented to reflect nesting
                </li>
                <li>Click a layer to select the element on the canvas</li>
                <li>Selected element highlighted in the layers list</li>
                <li>
                  Renaming writes both the <code>.tsx</code> and{" "}
                  <code>.module.css</code> atomically via a dedicated{" "}
                  <code>element:rename</code> IPC channel — never one without
                  the other
                </li>
              </ul>
            </div>
          </section>

          {/* v0.1.0 */}
          <section className={styles.release}>
            <h2 className={styles.version}>v0.1.0</h2>
            <p className={styles.versionSub}>
              Initial Release (POC) — The first working version of Scamp. A
              proof of concept covering the full end-to-end loop: draw visually,
              get real code, edit with an agent, canvas reloads automatically.
            </p>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>Project management</h3>
              <ul className={styles.list}>
                <li>
                  Create a new project by choosing any folder on your machine
                </li>
                <li>Open an existing project folder</li>
                <li>
                  Recent projects list on the start screen (last 5 projects)
                </li>
                <li>
                  Missing project folders shown as greyed out with a
                  &quot;Folder not found&quot; label
                </li>
                <li>
                  Auto-generated <code>agent.md</code> on project creation with
                  code conventions for coding agents
                </li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>Pages</h3>
              <ul className={styles.list}>
                <li>
                  Default <code>home</code> page created with every new project
                </li>
                <li>Pages listed in the left sidebar</li>
                <li>Switch between pages by clicking in the sidebar</li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>Canvas</h3>
              <ul className={styles.list}>
                <li>
                  DOM-based canvas viewport (1440×900, scales to fit the window)
                </li>
                <li>
                  Rectangle tool — click and drag to draw a rectangle (
                  <code>R</code>)
                </li>
                <li>
                  Select tool — click to select, drag to move, handles to resize
                  (<code>S</code>)
                </li>
                <li>
                  Text tool — click to place a text element, double-click to
                  edit (<code>T</code>)
                </li>
                <li>Nested rectangles — draw inside any selected rectangle</li>
                <li>
                  Selected element shown with a blue outline and 8 resize
                  handles
                </li>
                <li>Checkerboard background outside the viewport frame</li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>
                Properties panel — raw CSS editor
              </h3>
              <ul className={styles.list}>
                <li>
                  CodeMirror editor loads the selected element&apos;s CSS class
                  body on selection
                </li>
                <li>
                  Edit any CSS property in any format — shorthand, longhand,
                  anything valid
                </li>
                <li>
                  Commit on blur or <code>Cmd+S</code> — triggers a targeted
                  class patch and file write
                </li>
                <li>
                  Unknown properties preserved in output and shown with a ⚠
                  warning label
                </li>
                <li>Placeholder shown when no element is selected</li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>Code output</h3>
              <ul className={styles.list}>
                <li>
                  Every canvas change auto-saves to a <code>.tsx</code> and{" "}
                  <code>.module.css</code> file
                </li>
                <li>
                  Atomic file writes (write to <code>.tmp</code>, then rename)
                  to prevent partial reads
                </li>
                <li>
                  <code>data-scamp-id</code> attribute on every element as a
                  stable identity anchor
                </li>
                <li>
                  Class names follow the <code>[type]_[4-char-id]</code> pattern
                  (e.g. <code>rect_a1b2</code>, <code>text_c3d4</code>)
                </li>
                <li>
                  Only non-default properties emitted — output stays clean and
                  readable
                </li>
                <li>
                  Read-only code panel at the bottom shows live TSX and CSS with
                  syntax highlighting
                </li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>Bidirectional sync</h3>
              <ul className={styles.list}>
                <li>
                  chokidar watches project files for external changes
                </li>
                <li>
                  External edits (agent, editor, terminal) parsed and reflected
                  on the canvas automatically
                </li>
                <li>
                  <code>parseCode()</code> diffs against current state before
                  updating — no unnecessary re-renders
                </li>
                <li>
                  Unknown CSS properties round-trip through the file untouched
                </li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>Built-in terminal</h3>
              <ul className={styles.list}>
                <li>
                  Full terminal panel (<code>Ctrl+`</code>) powered by node-pty
                  and xterm.js
                </li>
                <li>Opens in the project folder automatically</li>
                <li>Up to 3 terminal tabs per session</li>
              </ul>
            </div>
          </section>

          {/* Upcoming */}
          <section className={styles.release}>
            <h2 className={styles.version}>Upcoming</h2>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>
                Copy and paste elements <Badge type="to-do" />
              </h3>
              <ul className={styles.list}>
                <li>
                  <code>Cmd+C</code> to copy a selected element and all its
                  children
                </li>
                <li>
                  <code>Cmd+V</code> to paste as a sibling of the current
                  selection, or onto the page root
                </li>
                <li>
                  Pasted elements get new IDs — deep copy, not a reference
                </li>
                <li>
                  <code>Cmd+D</code> to duplicate in place
                </li>
                <li>
                  CSS for new classes written to the module file on paste
                </li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>
                Images <Badge type="to-do" />
              </h3>
              <ul className={styles.list}>
                <li>
                  <strong>As an img element:</strong> click the image button in
                  the toolbar (<code>I</code>) or drag an image file onto the
                  canvas to place an <code>{"<img>"}</code> element
                </li>
                <li>
                  <strong>As a background:</strong> select a rectangle and click
                  &quot;Set background image&quot; in the background section of
                  the properties panel to set <code>background-image</code>
                </li>
                <li>
                  Background controls expand on image set: background-size,
                  background-position (9-point grid), background-repeat
                </li>
                <li>
                  All image files copied into an <code>assets/</code> folder in
                  the project directory
                </li>
                <li>
                  <code>assets/</code> documented in <code>agent.md</code>
                </li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>
                Add new page and duplicate page <Badge type="to-do" />
              </h3>
              <ul className={styles.list}>
                <li>
                  <strong>Add page:</strong> click &quot;+ Add Page&quot; in the
                  sidebar, name it inline, get a blank <code>.tsx</code> and{" "}
                  <code>.module.css</code> created immediately
                </li>
                <li>
                  <strong>Duplicate page:</strong> right-click a page →
                  Duplicate, new name defaults to <code>[name]-copy</code>,
                  editable inline
                </li>
                <li>Both flows use the same inline naming input component</li>
                <li>
                  Name validation: lowercase, alphanumeric and hyphens only,
                  unique within the project
                </li>
              </ul>
            </div>

            <div className={styles.feature}>
              <h3 className={styles.featureTitle}>
                Nudge with arrow keys <Badge type="to-do" />
              </h3>
              <ul className={styles.list}>
                <li>
                  <strong>Canvas:</strong> arrow keys move a selected element
                  1px; Shift + arrow moves 10px
                </li>
                <li>
                  <strong>Properties panel:</strong> up/down arrow in any number
                  field increments/decrements by 1; Shift + up/down by 10
                </li>
                <li>
                  Canvas nudge triggers the normal debounced file write
                </li>
                <li>
                  Panel nudge commits on blur or Enter — not on every keydown
                </li>
                <li>
                  Values clamp at 0 for properties where negative is not
                  meaningful
                </li>
              </ul>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
