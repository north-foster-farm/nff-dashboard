import { describe, it, expect } from "vitest";
import { attachmentStoragePath } from "./attachments.js";

describe("attachmentStoragePath", () => {
  // Storage object keys for uploaded files. The filename is sanitized
  // so an odd name can never break out of its prefix (path traversal)
  // or collide with the timestamp/prefix separators.
  const prefix = "events/series-1";
  const timestamp = 1_700_000_000_000;

  it("joins prefix, timestamp and sanitized filename", () => {
    const path = attachmentStoragePath({
      prefix, fileName: "cut-list.pdf", timestamp,
    });
    expect(path).toBe("events/series-1/1700000000000-cut-list.pdf");
  });

  it("replaces spaces and unsafe characters with underscores", () => {
    const path = attachmentStoragePath({
      prefix, fileName: "Batch 3 cuts (final).xlsx", timestamp,
    });
    expect(path).toBe(
      "events/series-1/1700000000000-Batch_3_cuts_final_.xlsx"
    );
  });

  it("neutralizes path-traversal attempts by stripping slashes", () => {
    // Dots are harmless to keep; it's the slash that would let a name
    // climb out of its prefix, so slashes become underscores.
    const path = attachmentStoragePath({
      prefix, fileName: "../../secret.key", timestamp,
    });
    const fileSegment = path.slice(prefix.length + 1);
    expect(fileSegment).not.toContain("/");
    expect(path).toBe("events/series-1/1700000000000-.._.._secret.key");
  });
});
