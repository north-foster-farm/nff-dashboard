import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import { buildPlaceTree } from "../places.js";

// Loads the recursive `places` tree + the `placements` occupancy edge in
// one hook so the admin can render/edit the whole tree and consumers
// (Rounds, Chores, Observations) can resolve any place or occupant from
// a single source.
//
// Places form one tree (farm -> zones -> areas -> structures) via
// parent_id. Placements bind an occupant (a livestock batch, a machine,
// …) to a place for a date range; the open row (moved_out IS NULL) is
// where the occupant is now. Replaces the old sites / site_locations /
// site_residents trio.
//
// Also loads livestock_groups + livestock_species (the occupants the
// placements point at), because chore-anchor fan-out (Batch 18 /
// migration 0014) needs to answer "where do the broilers live right
// now?" — that takes places + placements + groups together.
//
// Returned shape:
//   {
//     places: [{ id, parentId, name, kind, kindTag, code, mobile,
//                sortOrder, isActive }],
//     placesById: Map<id, place>,
//     childrenByParent: Map<parentId|null, place[]>,   // sorted
//     roots: place[],
//     placements: [{ id, placeId, occupantType, occupantId, movedIn,
//                    movedOut, notes }],
//     placementsByPlaceId: Map<placeId, placements[]>, // current only
//     placementsByOccupant: Map<"type:id", placements[]>, // open+closed
//     groups: [{ id, speciesId, label, count }],
//     groupsById: Map<id, group>,
//     speciesById: Map<id, { id, name }>,
//     choreCtx: { placesById, childrenByParent, placementsByPlaceId,
//                 groupsById, speciesById },  // pass to
//                                             // obligationPlaceIds /
//                                             // describeChoreAnchor
//     loading, error,
//     createPlace({ parentId, name, kind?, kindTag?, code?, mobile? }),
//     updatePlace(id, patch), deletePlace(id) [soft],
//     reorderPlaces(parentId, idsInOrder), reparentPlace(id, newParentId),
//     assignOccupant(placeId, occupantType, occupantId, movedIn?),
//     moveOutOccupant(placementId, movedOut?),
//     updatePlacement(placementId, patch),
//   }
//
// Mutations apply optimistically to local state then write to Postgres,
// reverting on failure.

const PLACE_COLS =
  "id, parent_id, name, kind, kind_tag, code, mobile, sort_order, is_active";
const PLACEMENT_COLS =
  "id, place_id, occupant_type, occupant_id, moved_in, moved_out, notes";
const GROUP_COLS = "id, species_id, label, count";
const SPECIES_COLS = "id, name";

const today = () => new Date().toISOString().slice(0, 10);

export function useSites() {
  const instanceId = useId();
  const [places, setPlaces] = useState(null);
  const [placements, setPlacements] = useState(null);
  const [groups, setGroups] = useState(null);
  const [species, setSpecies] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([
      supabase
        .from("places")
        .select(PLACE_COLS)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("placements")
        .select(PLACEMENT_COLS)
        .order("moved_in", { ascending: false }),
      supabase.from("livestock_groups").select(GROUP_COLS),
      supabase.from("livestock_species").select(SPECIES_COLS),
    ]).then(([placesRes, placementsRes, groupsRes, speciesRes]) => {
      if (cancelled) return;
      if (placesRes.error) {
        setError(placesRes.error);
        setPlaces([]);
        setPlacements([]);
        setGroups([]);
        setSpecies([]);
        return;
      }
      setPlaces(placesRes.data ?? []);
      if (placementsRes.error) {
        setError(placementsRes.error);
        setPlacements([]);
      } else {
        setPlacements(placementsRes.data ?? []);
      }
      setGroups(groupsRes.error ? [] : groupsRes.data ?? []);
      setSpecies(speciesRes.error ? [] : speciesRes.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime: refetch on any change. Rows are small, so a full refetch
  // is cheaper than reconciling deltas.
  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const [p, pl, g] = await Promise.all([
          supabase
            .from("places")
            .select(PLACE_COLS)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
          supabase
            .from("placements")
            .select(PLACEMENT_COLS)
            .order("moved_in", { ascending: false }),
          supabase.from("livestock_groups").select(GROUP_COLS),
        ]);
        if (!p.error) setPlaces(p.data ?? []);
        if (!pl.error) setPlacements(pl.data ?? []);
        if (!g.error) setGroups(g.data ?? []);
      }, 80);
    };
    const channel = realtimeChannel(`places:stream:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "places" },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "placements" },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "livestock_groups" },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  const shaped = useMemo(() => {
    const placeList = (places ?? []).map((p) => ({
      id: p.id,
      parentId: p.parent_id,
      name: p.name,
      kind: p.kind,
      kindTag: p.kind_tag,
      code: p.code,
      mobile: p.mobile,
      sortOrder: p.sort_order,
      isActive: p.is_active,
    }));
    const { byId, childrenByParent, roots } = buildPlaceTree(placeList);

    const placementList = (placements ?? []).map((r) => ({
      id: r.id,
      placeId: r.place_id,
      occupantType: r.occupant_type,
      occupantId: r.occupant_id,
      movedIn: r.moved_in,
      movedOut: r.moved_out,
      notes: r.notes,
    }));
    const placementsByPlaceId = new Map();
    // History index keyed by occupant ("type:id") — ALL rows, open and
    // closed. Lets callers ask "which places has this batch occupied?"
    // (e.g. brooder-cleanout resolving to the brooder a batch has since
    // left). placementsByPlaceId stays current-only.
    const placementsByOccupant = new Map();
    for (const pl of placementList) {
      const okey = `${pl.occupantType}:${pl.occupantId}`;
      if (!placementsByOccupant.has(okey))
        placementsByOccupant.set(okey, []);
      placementsByOccupant.get(okey).push(pl);
      if (pl.movedOut !== null) continue; // current occupancy only
      if (!placementsByPlaceId.has(pl.placeId))
        placementsByPlaceId.set(pl.placeId, []);
      placementsByPlaceId.get(pl.placeId).push(pl);
    }

    const groupList = (groups ?? []).map((g) => ({
      id: g.id,
      speciesId: g.species_id,
      label: g.label,
      count: g.count,
    }));
    const groupsById = new Map(groupList.map((g) => [g.id, g]));
    const speciesById = new Map(
      (species ?? []).map((s) => [s.id, { id: s.id, name: s.name }])
    );

    return {
      placeList,
      placesById: byId,
      childrenByParent,
      roots,
      placementList,
      placementsByPlaceId,
      placementsByOccupant,
      groupList,
      groupsById,
      speciesById,
      // One bag of lookups for obligationPlaceIds / describeChoreAnchor
      // (lib/chores.js) so call sites don't thread five Maps around.
      choreCtx: {
        placesById: byId,
        childrenByParent,
        placementsByPlaceId,
        placementsByOccupant,
        groupsById,
        speciesById,
      },
    };
  }, [places, placements, groups, species]);

  // ── Place mutations ───────────────────────────────────────────────
  const createPlace = useCallback(
    async ({
      parentId = null,
      name,
      kind = "structure",
      kindTag = null,
      code = null,
      mobile = false,
    } = {}) => {
      if (!name?.trim()) throw new Error("Place needs a name.");
      const siblings = (places ?? []).filter(
        (p) => (p.parent_id ?? null) === (parentId ?? null)
      );
      const sort_order =
        siblings.reduce((m, p) => Math.max(m, p.sort_order), 0) + 1;
      const { data: created, error: err } = await supabase
        .from("places")
        .insert({
          parent_id: parentId,
          name: name.trim(),
          kind,
          kind_tag: kindTag?.trim() || null,
          code: code?.trim() || null,
          mobile: !!mobile,
          sort_order,
        })
        .select(PLACE_COLS)
        .single();
      if (err) throw err;
      setPlaces((prev) => (prev ? [...prev, created] : prev));
      return created;
    },
    [places]
  );

  const updatePlace = useCallback(
    async (id, patch) => {
      const dbPatch = {};
      if (typeof patch.name === "string") dbPatch.name = patch.name.trim();
      if (typeof patch.kind === "string") dbPatch.kind = patch.kind;
      if ("kindTag" in patch) dbPatch.kind_tag = patch.kindTag?.trim() || null;
      if ("code" in patch) dbPatch.code = patch.code?.trim() || null;
      if (typeof patch.mobile === "boolean") dbPatch.mobile = patch.mobile;
      if (typeof patch.sortOrder === "number")
        dbPatch.sort_order = patch.sortOrder;
      if (typeof patch.isActive === "boolean")
        dbPatch.is_active = patch.isActive;
      if ("parentId" in patch) dbPatch.parent_id = patch.parentId;
      const prev = places ? [...places] : null;
      setPlaces((cur) =>
        cur ? cur.map((p) => (p.id === id ? { ...p, ...dbPatch } : p)) : cur
      );
      const { error: err } = await supabase
        .from("places")
        .update(dbPatch)
        .eq("id", id);
      if (err) {
        setPlaces(prev);
        throw err;
      }
    },
    [places]
  );

  const deletePlace = useCallback(
    async (id) => {
      const prev = places ? [...places] : null;
      setPlaces((cur) =>
        cur ? cur.map((p) => (p.id === id ? { ...p, is_active: false } : p)) : cur
      );
      const { error: err } = await supabase
        .from("places")
        .update({ is_active: false })
        .eq("id", id);
      if (err) {
        setPlaces(prev);
        throw err;
      }
    },
    [places]
  );

  const reorderPlaces = useCallback(
    async (parentId, idsInOrder) => {
      const prev = places ? [...places] : null;
      setPlaces((cur) => {
        if (!cur) return cur;
        const orderIdx = new Map(idsInOrder.map((id, i) => [id, i + 1]));
        return cur.map((p) =>
          orderIdx.has(p.id) ? { ...p, sort_order: orderIdx.get(p.id) } : p
        );
      });
      const results = await Promise.all(
        idsInOrder.map((id, i) =>
          supabase.from("places").update({ sort_order: i + 1 }).eq("id", id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed) {
        setPlaces(prev);
        throw failed.error;
      }
    },
    [places]
  );

  const reparentPlace = useCallback(
    (id, newParentId) => updatePlace(id, { parentId: newParentId ?? null }),
    [updatePlace]
  );

  // ── Placement (occupancy) mutations ───────────────────────────────
  const assignOccupant = useCallback(
    async (placeId, occupantType, occupantId, movedIn = null) => {
      if (!placeId) throw new Error("Placement needs a place.");
      if (!occupantType || !occupantId)
        throw new Error("Placement needs an occupant.");
      // Close any open placement for this occupant to satisfy the
      // one-open-row-per-occupant unique index (a move closes the prior
      // row and opens a new one).
      await supabase
        .from("placements")
        .update({ moved_out: today() })
        .eq("occupant_type", occupantType)
        .eq("occupant_id", occupantId)
        .is("moved_out", null);
      const { data: created, error: err } = await supabase
        .from("placements")
        .insert({
          place_id: placeId,
          occupant_type: occupantType,
          occupant_id: occupantId,
          moved_in: movedIn || today(),
        })
        .select(PLACEMENT_COLS)
        .single();
      if (err) throw err;
      // Refetch-free optimistic update: mark prior open rows for this
      // occupant closed locally, then append the new one.
      setPlacements((prev) =>
        prev
          ? [
              ...prev.map((r) =>
                r.occupant_type === occupantType &&
                r.occupant_id === occupantId &&
                r.moved_out === null
                  ? { ...r, moved_out: today() }
                  : r
              ),
              created,
            ]
          : prev
      );
      return created;
    },
    []
  );

  // Open a placement WITHOUT closing the occupant's other open rows —
  // for split occupancy (a batch across N chicken tractors / two
  // brooders at once). The per-(occupant, place) unique index (0039)
  // still blocks a duplicate open row in the same place. Use
  // assignOccupant instead when the occupant moves ENTIRELY to one place.
  const addPlacement = useCallback(
    async (placeId, occupantType, occupantId, movedIn = null) => {
      if (!placeId) throw new Error("Placement needs a place.");
      if (!occupantType || !occupantId)
        throw new Error("Placement needs an occupant.");
      const { data: created, error: err } = await supabase
        .from("placements")
        .insert({
          place_id: placeId,
          occupant_type: occupantType,
          occupant_id: occupantId,
          moved_in: movedIn || today(),
        })
        .select(PLACEMENT_COLS)
        .single();
      if (err) throw err;
      setPlacements((prev) => (prev ? [...prev, created] : prev));
      return created;
    },
    []
  );

  const moveOutOccupant = useCallback(
    async (placementId, movedOut = null) => {
      const moved_out = movedOut || today();
      const prev = placements ? [...placements] : null;
      setPlacements((cur) =>
        cur
          ? cur.map((r) => (r.id === placementId ? { ...r, moved_out } : r))
          : cur
      );
      const { error: err } = await supabase
        .from("placements")
        .update({ moved_out })
        .eq("id", placementId);
      if (err) {
        setPlacements(prev);
        throw err;
      }
    },
    [placements]
  );

  const updatePlacement = useCallback(
    async (placementId, patch) => {
      const dbPatch = {};
      if (typeof patch.movedIn === "string")
        dbPatch.moved_in = patch.movedIn || null;
      if ("movedOut" in patch) dbPatch.moved_out = patch.movedOut || null;
      if ("notes" in patch) dbPatch.notes = patch.notes || null;
      const prev = placements ? [...placements] : null;
      setPlacements((cur) =>
        cur
          ? cur.map((r) => (r.id === placementId ? { ...r, ...dbPatch } : r))
          : cur
      );
      const { error: err } = await supabase
        .from("placements")
        .update(dbPatch)
        .eq("id", placementId);
      if (err) {
        setPlacements(prev);
        throw err;
      }
    },
    [placements]
  );

  return {
    places: shaped.placeList,
    placesById: shaped.placesById,
    childrenByParent: shaped.childrenByParent,
    roots: shaped.roots,
    placements: shaped.placementList,
    placementsByPlaceId: shaped.placementsByPlaceId,
    placementsByOccupant: shaped.placementsByOccupant,
    groups: shaped.groupList,
    groupsById: shaped.groupsById,
    speciesById: shaped.speciesById,
    choreCtx: shaped.choreCtx,
    loading:
      places === null || placements === null ||
      groups === null || species === null,
    error,
    createPlace,
    updatePlace,
    deletePlace,
    reorderPlaces,
    reparentPlace,
    assignOccupant,
    addPlacement,
    moveOutOccupant,
    updatePlacement,
  };
}
