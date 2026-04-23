import type { FaqItem } from "./schema";

export const HOMEPAGE_FAQ: FaqItem[] = [
  {
    question: "What is Scamp?",
    answer:
      "Scamp is a free, open-source design tool built for designers. Draw layouts visually and style them with both visual controls and raw CSS on a local canvas. Scamp saves each page as production-ready TSX and CSS Module files on your computer — so the thing you design is the thing that ships.",
  },
  {
    question: "Who is Scamp for?",
    answer:
      "Designers first. Scamp is for designers who want full control over how their work renders — real typography, theme tokens, responsive breakpoints, and direct CSS access — and who want AI and developer handoff to actually work. Designer-developers and developers who sketch are a secondary audience and welcome.",
  },
  {
    question: "How is Scamp different from Figma?",
    answer:
      "Figma gives you a visual mockup stored in the cloud. Scamp gives you full visual and CSS control on a local canvas, and saves every page as real TSX and CSS Module files on your disk. You design what actually ships — no Dev Mode, no re-implementation, no account required.",
  },
  {
    question: "How does Scamp help with AI workflows?",
    answer:
      "Scamp has a built-in terminal that opens in your project folder, so any CLI coding agent (Claude Code, Codex, Cursor CLI, Gemini CLI) can read and write the same files the canvas renders. You can prompt the agent to add a section, tweak styles, or refactor — and the canvas updates the moment the agent saves.",
  },
  {
    question: "How does handoff to developers work?",
    answer:
      "Your designs are already code. Hand the developer a pull request instead of a Figma link: real .tsx and .module.css files they can read, review, and ship. There is no export step, no spec doc, and no 'translate this mockup to React' task on their backlog.",
  },
  {
    question: "Is Scamp free?",
    answer:
      "Yes. Scamp is free to download and use under the Business Source License (BSL). The source code is published on GitHub and you can build it yourself.",
  },
  {
    question: "Does Scamp work offline?",
    answer:
      "Yes. Scamp is local-first. All files are read from and written to your own machine, and you do not need an internet connection to design, save, or run a project.",
  },
  {
    question: "What data does Scamp access?",
    answer:
      "Only the project folder you point it at. Scamp does not upload your designs, send telemetry about your layouts, or sync files to any cloud service. Everything is a plain file on your disk — see the /trust page for the details.",
  },
  {
    question: "Do I need to know how to code to use Scamp?",
    answer:
      "No. You can design in Scamp using only the visual controls and never touch the CSS editor if you don't want to. The CSS access is there for designers who want finer control — it is an option, not a requirement.",
  },
  {
    question: "What file formats does Scamp generate?",
    answer:
      "TSX (React component) files and CSS Module files — one pair per page. Scamp also creates a shared theme.css for your design tokens and an agent.md with instructions for AI coding agents.",
  },
  {
    question: "Can I use Scamp with my team's existing React project?",
    answer:
      "Yes. A Scamp project is just a folder of TSX and CSS Module files, so you can point Scamp at a folder inside your existing repo, drop generated components into your app, or copy individual files over.",
  },
  {
    question: "How fast can I start?",
    answer:
      "Download the installer, launch Scamp, click New Project, and you have a blank canvas saving real files within a minute. There is no signup, onboarding wizard, or workspace setup.",
  },
];

export const HOMEPAGE_FAQ_SHORT = HOMEPAGE_FAQ.slice(0, 9);
