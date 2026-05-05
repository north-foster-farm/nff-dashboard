import { ArrowLeft } from "lucide-react";

// Header for non-top-level pages: shows a small back-link to the parent
// section above a large title, with optional subtitle. Top-level pages keep
// using SectionHeader (no back-link).
export default function PageHeader({
  title,
  subtitle,
  parentLabel,
  onBack,
  noBottomBorder
}) {
  return (
    <div
      className={
        noBottomBorder
          ? "mb-5"
          : "mb-7 pb-3.5 border-b border-line"
      }
    >
      {parentLabel && (
        <button
          onClick={onBack}
          disabled={!onBack}
          className={
            "inline-flex items-center gap-1.5 bg-transparent border-0 text-dim " +
            "font-ui text-[11px] font-semibold uppercase tracking-[0.14em] " +
            "p-0 mb-2 " +
            (onBack ? "cursor-pointer" : "cursor-default")
          }
        >
          <ArrowLeft size={12} />
          {parentLabel}
        </button>
      )}
      <h2 className="font-heading text-[32px] font-bold -tracking-[0.02em] m-0 text-fg">
        {title}
      </h2>
      {subtitle && (
        <div className="text-[13px] text-dim mt-1.5 leading-snug">
          {subtitle}
        </div>
      )}
    </div>
  );
}
