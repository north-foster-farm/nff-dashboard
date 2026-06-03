// Resources → Trailers (Batch 39: migrated off inline styles to
// Tailwind tokens).
export default function Trailers({ data }) {
  const trailers = data.trailers ?? [];
  if (trailers.length === 0) {
    return (
      <div className="text-[12px] text-muted italic py-8 text-center">
        No trailers captured yet.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-px bg-line">
      {trailers.map(t => <TrailerRow key={t.id} trailer={t} />)}
    </div>
  );
}

function TrailerRow({ trailer }) {
  return (
    <div className="bg-surface px-[22px] py-[18px]">
      <div className="flex justify-between items-baseline mb-2.5">
        <div className="font-heading text-[18px] font-semibold">
          {trailer.label}
        </div>
        {trailer.category && (
          <div className="text-[10px] text-dim uppercase tracking-[0.12em]">
            {trailer.category}
          </div>
        )}
      </div>
      {(trailer.uses?.length ?? 0) > 0 && (
        <ul className="m-0 pl-4 text-[12px] text-fg leading-[1.7]">
          {trailer.uses.map((u, idx) => <li key={idx}>{u}</li>)}
        </ul>
      )}
      {trailer.notes && (
        <div className="text-[11px] text-muted mt-2.5 pt-2.5 border-t border-surface-alt italic leading-[1.5]">
          {trailer.notes}
        </div>
      )}
    </div>
  );
}
