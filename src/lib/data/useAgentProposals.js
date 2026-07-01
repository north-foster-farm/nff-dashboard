import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import { useCurrentUserEmail } from "./useCurrentUserEmail.js";

// Agent proposals — the review queue for actions a Claude chat proposes
// via the nff-dashboard MCP server (see mcp/). Each row is a proposed
// create (a project, later events/chores) that James approves or rejects
// on the Proposals page. This hook only reads the queue and moves a
// proposal's status; the actual create-on-approve runs through the real
// domain hook (e.g. useProjects().createProjectTree) so an approved
// proposal is indistinguishable from one built by hand.
//
//   useAgentProposals() → {
//     pending, history, all, pendingCount, loading, error,
//     markApplied(id, appliedRef),  // approve succeeded
//     markFailed(id, message),      // approve threw
//     reject(id, note?),            // discard
//     retry(id),                    // re-open a failed proposal
//   }

const COLS =
  "id, created_at, source, kind, title, summary, payload, status, " +
  "applied_ref, error, reviewed_by, reviewed_at, review_note";

function shape(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    source: r.source,
    kind: r.kind,
    title: r.title,
    summary: r.summary,
    payload: r.payload ?? {},
    status: r.status,
    appliedRef: r.applied_ref,
    error: r.error,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    reviewNote: r.review_note,
  };
}

export function useAgentProposals() {
  const instanceId = useId();
  const userEmail = useCurrentUserEmail();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("agent_proposals")
      .select(COLS)
      .order("created_at", { ascending: false });
    if (err) {
      setError(err);
      return;
    }
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        fetchAll();
      }, 80);
    };
    const channel = realtimeChannel(`agent_proposals:stream:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_proposals" },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId, fetchAll]);

  const all = useMemo(() => (rows ?? []).map(shape), [rows]);
  const pending = useMemo(
    () => all.filter((p) => p.status === "pending"),
    [all]
  );
  const history = useMemo(
    () => all.filter((p) => p.status !== "pending"),
    [all]
  );

  const setStatus = useCallback(
    async (id, patch) => {
      const { error: err } = await supabase
        .from("agent_proposals")
        .update({
          reviewed_by: userEmail,
          reviewed_at: new Date().toISOString(),
          ...patch,
        })
        .eq("id", id);
      if (err) throw err;
      await fetchAll();
    },
    [userEmail, fetchAll]
  );

  const markApplied = useCallback(
    (id, appliedRef) =>
      setStatus(id, {
        status: "applied",
        applied_ref: appliedRef ?? null,
        error: null,
      }),
    [setStatus]
  );

  const markFailed = useCallback(
    (id, message) =>
      setStatus(id, {
        status: "failed",
        error: String(message ?? "").slice(0, 500),
      }),
    [setStatus]
  );

  const reject = useCallback(
    (id, note) =>
      setStatus(id, {
        status: "rejected",
        review_note: (note ?? "").trim() || null,
      }),
    [setStatus]
  );

  // Re-open a failed proposal for another approve attempt (no reviewer
  // stamp — it's going back into the queue, not being acted on).
  const retry = useCallback(
    async (id) => {
      const { error: err } = await supabase
        .from("agent_proposals")
        .update({ status: "pending", error: null })
        .eq("id", id);
      if (err) throw err;
      await fetchAll();
    },
    [fetchAll]
  );

  return {
    all,
    pending,
    history,
    pendingCount: pending.length,
    loading: rows === null,
    error,
    markApplied,
    markFailed,
    reject,
    retry,
  };
}
