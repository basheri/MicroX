// Private-bucket storage access (EP-02). Rule 00 / SEC-007: the bucket is PRIVATE;
// files are reachable only through short-lived Signed URLs — no permanent public links.

import { getSupabaseServiceClient } from "@/data/supabase";

export const PROGRAM_FILES_BUCKET = "program-files";

// Default signed-URL lifetime: short-lived (5 minutes).
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

type StorageLike = {
  from: (bucket: string) => {
    createSignedUrl: (
      path: string,
      expiresIn: number,
    ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    upload: (
      path: string,
      body: ArrayBuffer | Uint8Array | Blob,
      opts?: { contentType?: string; upsert?: boolean },
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
};

function storage(client?: { storage: StorageLike }): StorageLike {
  return (client ?? getSupabaseServiceClient()).storage as StorageLike;
}

// Create a short-lived signed URL for a private file. `client` is injectable for tests.
export async function createSignedUrl(
  path: string,
  expiresIn: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
  client?: { storage: StorageLike },
): Promise<string> {
  if (!path) throw new Error("createSignedUrl: path is required");
  const { data, error } = await storage(client)
    .from(PROGRAM_FILES_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) {
    throw new Error(`createSignedUrl failed for ${path}: ${error?.message ?? "no data"}`);
  }
  return data.signedUrl;
}

// Upload a file into the private bucket.
export async function uploadProgramFile(
  path: string,
  body: ArrayBuffer | Uint8Array | Blob,
  contentType: string,
  client?: { storage: StorageLike },
): Promise<void> {
  const { error } = await storage(client)
    .from(PROGRAM_FILES_BUCKET)
    .upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(`uploadProgramFile failed for ${path}: ${error.message}`);
}
