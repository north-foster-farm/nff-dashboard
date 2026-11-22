// The step after SVGOMG's settings (north-foster-farm#295): drop
// every class name an SVG carries that the app does not use. Most are
// Lucide's (`lucide`, `lucide-copy`), which come with every icon
// copied from lucide.dev and style nothing here.
//
// A file keeps only the classes its entry in OVERRIDES
// (svgo.config.mjs) names, each with why; none yet.
// scripts/svg/clean.mjs checks before it writes: when a class it would
// drop is named in a stylesheet, script, page or test, it stops and
// says where.

export const stripUnusedClasses = (keep = []) => ({
  name: "stripUnusedClasses",
  fn: () => ({
    element: {
      enter: (node) => {
        if (node.attributes.class === undefined) return;
        const names = node.attributes.class.split(/\s+/)
          .filter((name) => keep.includes(name));

        if (names.length) node.attributes.class = names.join(" ");
        else delete node.attributes.class;
      },
    },
  }),
});
