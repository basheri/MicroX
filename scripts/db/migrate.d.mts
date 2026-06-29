// Type declarations for the JS migration runner so TypeScript callers (tests) are typed.
import type { Client } from "pg";

export function listUpMigrations(): string[];
export function ensureMigrationsTable(client: Client): Promise<void>;
export function applyAll(client: Client, opts?: { reset?: boolean }): Promise<string[]>;
export function rollbackLast(client: Client): Promise<string | null>;
