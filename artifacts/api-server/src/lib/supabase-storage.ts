import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Required for Supabase Storage uploads.",
  );
}

export const STORAGE_BUCKET = "uploads";

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Public URL for an object in our uploads bucket. */
export function publicUrl(filename: string): string {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

export async function uploadFile(
  filename: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(filename, body, {
    contentType,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  return publicUrl(filename);
}

export async function deleteFile(filename: string): Promise<void> {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([filename]);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}

export interface StoredFile {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
  mimetype: string;
}

export async function listFiles(): Promise<StoredFile[]> {
  // Supabase list returns up to 100 by default; fetch with pagination if larger.
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list("", {
    limit: 1000,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw new Error(`Supabase list failed: ${error.message}`);
  return (data ?? [])
    .filter((f) => f.name && !f.name.startsWith("."))
    .map((f) => ({
      filename: f.name,
      url: publicUrl(f.name),
      size: (f.metadata as { size?: number } | null)?.size ?? 0,
      uploadedAt: (f.updated_at ?? f.created_at ?? new Date().toISOString()) as string,
      mimetype:
        ((f.metadata as { mimetype?: string } | null)?.mimetype) ?? "application/octet-stream",
    }));
}
