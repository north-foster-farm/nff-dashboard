import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";

// LoginGate wraps the entire app and enforces three possible states:
//
//   1. Unauthenticated  → show "Sign in with Google" button
//   2. Authenticated but not on the admins allowlist → show "not authorized"
//      with a sign-out button. Covers the (very unlikely) case where Google
//      hands us a successful session for an email we haven't approved.
//   3. Authenticated + on allowlist → render children (the real app)
//
// Children receive the current Supabase session via the `session` prop so
// downstream components can show the user's email in the sidebar footer, etc.
// A bare `<AuthContext>` is overkill given we only have one consumer.
//
// Resilience rules (the "no surprise sign-outs" contract):
//
//   * The admin RPC runs once per signed-in user, not once per auth
//     event. Token refreshes (hourly) reuse the cached verdict instead
//     of re-hitting the network — a flaky connection during a refresh
//     can no longer bounce an already-authorized user.
//   * A transient RPC failure (network down, DB unreachable) falls back
//     to the last persisted verdict for that user instead of kicking
//     them to the "Not authorized" screen.
//   * Session lifetime itself is server-side: the Supabase project's
//     Auth → Sessions settings control how long a refresh token chain
//     stays valid. Leave time-box / inactivity timeout unset (or ≥ 60
//     days) so signing in once lasts at least 60 days.
export default function LoginGate({ children }) {
  const [state, setState] = useState({ status: "loading", session: null });
  // Last admin verdict per user id — survives token refreshes within
  // this tab. Persisted copy (localStorage) survives reloads.
  const verdictRef = useRef({ userId: null, isAdmin: null });

  useEffect(() => {
    let disposed = false;
    const apply = (next) => {
      if (!disposed) setState(next);
    };

    const resolve = async (session) => {
      if (!session) {
        verdictRef.current = { userId: null, isAdmin: null };
        apply({ status: "signed-out", session: null });
        return;
      }
      const userId = session.user?.id ?? null;
      // Same user, verdict already known → reuse it. This is the path
      // every TOKEN_REFRESHED event takes.
      if (
        verdictRef.current.userId === userId &&
        verdictRef.current.isAdmin !== null
      ) {
        apply({
          status: verdictRef.current.isAdmin ? "authorized" : "not-authorized",
          session,
        });
        return;
      }
      const isAdmin = await checkAdmin(userId);
      if (disposed) return;
      verdictRef.current = { userId, isAdmin };
      apply({ status: isAdmin ? "authorized" : "not-authorized", session });
    };

    // Subscribe first so no auth event can slip between the initial
    // getSession() read and the listener attaching. The listener also
    // receives INITIAL_SESSION, so getSession() below is just a fast
    // path for the very first paint.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // USER_UPDATED / TOKEN_REFRESHED / SIGNED_IN with the same user
      // all flow through resolve(), which short-circuits on the cached
      // verdict. SIGNED_OUT clears it.
      resolve(session);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (disposed) return;
      resolve(data.session);
    });

    return () => {
      disposed = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state.status === "loading") return <Splash label="Loading…" />;
  if (state.status === "signed-out") return <SignInView />;
  if (state.status === "not-authorized") return <NotAuthorizedView session={state.session} />;
  // Authenticated admin — render the app, hand them the session.
  return children(state.session);
}

// ─── Admin check (cached, failure-tolerant) ─────────────────────────────────

const ADMIN_CACHE_KEY = "nff-admin-verdicts";

function readAdminCache() {
  try {
    const raw = localStorage.getItem(ADMIN_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAdminCache(userId, isAdmin) {
  try {
    const cache = readAdminCache();
    cache[userId] = isAdmin;
    localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage unavailable — in-memory verdict still applies.
  }
}

// Runs the is-admin RPC for the given user. On a definitive answer the
// verdict is persisted; on a transient failure (network, DB unreachable)
// we fall back to the persisted verdict so connectivity blips never log
// anyone out. Only a user we've never successfully verified defaults to
// not-authorized.
async function checkAdmin(userId) {
  try {
    const { data, error } = await supabase.rpc("current_user_is_admin");
    if (error) throw error;
    const isAdmin = !!data;
    writeAdminCache(userId, isAdmin);
    return isAdmin;
  } catch (err) {
    console.error("is-admin check failed (using cached verdict):", err);
    const cached = readAdminCache()[userId];
    return cached === true;
  }
}

// ─── Sign-in view ───────────────────────────────────────────────────────────

function SignInView() {
  const [signingIn, setSigningIn] = useState(false);
  const [err, setErr] = useState(null);

  const handleSignIn = async () => {
    setSigningIn(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Come back to whatever origin initiated the sign-in. In dev this is
        // http://localhost:5173; in prod it's https://admin.northfosterfarm.com.
        // Both must be listed in Supabase Auth → URL Configuration.
        redirectTo: window.location.origin,
        // Request all three scopes explicitly. `openid` + `email` are
        // Supabase's defaults; adding `profile` is what causes Google to
        // return the user's display name and avatar URL as OIDC claims,
        // which Supabase then surfaces as avatar_url / picture /
        // full_name on user_metadata. Without this, user_metadata comes
        // back almost empty (just email + sub).
        //
        // Note: we deliberately do NOT pass `prompt=consent` any more.
        // It forced the full Google consent screen on every sign-in,
        // which made each re-auth feel like setting up from scratch.
        // Existing grants already include the profile scope.
        scopes: "openid email profile"
      }
    });
    if (error) {
      setErr(error.message);
      setSigningIn(false);
    }
    // On success, the browser navigates to Google and never returns to this
    // line — we don't clear `signingIn` on the happy path.
  };

  return (
    <Centered>
      <div className="font-heading text-[28px] font-bold text-fg mb-2">
        North Foster Farm
      </div>
      <div className="text-[13px] text-dim mb-8">
        Admin dashboard
      </div>
      <button
        onClick={handleSignIn}
        disabled={signingIn}
        className="bg-accent text-on-accent border-none font-[inherit] font-semibold text-[13px] py-[10px] px-[18px] inline-flex items-center gap-2.5"
        style={{
          cursor: signingIn ? "default" : "pointer",
          opacity: signingIn ? 0.7 : 1,
        }}
      >
        <GoogleGlyph /> {signingIn ? "Redirecting…" : "Sign in with Google"}
      </button>
      {err && (
        <div className="mt-4 text-[12px] text-warn max-w-[360px] text-center">
          {err}
        </div>
      )}
    </Centered>
  );
}

// ─── Not-authorized view ────────────────────────────────────────────────────

function NotAuthorizedView({ session }) {
  const email = session?.user?.email ?? "unknown";
  const handleSignOut = () => supabase.auth.signOut();
  return (
    <Centered>
      <div className="font-heading text-[22px] font-bold text-fg mb-3">
        Not authorized
      </div>
      <div className="text-[13px] text-dim max-w-[380px] text-center mb-6">
        You're signed in as <strong className="text-fg">{email}</strong>, but
        that address isn't on the admin allowlist for this dashboard.
      </div>
      <button
        onClick={handleSignOut}
        className="bg-transparent text-dim border border-line font-[inherit] text-[12px] font-semibold py-2 px-[14px] cursor-pointer uppercase tracking-[0.12em]"
      >
        Sign out
      </button>
    </Centered>
  );
}

// ─── Layout helpers ─────────────────────────────────────────────────────────

function Splash({ label }) {
  return (
    <Centered>
      <div className="text-[12px] text-muted uppercase tracking-[0.18em]">
        {label}
      </div>
    </Centered>
  );
}

function Centered({ children }) {
  return (
    <div className="bg-bg text-fg min-h-screen flex flex-col items-center justify-center font-body p-6">
      {children}
    </div>
  );
}

// Inline Google "G" SVG so we don't pull in another icon library just for
// the sign-in button. Colors match Google's brand palette.
function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.9 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.3 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.3 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35 26.8 36 24 36c-5.3 0-9.8-3.1-11.3-7.5l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2 3.8-3.7 5.1l6.2 5.2C41.9 34 44 29.4 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
