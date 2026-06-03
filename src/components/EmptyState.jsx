// Generic "nothing here yet" placeholder (Batch 39: migrated off the
// inline-style idiom to Tailwind tokens).
export default function EmptyState({ label }) {
  return (
    <div className="py-16 text-center">
      <div className="inline-block px-12 py-8 border border-dashed border-line">
        <p className="text-[13px] text-dim m-0 mb-1.5">
          No {label.toLowerCase()} captured yet.
        </p>
        <p className="text-[11px] text-muted m-0">
          Drop bullets in chat to populate this section.
        </p>
      </div>
    </div>
  );
}
