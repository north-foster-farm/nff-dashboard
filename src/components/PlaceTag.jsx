import { displayPlace } from "../lib/places.js";

// D1 place disambiguation (Batch 17). Renders a place as its own name
// plus its immediate parent's name in bold — "Mobile Coop 1 ·
// **Pasture B**" — so non-unique names stay distinguishable in the
// field. Used by the Now surface rows, the Rounds check rows, and the
// quick-action capture sheets.
export default function PlaceTag({ place, placesById, className = "" }) {
  if (!place) return null;
  const { name, parentName } = displayPlace(place, placesById);
  return (
    <span className={"inline-flex items-baseline gap-1 " + className}>
      <span>{name}</span>
      {parentName && (
        <>
          <span aria-hidden>·</span>
          <span className="font-semibold">{parentName}</span>
        </>
      )}
    </span>
  );
}
