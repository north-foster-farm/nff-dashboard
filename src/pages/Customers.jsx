import { useMemo, useState } from "react";
import {
  Archive, ArchiveRestore, ChevronDown, ChevronRight, Mail, Pencil,
  Phone, Plus, Search, Trash2, Users, X,
} from "lucide-react";
import { useCustomers } from "../lib/data/useCustomers.js";

// The Customers page (Batch 24): the directory + named lists.
//
//   Directory tab — searchable customer rows (name / email / phone /
//   notes), inline editing, archive / restore.
//   Lists tab     — customer_lists with title + purpose; expanding a
//   list manages its members.
//
// Sidebar wiring: "Customers" lands on Directory, "Lists" lands on the
// Lists tab, and the "Add new customer" action lands on Directory with
// the new-customer form open.

export default function Customers({ initialTab = "directory", startCreating = false }) {
  const db = useCustomers();
  const [tab, setTab] = useState(initialTab);
  const [creating, setCreating] = useState(startCreating);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const visible = useMemo(() => {
    const source = showArchived ? db.archived : db.customers;
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter(c =>
      (c.name ?? "").toLowerCase().includes(q)
      || (c.email ?? "").toLowerCase().includes(q)
      || (c.phone ?? "").toLowerCase().includes(q)
      || (c.notes ?? "").toLowerCase().includes(q)
    );
  }, [db.customers, db.archived, showArchived, query]);

  return (
    <div className="max-w-[860px] flex flex-col gap-5">
      {/* tabs */}
      <div className="flex items-center gap-1 border-b border-line">
        <Tab
          active={tab === "directory"}
          onClick={() => setTab("directory")}
          label={`Directory · ${db.customers.length}`}
        />
        <Tab
          active={tab === "lists"}
          onClick={() => setTab("lists")}
          label={`Lists · ${db.lists.length}`}
        />
        {tab === "directory" && (
          <button
            onClick={() => setCreating(c => !c)}
            className="ml-auto inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 mb-2 cursor-pointer"
          >
            <Plus size={13} /> New customer
          </button>
        )}
      </div>

      {db.loading ? (
        <div className="text-[12px] text-dim italic">Loading…</div>
      ) : tab === "directory" ? (
        <>
          {creating && (
            <CustomerForm
              onCancel={() => setCreating(false)}
              onSave={async (fields) => {
                await db.createCustomer(fields);
                setCreating(false);
              }}
            />
          )}

          {/* search + archived toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-surface border border-line px-3 py-2">
              <Search size={14} className="text-faint shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, phone, notes…"
                className="flex-1 bg-transparent border-0 outline-none text-[13px] text-fg font-[inherit]"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="bg-transparent border-0 p-0 text-muted hover:text-fg cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowArchived(s => !s)}
              className={
                "shrink-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-2 border cursor-pointer " +
                (showArchived
                  ? "bg-surface-alt text-fg border-line"
                  : "bg-transparent text-dim border-line hover:text-fg")
              }
            >
              Archived · {db.archived.length}
            </button>
          </div>

          {visible.length === 0 ? (
            <div className="bg-surface border border-line px-6 py-10 text-center">
              <Users size={20} className="text-faint mx-auto mb-3" />
              <div className="text-[13px] text-muted">
                {query
                  ? "No customers match that search."
                  : showArchived
                    ? "Nothing archived."
                    : "No customers yet — add the first one."}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-px bg-line border border-line">
              {visible.map(c => (
                <CustomerRow key={c.id} customer={c} db={db} />
              ))}
            </div>
          )}
        </>
      ) : (
        <ListsTab db={db} />
      )}
    </div>
  );
}

function Tab({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={
        "bg-transparent border-0 font-[inherit] text-[12px] font-semibold " +
        "uppercase tracking-[0.12em] px-3 pb-2 pt-1 cursor-pointer " +
        (active
          ? "text-fg shadow-[inset_0_-2px_0_0_var(--c-accent)]"
          : "text-dim hover:text-fg")
      }
    >
      {label}
    </button>
  );
}

// ── directory ─────────────────────────────────────────────────────────

function CustomerRow({ customer: c, db }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <CustomerForm
        initial={c}
        onCancel={() => setEditing(false)}
        onSave={async (fields) => {
          await db.updateCustomer(c.id, fields);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="bg-surface px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-fg truncate">
          {c.displayName}
        </div>
        <div className="text-[11px] text-dim mt-0.5 flex items-center gap-3 flex-wrap">
          {c.email && c.name && (
            <span className="inline-flex items-center gap-1">
              <Mail size={11} className="shrink-0" /> {c.email}
            </span>
          )}
          {c.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone size={11} className="shrink-0" /> {c.phone}
            </span>
          )}
          {c.notes && <span className="text-faint truncate">{c.notes}</span>}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <RowAction title="Edit" onClick={() => setEditing(true)}>
          <Pencil size={13} />
        </RowAction>
        {c.archivedAt ? (
          <>
            <RowAction
              title="Restore"
              onClick={() => db.unarchiveCustomer(c.id).catch(() => {})}
            >
              <ArchiveRestore size={13} />
            </RowAction>
            <RowAction
              title="Delete forever"
              warn
              onClick={() => {
                if (!window.confirm(
                  `Delete ${c.displayName} forever? They also drop off ` +
                  "every list.")) return;
                db.removeCustomer(c.id).catch(() => {});
              }}
            >
              <Trash2 size={13} />
            </RowAction>
          </>
        ) : (
          <RowAction
            title="Archive"
            onClick={() => db.archiveCustomer(c.id).catch(() => {})}
          >
            <Archive size={13} />
          </RowAction>
        )}
      </div>
    </div>
  );
}

function RowAction({ title, onClick, warn = false, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={
        "bg-transparent border-0 p-1.5 cursor-pointer " +
        (warn ? "text-muted hover:text-warn" : "text-muted hover:text-fg")
      }
    >
      {children}
    </button>
  );
}

function CustomerForm({ initial = null, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const inputCls =
    "bg-bg border border-line text-fg text-[13px] px-2.5 py-2 outline-none " +
    "focus:border-accent font-[inherit] w-full";

  const submit = async () => {
    setPending(true);
    setErrorMsg(null);
    try {
      await onSave({ name, email, phone, notes });
    } catch (err) {
      // Surface unique-email violations in plain words.
      setErrorMsg(err?.code === "23505"
        ? "A customer with that email already exists."
        : err?.message ?? "Save failed.");
      setPending(false);
    }
  };

  return (
    <div className="bg-surface border border-line p-4 flex flex-col gap-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)}
          className={inputCls} placeholder="Name" autoFocus />
        <input value={email} onChange={(e) => setEmail(e.target.value)}
          className={inputCls} placeholder="Email" type="email" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)}
          className={inputCls} placeholder="Phone" type="tel" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)}
          className={inputCls}
          placeholder="Notes — e.g. egg drop regular, 2 dozen/week" />
      </div>
      {errorMsg && <div className="text-[11px] text-warn">{errorMsg}</div>}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={pending}
          className="bg-transparent border border-line text-dim font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={pending}
          className="bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50"
        >
          {pending ? "Saving…" : initial ? "Save" : "Add customer"}
        </button>
      </div>
    </div>
  );
}

// ── lists ─────────────────────────────────────────────────────────────

function ListsTab({ db }) {
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);

  return (
    <div className="flex flex-col gap-3">
      {db.lists.length === 0 && !creating && (
        <div className="bg-surface border border-line px-6 py-10 text-center">
          <div className="text-[13px] text-muted">
            No lists yet. A list is a named group of customers — a
            mailing list, the egg-drop regulars, wholesale accounts…
          </div>
        </div>
      )}

      {db.lists.map(list => (
        <ListCard
          key={list.id}
          list={list}
          db={db}
          open={openId === list.id}
          onToggle={() => setOpenId(openId === list.id ? null : list.id)}
        />
      ))}

      {creating ? (
        <ListForm
          onCancel={() => setCreating(false)}
          onSave={async (fields) => {
            const id = await db.createList(fields);
            setCreating(false);
            setOpenId(id);
          }}
        />
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center justify-center gap-1.5 bg-surface border border-dashed border-line text-dim hover:text-fg hover:border-accent font-[inherit] text-[12px] font-semibold px-4 py-3 cursor-pointer"
        >
          <Plus size={13} /> New list
        </button>
      )}
    </div>
  );
}

function ListForm({ onSave, onCancel }) {
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="bg-surface border border-line p-4 flex flex-col gap-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        className="bg-bg border border-line text-fg text-[13px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full"
        placeholder="List title — e.g. Egg drop customers"
      />
      <input
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        className="bg-bg border border-line text-fg text-[12px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full"
        placeholder="Purpose (optional) — what this list is for"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={pending}
          className="bg-transparent border border-line text-dim font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            if (!title.trim()) return;
            setPending(true);
            try { await onSave({ title, purpose }); }
            catch { setPending(false); }
          }}
          disabled={pending}
          className="bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50"
        >
          Create list
        </button>
      </div>
    </div>
  );
}

function ListCard({ list, db, open, onToggle }) {
  const [adding, setAdding] = useState("");

  const members = useMemo(
    () => db.customers.filter(c => list.memberIds.has(c.id)),
    [db.customers, list.memberIds]
  );
  const nonMembers = useMemo(
    () => db.customers.filter(c => !list.memberIds.has(c.id)),
    [db.customers, list.memberIds]
  );

  return (
    <section className="bg-surface border border-line">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-0 cursor-pointer font-[inherit] text-left"
      >
        {open
          ? <ChevronDown size={14} className="text-dim shrink-0" />
          : <ChevronRight size={14} className="text-dim shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="font-heading text-[15px] font-semibold text-fg">
            {list.title}
          </div>
          {list.purpose && (
            <div className="text-[11px] text-dim mt-0.5">{list.purpose}</div>
          )}
        </div>
        <span className="shrink-0 text-[11px] text-muted">
          {list.memberCount} member{list.memberCount === 1 ? "" : "s"}
        </span>
      </button>

      {open && (
        <div className="border-t border-line px-4 py-4 flex flex-col gap-3">
          {/* add member */}
          <div className="flex items-center gap-2">
            <select
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              className="flex-1 bg-bg border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit]"
            >
              <option value="">— add a customer to this list —</option>
              {nonMembers.map(c => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!adding) return;
                db.addToList(list.id, adding).catch(() => {});
                setAdding("");
              }}
              disabled={!adding}
              className="bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50"
            >
              Add
            </button>
          </div>

          {/* members */}
          {members.length === 0 ? (
            <div className="text-[12px] text-faint italic">
              Nobody on this list yet.
            </div>
          ) : (
            <div className="flex flex-col gap-px bg-line border border-line">
              {members.map(c => (
                <div
                  key={c.id}
                  className="bg-bg px-3 py-2 flex items-center gap-2"
                >
                  <span className="text-[12px] text-fg flex-1 min-w-0 truncate">
                    {c.displayName}
                    {c.name && c.email && (
                      <span className="text-faint"> · {c.email}</span>
                    )}
                  </span>
                  <button
                    onClick={() => db.removeFromList(list.id, c.id)
                      .catch(() => {})}
                    title="Remove from list"
                    className="bg-transparent border-0 p-1 text-muted hover:text-warn cursor-pointer shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* danger */}
          <div className="flex justify-end border-t border-line pt-3">
            <button
              onClick={() => {
                if (!window.confirm(
                  `Delete the list "${list.title}"? The customers on it ` +
                  "are not deleted.")) return;
                db.removeList(list.id).catch(() => {});
              }}
              className="inline-flex items-center gap-1.5 bg-transparent border border-line text-warn font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
            >
              <Trash2 size={13} /> Delete list
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
