import { useMemo } from "react";
import DOMPurify from "dompurify";

import { markdownToHtml } from "../lib/markdown.js";

// Markdown renderer for project bodies (Batch 22). marked parses,
// DOMPurify sanitizes — content is admin-authored, but sanitizing
// keeps a pasted snippet from ever injecting markup. The two steps are
// joined in lib/markdown.js, where a test holds them together.
//
// Styling comes from the `md` class scoped in styles.css rather than
// per-element Tailwind, since the markup is generated.

export default function Markdown({ source, className = "" }) {
  const html = useMemo(
    () => markdownToHtml(source, (dirty) => DOMPurify.sanitize(dirty)),
    [source],
  );

  if (!source) return null;
  return (
    <div
      className={`md text-[13px] leading-relaxed ${className}`}
      // Sanitized in markdownToHtml — see DOMPurify.sanitize.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
