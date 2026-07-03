import { Egg, Bird, PawPrint } from "lucide-react";

// Animal iconography (F27). One species→glyph map, so every surface —
// the sidebar, the command palette, batch headers — draws the same
// mark for a species instead of each call site hardcoding its own.
// lucide has no sheep, so `Sheep` below is a house glyph in lucide's
// stroke language (24×24, currentColor, round joins) to sit cleanly
// beside Egg and Bird.

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

// The per-species glyph. Unknown species fall back to a generic animal
// paw (better a neutral animal mark than the wrong species' icon).
const BY_SPECIES = {
  layers: Egg,
  broilers: Bird,
  sheep: Sheep,
};

export function iconForSpecies(speciesId) {
  return BY_SPECIES[speciesId] ?? PawPrint;
}
