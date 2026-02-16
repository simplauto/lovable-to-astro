import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Lock, Globe, Loader2 } from "lucide-react";

interface Repo {
  fullName: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  updatedAt: string;
}

export default function AddProjectDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "name">("select");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [projectName, setProjectName] = useState("");
  const [targetRepo, setTargetRepo] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && repos.length === 0) {
      setLoading(true);
      fetch("/api/github/repos")
        .then((r) => r.json())
        .then((data) => setRepos(data))
        .catch(() => setError("Impossible de charger les repos"))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const filtered = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  function handleSelectRepo(repo: Repo) {
    setSelectedRepo(repo);
    setProjectName(repo.name);
    setTargetRepo(repo.fullName + "-astro");
    setStep("name");
  }

  async function handleCreate() {
    if (!selectedRepo || !projectName.trim() || !targetRepo.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          sourceRepo: selectedRepo.fullName,
          targetRepo: targetRepo.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        window.location.href = `/project/${data.id}`;
      } else {
        setError(data.error || "Erreur lors de la création");
        setCreating(false);
      }
    } catch {
      setError("Erreur réseau");
      setCreating(false);
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setStep("select");
      setSelectedRepo(null);
      setProjectName("");
      setTargetRepo("");
      setSearch("");
      setError("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus className="size-5" />
          Ajouter un projet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {step === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle>Sélectionner un repo GitHub</DialogTitle>
              <DialogDescription>
                Choisissez le repo Lovable à convertir en Astro.
              </DialogDescription>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un repo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[300px] -mx-2">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Aucun repo trouvé
                </div>
              ) : (
                <div className="space-y-1 px-2">
                  {filtered.map((repo) => (
                    <button
                      key={repo.fullName}
                      onClick={() => handleSelectRepo(repo)}
                      className="w-full text-left px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {repo.isPrivate ? (
                          <Lock className="size-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <Globe className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-medium text-sm">{repo.fullName}</span>
                      </div>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 ml-5.5 line-clamp-1">
                          {repo.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nommer le projet</DialogTitle>
              <DialogDescription>
                Repo : {selectedRepo?.fullName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Nom du projet
                </label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Mon projet"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Repo cible (code Astro converti)
                </label>
                <Input
                  value={targetRepo}
                  onChange={(e) => setTargetRepo(e.target.value)}
                  placeholder="org/mon-projet-astro"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Le repo GitHub où sera poussé le code Astro. Il doit exister.
                </p>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("select");
                    setError("");
                  }}
                >
                  Retour
                </Button>
                <Button onClick={handleCreate} disabled={creating || !projectName.trim() || !targetRepo.trim()}>
                  {creating && <Loader2 className="size-4 animate-spin" />}
                  Créer le projet
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
