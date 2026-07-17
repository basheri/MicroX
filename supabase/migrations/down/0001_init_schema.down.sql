-- Reverse of 0001 — drop the whole baseline schema.
-- Destructive: intended only for a full teardown of a non-production database.
drop schema if exists public cascade;
create schema public;
grant all on schema public to public;
