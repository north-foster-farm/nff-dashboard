import { useEffect, useRef, useState } from "react";
import {
  FileText, Globe, Image, Paperclip, Trash2, Upload,
} from "lucide-react";
import { LiveDocViewer, isLiveDoc } from "./LiveDocViewer.jsx";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";

// Shared small components for the Projects subsystem (Batch 22):
// inline-editable text, assignee chips, and the Storage-backed
// attachments block. Used by ProjectPage.jsx and ProjectStepModal.jsx.

// Available assignees — same hardcoded list as AssignmentRulesEditor;
// down the road this could pull from the admins table.
export const PROJECT_ASSIGNEES = ["James", "Jim"];

// ── EditableText ──────────────────────────────────────────────────────
// Renders as text; click to edit in place. Enter/blur saves, Escape
// cancels. `multiline` renders a textarea instead of an input.
export function EditableText({
  value, onSave, className = "", placeholder = "Untitled",
  multiline = false, inputClassName = "",
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef(null);

  useEffect(() => {
    if (editing) {
      setDraft(value ?? "");
      // Focus after the input mounts.
      requestAnimationFrame(() => ref.current?.focus());
    }
  }, [editing, value]);

  const save = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== (value ?? "") && (next || multiline)) {
      onSave(next || null);
    }
  };

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        className={`cursor-text ${className} ${value ? "" : "text-faint italic"}`}
        title="Click to edit"
      >
        {value || placeholder}
      </span>
    );
  }

  const shared = {
    ref,
    value: draft,
    onChange: (e) => setDraft(e.target.value),
    onBlur: save,
    onKeyDown: (e) => {
      if (e.key === "Enter" && (!multiline || e.metaKey)) {
        e.preventDefault();
        save();
      }
      if (e.key === "Escape") { setEditing(false); }
    },
    className:
      "bg-bg border border-line text-fg px-2 py-1 outline-none " +
      "focus:border-accent font-[inherit] w-full " + inputClassName,
  };

  return multiline
    ? <textarea {...shared} rows={3} />
    : <input {...shared} />;
}

// ── AssigneeChips ─────────────────────────────────────────────────────
// Toggleable name chips. `value` is an array of display names.
export function AssigneeChips({ value, onChange, readonly = false }) {
  const selected = new Set(value ?? []);
  if (readonly) {
    if (selected.size === 0) return null;
    return (
      <span className="inline-flex gap-1">
        {[...selected].map(name => (
          <span
            key={name}
            className="text-[10px] font-semibold uppercase tracking-[0.08em] bg-surface-alt text-dim px-1.5 py-0.5"
          >
            {name}
          </span>
        ))}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PROJECT_ASSIGNEES.map(name => {
        const on = selected.has(name);
        return (
          <button
            key={name}
            onClick={() => {
              const next = on
                ? (value ?? []).filter(n => n !== name)
                : [...(value ?? []), name];
              onChange(next);
            }}
            className={
              "font-[inherit] text-[11px] font-semibold px-2.5 py-1 border cursor-pointer " +
              (on
                ? "bg-accent text-on-accent border-accent"
                : "bg-transparent text-dim border-line hover:border-accent")
            }
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

// ── AttachmentsBlock ──────────────────────────────────────────────────
// Upload + list of Storage-backed files. `attachments` is the shaped
// list; upload / remove / url come from useProject().
export function AttachmentsBlock({
  attachments, onUpload, onRemove, getUrl, compact = false,
}) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  // Live HTML docs (batch 42.8) open in the in-app viewer — the doc's
  // localStorage persists to the database — instead of a raw tab.
  const [liveDoc, setLiveDoc] = useState(null);
  const userEmail = useCurrentUserEmail();

  const pick = () => fileRef.current?.click();

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (files.length === 0) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      for (const f of files) await onUpload(f);
    } catch (err) {
      setErrorMsg(err?.message ?? "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const open = async (att) => {
    if (isLiveDoc(att)) { setLiveDoc(att); return; }
    try {
      const url = await getUrl(att);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setErrorMsg(err?.message ?? "Could not open file.");
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      {(attachments ?? []).map(att => (
        <div
          key={att.id}
          className="flex items-center gap-2 bg-surface-alt px-2.5 py-1.5"
        >
          {isLiveDoc(att)
            ? <Globe size={13} className="text-accent shrink-0" />
            : att.contentType?.startsWith("image/")
              ? <Image size={13} className="text-dim shrink-0" />
              : <FileText size={13} className="text-dim shrink-0" />}
          <button
            onClick={() => open(att)}
            className="bg-transparent border-0 p-0 font-[inherit] text-[12px] text-fg hover:text-accent cursor-pointer truncate text-left flex-1"
            title="Open"
          >
            {att.fileName}
          </button>
          <span className="text-[10px] text-faint shrink-0">
            {formatBytes(att.sizeBytes)}
          </span>
          <button
            onClick={() => onRemove(att).catch(
              (err) => setErrorMsg(err?.message ?? "Delete failed."))}
            className="bg-transparent border-0 p-0.5 text-muted hover:text-warn cursor-pointer shrink-0"
            title="Delete attachment"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={pick}
        disabled={busy}
        className={
          "inline-flex items-center gap-1.5 bg-transparent border border-dashed border-line text-dim hover:text-fg hover:border-accent font-[inherit] text-[11px] font-semibold cursor-pointer disabled:opacity-50 " +
          (compact ? "px-2.5 py-1.5" : "px-3 py-2")
        }
      >
        {busy
          ? <>Uploading…</>
          : <>
              {(attachments ?? []).length === 0
                ? <Paperclip size={12} />
                : <Upload size={12} />}
              {" Attach file"}
            </>}
      </button>
      {errorMsg && <div className="text-[11px] text-warn">{errorMsg}</div>}
      {liveDoc && (
        <LiveDocViewer
          attachment={liveDoc}
          getUrl={getUrl}
          me={userEmail}
          onClose={() => setLiveDoc(null)}
        />
      )}
    </div>
  );
}

function formatBytes(n) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
