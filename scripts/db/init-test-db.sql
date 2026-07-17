-- Auto-run once on first Postgres container boot (docker-entrypoint-initdb.d).
-- Creates the throwaway database used by the DB integration tests (npm test), so the
-- default microx (dev) and microx_test (tests) databases both exist out of the box.
CREATE DATABASE microx_test;
