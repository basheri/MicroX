// Storage abstraction (EP-04). Decouples the upload service from Supabase Storage so
// it can be tested without a live bucket. Production uses SupabaseFileStore (private
// bucket + signed URLs, SEC-007); tests use InMemoryFileStore.

import { uploadProgramFile, createSignedUrl } from "@/data/storage";

export interface FileStore {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  signedUrl(path: string, ttlSeconds?: number): Promise<string>;
}

export class SupabaseFileStore implements FileStore {
  async put(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await uploadProgramFile(path, bytes, contentType);
  }
  async signedUrl(path: string, ttlSeconds?: number): Promise<string> {
    return createSignedUrl(path, ttlSeconds);
  }
}

// In-memory store for tests: keeps bytes so a "signed URL" can actually retrieve them.
export class InMemoryFileStore implements FileStore {
  readonly files = new Map<string, { bytes: Uint8Array; contentType: string }>();

  async put(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.files.set(path, { bytes, contentType });
  }
  async signedUrl(path: string): Promise<string> {
    if (!this.files.has(path)) throw new Error(`InMemoryFileStore: no file at ${path}`);
    return `memory://${path}`;
  }
  get(path: string): Uint8Array | undefined {
    return this.files.get(path)?.bytes;
  }
}
