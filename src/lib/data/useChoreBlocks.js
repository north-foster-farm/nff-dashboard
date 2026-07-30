import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";
import { resolveBlockMinutes } from "../sunTimes.js";

// Loads chore_blocks and exposes CRUD for the Blocks tab on the
// Chores page. A block has a start (fixed clock time, sunrise, or
// sunset) and a duration; end is derived as start + duration. The
// start-side sun events are resolved per-day at render time.
//
// Returned shape:
//   {
//     blocks: [{ id, name, slug, startKind, startMinutes,
//                durationMinutes, sortOrder, isActive }],
//     blocksOrdered: blocks sorted ascending by today's resolved
//                    start minutes — what the UI should render,
//                    rather than the raw sort_order list.
//     blockById: Map<id, block>,
//     blockByName: Map<lowercased name, block>,
//     loading, error,
//     createBlock({ name, startKind, startMinutes, durationMinutes }) -> block,
//     updateBlock(id, patch) -> void,
//     deleteBlock(id) -> void,                // soft delete
//   }
//
// All mutations apply optimistically to local state first, then
// persist; on persistence failure we revert.

const SELECT_COLS =
  "id, name, slug, start_kind, start_minutes, duration_minutes, " +
  "sort_order, is_active";

export function useChoreBlocks() {
  const instanceId = useId();
  const [blocks, setBlocks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    supabase.from("chore_blocks")
      .select(SELECT_COLS)
      .order("sort_order", { ascending: true })
      .order("start_minutes", { ascending: true })
      .then((res) => {
        if (cancelled) return;
        if (res.error) { setError(res.error); setBlocks([]); return; }
        setBlocks(res.data ?? []);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let scheduled = false;
    const refresh = async () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const res = await supabase.from("chore_blocks")
          .select(SELECT_COLS)
          .order("sort_order", { ascending: true })
          .order("start_minutes", { ascending: true });
        if (!res.error) setBlocks(res.data ?? []);
      }, 80);
    };
    const channel = realtimeChannel(`chore_blocks:stream:${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chore_blocks" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId]);

  const shaped = useMemo(() => {
    const list = (blocks ?? []).map(b => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      startKind: b.start_kind,
      startMinutes: b.start_minutes,
      durationMinutes: b.duration_minutes,
      sortOrder: b.sort_order,
      isActive: b.is_active,
    }));
    // Order by today's resolved start minutes ascending — sunrise /
    // sunset land where they actually fall on the clock today.
    const today = new Date();
    const resolveStart = (b) => resolveBlockMinutes(today, b.startKind, b.startMinutes) ?? b.startMinutes ?? 0;
    const ordered = [...list].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return resolveStart(a) - resolveStart(b);
    });
    const byId = new Map(list.map(b => [b.id, b]));
    const byName = new Map(list.map(b => [b.name.toLowerCase(), b]));
    return { list, ordered, byId, byName };
  }, [blocks]);

  const createBlock = useCallback(async (input = {}) => {
    const {
      name,
      startKind = "fixed",
      startMinutes = null,
      durationMinutes = 120,
    } = input;
    if (!name?.trim()) throw new Error("Block needs a name.");
    if (startKind === "fixed" && typeof startMinutes !== "number") {
      throw new Error("Fixed-start blocks need a start time.");
    }
    if (typeof durationMinutes !== "number" || durationMinutes <= 0) {
      throw new Error("Block needs a positive duration.");
    }
    const sort_order = (blocks ?? []).reduce(
      (m, b) => Math.max(m, b.sort_order), 0
    ) + 1;
    const { data: created, error: err } = await supabase
      .from("chore_blocks")
      .insert({
        name: name.trim(),
        start_kind: startKind,
        start_minutes: startKind === "fixed" ? startMinutes : null,
        duration_minutes: durationMinutes,
        sort_order,
      })
      .select()
      .single();
    if (err) throw err;
    setBlocks((prev) => prev ? [...prev, created] : prev);
    return created;
  }, [blocks]);

  const updateBlock = useCallback(async (id, patch) => {
    const dbPatch = {};
    if (typeof patch.name === "string") dbPatch.name = patch.name.trim();
    if (typeof patch.startKind === "string") dbPatch.start_kind = patch.startKind;
    if ("startMinutes" in patch) {
      dbPatch.start_minutes =
        typeof patch.startMinutes === "number" ? patch.startMinutes : null;
    }
    if (typeof patch.durationMinutes === "number") {
      dbPatch.duration_minutes = patch.durationMinutes;
    }
    if (typeof patch.sortOrder === "number") dbPatch.sort_order = patch.sortOrder;
    if (typeof patch.isActive === "boolean") dbPatch.is_active = patch.isActive;
    const prev = blocks ? [...blocks] : null;
    setBlocks((cur) =>
      cur ? cur.map(b => b.id === id ? { ...b, ...dbPatch } : b) : cur
    );
    const { error: err } = await supabase
      .from("chore_blocks").update(dbPatch).eq("id", id);
    if (err) {
      setBlocks(prev);
      throw err;
    }
  }, [blocks]);

  const deleteBlock = useCallback(async (id) => {
    const prev = blocks ? [...blocks] : null;
    setBlocks((cur) =>
      cur ? cur.map(b => b.id === id ? { ...b, is_active: false } : b) : cur
    );
    const { error: err } = await supabase
      .from("chore_blocks").update({ is_active: false }).eq("id", id);
    if (err) {
      setBlocks(prev);
      throw err;
    }
  }, [blocks]);

  return {
    blocks: shaped.list,
    blocksOrdered: shaped.ordered,
    blockById: shaped.byId,
    blockByName: shaped.byName,
    loading: blocks === null,
    error,
    createBlock,
    updateBlock,
    deleteBlock,
  };
}

// ── Helpers reused by the admin and other consumers ──────────────────
export { formatMinutesOfDay, displayBlockSide } from "../sunTimes.js";

// Parse "6:00 AM" / "13:30" / "1:30 PM" / native time-input "06:00"
// into a minutes-of-day integer, or null if unparseable.
export function parseMinutesOfDay(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }
  const m12 = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)$/.exec(trimmed);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = m12[2] ? parseInt(m12[2], 10) : 0;
    const period = m12[3].toLowerCase();
    if (h < 1 || h > 12 || min < 0 || min > 59) return null;
    if (period === "pm" && h !== 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    return h * 60 + min;
  }
  return null;
}

// Convert minutes-of-day into the HH:MM 24-hour string an
// <input type="time"> expects.
export function minutesOfDayToTimeInput(minutes) {
  if (typeof minutes !== "number" || Number.isNaN(minutes)) return "";
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Current clock time as an HH:MM string. Used to default-fill a
// freshly-opened time input when no value was set.
export function nowAsTimeInput() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Resolve a block to today's (startMin, endMin) pair.
// endMin = startMin + durationMinutes, clamped to the same day for
// overlap-comparison purposes (a block running past midnight wraps,
// which is fine for display but treated as same-day for overlap).
export function resolveBlockWindow(date, block) {
  const start = resolveBlockMinutes(date, block.startKind, block.startMinutes);
  if (start === null) return null;
  const end = start + (block.durationMinutes ?? 0);
  return { start, end };
}

// Validation: a block's start resolves to startMin for today; the
// end is start + duration. Reject zero/negative durations and
// overlap with any other active block. Returns either { ok: true } or
// { ok: false, reason }.
export function validateBlockWindow({
  id, startKind, startMinutes, durationMinutes, allBlocks,
}) {
  const today = new Date();
  const start = resolveBlockMinutes(today, startKind, startMinutes);
  if (start === null) {
    return { ok: false, reason: "Couldn't resolve sunrise / sunset for today." };
  }
  if (typeof durationMinutes !== "number" || durationMinutes <= 0) {
    return { ok: false, reason: "Duration must be a positive number of minutes." };
  }
  const end = start + durationMinutes;
  for (const b of allBlocks) {
    if (b.id === id || !b.isActive) continue;
    const bWin = resolveBlockWindow(today, b);
    if (!bWin) continue;
    if (start < bWin.end && end > bWin.start) {
      return {
        ok: false,
        reason: `Overlaps "${b.name}".`,
      };
    }
  }
  return { ok: true };
}
