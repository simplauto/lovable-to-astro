import { createHmac, timingSafeEqual } from "node:crypto";

export function validateWebhookSignature(
  body: string,
  signature: string,
): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("GITHUB_WEBHOOK_SECRET not set, skipping validation");
    return false;
  }

  const expected =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  if (expected.length !== signature.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
