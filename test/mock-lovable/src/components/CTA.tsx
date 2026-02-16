import { useState } from "react";

export function CTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <section className="py-16 text-center">
        <p className="text-xl text-green-600">Merci ! Nous vous contacterons bientôt.</p>
      </section>
    );
  }

  return (
    <section className="py-16 text-center">
      <h2 className="text-3xl font-bold">Prêt à commencer ?</h2>
      <form onSubmit={handleSubmit} className="mt-8 flex justify-center gap-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre email"
          className="px-4 py-2 border rounded-lg w-64"
          required
        />
        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg">
          Démarrer
        </button>
      </form>
    </section>
  );
}
