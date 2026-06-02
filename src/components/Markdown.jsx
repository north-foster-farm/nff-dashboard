import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

// Markdown renderer for project bodies (Batch 22). marked parses,
// DOMPurify sanitizes — content is admin-authored, but sanitizing
// keeps a pasted snippet from ever injecting markup.
//
// Styling comes from the `md` class scoped in styles.css rather than
// per-element Tailwind, since the markup is generated.

marked.setOptions({
  gfm: true,
  breaks: true, // single newlines render as <br> — matches how
                // farm notes are actually typed
});

export default function Markdown({ source, className = "" }) {
  const html = useMemo(() => {
    if (!source) return "";
    return DOMPurify.sanitize(marked.parse(source));
  }, [source]);

  if (!source) return null;
  return (
    <div
      className={`md text-[13px] leading-relaxed ${className}`}
      // Sanitized above — see DOMPurify.sanitize.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
