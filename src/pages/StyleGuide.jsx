import { ExternalLink } from "lucide-react";

// The style guide is one source of truth: the static doc site served from
// /public/style-guide/. We embed it (?embed=1 → it hides its own topbar and
// follows the app's theme, same-origin) rather than reimplementing it in React,
// so the browsable site and the in-app view never drift. The app shell renders
// the section title + description; this page adds the embed + an "Open full
// page" escape hatch (standalone, with its own theme toggle).
export default function StyleGuide() {
  return (
    <div className="flex flex-col">
      <div className="flex justify-end mb-3">
        <a
          href="/style-guide/index.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-dim hover:text-fg border border-line px-3 py-1.5"
        >
          <ExternalLink size={12} /> Open full page
        </a>
      </div>
      <iframe
        title="NFF design system"
        src="/style-guide/index.html?embed=1"
        className="w-full border border-line bg-bg h-[80vh] min-h-[560px]"
      />
    </div>
  );
}
