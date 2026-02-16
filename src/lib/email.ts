const BREVO_API_KEY = process.env.BREVO_API_KEY ?? import.meta.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL ?? import.meta.env.FROM_EMAIL ?? "noreply@simplauto.com";
const FROM_NAME = "lovable-to-astro";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!BREVO_API_KEY) {
    console.error("[email] BREVO_API_KEY not set, cannot send email");
    return;
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject: "Réinitialisation de mot de passe",
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1f2937;">lovable-to-astro</h2>
          <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
          <p>
            <a href="${resetUrl}"
               style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
              Choisir un nouveau mot de passe
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">
            Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[email] Brevo error:", res.status, err);
  }
}
