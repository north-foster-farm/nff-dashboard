// Resources → Suppliers (Batch 39: migrated off inline styles to
// Tailwind tokens).
export default function Suppliers({ data }) {
  return (
    <div className="flex flex-col gap-px bg-line">
      {data.suppliers.map(s => <SupplierRow key={s.id} supplier={s} />)}
    </div>
  );
}

function SupplierRow({ supplier }) {
  return (
    <div className="bg-surface px-[22px] py-[18px]">
      <div className="flex justify-between items-baseline mb-2.5">
        <div className="font-heading text-[17px] font-semibold">
          {supplier.label}
        </div>
        <div className="text-[10px] text-dim uppercase tracking-[0.12em]">
          {supplier.category}
        </div>
      </div>
      <div className="text-[11px] text-dim uppercase tracking-[0.08em] mb-1.5">
        Supplies
      </div>
      <ul className="m-0 pl-4 text-[12px] text-fg leading-[1.7]">
        {supplier.supplies.map((s, idx) => <li key={idx}>{s}</li>)}
      </ul>
      {supplier.notes && (
        <div className="text-[11px] text-muted mt-2.5 pt-2.5 border-t border-surface-alt italic leading-[1.5]">
          {supplier.notes}
        </div>
      )}
    </div>
  );
}
