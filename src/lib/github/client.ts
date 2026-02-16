import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

function getToken(): string {
  const token = process.env.GITHUB_TOKEN ?? (import.meta as any).env?.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not set");
  return token;
}

/**
 * Clone le repo source dans un répertoire temporaire.
 * @param targetDir - Le répertoire où cloner
 * @param repo - Le repo au format "owner/name" (optionnel, fallback sur env var)
 */
export async function cloneSourceRepo(targetDir: string, repo?: string): Promise<void> {
  const repoName = repo ?? process.env.GITHUB_SOURCE_REPO;
  if (!repoName) throw new Error("No source repo specified");
  const token = getToken();

  const url = `https://x-access-token:${token}@github.com/${repoName}.git`;
  await exec("git", ["clone", "--depth", "1", url, targetDir]);
}

/**
 * Pousse le code Astro généré vers le repo cible.
 * @param sourceDir - Le répertoire contenant le code généré
 * @param commitMessage - Le message de commit
 * @param repo - Le repo au format "owner/name" (optionnel, fallback sur env var)
 */
export async function pushToTargetRepo(sourceDir: string, commitMessage: string, repo?: string): Promise<void> {
  const repoName = repo ?? process.env.GITHUB_TARGET_REPO;
  if (!repoName) throw new Error("No target repo specified");
  const token = getToken();

  const url = `https://x-access-token:${token}@github.com/${repoName}.git`;

  await exec("git", ["init"], { cwd: sourceDir });
  await exec("git", ["checkout", "-b", "main"], { cwd: sourceDir });
  await exec("git", ["add", "."], { cwd: sourceDir });
  await exec("git", ["commit", "-m", commitMessage], { cwd: sourceDir });
  await exec("git", ["remote", "add", "origin", url], { cwd: sourceDir });
  await exec("git", ["push", "--force", "origin", "main"], { cwd: sourceDir });
}
