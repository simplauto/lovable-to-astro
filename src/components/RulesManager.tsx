import { useState } from "react";

interface Rule {
  id: number;
  componentPath: string;
  mode: "static" | "island";
  hydrationDirective: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialRules: Rule[];
}

export default function RulesManager({ initialRules }: Props) {
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [editing, setEditing] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    componentPath: "",
    mode: "island" as "static" | "island",
    hydrationDirective: "client:load",
    notes: "",
  });

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const rule = await res.json();
      setRules((prev) => [...prev, rule].sort((a, b) => a.componentPath.localeCompare(b.componentPath)));
      setForm({ componentPath: "", mode: "island", hydrationDirective: "client:load", notes: "" });
      setShowAdd(false);
    }
  }

  async function handleUpdate(id: number) {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;

    const res = await fetch(`/api/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: rule.mode,
        hydrationDirective: rule.hydrationDirective,
        notes: rule.notes,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setEditing(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Supprimer cette règle ?")) return;
    const res = await fetch(`/api/rules/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRules((prev) => prev.filter((r) => r.id !== id));
    }
  }

  function updateRule(id: number, field: string, value: string) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Règles de conversion</h1>
          <p className="mt-1 text-sm text-gray-500">
            Définissez comment chaque composant React doit être converti.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          {showAdd ? "Annuler" : "Ajouter une règle"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-lg border border-blue-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Chemin du composant</label>
              <input
                type="text"
                value={form.componentPath}
                onChange={(e) => setForm({ ...form, componentPath: e.target.value })}
                placeholder="src/components/MyComponent.tsx"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mode</label>
              <select
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value as "static" | "island" })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="static">Statique</option>
                <option value="island">Îlot React</option>
              </select>
            </div>
            {form.mode === "island" && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Directive</label>
                <select
                  value={form.hydrationDirective}
                  onChange={(e) => setForm({ ...form, hydrationDirective: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="client:load">client:load</option>
                  <option value="client:visible">client:visible</option>
                  <option value="client:idle">client:idle</option>
                  <option value="client:only">client:only</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optionnel"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Créer la règle
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        {rules.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            Aucune règle définie. Les règles seront créées automatiquement lors de la première conversion.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Composant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Directive</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">{rule.componentPath}</td>
                  <td className="px-6 py-4">
                    {editing === rule.id ? (
                      <select
                        value={rule.mode}
                        onChange={(e) => updateRule(rule.id, "mode", e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="static">Statique</option>
                        <option value="island">Îlot</option>
                      </select>
                    ) : (
                      <span
                        className={`px-2 py-1 text-xs rounded-full font-medium ${
                          rule.mode === "static"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {rule.mode}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                    {editing === rule.id && rule.mode === "island" ? (
                      <select
                        value={rule.hydrationDirective ?? "client:load"}
                        onChange={(e) => updateRule(rule.id, "hydrationDirective", e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="client:load">client:load</option>
                        <option value="client:visible">client:visible</option>
                        <option value="client:idle">client:idle</option>
                        <option value="client:only">client:only</option>
                      </select>
                    ) : (
                      rule.hydrationDirective ?? "—"
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {editing === rule.id ? (
                      <input
                        type="text"
                        value={rule.notes ?? ""}
                        onChange={(e) => updateRule(rule.id, "notes", e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm w-full"
                      />
                    ) : (
                      rule.notes ?? "—"
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {editing === rule.id ? (
                      <>
                        <button
                          onClick={() => handleUpdate(rule.id)}
                          className="text-sm text-green-600 hover:text-green-800 font-medium"
                        >
                          Sauver
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditing(rule.id)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Éditer
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="text-sm text-red-600 hover:text-red-800 font-medium"
                        >
                          Supprimer
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
