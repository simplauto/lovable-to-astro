import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

async function fetchStats() {
  const res = await fetch("/api/stats");
  return res.json();
}

export default function Dashboard() {
  const [filter, setFilter] = useState("all");
  const { data: stats, isLoading } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });

  useEffect(() => {
    document.title = "Dashboard — Simplauto";
  }, []);

  function handleExport() {
    toast.success("Export lancé !");
  }

  if (isLoading) return <div>Chargement...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="flex gap-4 mt-4">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
        </select>
        <button onClick={handleExport} className="px-4 py-2 bg-blue-600 text-white rounded">
          Exporter
        </button>
      </div>
      <pre className="mt-4">{JSON.stringify(stats, null, 2)}</pre>
    </div>
  );
}
