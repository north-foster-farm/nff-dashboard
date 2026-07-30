import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";
import { useCurrentUserEmail } from "./useCurrentUserEmail.js";
import { slugify } from "../slug.js";
import {
  computeDependentShifts, dayDelta, progressOf, phaseDone,
} from "../projects.js";

// Projects subsystem hooks (Batch 22).
//
//   useProjects()          → list level: every project + its progress,
//                            create / update / archive / remove.
//   useProject(projectId)  → detail level: one project's full tree
//                            (phases → steps → checklists → items),
//                            links, dependencies, attachments, and
//                            every mutation the detail page + step
//                            modal need.
//
// Both share one fetch-all core (useProjectTables): the farm runs a
// handful of projects at a time, so loading every project table and
// shaping client-side is far simpler than per-project queries — and it
// makes realtime reconciliation a single refetch, same as the other
// data hooks.

const PROJECT_COLS =
  "id, title, description, status, owner_email, started_at, " +
  "target_date, completed_at, notes, created_at, body_md, created_by, " +
  "archived_at, sort_order, updated_at, queue_state, timing_note, " +
  "locked_date, slug";
const PHASE_COLS =
  "id, project_id, title, description, sort_order, start_date, " +
  "target_date, completed_at, locked_date, created_at, updated_at";
const STEP_COLS =
  "id, project_id, phase_id, title, body_md, sort_order, start_date, " +
  "target_date, completed_at, locked_date, assignees, created_at, " +
  "updated_at";
const CHECKLIST_COLS = "id, step_id, title, sort_order, created_at";
const ITEM_COLS =
  "id, checklist_id, body, done_at, sort_order, locked_date, created_at";
const LINK_COLS =
  "id, project_id, target_kind, target_id, label, created_at";
const DEP_COLS =
  "id, project_id, predecessor_step_id, dependent_step_id, " +
  "shift_dependents, created_at";
const ATTACH_COLS =
  "id, project_id, step_id, storage_path, file_name, content_type, " +
  "size_bytes, uploaded_by, created_at";

const TABLES = [
  "projects", "project_phases", "project_steps", "project_checklists",
  "project_checklist_items", "project_links", "project_dependencies",
  "project_attachments",
];

export const STORAGE_BUCKET = "project-files";

// ── Row shaping (snake_case → camelCase) ─────────────────────────────

function shapeProject(r) {
  return {
    id: r.id,
    title: r.title,
    // Immutable URL slug (0047) — derived from the title at create /
    // backfill, never rewritten on retitle so shared links keep working.
    slug: r.slug ?? null,
    description: r.description,
    bodyMd: r.body_md,
    status: r.status,
    ownerEmail: r.owner_email,
    createdBy: r.created_by,
    startedAt: r.started_at,
    targetDate: r.target_date,
    completedAt: r.completed_at,
    notes: r.notes,
    archivedAt: r.archived_at,
    sortOrder: r.sort_order ?? 0,
    // Forced-ranked queue placement: 'ranked' | 'unprioritized'. Done is
    // completedAt; archived is archivedAt — both orthogonal to this.
    queueState: r.queue_state ?? "ranked",
    timingNote: r.timing_note,
    lockedDate: r.locked_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function shapePhase(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description,
    sortOrder: r.sort_order ?? 0,
    startDate: r.start_date,
    targetDate: r.target_date,
    completedAt: r.completed_at,
    lockedDate: r.locked_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function shapeStep(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    phaseId: r.phase_id,
    title: r.title,
    bodyMd: r.body_md,
    sortOrder: r.sort_order ?? 0,
    startDate: r.start_date,
    targetDate: r.target_date,
    completedAt: r.completed_at,
    lockedDate: r.locked_date,
    assignees: Array.isArray(r.assignees) ? r.assignees : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function shapeChecklist(r) {
  return {
    id: r.id,
    stepId: r.step_id,
    title: r.title,
    sortOrder: r.sort_order ?? 0,
    createdAt: r.created_at,
  };
}

function shapeItem(r) {
  return {
    id: r.id,
    checklistId: r.checklist_id,
    body: r.body,
    doneAt: r.done_at,
    sortOrder: r.sort_order ?? 0,
    lockedDate: r.locked_date,
    createdAt: r.created_at,
  };
}

function shapeLink(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    targetKind: r.target_kind,
    targetId: r.target_id,
    label: r.label,
    createdAt: r.created_at,
  };
}

function shapeDependency(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    predecessorStepId: r.predecessor_step_id,
    dependentStepId: r.dependent_step_id,
    shiftDependents: r.shift_dependents,
    createdAt: r.created_at,
  };
}

function shapeAttachment(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    stepId: r.step_id,
    storagePath: r.storage_path,
    fileName: r.file_name,
    contentType: r.content_type,
    sizeBytes: r.size_bytes,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  };
}

const bySort = (a, b) =>
  (a.sortOrder - b.sortOrder)
  || (a.createdAt ?? "").localeCompare(b.createdAt ?? "");

// ── Shared fetch-all core ─────────────────────────────────────────────

function useProjectTables() {
  const instanceId = useId();
  const [tables, setTables] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    const [
      projectsRes, phasesRes, stepsRes, checklistsRes, itemsRes,
      linksRes, depsRes, attachRes,
    ] = await Promise.all([
      supabase.from("projects").select(PROJECT_COLS),
      supabase.from("project_phases").select(PHASE_COLS),
      supabase.from("project_steps").select(STEP_COLS),
      supabase.from("project_checklists").select(CHECKLIST_COLS),
      supabase.from("project_checklist_items").select(ITEM_COLS),
      supabase.from("project_links").select(LINK_COLS),
      supabase.from("project_dependencies").select(DEP_COLS),
      supabase.from("project_attachments").select(ATTACH_COLS),
    ]);
    const failed = [
      projectsRes, phasesRes, stepsRes, checklistsRes, itemsRes,
      linksRes, depsRes, attachRes,
    ].find(r => r.error);
    if (failed) { setError(failed.error); return; }
    setTables({
      projects: (projectsRes.data ?? []).map(shapeProject),
      phases: (phasesRes.data ?? []).map(shapePhase),
      steps: (stepsRes.data ?? []).map(shapeStep),
      checklists: (checklistsRes.data ?? []).map(shapeChecklist),
      items: (itemsRes.data ?? []).map(shapeItem),
      links: (linksRes.data ?? []).map(shapeLink),
      dependencies: (depsRes.data ?? []).map(shapeDependency),
      attachments: (attachRes.data ?? []).map(shapeAttachment),
    });
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 80);
    };
    let channel = realtimeChannel(`projects:stream:${instanceId}`);
    for (const t of TABLES) {
      channel = channel.on("postgres_changes",
        { event: "*", schema: "public", table: t }, refresh);
    }
    channel = channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  return { tables, error, fetchAll };
}

// ── Shared mutation helpers ───────────────────────────────────────────

async function dbInsert(table, row, cols) {
  const { data, error } = await supabase.from(table)
    .insert(row).select(cols).single();
  if (error) throw error;
  return data;
}

async function dbUpdate(table, id, patch) {
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) throw error;
}

async function dbDelete(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

// camelCase patch → snake_case columns, only mapping known keys so a
// stray field never reaches Postgres.
function projectPatch(patch) {
  const out = {};
  if ("title" in patch) out.title = patch.title;
  if ("description" in patch) out.description = patch.description;
  if ("bodyMd" in patch) out.body_md = patch.bodyMd;
  if ("status" in patch) out.status = patch.status;
  if ("ownerEmail" in patch) out.owner_email = patch.ownerEmail;
  if ("startedAt" in patch) out.started_at = patch.startedAt;
  if ("targetDate" in patch) out.target_date = patch.targetDate;
  if ("completedAt" in patch) out.completed_at = patch.completedAt;
  if ("notes" in patch) out.notes = patch.notes;
  if ("archivedAt" in patch) out.archived_at = patch.archivedAt;
  if ("sortOrder" in patch) out.sort_order = patch.sortOrder;
  if ("queueState" in patch) out.queue_state = patch.queueState;
  if ("timingNote" in patch) out.timing_note = patch.timingNote;
  if ("lockedDate" in patch) out.locked_date = patch.lockedDate;
  return out;
}

function phasePatch(patch) {
  const out = {};
  if ("title" in patch) out.title = patch.title;
  if ("description" in patch) out.description = patch.description;
  if ("sortOrder" in patch) out.sort_order = patch.sortOrder;
  if ("startDate" in patch) out.start_date = patch.startDate;
  if ("targetDate" in patch) out.target_date = patch.targetDate;
  if ("completedAt" in patch) out.completed_at = patch.completedAt;
  if ("lockedDate" in patch) out.locked_date = patch.lockedDate;
  return out;
}

function stepPatch(patch) {
  const out = {};
  if ("title" in patch) out.title = patch.title;
  if ("bodyMd" in patch) out.body_md = patch.bodyMd;
  if ("phaseId" in patch) out.phase_id = patch.phaseId;
  if ("sortOrder" in patch) out.sort_order = patch.sortOrder;
  if ("startDate" in patch) out.start_date = patch.startDate;
  if ("targetDate" in patch) out.target_date = patch.targetDate;
  if ("completedAt" in patch) out.completed_at = patch.completedAt;
  if ("lockedDate" in patch) out.locked_date = patch.lockedDate;
  if ("assignees" in patch) out.assignees = patch.assignees;
  return out;
}

// ── useProjects — the list page ───────────────────────────────────────

export function useProjects() {
  const userEmail = useCurrentUserEmail();
  const { tables, error, fetchAll } = useProjectTables();

  const withProgress = useCallback((project) => {
    const phases = (tables?.phases ?? [])
      .filter(p => p.projectId === project.id);
    const steps = (tables?.steps ?? [])
      .filter(s => s.projectId === project.id);
    return {
      ...project,
      progress: progressOf(phases, steps),
      phaseCount: phases.length,
      stepCount: steps.length,
      // The scheduling engine (reflow.js) ranks a project's incomplete
      // steps into the day's gaps, so the list level hydrates them too.
      steps,
    };
  }, [tables]);

  const projects = useMemo(
    () => (tables?.projects ?? [])
      .filter(p => !p.archivedAt)
      .sort(bySort)
      .map(withProgress),
    [tables, withProgress]
  );

  const archived = useMemo(
    () => (tables?.projects ?? [])
      .filter(p => p.archivedAt)
      .sort((a, b) =>
        (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""))
      .map(withProgress),
    [tables, withProgress]
  );

  // The live ranked rank-numbers, used to place a project at the bottom
  // of the forced-ranked list (a new / re-ranked project never claims
  // the #1 focus slot by surprise — it joins at the tail).
  const rankedTailSort = useCallback(() => {
    const sorts = (tables?.projects ?? [])
      .filter(p => p.queueState === "ranked" && !p.archivedAt
        && !p.completedAt)
      .map(p => p.sortOrder);
    return Math.max(0, ...sorts) + 1;
  }, [tables]);

  // Slugs are unique across ALL projects (archived included) — the
  // taken set feeds slugify's -2/-3… collision suffixes.
  const takenSlugs = useCallback(() => new Set(
    (tables?.projects ?? []).map(p => p.slug).filter(Boolean)
  ), [tables]);

  const createProject = useCallback(async ({
    title, description, queueState = "ranked",
  }) => {
    const trimmed = (title ?? "").trim();
    if (!trimmed) throw new Error("Title required.");
    const data = await dbInsert("projects", {
      title: trimmed,
      slug: slugify(trimmed, takenSlugs()),
      description: (description ?? "").trim() || null,
      created_by: userEmail,
      queue_state: queueState,
      sort_order: queueState === "ranked" ? rankedTailSort() : 0,
    }, PROJECT_COLS);
    await fetchAll();
    return data.id;
  }, [userEmail, rankedTailSort, takenSlugs, fetchAll]);

  // Create a whole project in one shot from an approved agent proposal:
  // the project (tail of the ranked queue), and — if steps were proposed
  // — a single phase to hold them plus the steps in order. Reuses the
  // same rank/sort invariants as the piecemeal in-app creates, so an
  // approved proposal is indistinguishable from one built by hand.
  const createProjectTree = useCallback(async ({
    title, description, steps = [],
  }) => {
    const trimmed = (title ?? "").trim();
    if (!trimmed) throw new Error("Title required.");
    const project = await dbInsert("projects", {
      title: trimmed,
      slug: slugify(trimmed, takenSlugs()),
      description: (description ?? "").trim() || null,
      created_by: userEmail,
      queue_state: "ranked",
      sort_order: rankedTailSort(),
    }, PROJECT_COLS);
    const cleanSteps = (steps ?? [])
      .map(s => (typeof s === "string" ? s : s?.title) ?? "")
      .map(s => s.trim())
      .filter(Boolean);
    if (cleanSteps.length) {
      const phase = await dbInsert("project_phases", {
        project_id: project.id,
        title: "Steps",
        sort_order: 0,
      }, PHASE_COLS);
      for (let i = 0; i < cleanSteps.length; i += 1) {
        await dbInsert("project_steps", {
          project_id: project.id,
          phase_id: phase.id,
          title: cleanSteps[i],
          sort_order: i,
        }, STEP_COLS);
      }
    }
    await fetchAll();
    return project.id;
  }, [userEmail, rankedTailSort, takenSlugs, fetchAll]);

  const updateProject = useCallback(async (id, patch) => {
    await dbUpdate("projects", id, projectPatch(patch));
    await fetchAll();
  }, [fetchAll]);

  // Forced rank: write the new total order straight onto sort_order
  // (0..n-1). Cascade is implicit — moving P1 to slot 2 renumbers P2 to
  // the top in the same pass. Caller passes the full ranked-id order.
  const reorderProjects = useCallback(async (idsInOrder) => {
    for (let i = 0; i < idsInOrder.length; i += 1) {
      await dbUpdate("projects", idsInOrder[i], { sort_order: i });
    }
    await fetchAll();
  }, [fetchAll]);

  // Move between the ranked list and the Unprioritized bucket. Entering
  // the ranked list joins at the tail; leaving it just flips the state
  // (rank is meaningless off the list).
  const setQueueState = useCallback(async (id, state) => {
    const patch = { queueState: state };
    if (state === "ranked") patch.sortOrder = rankedTailSort();
    await dbUpdate("projects", id, projectPatch(patch));
    await fetchAll();
  }, [rankedTailSort, fetchAll]);

  const setProjectLocked = useCallback(
    (id, date) => updateProject(id, { lockedDate: date }),
    [updateProject]
  );
  const setTimingNote = useCallback(
    (id, note) => updateProject(id, { timingNote: (note ?? "").trim() || null }),
    [updateProject]
  );

  const archiveProject = useCallback(
    (id) => updateProject(id, { archivedAt: new Date().toISOString() }),
    [updateProject]
  );
  const unarchiveProject = useCallback(
    (id) => updateProject(id, { archivedAt: null }),
    [updateProject]
  );

  const removeProject = useCallback(async (id) => {
    await dbDelete("projects", id);
    await fetchAll();
  }, [fetchAll]);

  return {
    projects,
    archived,
    loading: tables === null,
    error,
    createProject,
    createProjectTree,
    updateProject,
    reorderProjects,
    setQueueState,
    setProjectLocked,
    setTimingNote,
    archiveProject,
    unarchiveProject,
    removeProject,
  };
}

// ── useProject — the detail page + step modal ─────────────────────────

// `projectKey` is a uuid OR a slug (0047) — the URL carries either;
// everything below resolves and works off the real id.
export function useProject(projectKey) {
  const userEmail = useCurrentUserEmail();
  const { tables, error, fetchAll } = useProjectTables();

  const projectId = useMemo(() => {
    const p = (tables?.projects ?? []).find(
      (r) => r.id === projectKey || r.slug === projectKey
    );
    return p?.id ?? projectKey;
  }, [tables, projectKey]);

  // ── Shaping: one project's full tree ────────────────────────────────
  const shaped = useMemo(() => {
    if (!tables) return null;
    const project = tables.projects.find(p => p.id === projectId) ?? null;
    if (!project) return { project: null };

    const phases = tables.phases
      .filter(p => p.projectId === projectId).sort(bySort);
    const steps = tables.steps
      .filter(s => s.projectId === projectId).sort(bySort);
    const dependencies = tables.dependencies
      .filter(d => d.projectId === projectId);
    const links = tables.links
      .filter(l => l.projectId === projectId)
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

    const stepIds = new Set(steps.map(s => s.id));
    const checklistsByStep = new Map();
    for (const cl of tables.checklists) {
      if (!stepIds.has(cl.stepId)) continue;
      const items = tables.items
        .filter(i => i.checklistId === cl.id).sort(bySort);
      const list = checklistsByStep.get(cl.stepId) ?? [];
      list.push({ ...cl, items });
      checklistsByStep.set(cl.stepId, list);
    }
    for (const list of checklistsByStep.values()) list.sort(bySort);

    const attachmentsByStep = new Map();
    const projectAttachments = [];
    for (const att of tables.attachments) {
      if (att.projectId !== projectId) continue;
      if (att.stepId) {
        const list = attachmentsByStep.get(att.stepId) ?? [];
        list.push(att);
        attachmentsByStep.set(att.stepId, list);
      } else {
        projectAttachments.push(att);
      }
    }

    const shapedSteps = steps.map(s => ({
      ...s,
      checklists: checklistsByStep.get(s.id) ?? [],
      attachments: attachmentsByStep.get(s.id) ?? [],
      // Outgoing + incoming dependency edges, from this step's view.
      blocks: dependencies
        .filter(d => d.predecessorStepId === s.id)
        .map(d => d.dependentStepId),
      blockedBy: dependencies
        .filter(d => d.dependentStepId === s.id)
        .map(d => d.predecessorStepId),
    }));

    const shapedPhases = phases.map(p => ({
      ...p,
      done: phaseDone(p, steps),
      steps: shapedSteps.filter(s => s.phaseId === p.id),
    }));

    return {
      project: {
        ...project,
        progress: progressOf(phases, steps),
      },
      phases: shapedPhases,
      steps: shapedSteps,
      links,
      dependencies,
      attachments: projectAttachments,
    };
  }, [tables, projectId]);

  // ── Phase mutations ─────────────────────────────────────────────────
  const createPhase = useCallback(async (fields = {}) => {
    const maxSort = Math.max(
      -1, ...(shaped?.phases ?? []).map(p => p.sortOrder));
    const data = await dbInsert("project_phases", {
      project_id: projectId,
      title: (fields.title ?? "").trim() || "New phase",
      sort_order: maxSort + 1,
    }, PHASE_COLS);
    await fetchAll();
    return data.id;
  }, [projectId, shaped, fetchAll]);

  const updatePhase = useCallback(async (id, patch) => {
    await dbUpdate("project_phases", id, phasePatch(patch));
    await fetchAll();
  }, [fetchAll]);

  const setPhaseDone = useCallback(
    (id, done) => updatePhase(id, {
      completedAt: done ? new Date().toISOString() : null,
    }),
    [updatePhase]
  );

  const reorderPhases = useCallback(async (idsInOrder) => {
    for (let i = 0; i < idsInOrder.length; i += 1) {
      await dbUpdate("project_phases", idsInOrder[i], { sort_order: i });
    }
    await fetchAll();
  }, [fetchAll]);

  const removePhase = useCallback(async (id) => {
    await dbDelete("project_phases", id);
    await fetchAll();
  }, [fetchAll]);

  // ── Step mutations ──────────────────────────────────────────────────
  const createStep = useCallback(async (phaseId, fields = {}) => {
    const phase = (shaped?.phases ?? []).find(p => p.id === phaseId);
    const maxSort = Math.max(-1, ...(phase?.steps ?? []).map(s => s.sortOrder));
    const data = await dbInsert("project_steps", {
      project_id: projectId,
      phase_id: phaseId,
      title: (fields.title ?? "").trim() || "New step",
      sort_order: maxSort + 1,
    }, STEP_COLS);
    await fetchAll();
    return data.id;
  }, [projectId, shaped, fetchAll]);

  // updateStep applies the dependency date-shuffle: when targetDate
  // (or, failing that, startDate) moves and the step has
  // shift_dependents edges, every transitive dependent's dates shift
  // by the same delta. Returns the number of dependent steps shifted.
  const updateStep = useCallback(async (id, patch) => {
    const step = (shaped?.steps ?? []).find(s => s.id === id);
    let shifted = 0;
    if (step) {
      const oldAnchor = step.targetDate ?? step.startDate;
      const patchedTarget = "targetDate" in patch
        ? patch.targetDate : step.targetDate;
      const patchedStart = "startDate" in patch
        ? patch.startDate : step.startDate;
      const newAnchor = patchedTarget ?? patchedStart;
      const delta = oldAnchor && newAnchor
        ? dayDelta(oldAnchor, newAnchor) : 0;
      if (delta !== 0) {
        const plan = computeDependentShifts({
          steps: shaped?.steps ?? [],
          dependencies: shaped?.dependencies ?? [],
          stepId: id,
          deltaDays: delta,
        });
        for (const move of plan) {
          await dbUpdate("project_steps", move.stepId, {
            start_date: move.startDate,
            target_date: move.targetDate,
          });
          shifted += 1;
        }
      }
    }
    await dbUpdate("project_steps", id, stepPatch(patch));
    await fetchAll();
    return shifted;
  }, [shaped, fetchAll]);

  const setStepDone = useCallback(
    (id, done) => updateStep(id, {
      completedAt: done ? new Date().toISOString() : null,
    }),
    [updateStep]
  );

  const reorderSteps = useCallback(async (idsInOrder) => {
    for (let i = 0; i < idsInOrder.length; i += 1) {
      await dbUpdate("project_steps", idsInOrder[i], { sort_order: i });
    }
    await fetchAll();
  }, [fetchAll]);

  const removeStep = useCallback(async (id) => {
    await dbDelete("project_steps", id);
    await fetchAll();
  }, [fetchAll]);

  // ── Checklist mutations ─────────────────────────────────────────────
  const createChecklist = useCallback(async (stepId, title) => {
    const step = (shaped?.steps ?? []).find(s => s.id === stepId);
    const maxSort = Math.max(
      -1, ...(step?.checklists ?? []).map(c => c.sortOrder));
    const data = await dbInsert("project_checklists", {
      step_id: stepId,
      title: (title ?? "").trim() || "Checklist",
      sort_order: maxSort + 1,
    }, CHECKLIST_COLS);
    await fetchAll();
    return data.id;
  }, [shaped, fetchAll]);

  const renameChecklist = useCallback(async (id, title) => {
    await dbUpdate("project_checklists", id, { title });
    await fetchAll();
  }, [fetchAll]);

  const removeChecklist = useCallback(async (id) => {
    await dbDelete("project_checklists", id);
    await fetchAll();
  }, [fetchAll]);

  const createChecklistItem = useCallback(async (checklistId, body) => {
    const trimmed = (body ?? "").trim();
    if (!trimmed) return null;
    const siblings = (tables?.items ?? [])
      .filter(i => i.checklistId === checklistId);
    const maxSort = Math.max(-1, ...siblings.map(i => i.sortOrder));
    const data = await dbInsert("project_checklist_items", {
      checklist_id: checklistId,
      body: trimmed,
      sort_order: maxSort + 1,
    }, ITEM_COLS);
    await fetchAll();
    return data.id;
  }, [tables, fetchAll]);

  const toggleChecklistItem = useCallback(async (id, done) => {
    await dbUpdate("project_checklist_items", id, {
      done_at: done ? new Date().toISOString() : null,
    });
    await fetchAll();
  }, [fetchAll]);

  const updateChecklistItem = useCallback(async (id, body) => {
    await dbUpdate("project_checklist_items", id, { body });
    await fetchAll();
  }, [fetchAll]);

  const removeChecklistItem = useCallback(async (id) => {
    await dbDelete("project_checklist_items", id);
    await fetchAll();
  }, [fetchAll]);

  // ── Link mutations ──────────────────────────────────────────────────
  const addLink = useCallback(async ({ targetKind, targetId, label }) => {
    await dbInsert("project_links", {
      project_id: projectId,
      target_kind: targetKind,
      target_id: targetId,
      label: label ?? null,
    }, LINK_COLS);
    await fetchAll();
  }, [projectId, fetchAll]);

  const removeLink = useCallback(async (id) => {
    await dbDelete("project_links", id);
    await fetchAll();
  }, [fetchAll]);

  // ── Dependency mutations ────────────────────────────────────────────
  const addDependency = useCallback(async ({
    predecessorStepId, dependentStepId, shiftDependents = true,
  }) => {
    await dbInsert("project_dependencies", {
      project_id: projectId,
      predecessor_step_id: predecessorStepId,
      dependent_step_id: dependentStepId,
      shift_dependents: shiftDependents,
    }, DEP_COLS);
    await fetchAll();
  }, [projectId, fetchAll]);

  const removeDependency = useCallback(async (id) => {
    await dbDelete("project_dependencies", id);
    await fetchAll();
  }, [fetchAll]);

  // ── Attachments (Supabase Storage) ──────────────────────────────────
  const uploadAttachment = useCallback(async (file, { stepId = null } = {}) => {
    // Path: <projectId>/<stepId|project>/<timestamp>-<name>. Sanitized
    // so odd filenames can't break out of the prefix.
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${projectId}/${stepId ?? "project"}/` +
      `${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    await dbInsert("project_attachments", {
      project_id: projectId,
      step_id: stepId,
      storage_path: path,
      file_name: file.name,
      content_type: file.type || null,
      size_bytes: file.size ?? null,
      uploaded_by: userEmail,
    }, ATTACH_COLS);
    await fetchAll();
  }, [projectId, userEmail, fetchAll]);

  const removeAttachment = useCallback(async (attachment) => {
    // Best-effort storage delete first; the metadata row goes second so
    // a failed object delete never orphans the row silently.
    const { error: rmErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([attachment.storagePath]);
    if (rmErr) throw rmErr;
    await dbDelete("project_attachments", attachment.id);
    await fetchAll();
  }, [fetchAll]);

  // Signed URL for viewing/downloading a private-bucket object.
  const attachmentUrl = useCallback(async (attachment) => {
    const { data, error: urlErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(attachment.storagePath, 60 * 60);
    if (urlErr) throw urlErr;
    return data.signedUrl;
  }, []);

  // ── Project-level mutations (mirrored from useProjects) ─────────────
  const updateProject = useCallback(async (patch) => {
    await dbUpdate("projects", projectId, projectPatch(patch));
    await fetchAll();
  }, [projectId, fetchAll]);

  const removeProject = useCallback(async () => {
    await dbDelete("projects", projectId);
    // No refetch — the caller navigates away.
  }, [projectId]);

  return {
    project: shaped?.project ?? null,
    phases: shaped?.phases ?? [],
    steps: shaped?.steps ?? [],
    links: shaped?.links ?? [],
    dependencies: shaped?.dependencies ?? [],
    attachments: shaped?.attachments ?? [],
    loading: tables === null,
    error,
    // project
    updateProject, removeProject,
    // phases
    createPhase, updatePhase, setPhaseDone, reorderPhases, removePhase,
    // steps
    createStep, updateStep, setStepDone, reorderSteps, removeStep,
    // checklists
    createChecklist, renameChecklist, removeChecklist,
    createChecklistItem, toggleChecklistItem, updateChecklistItem,
    removeChecklistItem,
    // links + dependencies
    addLink, removeLink, addDependency, removeDependency,
    // attachments
    uploadAttachment, removeAttachment, attachmentUrl,
  };
}
