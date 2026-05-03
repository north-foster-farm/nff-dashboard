import { X } from "lucide-react";
import { T } from "../theme.js";
import { formatLongDate, formatTime12h } from "../lib/dates.js";
import { Row } from "./primitives.jsx";

export default function DetailModal({ item, onClose }) {
  const dateLong = formatLongDate(item.date);
  const time = item.endTime ? `${formatTime12h(item.startTime)} – ${formatTime12h(item.endTime)}` : formatTime12h(item.startTime);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg, border: `1px solid ${T.border}`, padding: 28,
        maxWidth: 480, width: "100%", position: "relative"
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14, background: "transparent",
          border: "none", color: T.textDim, cursor: "pointer", padding: 4,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}><X size={16} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, background: T.cat[item.kindId] || T.textDim, borderRadius: "50%" }} />
          <span style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.14em" }}>{item.kindLabel}</span>
        </div>
        <h3 style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 600, margin: "0 0 4px", letterSpacing: "-0.01em" }}>{item.instanceLabel}</h3>
        {item.subtitle && <p style={{ fontSize: 12, color: T.textDim, margin: "0 0 18px" }}>{item.subtitle}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
          <Row label="Date" value={dateLong} />
          <Row label="Time" value={time} />
          <Row label="Location" value={<><div>{item.location.name}</div><div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{item.location.address}</div></>} />
          {item.recurring && <Row label="Recurrence" value="Recurring (weekly)" />}
        </div>
      </div>
    </div>
  );
}
