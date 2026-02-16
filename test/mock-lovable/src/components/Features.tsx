import { Car, Shield, Zap } from "lucide-react";

const features = [
  { icon: Car, title: "Gestion de flotte", description: "Suivez tous vos véhicules en temps réel." },
  { icon: Shield, title: "Sécurité", description: "Données chiffrées et sécurisées." },
  { icon: Zap, title: "Rapidité", description: "Interface ultra-rapide et intuitive." },
];

export function Features() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-5xl mx-auto grid grid-cols-3 gap-8">
        {features.map((f) => (
          <div key={f.title} className="text-center">
            <f.icon className="mx-auto h-12 w-12 text-blue-600" />
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-gray-600">{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
