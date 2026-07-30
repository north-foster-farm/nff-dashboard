import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { CHORE_SEEDS } from "../../data/choreSeeds.js";

// Tiny shared cache so every consumer (InboxBell, ChoreMessageButton, etc.)
// pays the load cost at most once per session. Resolves to a Map<id, title>.
let cachePromise = null;

function loadChoreTitleMap() {
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    const map = new Map();
    for (const c of CHORE_SEEDS) map.set(c.id, c.title);
    const { data, error } = await supabase
      .from("chore_definitions")
      .select("id, title");
    if (!error && Array.isArray(data)) {
      for (const c of data) map.set(c.id, c.title);
    }
    return map;
  })();
  return cachePromise;
}

// Returns a synchronous `(choreId) => title | null` lookup. Initially backed
// only by the seed file so the very first render isn't blank; the DB results
// are merged in once they arrive.
export function useChoreLookup() {
  const [map, setMap] = useState(() => {
    const m = new Map();
    for (const c of CHORE_SEEDS) m.set(c.id, c.title);
    return m;
  });

  useEffect(() => {
    let cancelled = false;
    loadChoreTitleMap().then(m => { if (!cancelled) setMap(new Map(m)); });
    return () => { cancelled = true; };
  }, []);

  return (id) => (id ? (map.get(id) ?? null) : null);
}
