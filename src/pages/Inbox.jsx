import { useMemo, useState } from "react";
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive, ArchiveRestore, CalendarPlus, Circle, CircleCheck,
  GripVertical, Pin, PinOff, Trash2,
} from "lucide-react";
import { useInboxItems } from "../lib/data/useInboxItems.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";

// The Inbox page (Batch 21) — every captured "just a thought…" with
// creator + creation time, drag-and-drop ordering, pinning (pinned
// items stick to the top, drag-orderable among themselves), archiving
// (+ the Archived tab), and per-user read/unread state.
//
// Capture happens in the TopBar (the lightbulb button) and lands
// here. "Promote to event" hands the thought to the EventEditor with
// the text prefilled — the thought stays in the inbox until someone
// archives it.

export default function Inbox({ onOpenEvent }) {
  const inbox = useInboxItems();
  const userEmail = useCurrentUserEmail();
  const [tab, setTab] = useState("inbox");

  const pinned = useMemo(
    () => inbox.items.filter(i => i.pinned),
    [inbox.items]
  );
  const unpinned = useMemo(
    () => inbox.items.filter(i => !i.pinned),
    [inbox.items]
  );

  return (
    <div className="max-w-[760px] flex flex-col gap-5">
      {/* tabs */}
      <div className="flex items-center gap-1 border-b border-line">
        <Tab
          active={tab === "inbox"}
          onClick={() => setTab("inbox")}
          label={`Inbox · ${inbox.items.length}`}
        />
        <Tab
          active={tab === "archived"}
          onClick={() => setTab("archived")}
          label={`Archived · ${inbox.archived.length}`}
        />
        {inbox.unreadCount > 0 && (
          <span className="ml-auto text-[11px] text-dim pb-2">
            {inbox.unreadCount} unread
          </span>
        )}
      </div>

      {inbox.loading ? (
        <div className="text-[12px] text-dim italic">Loading…</div>
      ) : tab === "inbox" ? (
        <>
          {inbox.items.length === 0 && (
            <EmptyState>
              Nothing captured yet. Use the lightbulb in the top bar to
              drop a thought here — anything that isn't yet a project
              or a chore.
            </EmptyState>
          )}
          {pinned.length > 0 && (
            <ItemGroup
              title="Pinned"
              items={pinned}
              inbox={inbox}
              userEmail={userEmail}
              onOpenEvent={onOpenEvent}
            />
          )}
          {unpinned.length > 0 && (
            <ItemGroup
              title={pinned.length > 0 ? "Everything else" : null}
              items={unpinned}
              inbox={inbox}
              userEmail={userEmail}
              onOpenEvent={onOpenEvent}
            />
          )}
        </>
      ) : (
        <ArchivedList inbox={inbox} userEmail={userEmail} />
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

function EmptyState({ children }) {
  return (
    <div className="bg-surface border border-line px-6 py-10 text-center">
      <div className="text-[13px] text-muted leading-relaxed max-w-[420px] mx-auto">
        {children}
      </div>
    </div>
  );
}

// One drag-sortable group (pinned / unpinned). Dropping reorders only
// within the group — the hook writes sort_order = index for the
// group's ids.
function ItemGroup({ title, items, inbox, userEmail, onOpenEvent }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Small movement threshold so taps/clicks on buttons inside the
      // row don't start a drag.
      activationConstraint: { distance: 6 },
    })
  );
  const ids = items.map(i => i.id);

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    inbox.reorder(next).catch(() => {});
  };

  return (
    <section className="flex flex-col gap-2">
      {title && (
        <div className="font-ui text-[10px] uppercase tracking-[0.16em] font-semibold text-muted">
          {title}
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="m-0 p-0 list-none flex flex-col gap-1">
            {items.map(item => (
              <SortableItemRow
                key={item.id}
                item={item}
                inbox={inbox}
                userEmail={userEmail}
                onOpenEvent={onOpenEvent}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SortableItemRow({ item, inbox, userEmail, onOpenEvent }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-60 z-10 relative" : ""}
    >
      <ItemRow
        item={item}
        inbox={inbox}
        userEmail={userEmail}
        onOpenEvent={onOpenEvent}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </li>
  );
}

function ItemRow({
  item, inbox, userEmail, onOpenEvent, dragHandleProps, archivedView = false,
}) {
  const read = inbox.isRead(item.id);

  const promote = () => {
    // Hand the thought to the EventEditor prefilled; mark it read so
    // the unread badge doesn't keep counting it.
    onOpenEvent?.({
      mode: "new",
      label: item.body.length > 80
        ? item.body.slice(0, 77) + "…"
        : item.body,
      notes: item.body,
    });
    if (!read) inbox.markRead(item.id).catch(() => {});
  };

  return (
    <div
      className={
        "bg-surface border border-line px-4 py-3 flex items-start gap-3 " +
        (read ? "" : "border-l-2 border-l-accent")
      }
    >
      {dragHandleProps && (
        <span
          {...dragHandleProps}
          className="shrink-0 text-faint hover:text-dim cursor-grab touch-none pt-0.5"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div
          className={
            "text-[13px] leading-relaxed break-words " +
            (read ? "text-fg" : "text-fg font-semibold")
          }
        >
          {item.body}
        </div>
        <div className="text-[10px] text-faint mt-1.5 uppercase tracking-[0.12em]">
          {nameOf(item.createdBy)} · {formatRelative(item.createdAt)}
          {item.pinned && " · pinned"}
          {archivedView && item.archivedAt &&
            ` · archived ${formatRelative(item.archivedAt)}`}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {!archivedView && (
          <>
            <RowAction
              title={read ? "Mark unread" : "Mark read"}
              onClick={() => (read
                ? inbox.markUnread(item.id)
                : inbox.markRead(item.id)
              ).catch(() => {})}
            >
              {read
                ? <CircleCheck size={14} className="text-resolved" />
                : <Circle size={14} />}
            </RowAction>
            <RowAction
              title={item.pinned ? "Unpin" : "Pin to top"}
              onClick={() =>
                inbox.setPinned(item.id, !item.pinned).catch(() => {})}
            >
              {item.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </RowAction>
            <RowAction
              title="Promote to event"
              onClick={promote}
            >
              <CalendarPlus size={14} />
            </RowAction>
            <RowAction
              title="Archive"
              onClick={() => inbox.archive(item.id).catch(() => {})}
            >
              <Archive size={14} />
            </RowAction>
          </>
        )}
        {archivedView && (
          <>
            <RowAction
              title="Restore to inbox"
              onClick={() => inbox.unarchive(item.id).catch(() => {})}
            >
              <ArchiveRestore size={14} />
            </RowAction>
            {item.createdBy === userEmail && (
              <RowAction
                title="Delete forever"
                warn
                onClick={() => inbox.remove(item.id).catch(() => {})}
              >
                <Trash2 size={14} />
              </RowAction>
            )}
          </>
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

function ArchivedList({ inbox, userEmail }) {
  if (inbox.archived.length === 0) {
    return (
      <EmptyState>
        Nothing archived. Archiving a thought moves it here — it can
        always be restored.
      </EmptyState>
    );
  }
  return (
    <ol className="m-0 p-0 list-none flex flex-col gap-1">
      {inbox.archived.map(item => (
        <li key={item.id}>
          <ItemRow
            item={item}
            inbox={inbox}
            userEmail={userEmail}
            archivedView
          />
        </li>
      ))}
    </ol>
  );
}

function nameOf(email) {
  if (!email) return "Someone";
  const local = email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function formatRelative(iso) {
  const t = new Date(iso).getTime();
  const dt = Date.now() - t;
  const m = Math.floor(dt / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}
