// The tiny history-based router's pure path layer: building paths for
// sections / batches / projects / place timelines, and parseRoute's
// pathname → route-descriptor mapping. The history plumbing
// (navigate, navigateBack, usePath, useRoute, usePersistedState) is
// window/React-bound and not covered here.
import { describe, it, expect } from "vitest";
import {
  pathForSection,
  pathForBatch,
  pathForProject,
  pathForPlaceTimeline,
  parseRoute,
} from "./router.js";

describe("pathForSection", () => {
  it("maps a plain section id to /<id> with underscores dashed", () => {
    expect(pathForSection("now")).toBe("/now");
    expect(pathForSection("farm_map")).toBe("/farm-map");
  });

  it("maps events_* ids under /events/", () => {
    expect(pathForSection("events_all")).toBe("/events/all");
    expect(pathForSection("events_farm_tasks")).toBe(
      "/events/farm-tasks"
    );
  });

  it("maps livestock_* ids under /livestock/", () => {
    expect(pathForSection("livestock_broiler_chickens")).toBe(
      "/livestock/broiler-chickens"
    );
  });

  it("returns the root path for a missing section id", () => {
    expect(pathForSection(null)).toBe("/");
    expect(pathForSection("")).toBe("/");
  });
});

describe("pathForBatch / pathForProject / pathForPlaceTimeline", () => {
  it("builds /livestock/<species>/<batch> with both parts dashed", () => {
    expect(pathForBatch("broiler_chickens", "batch_3")).toBe(
      "/livestock/broiler-chickens/batch-3"
    );
  });

  it("keeps project ids verbatim (uuid dashes are real)", () => {
    const id = "0a1b2c3d-4e5f-6789-abcd-ef0123456789";
    expect(pathForProject(id)).toBe("/projects/" + id);
  });

  it("builds /place/<id>/timeline with the place id verbatim", () => {
    expect(pathForPlaceTimeline("pasture_a")).toBe(
      "/place/pasture_a/timeline"
    );
  });
});

describe("parseRoute — round-trips through the path builders", () => {
  it("recovers a plain section id, including underscores", () => {
    expect(parseRoute(pathForSection("overview")).sectionId).toBe(
      "overview"
    );
    expect(parseRoute(pathForSection("farm_map")).sectionId).toBe(
      "farm_map"
    );
  });

  it("recovers an events_* section id", () => {
    const route = parseRoute(pathForSection("events_farm_tasks"));
    expect(route.kind).toBe("section");
    expect(route.sectionId).toBe("events_farm_tasks");
  });

  it("recovers a livestock_* section id with no batch", () => {
    const route = parseRoute(
      pathForSection("livestock_broiler_chickens")
    );
    expect(route.sectionId).toBe("livestock_broiler_chickens");
    expect(route.batchId).toBeNull();
  });

  it("recovers the species and batch ids from a batch path", () => {
    const route = parseRoute(
      pathForBatch("broiler_chickens", "batch_3")
    );
    expect(route.sectionId).toBe("livestock_broiler_chickens");
    expect(route.batchId).toBe("batch_3");
  });

  it("recovers a uuid project id verbatim", () => {
    const id = "0a1b2c3d-4e5f-6789-abcd-ef0123456789";
    const route = parseRoute(pathForProject(id));
    expect(route.sectionId).toBe("projects");
    expect(route.projectId).toBe(id);
  });

  it("recovers a place-timeline path as the map section", () => {
    const route = parseRoute(pathForPlaceTimeline("pasture_a"));
    expect(route.sectionId).toBe("map");
    expect(route.placeId).toBe("pasture_a");
    expect(route.placeView).toBe("timeline");
  });
});

describe("parseRoute — direct cases", () => {
  it("the root path (and a null pathname) is the home route", () => {
    expect(parseRoute("/")).toEqual({ kind: "home" });
    expect(parseRoute(null)).toEqual({ kind: "home" });
    expect(parseRoute("")).toEqual({ kind: "home" });
  });

  it("/rounds is the Rounds takeover with no block selected", () => {
    expect(parseRoute("/rounds")).toEqual({
      kind: "rounds",
      blockId: null,
    });
  });

  it("/rounds/<blockId> carries the block id", () => {
    expect(parseRoute("/rounds/morning")).toEqual({
      kind: "rounds",
      blockId: "morning",
    });
  });

  it("a section route fills every deep-link field with null", () => {
    expect(parseRoute("/now")).toEqual({
      kind: "section",
      sectionId: "now",
      placeId: null,
      placeView: null,
      choresTab: null,
      batchId: null,
      projectId: null,
    });
  });

  it("/place/<id> without /timeline has placeView:null", () => {
    const route = parseRoute("/place/coop1");
    expect(route.sectionId).toBe("map");
    expect(route.placeId).toBe("coop1");
    expect(route.placeView).toBeNull();
  });

  it("an unrecognized third place segment is not a timeline", () => {
    expect(parseRoute("/place/coop1/history").placeView).toBeNull();
  });

  it("bare /events defaults to the events_all section", () => {
    expect(parseRoute("/events").sectionId).toBe("events_all");
  });

  it("/chores selects the Chores section with no tab", () => {
    const route = parseRoute("/chores");
    expect(route.sectionId).toBe("chores");
    expect(route.choresTab).toBeNull();
  });

  it("/chores/<tab> carries the tab verbatim", () => {
    expect(parseRoute("/chores/today").choresTab).toBe("today");
  });

  it("a trailing slash parses the same as without it", () => {
    expect(parseRoute("/now/")).toEqual(parseRoute("/now"));
    expect(parseRoute("/rounds/")).toEqual(parseRoute("/rounds"));
  });

  it("an unknown path becomes a section named after its head", () => {
    // parseRoute never rejects: /whatever-here is section
    // "whatever_here" and the app decides it doesn't exist.
    expect(parseRoute("/no-such-screen").sectionId).toBe(
      "no_such_screen"
    );
  });

  it("extra segments after a plain section head are ignored", () => {
    expect(parseRoute("/now/extra/junk").sectionId).toBe("now");
  });

  it("bare /place and /livestock fall through to plain sections", () => {
    // With no id segment the special-case branches don't match, so
    // the head parses as an ordinary section id.
    expect(parseRoute("/place").sectionId).toBe("place");
    expect(parseRoute("/place").placeId).toBeNull();
    expect(parseRoute("/livestock").sectionId).toBe("livestock");
  });
});
