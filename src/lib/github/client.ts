import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/**
 * Clone le repo source dans un répertoire temporaire.
 * Retourne le chemin du répertoire cloné.
 */
export async function cloneSourceRepo(targetDir: string): Promise<void> {
  const repo = process.env.GITHUB_SOURCE_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) throw new Error("GITHUB_SOURCE_REPO or GITHUB_TOKEN not set");

  const url = `https://x-access-token:${token}@github.com/${repo}.git`;
  await exec("git", ["clone", "--depth", "1", url, targetDir]);
}

/**
 * Pousse le code Astro généré vers le repo cible.
 */
export async function pushToTargetRepo(sourceDir: string, commitMessage: string): Promise<void> {
  const repo = process.env.GITHUB_TARGET_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) throw new Error("GITHUB_TARGET_REPO or GITHUB_TOKEN not set");

  const url = `https://x-access-token:${token}@github.com/${repo}.git`;

  // Init + commit + push
  await exec("git", ["init"], { cwd: sourceDir });
  await exec("git", ["checkout", "-b", "main"], { cwd: sourceDir });
  await exec("git", ["add", "."], { cwd: sourceDir });
  await exec("git", ["commit", "-m", commitMessage], { cwd: sourceDir });
  await exec("git", ["remote", "add", "origin", url], { cwd: sourceDir });
  await exec("git", ["push", "--force", "origin", "main"], { cwd: sourceDir });
}
