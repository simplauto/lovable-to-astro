type DeployTarget = "preview" | "prod";

function getAppId(target: DeployTarget): string {
  const envKey = target === "preview" ? "COOLIFY_PREVIEW_APP_ID" : "COOLIFY_PROD_APP_ID";
  const id = process.env[envKey];
  if (!id) throw new Error(`${envKey} not set`);
  return id;
}

/**
 * Déclenche un déploiement sur Coolify via son API REST.
 */
export async function deployCoolify(target: DeployTarget): Promise<void> {
  const apiUrl = process.env.COOLIFY_API_URL;
  const apiToken = process.env.COOLIFY_API_TOKEN;
  if (!apiUrl || !apiToken) throw new Error("COOLIFY_API_URL or COOLIFY_API_TOKEN not set");

  const appId = getAppId(target);

  const response = await fetch(`${apiUrl}/api/v1/applications/${appId}/restart`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Coolify deploy failed (${response.status}): ${text}`);
  }
}
