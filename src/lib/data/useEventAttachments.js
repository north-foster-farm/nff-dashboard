import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { attachmentStoragePath } from "../attachments.js";
import { STORAGE_BUCKET } from "./useProjects.js";
import { useCurrentUserEmail } from "./useCurrentUserEmail.js";

// Files attached to an event series (Batch 42.15, F22d) — the cut-size
// sheets for a processing day. Metadata lives in event_attachments;
// the objects share the project-files Storage bucket under an
// `events/<seriesId>/` prefix (its policies are bucket-scoped to
// admins). Mirrors the project-attachment ops in useProjects.
//
// Returns the shaped attachment list plus upload / remove / getUrl,
// shaped exactly as the AttachmentsBlock component expects.

const COLS =
  "id, series_id, storage_path, file_name, content_type, size_bytes, " +
  "uploaded_by, created_at";

function shape(r) {
  return {
    id: r.id,
    seriesId: r.series_id,
    storagePath: r.storage_path,
    fileName: r.file_name,
    contentType: r.content_type,
    sizeBytes: r.size_bytes,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  };
}

export function useEventAttachments(seriesId) {
  const [attachments, setAttachments] = useState([]);
  const userEmail = useCurrentUserEmail();

  const refresh = useCallback(async () => {
    if (!seriesId) { setAttachments([]); return; }
    const { data } = await supabase
      .from("event_attachments")
      .select(COLS)
      .eq("series_id", seriesId)
      .order("created_at", { ascending: true });
    setAttachments((data ?? []).map(shape));
  }, [seriesId]);

  useEffect(() => { refresh(); }, [refresh]);

  const upload = useCallback(async (file) => {
    const path = attachmentStoragePath({
      prefix: `events/${seriesId}`,
      fileName: file.name,
      timestamp: Date.now(),
    });
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    const { error: insErr } = await supabase
      .from("event_attachments")
      .insert({
        series_id: seriesId,
        storage_path: path,
        file_name: file.name,
        content_type: file.type || null,
        size_bytes: file.size ?? null,
        uploaded_by: userEmail,
      });
    if (insErr) throw insErr;
    await refresh();
  }, [seriesId, userEmail, refresh]);

  const remove = useCallback(async (attachment) => {
    // Best-effort object delete first so a failed removal never orphans
    // the metadata row silently (mirrors useProjects).
    const { error: rmErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([attachment.storagePath]);
    if (rmErr) throw rmErr;
    const { error: delErr } = await supabase
      .from("event_attachments")
      .delete()
      .eq("id", attachment.id);
    if (delErr) throw delErr;
    await refresh();
  }, [refresh]);

  const getUrl = useCallback(async (attachment) => {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(attachment.storagePath, 60 * 60);
    if (error) throw error;
    return data.signedUrl;
  }, []);

  return { attachments, upload, remove, getUrl };
}
