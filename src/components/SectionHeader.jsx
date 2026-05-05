import { ArrowLeft } from "lucide-react";

// Section subheadings were dropped globally; the header is now just a title.
// `noBottomBorder` is preserved for pages (e.g. species pages) that render
// their own subnav directly underneath and don't want a divider in between.
// Page-specific headers (e.g. Chores with its tabs + actions) opt out of this
// component entirely by rendering their own title row.
//
// `parent` (optional) — if supplied, renders a small back-link above the
// title pointing to the parent section. Used for flyout children to make the
// hierarchy visible.
export default function SectionHeader({ section, parent, onNavigate, noBottomBorder }) {
  return (
    <div className={noBottomBorder ? "mb-5" : "mb-7 pb-3.5 border-b border-line"}>
      {parent && (
        <button
          onClick={() => onNavigate?.(parent.id)}
          disabled={!onNavigate}
          className={
            "inline-flex items-center gap-1.5 bg-transparent border-0 text-dim " +
            "font-ui text-[11px] font-semibold uppercase tracking-[0.14em] " +
            "p-0 mb-2 " +
            (onNavigate ? "cursor-pointer" : "cursor-default")
          }
        >
          <ArrowLeft size={12} />
          {parent.flyoutTitle || parent.label}
        </button>
      )}
      <h2 className="font-heading text-[32px] font-bold -tracking-[0.02em] m-0 text-fg">
        {section.label}
      </h2>
      {section.description && parent && (
        <div className="text-[13px] text-dim mt-1.5 leading-snug">
          {section.description}
        </div>
      )}
    </div>
  );
}
