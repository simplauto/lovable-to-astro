import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const sqlite = new Database("./data/lovable-to-astro.db");
sqlite.pragma("journal_mode = WAL");

// Auto-create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_repo TEXT NOT NULL,
    target_repo TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS conversions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id),
    commit_sha TEXT NOT NULL,
    commit_message TEXT,
    branch TEXT DEFAULT 'main',
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT
  );
  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id),
    component_path TEXT NOT NULL,
    mode TEXT NOT NULL,
    hydration_directive TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversion_id INTEGER NOT NULL REFERENCES conversions(id),
    component_path TEXT NOT NULL,
    question_text TEXT NOT NULL,
    context TEXT,
    answer TEXT,
    answered_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );
`);

// Migration: add project_id columns to existing tables if missing
try {
  sqlite.exec(`ALTER TABLE conversions ADD COLUMN project_id INTEGER REFERENCES projects(id)`);
} catch (_) { /* column already exists */ }
try {
  sqlite.exec(`ALTER TABLE rules ADD COLUMN project_id INTEGER REFERENCES projects(id)`);
} catch (_) { /* column already exists */ }

// Au démarrage : marquer comme erreur les conversions restées en cours
// (crash, redéploiement, timeout non attrapé, etc.)
sqlite.exec(`
  UPDATE conversions
  SET status = 'error',
      error_message = 'Interrompu par un redémarrage du serveur',
      finished_at = datetime('now')
  WHERE status IN ('pending', 'analyzing', 'converting', 'pushing', 'deploying')
`);

export const db = drizzle(sqlite, { schema });
