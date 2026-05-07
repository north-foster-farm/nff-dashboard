import { useMemo, useState } from "react";
import {
  Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight, GripVertical,
} from "lucide-react";
import {
  DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable,
  arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useChoreGroups } from "../lib/data/useChoreGroups.js";
import {
  getAllChoreDefinitions, CHORE_CATEGORIES,
  displayStartTime, describeFrequency,
} from "../lib/chores.js";

// "Groups" tab inside the Chores page. Lists every chore_group with its
// members; supports create / rename / delete and inline membership
// editing. Each group renders as an always-visible header + an editor
// that can be expanded to manage membership.
//
// One-to-one membership is enforced by the schema (unique chore_id), so
// adding a chore that already lives in another group moves it.

export default function ChoreGroupsTab({ data }) {
  const {
    groups, groupByChoreId, loading,
    createGroup, updateGroup, deleteGroup,
    addMember, removeMember,
    reorderGroups, reorderMembers,
  } = useChoreGroups();
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  const allChores = useMemo(() => getAllChoreDefinitions(data), [data]);

  // ── Drag-and-drop sensors (mouse + keyboard) ──────────────────────────
  // PointerSensor keeps the input usable for non-drag interactions —
  // 6px activation distance so a click on a button doesn't trigger a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleGroupDragEnd = (e) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = groups.findIndex(g => g.id === active.id);
    const newIdx = groups.findIndex(g => g.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const newOrder = arrayMove(groups, oldIdx, newIdx).map(g => g.id);
    reorderGroups(newOrder).catch(reportErr);
  };

  const submitNewGroup = async () => {
    const name = draftName.trim();
    if (!name) { setCreating(false); return; }
    try {
      await createGroup({ name });
    } catch (err) {
      reportErr(err);
    }
    setDraftName("");
    setCreating(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <p className="text-[12px] text-dim m-0 max-w-[560px] leading-relaxed">
          A chore group is a set of chores that get done at the same time and
          place. Group rendering is the default everywhere chores appear so
          a group of related tasks reads as one unit.
        </p>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold px-3 py-1.5 cursor-pointer uppercase tracking-[0.12em]"
          >
            <Plus size={14} /> New group
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-surface-alt border border-line p-3 mb-5 flex items-center gap-2">
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewGroup();
              if (e.key === "Escape") { setDraftName(""); setCreating(false); }
            }}
            placeholder="Group name (e.g. Layer-coop morning)"
            className="flex-1 bg-surface text-fg border border-line px-2 py-1.5 outline-none focus:border-accent text-[13px] font-[inherit]"
          />
          <button
            onClick={submitNewGroup}
            className="text-muted hover:text-accent p-1 cursor-pointer bg-transparent border-0"
            aria-label="Create"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => { setDraftName(""); setCreating(false); }}
            className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-surface border border-line py-8 text-center text-[12px] text-muted uppercase tracking-[0.16em]">
          Loading groups…
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-surface border border-line py-10 px-6 text-center">
          <div className="text-[13px] text-muted font-medium mb-1">No chore groups yet</div>
          <div className="text-[12px] text-faint leading-relaxed max-w-[420px] mx-auto">
            Create a group to bundle related chores. Once they're grouped, the
            schedule and Chores page render them as one unit.
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleGroupDragEnd}
        >
          <SortableContext
            items={groups.map(g => g.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="m-0 p-0 list-none flex flex-col gap-3">
              {groups.map((g) => (
                <SortableGroupCard
                  key={g.id}
                  group={g}
                  allChores={allChores}
                  groupByChoreId={groupByChoreId}
                  onUpdate={updateGroup}
                  onDelete={deleteGroup}
                  onAddMember={addMember}
                  onRemoveMember={removeMember}
                  onReorderMembers={reorderMembers}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableGroupCard(props) {
  const {
    attributes, listeners,
    setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: props.group.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <GroupCard
      {...props}
      sortableRef={setNodeRef}
      sortableStyle={style}
      sortableHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

function GroupCard({
  group, allChores, groupByChoreId,
  onUpdate, onDelete, onAddMember, onRemoveMember, onReorderMembers,
  sortableRef, sortableStyle, sortableHandleProps,
}) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(group.name);

  // Members shown in their stored sort_order — chores.filter() keeps the
  // order of `allChores`, so build the list by walking `group.members`
  // (which the hook already returned ordered) instead.
  const memberIds = useMemo(
    () => new Set(group.members.map(m => m.choreId)),
    [group.members]
  );
  const choreById = useMemo(() => {
    const m = new Map();
    for (const c of allChores) m.set(c.id, c);
    return m;
  }, [allChores]);
  const memberChores = useMemo(
    () => group.members
      .map(m => choreById.get(m.choreId))
      .filter(Boolean),
    [group.members, choreById]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleMemberDragEnd = (e) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = memberChores.map(c => c.id);
    const oldIdx = ids.indexOf(active.id);
    const newIdx = ids.indexOf(over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(ids, oldIdx, newIdx);
    onReorderMembers(group.id, next).catch(reportErr);
  };

  const submitRename = async () => {
    const name = draftName.trim();
    if (!name || name === group.name) { setRenaming(false); setDraftName(group.name); return; }
    try { await onUpdate(group.id, { name }); }
    catch (err) { reportErr(err); }
    setRenaming(false);
  };

  const removeFromThisGroup = async (choreId) => {
    try { await onRemoveMember(choreId); } catch (err) { reportErr(err); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete the group "${group.name}"? Members will become ungrouped.`)) return;
    try { await onDelete(group.id); } catch (err) { reportErr(err); }
  };

  return (
    <li ref={sortableRef} style={sortableStyle} className="bg-surface border border-line">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
        <button
          {...sortableHandleProps}
          aria-label="Drag to reorder group"
          title="Drag to reorder"
          className="text-muted hover:text-fg p-1 cursor-grab active:cursor-grabbing bg-transparent border-0 touch-none"
        >
          <GripVertical size={14} />
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          {renaming ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") { setRenaming(false); setDraftName(group.name); }
              }}
              className="bg-surface-alt text-fg border border-line px-2 py-0.5 outline-none focus:border-accent text-[14px] font-[inherit] min-w-[200px]"
            />
          ) : (
            <button
              onClick={() => setRenaming(true)}
              className="text-fg font-medium text-[14px] bg-transparent border-0 p-0 cursor-pointer text-left"
              title="Rename"
            >
              {group.name}
            </button>
          )}
        </div>
        <span className="text-[11px] text-muted uppercase tracking-[0.12em] font-semibold">
          {memberChores.length} {memberChores.length === 1 ? "chore" : "chores"}
        </span>
        <button
          onClick={() => setRenaming(true)}
          aria-label="Rename"
          title="Rename"
          className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={handleDelete}
          aria-label="Delete group"
          title="Delete group"
          className="text-muted hover:text-warn p-1 cursor-pointer bg-transparent border-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="p-4 flex flex-col gap-3">
          {memberChores.length === 0 ? (
            <div className="text-[12px] text-faint italic">
              No chores in this group yet — add some below.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleMemberDragEnd}
            >
              <SortableContext
                items={memberChores.map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="m-0 p-0 list-none flex flex-col gap-px bg-line">
                  {memberChores.map((c) => (
                    <SortableMemberRow
                      key={c.id}
                      chore={c}
                      onRemove={() => removeFromThisGroup(c.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          <AddMemberPicker
            groupId={group.id}
            allChores={allChores}
            groupByChoreId={groupByChoreId}
            onAdd={onAddMember}
          />
        </div>
      )}
    </li>
  );
}

function SortableMemberRow({ chore, onRemove }) {
  const {
    attributes, listeners,
    setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: chore.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="bg-surface px-3 py-2 flex items-baseline gap-2"
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        title="Drag to reorder"
        className="text-muted hover:text-fg p-1 cursor-grab active:cursor-grabbing bg-transparent border-0 touch-none -ml-1 self-center"
      >
        <GripVertical size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-fg truncate">{chore.title}</div>
        <div className="text-[12px] text-muted mt-0.5 truncate">
          {CHORE_CATEGORIES[chore.category]?.label ?? chore.category}
          <span className="mx-1.5 text-faint">·</span>
          {describeFrequency(chore)}
          <span className="mx-1.5 text-faint">·</span>
          <span className="[font-variant-numeric:tabular-nums]">
            {displayStartTime(chore)}
          </span>
        </div>
      </div>
      <button
        onClick={onRemove}
        aria-label={`Remove ${chore.title}`}
        title="Remove from group"
        className="text-muted hover:text-warn p-1 cursor-pointer bg-transparent border-0 shrink-0 self-center"
      >
        <X size={13} />
      </button>
    </li>
  );
}

function AddMemberPicker({ groupId, allChores, groupByChoreId, onAdd }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allChores.filter(c => {
      const inGroup = groupByChoreId.get(c.id);
      // Allow "move to this group" — show chores in OTHER groups too,
      // but skip ones already here.
      if (inGroup?.id === groupId) return false;
      if (!q) return true;
      // Match against title + description + tags + category id + category
      // display label so "mobile coops" / "layers" / "weekly" all surface
      // the right chores.
      const haystack = [
        c.title,
        c.description ?? "",
        (c.tags ?? []).join(" "),
        c.category ?? "",
        CHORE_CATEGORIES[c.category]?.label ?? "",
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [allChores, groupByChoreId, query, groupId]);

  const pick = async (choreId) => {
    // Keep the search query and picker open so you can rapidly add several
    // matching chores. The just-added chore drops out of the candidate list
    // automatically because it now lives in this group.
    try { await onAdd(groupId, choreId); }
    catch (err) { reportErr(err); }
  };

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Add a chore to this group…"
        className="w-full bg-surface-alt text-fg border border-line px-2 py-1.5 outline-none focus:border-accent text-[13px] font-[inherit]"
      />
      {open && candidates.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 m-0 p-0 list-none bg-surface border border-line z-10 max-h-[280px] overflow-y-auto no-scrollbar shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          {candidates.map((c) => {
            const otherGroup = groupByChoreId.get(c.id);
            return (
              <li key={c.id}>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c.id)}
                  className="w-full px-3 py-2 text-left bg-transparent hover:bg-row-hover border-0 cursor-pointer"
                >
                  <div className="text-[13px] text-fg truncate">{c.title}</div>
                  <div className="text-[12px] text-muted mt-0.5 truncate">
                    {CHORE_CATEGORIES[c.category]?.label ?? c.category}
                    <span className="mx-1.5 text-faint">·</span>
                    {describeFrequency(c)}
                    <span className="mx-1.5 text-faint">·</span>
                    <span className="[font-variant-numeric:tabular-nums]">
                      {displayStartTime(c)}
                    </span>
                    {otherGroup && (
                      <>
                        <span className="mx-1.5 text-faint">·</span>
                        <span className="italic">moves from "{otherGroup.name}"</span>
                      </>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function reportErr(err) {
  // eslint-disable-next-line no-console
  console.error("[chore-groups]", err);
  alert("That action failed. See console for details.");
}
