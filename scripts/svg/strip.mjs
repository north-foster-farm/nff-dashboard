// The step after SVGOMG's settings (north-foster-farm#295): drop
// every class name an SVG carries that the app does not use. Most are
// Lucide's (`lucide`, `lucide-copy`), which come with every icon
// copied from lucide.dev and style nothing here.
//
// KEEP names the classes the app does use, each with why; none yet.
// Every other class goes. scripts/svg/clean.mjs checks before it
// writes: when a class it would drop is named in a stylesheet,
// script, page or test, it stops and says where.

export const KEEP = {};

const kept = (value) =>
  value.split(/\s+/).filter((name) => Object.hasOwn(KEEP, name));

export const stripUnusedClasses = {
  name: "stripUnusedClasses",
  fn: () => ({
    element: {
      enter: (node) => {
        if (node.attributes.class === undefined) return;
        const names = kept(node.attributes.class);

        if (names.length) node.attributes.class = names.join(" ");
        else delete node.attributes.class;
      },
    },
  }),
};
