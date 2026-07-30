import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

// Returns the signed-in user's email. Reads the cached session synchronously
// where possible (so the first render doesn't flash undefined), then keeps
// the value in sync via onAuthStateChange. Returns null when there is no
// session — but in this app LoginGate keeps the unauthenticated tree from
// rendering, so consumers can usually treat null as a transient "loading"
// state on first render.
export function useCurrentUserEmail() {
  const [email, setEmail] = useState(() => {
    // supabase.auth.getSession is async, but the JS client also keeps a
    // synchronous reference via auth.session() in some versions. We start
    // with null and let the effect populate.
    return null;
  });

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setEmail(data?.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return email;
}
