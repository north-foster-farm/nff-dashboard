import { T } from "../theme.js";
import { DAY_NAMES, formatDate, formatLongDate, formatTime12h } from "../lib/dates.js";

export default function EventKindPage({ kind, data }) {
  if (kind.instances.length === 0) {
    return <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic", padding: "32px 0", textAlign: "center" }}>No instances captured yet.</div>;
  }
  const sorted = [...kind.instances].sort((a, b) => {
    if (a.recurrence && b.recurrence) return a.recurrence.seasonStart.localeCompare(b.recurrence.seasonStart);
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.recurrence) return -1;
    return 1;
  });
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map(inst => <EventInstanceCard key={inst.id} instance={inst} data={data} />)}
      </div>
      {kind.notes && (
        <div style={{ marginTop: 18, padding: "12px 16px", background: T.surfaceAlt, border: `1px solid ${T.border}`, fontSize: 11, color: T.textMuted, lineHeight: 1.6, fontStyle: "italic" }}>{kind.notes}</div>
      )}
    </div>
  );
}

function EventInstanceCard({ instance, data }) {
  const isRecurring = !!instance.recurrence;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "18px 22px" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: T.serif, fontSize: 19, fontWeight: 600, lineHeight: 1.2 }}>
          {instance.label}
          {instance.date && <span style={{ color: T.textDim, fontWeight: 500 }}> · {formatLongDate(instance.date)}</span>}
        </div>
        {instance.subtitle && <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>{instance.subtitle}</div>}
      </div>
      {isRecurring ? <RecurringScheduleBlock recurrence={instance.recurrence} /> : <SingleDateBlock instance={instance} />}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.surfaceAlt}` }}>
        <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Location</div>
        <div style={{ fontSize: 13, color: T.text }}>{instance.location.name}</div>
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{instance.location.address}</div>
      </div>
      {instance.processing && <ProcessingBlock processing={instance.processing} data={data} />}
      {instance.notes && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}`, fontStyle: "italic", lineHeight: 1.5 }}>{instance.notes}</div>}
    </div>
  );
}

// Processing-day-specific payload. Planning fields (batch size, breed, birds
// per crate, resources required) are known up front; day-of fields (final
// count, crates packed, cut sheet document) are captured by the processor
// team and show as "not recorded" until set.
function ProcessingBlock({ processing, data }) {
  const resources = (processing.resourcesRequired ?? []).map(ref => resolveResource(ref, data)).filter(Boolean);
  const batch = processing.batchId ? resolveBatch(processing.batchId, data) : null;
  const pending = (v) => v == null ? <span style={{ color: T.textFaint, fontStyle: "italic" }}>not recorded</span> : v;
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.surfaceAlt}` }}>
      <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Processing details</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, fontSize: 11 }}>
        <FieldCell
          label="Batch"
          value={batch
            ? batch.label
            : <button onClick={() => alert("Assign batch — UI pending. See thread_batch_assignment.")} style={assignBatchButtonStyle}>+ Assign batch</button>}
        />
        <FieldCell label="Batch size" value={processing.batchSize != null ? `${processing.batchSize} birds` : "—"} />
        <FieldCell label="Breed" value={processing.breed ?? "—"} />
        <FieldCell label="Birds / crate" value={processing.birdsPerCrate ?? "—"} />
        <FieldCell label="Crates packed" value={pending(processing.cratesPacked)} />
        <FieldCell label="Final count" value={pending(processing.finalCount)} />
        <FieldCell label="Cut sheet" value={
          processing.cutSheetDocumentId
            ? (resolveDocument(processing.cutSheetDocumentId, data)?.label ?? processing.cutSheetDocumentId)
            : <span style={{ color: T.warn, fontStyle: "italic" }}>not uploaded</span>
        } />
      </div>
      {resources.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Resources required</div>
          <div style={{ fontSize: 12, color: T.text }}>{resources.map(r => r.label).join(", ")}</div>
        </div>
      )}
    </div>
  );
}

// Map a {type, id} reference to the actual record in `data`. Unknown types
// return null so the caller just skips them.
function resolveResource(ref, data) {
  if (!ref || !data) return null;
  const buckets = {
    trailer: data.trailers,
    machine: data.machines,
    space: data.spaces?.items,
    supplier: data.suppliers
  };
  const list = buckets[ref.type];
  return list ? list.find(r => r.id === ref.id) ?? null : null;
}

function resolveDocument(docId, data) {
  return (data?.documents ?? []).find(d => d.id === docId) ?? null;
}

// Look up a livestock group by id across all species. Used by processing
// events that link to a broiler batch.
function resolveBatch(batchId, data) {
  for (const sp of data?.livestock?.species ?? []) {
    for (const g of sp.groups ?? []) {
      if (g.id === batchId) return g;
    }
  }
  return null;
}

const assignBatchButtonStyle = {
  background: "transparent", border: `1px dashed ${T.border}`,
  color: T.textDim, fontFamily: "inherit", fontSize: 11,
  padding: "3px 8px", cursor: "pointer"
};

function FieldCell({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: T.text }}>{value}</div>
    </div>
  );
}

function RecurringScheduleBlock({ recurrence }) {
  const dayName = DAY_NAMES[recurrence.dayOfWeek];
  const time = `${formatTime12h(recurrence.startTime)} – ${formatTime12h(recurrence.endTime)}`;
  const season = `${formatDate(recurrence.seasonStart)} – ${formatDate(recurrence.seasonEnd)}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, fontSize: 11 }}>
      <FieldCell label="Day" value={`${dayName}s`} />
      <FieldCell label="Time" value={time} />
      <FieldCell label="Season" value={season} />
    </div>
  );
}

function SingleDateBlock({ instance }) {
  const dateLong = formatLongDate(instance.date);
  const time = `${formatTime12h(instance.startTime)} – ${formatTime12h(instance.endTime)}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, fontSize: 11 }}>
      <FieldCell label="Date" value={dateLong} />
      <FieldCell label="Time" value={time} />
    </div>
  );
}
