import { ArrowLeft } from "lucide-react";

export default function About() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <a href="/" className="flex items-center gap-2 text-blue-600 mb-8">
        <ArrowLeft size={16} />
        Retour
      </a>
      <h1 className="text-4xl font-bold">À propos de Simplauto</h1>
      <p className="mt-4 text-lg text-gray-600">
        Simplauto simplifie la gestion automobile pour les professionnels.
      </p>
    </div>
  );
}
