import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, GitBranch, Search } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";

export interface NoeudRubrique {
  code: string;
  libelle: string;
  niveau: number;
  code_synthetique: boolean;
  enfants: NoeudRubrique[];
  famille: string;
  famille_libelle: string;
}

interface ArbreRubriquesProps {
  noeuds: NoeudRubrique[];
  familles: { valeur: string; libelle: string }[];
  labelFamille: string;
}

function correspond(noeud: NoeudRubrique, terme: string): boolean {
  if (noeud.code.toLowerCase().includes(terme) || noeud.libelle.toLowerCase().includes(terme)) {
    return true;
  }
  return noeud.enfants.some((enfant) => correspond(enfant, terme));
}

function filtrerArbre(noeuds: NoeudRubrique[], terme: string, famille: string): NoeudRubrique[] {
  return noeuds
    .filter((n) => (famille === "" || n.famille === famille) && (terme === "" || correspond(n, terme)))
    .map((n) => ({
      ...n,
      enfants: terme === "" ? n.enfants : filtrerArbre(n.enfants, terme, ""),
    }));
}

function LigneRubrique({
  noeud,
  ouvert,
  onToggle,
}: {
  noeud: NoeudRubrique;
  ouvert: Set<string>;
  onToggle: (code: string) => void;
}) {
  const aEnfants = noeud.enfants.length > 0;
  const estOuvert = ouvert.has(noeud.code);

  return (
    <div>
      <div
        className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.03]"
        style={{ paddingLeft: `${8 + (noeud.niveau - 1) * 20}px` }}
      >
        <button
          type="button"
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md text-foreground/50",
            aEnfants ? "hover:bg-foreground/5" : "invisible",
          )}
          aria-expanded={aEnfants ? estOuvert : undefined}
          onClick={() => aEnfants && onToggle(noeud.code)}
        >
          {estOuvert ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] font-semibold text-foreground/80">{noeud.code}</span>
            <span className="text-[13px] text-foreground">{noeud.libelle}</span>
            {noeud.code_synthetique && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
                Synthétique
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-foreground/45">{noeud.famille_libelle} · niveau {noeud.niveau}</p>
        </div>
        <GitBranch size={14} className="text-foreground/25" />
      </div>
      {aEnfants && estOuvert && (
        <div>
          {noeud.enfants.map((enfant) => (
            <LigneRubrique key={enfant.code} noeud={enfant} ouvert={ouvert} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ArbreRubriques({ noeuds, familles, labelFamille }: ArbreRubriquesProps) {
  const [recherche, setRecherche] = useState("");
  const [famille, setFamille] = useState("");
  const [ouvert, setOuvert] = useState<Set<string>>(() => new Set(noeuds.map((n) => n.code)));

  const filtre = filtrerArbre(noeuds, recherche.trim().toLowerCase(), famille);
  const codesVisibles = useMemo(() => {
    const codes = new Set<string>();
    const visiter = (liste: NoeudRubrique[]) => {
      for (const n of liste) {
        codes.add(n.code);
        visiter(n.enfants);
      }
    };
    visiter(filtre);
    return codes;
  }, [filtre]);

  function basculer(code: string) {
    setOuvert((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(code)) suivant.delete(code);
      else suivant.add(code);
      return suivant;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/40" />
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un code ou un libellé…"
            className="h-9 pl-8 text-[13px]"
          />
        </div>
        <Select value={famille || "__toutes"} onValueChange={(v) => setFamille(v === "__toutes" ? "" : v)}>
          <SelectTrigger className="h-9 w-[220px] text-[13px]">
            <SelectValue placeholder={labelFamille} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__toutes">Toutes les {labelFamille.toLowerCase()}s</SelectItem>
            {familles.map((f) => (
              <SelectItem key={f.valeur} value={f.valeur}>{f.libelle}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtre.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-[13px] text-foreground/50">
          Aucune rubrique ne correspond à ce filtre.
        </p>
      ) : (
        <div className="rounded-xl border bg-background py-1">
          {filtre.map((noeud) => (
            <LigneRubrique
              key={noeud.code}
              noeud={noeud}
              ouvert={new Set([...ouvert].filter((c) => codesVisibles.has(c)))}
              onToggle={basculer}
            />
          ))}
        </div>
      )}
    </div>
  );
}
