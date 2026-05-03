import { T } from "../theme.js";
import { DAY_NAMES, formatDate, formatLongDate, formatTime12h } from "../lib/dates.js";

export default function EventKindPage({ kind }) {
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
        {sorted.map(inst => <EventInstanceCard key={inst.id} instance={inst} />)}
      </div>
      {kind.notes && (
        <div style={{ marginTop: 18, padding: "12px 16px", background: T.surfaceAlt, border: `1px solid ${T.border}`, fontSize: 11, color: T.textMuted, lineHeight: 1.6, fontStyle: "italic" }}>{kind.notes}</div>
      )}
    </div>
  );
}

function EventInstanceCard({ instance }) {
  const isRecurring = !!instance.recurrence;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "18px 22px" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: T.serif, fontSize: 19, fontWeight: 600, lineHeight: 1.2 }}>{instance.label}</div>
        {instance.subtitle && <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>{instance.subtitle}</div>}
      </div>
      {isRecurring ? <RecurringScheduleBlock recurrence={instance.recurrence} /> : <SingleDateBlock instance={instance} />}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.surfaceAlt}` }}>
        <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Location</div>
        <div style={{ fontSize: 13, color: T.text }}>{instance.location.name}</div>
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{instance.location.address}</div>
      </div>
      {instance.notes && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}`, fontStyle: "italic", lineHeight: 1.5 }}>{instance.notes}</div>}
    </div>
  );
}

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
