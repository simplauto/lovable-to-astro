/**
 * Crée un utilisateur en ligne de commande.
 * Usage: npx tsx scripts/create-user.ts <email> <password> [name] [--admin]
 */
import Database from "better-sqlite3";
import { hashSync } from "bcryptjs";

const [, , email, password, ...rest] = process.argv;

if (!email || !password) {
  console.error("Usage: npx tsx scripts/create-user.ts <email> <password> [name] [--admin]");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Erreur: le mot de passe doit faire au moins 8 caractères.");
  process.exit(1);
}

const ALLOWED_DOMAINS = ["simplauto.com", "naeka.fr"];
const domain = email.split("@")[1]?.toLowerCase();
if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
  console.error("Erreur: domaine email non autorisé.");
  process.exit(1);
}

const isAdmin = rest.includes("--admin");
const name = rest.filter((a) => a !== "--admin").join(" ") || null;
const role = isAdmin ? "admin" : "user";

const sqlite = new Database("./data/lovable-to-astro.db");
sqlite.pragma("journal_mode = WAL");

// Ensure table exists
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  );
`);

const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
if (existing) {
  console.error(`Erreur: l'email ${email} existe déjà.`);
  process.exit(1);
}

const hash = hashSync(password, 12);
const now = new Date().toISOString();

sqlite.prepare("INSERT INTO users (email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?)").run(
  email.toLowerCase(),
  hash,
  name,
  role,
  now,
);

console.log(`Utilisateur créé: ${email} (${role})`);
