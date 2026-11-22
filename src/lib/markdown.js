import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true, // single newlines render as <br> — matches how
                // farm notes are actually typed
});

// Markdown to HTML for project bodies. marked passes raw HTML straight
// through, so its output is markup from outside until `sanitize` has
// seen it; nothing leaves here that did not come back from `sanitize`.
// The sanitizer is DOMPurify in the browser (components/Markdown.jsx),
// passed in so this stays pure and a test can watch what reaches it.
export const markdownToHtml = (source, sanitize) => {
  if (!source) return "";

  return sanitize(marked.parse(source));
};
