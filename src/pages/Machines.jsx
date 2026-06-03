// Resources → Machinery (Batch 39: migrated off inline styles to
// Tailwind tokens).
export default function Machines({ data }) {
  return (
    <div className="flex flex-col gap-px bg-line">
      {data.machines.map(m => <MachineRow key={m.id} machine={m} />)}
    </div>
  );
}

function MachineRow({ machine }) {
  return (
    <div className="bg-surface px-[22px] py-[18px]">
      <div className="flex justify-between items-baseline mb-2.5">
        <div className="font-heading text-[18px] font-semibold">
          {machine.label}
        </div>
        <div className="text-[10px] text-dim uppercase tracking-[0.12em]">
          {machine.category}
        </div>
      </div>
      <div className="text-[11px] text-dim mb-2.5">
        {machine.manufacturer} · Model {machine.model}
      </div>
      {machine.uses.length > 0 && (
        <ul className="m-0 pl-4 text-[12px] text-fg leading-[1.7]">
          {machine.uses.map((u, idx) => <li key={idx}>{u}</li>)}
        </ul>
      )}
      {machine.notes && (
        <div className="text-[11px] text-muted mt-2.5 pt-2.5 border-t border-surface-alt italic leading-[1.5]">
          {machine.notes}
        </div>
      )}
    </div>
  );
}
