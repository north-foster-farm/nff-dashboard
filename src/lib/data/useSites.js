import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "../supabase.js";

// Loads sites + site_locations + site_residents in one hook so the
// admin can render the full tree, and consumers elsewhere (Rounds,
// observations) can resolve any of the three from a single source.
//
// Sites are user-creatable parent categories (Brooders, Mobile coops,
// Barn, Wash & pack…). Locations are specific instances within a site
// (Brooder #1, Hay room, Egg station). Residents are livestock_groups
// bound to a location for a date range.
//
// Returned shape:
//   {
//     sites: [{ id, name, description, sortOrder, isActive }],
//     locations: [{ id, siteId, name, sortOrder, isActive, hasResidents }],
//     locationsBySiteId: Map<siteId, locations[]>,
//     residents: [{ id, locationId, livestockGroupId, movedIn, movedOut, notes }],
//     residentsByLocationId: Map<locationId, residents[]>,
//     loading, error,
//     createSite({ name, description? }) -> site,
//     updateSite(id, patch) -> void,
//     deleteSite(id) -> void,
//     reorderSites(idsInOrder) -> void,
//     createLocation({ siteId, name, hasResidents? }) -> location,
//     updateLocation(id, patch) -> void,
//     deleteLocation(id) -> void,
//     reorderLocations(siteId, idsInOrder) -> void,
//     assignResident(locationId, livestockGroupId, movedIn?) -> resident,
//     moveOutResident(residentId, movedOut?) -> void,
//     updateResident(residentId, patch) -> void,
//   }
//
// All mutations apply optimistically to local state first (so the UI
// never lags the round-trip) then write to Postgres in parallel where
// it matters (reorders especially).

export function useSites() {
  const instanceId = useId();
  const [sites, setSites] = useState(null);
  const [locations, setLocations] = useState(null);
  const [residents, setResidents] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([
      supabase.from("sites")
        .select("id, name, description, sort_order, is_active")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("site_locations")
        .select("id, site_id, name, sort_order, is_active, has_residents")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("site_residents")
        .select("id, location_id, livestock_group_id, moved_in, moved_out, notes")
        .order("moved_in", { ascending: false }),
    ]).then(([sitesRes, locsRes, resRes]) => {
      if (cancelled) return;
      if (sitesRes.error) {
        setError(sitesRes.error);
        setSites([]); setLocations([]); setResidents([]);
        return;
      }
      if (locsRes.error) {
        setError(locsRes.error);
        setSites(sitesRes.data ?? []);
        setLocations([]); setResidents([]);
        return;
      }
      if (resRes.error) {
        setError(resRes.error);
        setSites(sitesRes.data ?? []);
        setLocations(locsRes.data ?? []);
        setResidents([]);
        return;
      }
      setSites(sitesRes.data ?? []);
      setLocations(locsRes.data ?? []);
      setResidents(resRes.data ?? []);
    });
    return () => { cancelled = true; };
  }, []);

  // Realtime: refetch on any change. Cheap because rows are small.
  useEffect(() => {
    let scheduled = false;
    const refresh = async () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const [s, l, r] = await Promise.all([
          supabase.from("sites")
            .select("id, name, description, sort_order, is_active, default_has_residents")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
          supabase.from("site_locations")
            .select("id, site_id, name, sort_order, is_active, has_residents")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
          supabase.from("site_residents")
            .select("id, location_id, livestock_group_id, moved_in, moved_out, notes")
            .order("moved_in", { ascending: false }),
        ]);
        if (!s.error) setSites(s.data ?? []);
        if (!l.error) setLocations(l.data ?? []);
        if (!r.error) setResidents(r.data ?? []);
      }, 80);
    };
    const channel = supabase
      .channel(`sites:stream:${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sites" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_locations" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_residents" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId]);

  const shaped = useMemo(() => {
    const siteList = (sites ?? []).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      sortOrder: s.sort_order,
      isActive: s.is_active,
    }));
    const locationList = (locations ?? []).map(l => ({
      id: l.id,
      siteId: l.site_id,
      name: l.name,
      sortOrder: l.sort_order,
      isActive: l.is_active,
      hasResidents: l.has_residents,
    }));
    const locationsBySiteId = new Map();
    for (const l of locationList) {
      if (!locationsBySiteId.has(l.siteId)) locationsBySiteId.set(l.siteId, []);
      locationsBySiteId.get(l.siteId).push(l);
    }
    const residentList = (residents ?? []).map(r => ({
      id: r.id,
      locationId: r.location_id,
      livestockGroupId: r.livestock_group_id,
      movedIn: r.moved_in,
      movedOut: r.moved_out,
      notes: r.notes,
    }));
    const residentsByLocationId = new Map();
    for (const r of residentList) {
      if (!residentsByLocationId.has(r.locationId)) residentsByLocationId.set(r.locationId, []);
      residentsByLocationId.get(r.locationId).push(r);
    }
    return { siteList, locationList, locationsBySiteId, residentList, residentsByLocationId };
  }, [sites, locations, residents]);

  // ── Site mutations ────────────────────────────────────────────────
  const createSite = useCallback(async ({ name, description = null } = {}) => {
    if (!name?.trim()) throw new Error("Site needs a name.");
    const sort_order = (sites ?? []).reduce((m, s) => Math.max(m, s.sort_order), 0) + 1;
    const { data: created, error: err } = await supabase
      .from("sites")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        sort_order,
      })
      .select()
      .single();
    if (err) throw err;
    setSites((prev) => prev ? [...prev, created] : prev);
    return created;
  }, [sites]);

  const updateSite = useCallback(async (id, patch) => {
    const dbPatch = {};
    if (typeof patch.name === "string") dbPatch.name = patch.name.trim();
    if ("description" in patch) dbPatch.description = patch.description?.trim() || null;
    if (typeof patch.sortOrder === "number") dbPatch.sort_order = patch.sortOrder;
    if (typeof patch.isActive === "boolean") dbPatch.is_active = patch.isActive;
    const prev = sites ? [...sites] : null;
    setSites((cur) =>
      cur ? cur.map(s => s.id === id ? { ...s, ...dbPatch } : s) : cur
    );
    const { error: err } = await supabase
      .from("sites").update(dbPatch).eq("id", id);
    if (err) {
      setSites(prev); // revert on failure
      throw err;
    }
  }, [sites]);

  const deleteSite = useCallback(async (id) => {
    const prev = sites ? [...sites] : null;
    setSites((cur) =>
      cur ? cur.map(s => s.id === id ? { ...s, is_active: false } : s) : cur
    );
    const { error: err } = await supabase
      .from("sites").update({ is_active: false }).eq("id", id);
    if (err) {
      setSites(prev);
      throw err;
    }
  }, [sites]);

  const reorderSites = useCallback(async (idsInOrder) => {
    const prev = sites ? [...sites] : null;
    setSites((cur) => {
      if (!cur) return cur;
      const orderIdx = new Map(idsInOrder.map((id, i) => [id, i + 1]));
      return cur.map(s =>
        orderIdx.has(s.id) ? { ...s, sort_order: orderIdx.get(s.id) } : s
      );
    });
    // Parallel writes — was sequential and laggy.
    const results = await Promise.all(idsInOrder.map((id, i) =>
      supabase.from("sites").update({ sort_order: i + 1 }).eq("id", id)
    ));
    const failed = results.find(r => r.error);
    if (failed) {
      setSites(prev);
      throw failed.error;
    }
  }, [sites]);

  // ── Location mutations ────────────────────────────────────────────
  const createLocation = useCallback(async ({ siteId, name, hasResidents = true } = {}) => {
    if (!siteId) throw new Error("Location needs a site.");
    if (!name?.trim()) throw new Error("Location needs a name.");
    const inSite = (locations ?? []).filter(l => l.site_id === siteId);
    const sort_order = inSite.reduce((m, l) => Math.max(m, l.sort_order), 0) + 1;
    const { data: created, error: err } = await supabase
      .from("site_locations")
      .insert({
        site_id: siteId,
        name: name.trim(),
        sort_order,
        has_residents: hasResidents,
      })
      .select()
      .single();
    if (err) throw err;
    setLocations((prev) => prev ? [...prev, created] : prev);
    return created;
  }, [locations]);

  const updateLocation = useCallback(async (id, patch) => {
    const dbPatch = {};
    if (typeof patch.name === "string") dbPatch.name = patch.name.trim();
    if (typeof patch.sortOrder === "number") dbPatch.sort_order = patch.sortOrder;
    if (typeof patch.isActive === "boolean") dbPatch.is_active = patch.isActive;
    if (typeof patch.hasResidents === "boolean") dbPatch.has_residents = patch.hasResidents;
    const prev = locations ? [...locations] : null;
    setLocations((cur) =>
      cur ? cur.map(l => l.id === id ? { ...l, ...dbPatch } : l) : cur
    );
    const { error: err } = await supabase
      .from("site_locations").update(dbPatch).eq("id", id);
    if (err) {
      setLocations(prev);
      throw err;
    }
  }, [locations]);

  const deleteLocation = useCallback(async (id) => {
    const prev = locations ? [...locations] : null;
    setLocations((cur) =>
      cur ? cur.map(l => l.id === id ? { ...l, is_active: false } : l) : cur
    );
    const { error: err } = await supabase
      .from("site_locations").update({ is_active: false }).eq("id", id);
    if (err) {
      setLocations(prev);
      throw err;
    }
  }, [locations]);

  const reorderLocations = useCallback(async (siteId, idsInOrder) => {
    const prev = locations ? [...locations] : null;
    setLocations((cur) => {
      if (!cur) return cur;
      const orderIdx = new Map(idsInOrder.map((id, i) => [id, i + 1]));
      return cur.map(l =>
        l.site_id === siteId && orderIdx.has(l.id)
          ? { ...l, sort_order: orderIdx.get(l.id) }
          : l
      );
    });
    const results = await Promise.all(idsInOrder.map((id, i) =>
      supabase.from("site_locations").update({ sort_order: i + 1 }).eq("id", id)
    ));
    const failed = results.find(r => r.error);
    if (failed) {
      setLocations(prev);
      throw failed.error;
    }
  }, [locations]);

  // ── Resident mutations ────────────────────────────────────────────
  const assignResident = useCallback(async (locationId, livestockGroupId, movedIn = null) => {
    const today = new Date().toISOString().slice(0, 10);
    // Close any current assignment for this group to satisfy the
    // partial unique index (one current site per group).
    await supabase.from("site_residents")
      .update({ moved_out: today })
      .eq("livestock_group_id", livestockGroupId)
      .is("moved_out", null);
    const { data: created, error: err } = await supabase
      .from("site_residents")
      .insert({
        location_id: locationId,
        livestock_group_id: livestockGroupId,
        moved_in: movedIn || today,
      })
      .select()
      .single();
    if (err) throw err;
    setResidents((prev) => prev ? [...prev, created] : prev);
    return created;
  }, []);

  const moveOutResident = useCallback(async (residentId, movedOut = null) => {
    const moved_out = movedOut || new Date().toISOString().slice(0, 10);
    const prev = residents ? [...residents] : null;
    setResidents((cur) =>
      cur ? cur.map(r => r.id === residentId ? { ...r, moved_out } : r) : cur
    );
    const { error: err } = await supabase
      .from("site_residents").update({ moved_out }).eq("id", residentId);
    if (err) {
      setResidents(prev);
      throw err;
    }
  }, [residents]);

  const updateResident = useCallback(async (residentId, patch) => {
    const dbPatch = {};
    if (typeof patch.movedIn === "string") dbPatch.moved_in = patch.movedIn || null;
    if ("movedOut" in patch) dbPatch.moved_out = patch.movedOut || null;
    if ("notes" in patch) dbPatch.notes = patch.notes || null;
    const prev = residents ? [...residents] : null;
    setResidents((cur) =>
      cur ? cur.map(r => r.id === residentId ? { ...r, ...dbPatch } : r) : cur
    );
    const { error: err } = await supabase
      .from("site_residents").update(dbPatch).eq("id", residentId);
    if (err) {
      setResidents(prev);
      throw err;
    }
  }, [residents]);

  return {
    sites: shaped.siteList,
    locations: shaped.locationList,
    locationsBySiteId: shaped.locationsBySiteId,
    residents: shaped.residentList,
    residentsByLocationId: shaped.residentsByLocationId,
    loading: sites === null || locations === null || residents === null,
    error,
    createSite,
    updateSite,
    deleteSite,
    reorderSites,
    createLocation,
    updateLocation,
    deleteLocation,
    reorderLocations,
    assignResident,
    moveOutResident,
    updateResident,
  };
}
