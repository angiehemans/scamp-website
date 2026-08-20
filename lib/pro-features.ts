/**
 * What Scamp Cloud will include.
 *
 * Shared by the public pricing page and the signed-in dashboard so the two can
 * never advertise different things. Edit here, both update.
 *
 * `detail` is optional: some items are self-explanatory and read better as a
 * bare line than as a sentence padded out for symmetry.
 */
export interface ProFeature {
  title: string;
  detail?: string;
}

export const PRO_FEATURES: ProFeature[] = [
  {
    title: "Shareable preview links",
    detail:
      "send a URL and your client sees the live prototype in a browser, no install",
  },
  { title: "Password-protected share links" },
  {
    title: "Comments on prototypes",
    detail:
      "stakeholders click anywhere to leave a note, you see it in the app",
  },
  { title: "Comment threads and resolution" },
  {
    title: "Cloud backup",
    detail: "automatic project backup so a dead laptop doesn't cost you work",
  },
  {
    title: "Version history",
    detail: "roll back to any previous state of a project",
  },
  {
    title: "Cross-machine sync",
    detail: "work on your laptop, continue on your desktop",
  },
];
