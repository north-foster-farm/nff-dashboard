import { useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import { useSites } from "../lib/data/useSites.js";

// BatchPicker (Batch 27.6) — the shared "which batch is this about?"
// select, extracted from the Processing workspace's BatchAssignSection
// (Batch 20) so the EventEditor can offer the same picker when a
// processing-day event is created or edited.
//
// Pure controlled component: `value` is a batch id (or null),
// `onChange` receives the picked batch id (or null). Candidates come
// from useBatchCandidates — every batch of a batch-tracked species,
// annotated with where it currently lives.

export function useBatchCandidates(data) {
  const { placesById, placements } = useSites();
  return useMemo(() => {
    const out = [];
    for (const sp of data?.livestock?.species ?? []) {
      if (sp.trackingModel !== "batch") continue;
      for (const g of sp.groups ?? []) {
        const placement = (placements ?? []).find(
          (p) => p.occupantType === "batch"
            && p.occupantId === g.id
            && !p.movedOut
        );
        const place = placement ? placesById?.get(placement.placeId) : null;
        out.push({
          id: g.id,
          label: `${sp.name} — ${g.label}`,
          batchLabel: g.label,
          speciesId: sp.id,
          count: g.count,
          placeName: place?.name ?? null,
        });
      }
    }
    return out;
  }, [data, placements, placesById]);
}

// Keep event_links in sync with a batch assignment: one batch link per
// processing series — retarget the existing link or create it. Moved
// verbatim from Processing.jsx's onAssign so both pickers write the
// same rows.
export async function syncBatchLink(seriesId, batchId) {
  const { data: existing, error: qErr } = await supabase
    .from("event_links")
    .select("id, target_id")
    .eq("series_id", seriesId)
    .eq("target_type", "batch");
  if (qErr) throw qErr;
  if (existing && existing.length > 0) {
    const { error: uErr } = await supabase
      .from("event_links")
      .update({ target_id: batchId, role: "processing" })
      .eq("id", existing[0].id);
    if (uErr) throw uErr;
  } else {
    const { error: iErr } = await supabase
      .from("event_links")
      .insert({
        series_id: seriesId,
        target_type: "batch",
        target_id: batchId,
        role: "processing",
      });
    if (iErr) throw iErr;
  }
}

export default function BatchPicker({
  candidates, value, onChange, disabled = false,
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className="bg-surface border border-line text-fg text-[13px] px-3 py-2 outline-none focus:border-accent font-[inherit] disabled:opacity-50 min-w-[220px]"
    >
      <option value="">— no batch assigned —</option>
      {candidates.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
          {c.count != null ? ` (${c.count} birds)` : ""}
          {c.placeName ? ` · ${c.placeName}` : ""}
        </option>
      ))}
    </select>
  );
}
