import { describe, expect, it } from "vitest";

import { safeHttpUrl } from "./safeUrl.js";

describe("safeHttpUrl", () => {
  it("lets a web address through, normalized", () => {
    expect(safeHttpUrl("https://track.example.com/p?id=1"))
      .toBe("https://track.example.com/p?id=1");
    expect(safeHttpUrl("  http://example.com  ")).toBe("http://example.com/");
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    " \u0001javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//evil.example.com/x",
    "/relative/path",
    "mailto:a@example.com",
  ])("refuses %j", (hostile) => {
    expect(safeHttpUrl(hostile)).toBeNull();
  });

  it("refuses what is not text or not a URL", () => {
    for (const value of [null, undefined, 42, {}, "", "   ", "not a url"]) {
      expect(safeHttpUrl(value)).toBeNull();
    }
  });
});
