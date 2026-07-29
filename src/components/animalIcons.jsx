import { Egg, PawPrint } from "lucide-react";

// Animal iconography (F27). One species→glyph map, so every surface —
// the sidebar, the command palette, batch headers — draws the same
// mark for a species instead of each call site hardcoding its own.
// lucide has no sheep or chicken, so `Sheep` and `Chicken` below are
// house glyphs in lucide's stroke language (24×24, currentColor,
// round joins) to sit cleanly beside Egg.

// A woolly body on two legs with a head to the right. Authored to match
// lucide's line weight so it reads as a sibling of the other icons.
export function Sheep({ size = 18, className = "", ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* woolly back — three soft bumps */}
      <path d="M6 12.5a2.2 2.2 0 0 1 1-4.1 2.2 2.2 0 0 1 3.5-2.2 2.2 2.2 0 0 1 3.9 0 2.2 2.2 0 0 1 3.4 2.4" />
      {/* belly + rump */}
      <path d="M6 12.5A3.5 3.5 0 0 0 9.5 18H13" />
      {/* head */}
      <circle cx="17" cy="12" r="3" />
      {/* ear */}
      <path d="m19.3 10.1 1.3-1.1" />
      {/* legs */}
      <path d="M9 18v2.5M12.5 18v2.5" />
    </svg>
  );
}

// A plump hen facing right: one silhouette from tail point over the
// back, up the neck into a jagged comb, around the face to a closed
// beak, then a chin-to-tail belly sweep; eye dot and two legs. Like
// Sheep, authored in lucide's stroke language.
export function Chicken({ size = 18, className = "", ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* tail -> back -> neck -> comb -> face -> beak -> chin -> belly */}
      <path
        d="M4.8 5.8Q9.4 7.4 14.2 7Q15 6.4 15.2 5.2L15.5 3.4L16.5
           4.5L17.5 3.6L18.5 5.2Q19.5 6.5 19.7 7.3L22 8.1L19.5
           9Q19.2 10.6 18.4 11.2A6.6 6.6 0 1 1 5.7 9Z"
      />
      {/* eye */}
      <path d="M15.9 7.5h.01" />
      {/* legs */}
      <path d="M10.8 18.2v2.3M13.8 18.2v2.3" />
    </svg>
  );
}

// The per-species glyph. Unknown species fall back to a generic animal
// paw (better a neutral animal mark than the wrong species' icon).
// Broilers wear the house Chicken, not lucide's Bird — Bird is reserved
// for non-chicken bird surfaces.
const BY_SPECIES = {
  layers: Egg,
  broilers: Chicken,
  sheep: Sheep,
};

export function iconForSpecies(speciesId) {
  return BY_SPECIES[speciesId] ?? PawPrint;
}
