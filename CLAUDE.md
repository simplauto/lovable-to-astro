# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Langue

Toujours répondre en français dans ce projet.

## Projet

Pipeline automatique de conversion Lovable (React/Vite) → Astro pour Simplauto.com. Le service reçoit les webhooks GitHub du repo Lovable, convertit le code React en projet Astro avec des îlots React, et déploie sur Coolify.

## Commandes

```bash
npm run dev          # Serveur de dev (dashboard + API)
npm run build        # Build production
npm run start        # Lancer le serveur prod (après build)
npm run db:generate  # Générer les migrations Drizzle
npm run db:migrate   # Appliquer les migrations
npm run db:studio    # Interface Drizzle Studio
npx astro check      # Vérification TypeScript
```

## Architecture

Service Astro SSR (`output: "server"`) avec adaptateur `@astrojs/node` (mode standalone). Tailwind CSS v4 via plugin Vite `@tailwindcss/vite`. React pour les composants interactifs du dashboard (îlots Astro).

### Flux principal

```
[Repo Lovable] → webhook POST /api/webhook → clone → analyse AST → conversion → push [Repo Astro] → deploy preview Coolify
                                                                                       → deploy prod (manuel via dashboard)
```

### Structure `src/lib/`

- **converter/** — Moteur de conversion React → Astro
  - `analyzer.ts` — Analyse AST des composants React (Babel parser/traverse), détecte hooks, event handlers, context, router, APIs navigateur (window, document, localStorage), dépendances client-only (@tanstack/react-query, react-hook-form, framer-motion, sonner) vs static-safe (radix-ui, lucide-react, clsx, tailwind-merge)
  - `transformer.ts` — Génération des fichiers `.astro` (pages statiques ou îlots React)
  - `router.ts` — Extraction des routes React Router et conversion en file-based routing Astro
  - `islands.ts` — Heuristiques pour choisir la directive d'hydratation (`client:load`/`visible`/`idle`/`only`)
  - `scaffold.ts` — Génère l'arborescence complète du projet Astro (package.json, astro.config.mjs, layouts, copie components/assets/hooks/contexts/lib depuis la source)
  - `pipeline.ts` — Orchestration complète : clone → analyse → questions → conversion → push → deploy. Reprend automatiquement quand toutes les questions sont répondues
- **rules/** — Moteur de règles de conversion (stockées en DB)
- **github/** — Webhook validation (HMAC SHA-256) et client Git (clone/push)
- **coolify/** — Client API REST Coolify pour déclencher les déploiements
- **db/** — Drizzle ORM + better-sqlite3, base stockée dans `./data/`

### Schéma DB (SQLite via Drizzle)

3 tables : `conversions` (historique), `rules` (règles de conversion par composant), `questions` (file d'attente pour les cas ambigus).

### Pages du dashboard

- `/` — Statut, dernières conversions, compteur questions en attente, bouton "Déployer en production" avec dialog de confirmation
- `/rules` — Gestion des règles (composant → statique ou îlot + directive)
- `/queue` — Questions en attente avec boutons de réponse, crée automatiquement la règle correspondante

### Routes API

- `POST /api/webhook` — Réception webhook GitHub (push events)
- `POST /api/deploy` — Déclenchement déploiement Coolify (`{ target: "preview" | "prod" }`)
- `POST /api/queue/[id]/answer` — Réponse à une question (formulaire, redirige vers `/queue`)
- `GET /api/rules` — Liste toutes les règles de conversion
- `POST /api/rules` — Crée ou met à jour une règle (upsert sur componentName)
- `DELETE /api/rules/[id]` — Supprime une règle par son ID
- `PATCH /api/rules/[id]` — Modifie une règle existante
- `POST /api/conversions/trigger` — Déclenche une conversion manuelle (bypass webhook)

## Conventions

- Imports avec alias `@/*` → `src/*`
- Dates stockées en ISO 8601 (`new Date().toISOString()`)
- Les variables d'environnement nécessaires sont dans `.env.example`
- La base SQLite est dans `./data/` (gitignored)
- Le Dockerfile utilise un multi-stage build (deps → build → runtime)
