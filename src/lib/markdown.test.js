import { describe, expect, it, vi } from "vitest";
import { marked } from "marked";

import { markdownToHtml } from "./markdown.js";

const HOSTILE = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "[click](javascript:alert(1))",
  "<iframe src=\"javascript:alert(1)\"></iframe>",
].join("\n\n");

describe("markdownToHtml", () => {
  it("is not safe on its own: marked passes the markup through", () => {
    const raw = marked.parse(HOSTILE);

    expect(raw).toContain("<script>alert(1)</script>");
    expect(raw).toContain("onerror=alert(1)");
  });

  it("hands marked's output to the sanitizer and returns only its answer", () => {
    const sanitize = vi.fn(() => "<p>clean</p>");

    expect(markdownToHtml(HOSTILE, sanitize)).toBe("<p>clean</p>");
    expect(sanitize).toHaveBeenCalledTimes(1);
    expect(sanitize).toHaveBeenCalledWith(marked.parse(HOSTILE));
  });

  it("has nothing to sanitize in an empty body", () => {
    const sanitize = vi.fn();

    expect(markdownToHtml("", sanitize)).toBe("");
    expect(markdownToHtml(null, sanitize)).toBe("");
    expect(sanitize).not.toHaveBeenCalled();
  });
});
