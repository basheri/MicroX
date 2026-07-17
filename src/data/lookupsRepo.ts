// Lookup reads for dashboard filters and the create-program form (EP-03).
// Active (non-deleted) rows only, per rule 30.

import { getPool } from "@/data/pool";

export interface Sector {
  id: string;
  name: string;
}
export interface Field {
  id: string;
  sector_id: string;
  name: string;
}
export interface DevelopmentPath {
  id: string;
  path_code: string;
  name: string;
}

export async function listSectors(): Promise<Sector[]> {
  return (
    await getPool().query<Sector>(
      "select id, name from sectors where is_deleted = false order by name",
    )
  ).rows;
}

export async function listFields(): Promise<Field[]> {
  return (
    await getPool().query<Field>(
      "select id, sector_id, name from fields where is_deleted = false order by name",
    )
  ).rows;
}

export async function listDevelopmentPaths(): Promise<DevelopmentPath[]> {
  return (
    await getPool().query<DevelopmentPath>(
      "select id, path_code, name from development_paths order by path_code",
    )
  ).rows;
}
