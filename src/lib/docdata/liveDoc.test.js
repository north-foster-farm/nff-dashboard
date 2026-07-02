// liveDoc — the pure half of live HTML doc attachments (batch 42.8):
// the localStorage-shaped shim a live doc runs against instead of the
// browser's real storage, the srcdoc injection that installs it, and
// the advisory write-lock state machine. The Supabase side (rows,
// realtime, heartbeats) lives in useDocData and is not under test.
import { describe, it, expect, vi } from "vitest";
import {
  createStorageShim, injectShim, lockState, LOCK_STALE_MS,
} from "./liveDoc.js";

const NOW = new Date("2026-07-02T12:00:00Z");
const secondsAgo = (s) =>
  new Date(NOW.getTime() - s * 1000).toISOString();

describe("lockState — who may write the doc right now", () => {
  it("no lock row at all -> unlocked", () => {
    expect(lockState(null, { me: "James", now: NOW })).toBe("unlocked");
  });

  it("my own lock -> mine", () => {
    const myLock = { lockedBy: "James", heartbeatAt: secondsAgo(5) };
    expect(lockState(myLock, { me: "James", now: NOW })).toBe("mine");
  });

  it("someone else's lock with a fresh heartbeat -> theirs", () => {
    const jimsLock = { lockedBy: "Jim", heartbeatAt: secondsAgo(30) };
    expect(lockState(jimsLock, { me: "James", now: NOW })).toBe("theirs");
  });

  it("someone else's lock past the stale cutoff -> stale (claimable)", () => {
    const abandoned = {
      lockedBy: "Jim",
      heartbeatAt: secondsAgo(LOCK_STALE_MS / 1000 + 1),
    };
    expect(lockState(abandoned, { me: "James", now: NOW })).toBe("stale");
  });

  it("my OWN stale lock is still mine (a laggy tab resumes editing)", () => {
    const myOldLock = {
      lockedBy: "James",
      heartbeatAt: secondsAgo(LOCK_STALE_MS / 1000 + 60),
    };
    expect(lockState(myOldLock, { me: "James", now: NOW })).toBe("mine");
  });
});

describe("createStorageShim — localStorage semantics over our store", () => {
  it("serves seeded values through getItem", () => {
    const shim = createStorageShim({ nff_neg: '{"entries":[]}' });
    expect(shim.getItem("nff_neg")).toBe('{"entries":[]}');
    expect(shim.getItem("missing")).toBe(null);
  });

  it("setItem round-trips and reports the write", () => {
    const onWrite = vi.fn();
    const shim = createStorageShim({}, { onWrite });
    shim.setItem("nff_draft_james", '{"price":9}');
    expect(shim.getItem("nff_draft_james")).toBe('{"price":9}');
    expect(onWrite).toHaveBeenCalledWith("nff_draft_james", '{"price":9}');
  });

  it("coerces non-string values like real localStorage", () => {
    const shim = createStorageShim({});
    shim.setItem("n", 5);
    expect(shim.getItem("n")).toBe("5");
  });

  it("removeItem deletes and reports null", () => {
    const onWrite = vi.fn();
    const shim = createStorageShim({ k: "v" }, { onWrite });
    shim.removeItem("k");
    expect(shim.getItem("k")).toBe(null);
    expect(onWrite).toHaveBeenCalledWith("k", null);
  });

  it("length + key() walk the live key set", () => {
    const shim = createStorageShim({ a: "1", b: "2" });
    expect(shim.length).toBe(2);
    expect([shim.key(0), shim.key(1)].sort()).toEqual(["a", "b"]);
    expect(shim.key(9)).toBe(null);
  });

  it("read-only mode swallows writes and reports nothing", () => {
    const onWrite = vi.fn();
    const shim = createStorageShim({ k: "v" }, { onWrite, readOnly: true });
    shim.setItem("k", "changed");
    shim.removeItem("k");
    expect(shim.getItem("k")).toBe("v"); // untouched
    expect(onWrite).not.toHaveBeenCalled();
  });

  it("acceptExternal updates a key without echoing it back as a write", () => {
    const onWrite = vi.fn();
    const shim = createStorageShim({ k: "old" }, { onWrite });
    shim.acceptExternal("k", "from-jim");
    expect(shim.getItem("k")).toBe("from-jim");
    expect(onWrite).not.toHaveBeenCalled();
  });
});

describe("injectShim — building the srcdoc", () => {
  const page =
    "<!DOCTYPE html><html><head><title>t</title>" +
    "<script>var x=localStorage.getItem('k');</script>" +
    "</head><body></body></html>";

  it("installs the shim script immediately after <head>, before page scripts", () => {
    const out = injectShim(page, { k: "v" });
    const shimAt = out.indexOf("nff-live-doc-shim");
    const pageScriptAt = out.indexOf("localStorage.getItem('k')");
    expect(shimAt).toBeGreaterThan(-1);
    expect(shimAt).toBeLessThan(pageScriptAt);
    expect(out.indexOf("<head>")).toBeLessThan(shimAt);
  });

  it("escapes '<' in seed values so one can never close the script tag", () => {
    const hostile = { k: "</script><script>alert(1)</script>" };
    const out = injectShim(page, hostile);
    expect(out).not.toContain("</script><script>alert(1)");
    expect(out).toContain("\\u003c/script"); // the escaped form
  });

  it("a headless fragment still gets the shim prepended", () => {
    const out = injectShim("<p>bare</p>", {});
    expect(out.indexOf("<script")).toBe(0); // shim first…
    expect(out).toContain("nff-live-doc-shim");
    expect(out.indexOf("nff-live-doc-shim"))
      .toBeLessThan(out.indexOf("<p>bare")); // …fragment after
  });

  it("read-only mode is baked into the injected runtime", () => {
    const out = injectShim(page, {}, { readOnly: true });
    expect(out).toContain('"readOnly":true');
  });
});
