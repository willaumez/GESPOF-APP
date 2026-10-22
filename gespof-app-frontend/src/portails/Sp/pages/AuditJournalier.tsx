import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowDownUp, ArrowRightLeft, CalendarCheck2, CheckCheck, CreditCard, FilePen, FileText,
  FilterX, Inbox, ListChecks, Loader2, Lock, LockOpen, PencilLine, RefreshCw, Search, Send,
  Sunrise, Table2, Undo2, Users, type LucideIcon,
} from "lucide-react";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { useAuth } from "@/shared/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/shared/components/ui/input-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { BadgeVous, initiales } from "@/shared/components/audit-connexion/affichage";
import { historiqueJournee } from "@/portails/Sp/api/journees-tresorerie";
import { libelleDateFr } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type { EvenementJournee, HistoriqueJournee } from "@/portails/Sp/types/journal-journee.interface";

type Categorie = "cycle" | "fiche_bleue" | "fiche_execution" | "depots" | "listes" | "rapprochement" | "autre";

const CATEGORIES: Record<Categorie, { libelle: string; classe: string }> = {
  cycle: { libelle: "Cycle de la journée", classe: "bg-slate-100 text-slate-700" },
  fiche_bleue: { libelle: "Fiche Bleue", classe: "bg-sky-100 text-sky-700" },
  fiche_execution: { libelle: "Fiche d'exécution", classe: "bg-violet-100 text-violet-700" },
  depots: { libelle: "Fiches de dépôt", classe: "bg-orange-100 text-orange-700" },
  listes: { libelle: "Recettes et dépenses", classe: "bg-teal-100 text-teal-700" },
  rapprochement: { libelle: "Rapprochement", classe: "bg-emerald-100 text-emerald-700" },
  autre: { libelle: "Autre", classe: "bg-muted text-muted-foreground" },
};

/** Catégorie et icône de chaque type d'événement. */
const TYPES: Record<string, { categorie: Categorie; icone: LucideIcon; jalon?: "ouverture" | "cloture" | "reouverture" }> = {
  ouverture: { categorie: "cycle", icone: Sunrise, jalon: "ouverture" },
  cloture: { categorie: "cycle", icone: Lock, jalon: "cloture" },
  reouverture: { categorie: "cycle", icone: LockOpen, jalon: "reouverture" },
  fiche_bleue_liee: { categorie: "fiche_bleue", icone: FileText },
  fiche_bleue_modifiee: { categorie: "fiche_bleue", icone: FilePen },
  programme_saisi: { categorie: "fiche_bleue", icone: PencilLine },
  fiche_execution_creee: { categorie: "fiche_execution", icone: Table2 },
  realise_saisi: { categorie: "fiche_execution", icone: PencilLine },
  rubrique_ajoutee: { categorie: "fiche_execution", icone: PencilLine },
  rubrique_modifiee: { categorie: "fiche_execution", icone: PencilLine },
  rubrique_supprimee: { categorie: "fiche_execution", icone: PencilLine },
  rubriques_reordonnees: { categorie: "fiche_execution", icone: ArrowDownUp },
  fiche_depot_demandee: { categorie: "depots", icone: Send },
  fiche_depot_envoyee: { categorie: "depots", icone: CreditCard },
  fiche_depot_recue: { categorie: "depots", icone: CheckCheck },
  recettes_validees: { categorie: "listes", icone: ListChecks },
  depenses_validees: { categorie: "listes", icone: ListChecks },
  rapprochement: { categorie: "rapprochement", icone: ArrowRightLeft },
  rapprochement_annule: { categorie: "rapprochement", icone: Undo2 },
};

const JALONS = {
  ouverture: { libelle: "Ouverture", classe: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  cloture: { libelle: "Clôture", classe: "border-red-300 bg-red-50 text-red-800" },
  reouverture: { libelle: "Réouverture", classe: "border-amber-300 bg-amber-50 text-amber-900" },
} as const;

const STYLE_CARTE_OUVERTURE: CSSProperties = {
  borderColor: "#6ee7b7",
  background: "#ecfdf5",
};
const STYLE_CARTE_CLOTURE: CSSProperties = {
  borderColor: "#fca5a5",
  background: "#fef2f2",
};

function infoType(type: string) {
  return TYPES[type] ?? { categorie: "autre" as Categorie, icone: ListChecks };
}

function heureCourte(heure: string): string {
  return heure.slice(0, 5);
}

/** Durée lisible entre deux dates ISO (« 4 h 12 », « 35 min »). */
function duree(debut: string, fin: Date): string {
  const minutes = Math.max(0, Math.round((fin.getTime() - new Date(debut).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  if (h >= 24) return `${Math.floor(h / 24)} j ${h % 24} h`;
  return `${h} h ${String(minutes % 60).padStart(2, "0")}`;
}

function Indicateur({
  libelle,
  valeur,
  pied,
  style,
}: {
  libelle: string;
  valeur: React.ReactNode;
  pied?: React.ReactNode;
  style: CSSProperties;
}) {
  return (
    <Card size="sm" className="border bg-card shadow-sm" style={style}>
      <CardContent className="space-y-0.5 px-3 py-2.5 sm:px-3.5 sm:py-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{libelle}</p>
        <div className="min-w-0 truncate text-[14px] font-bold text-foreground">{valeur}</div>
        {pied ? <div className="truncate text-[11px] text-muted-foreground">{pied}</div> : null}
      </CardContent>
    </Card>
  );
}

/**
 * Audit journalier : chronologie de toutes les actions de la journée de
 * trésorerie choisie dans la TopBar (qui, quoi, à quelle heure), de
 * l'ouverture à la clôture, réouvertures comprises.
 */
export default function AuditJournalier() {
  const theme = getPortalMenu("sp").theme;
  const styleCarte: CSSProperties = { borderColor: `${theme.topColor}28` };
  const { user } = useAuth();
  const { journee, date, chargement: chargementJournee } = useJourneeSelectionnee();
  const reference = journee?.reference ?? null;

  const [resultat, setResultat] = useState<{ reference: string; donnees: HistoriqueJournee | null; erreur: string | null } | null>(null);
  const [version, setVersion] = useState(0);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState<Categorie | "toutes">("toutes");
  const [acteur, setActeur] = useState("tous");
  const [recentsDabord, setRecentsDabord] = useState(true);

  useEffect(() => {
    if (!reference) return;
    let annule = false;
    void historiqueJournee(reference)
      .then((donnees) => {
        if (!annule) setResultat({ reference, donnees, erreur: null });
      })
      .catch((e) => {
        if (!annule) {
          setResultat({
            reference,
            donnees: null,
            erreur: messageDonneesOuDefaut(e instanceof Error ? e.message : null, "Impossible de charger l'audit de la journée."),
          });
        }
      });
    return () => {
      annule = true;
    };
  }, [reference, version]);

  const pret = resultat !== null && resultat.reference === reference;
  const chargement = chargementJournee || (reference !== null && !pret);
  const historique = pret ? resultat.donnees : null;
  const evenements = useMemo(() => historique?.evenements ?? [], [historique]);

  const intervenants = useMemo(() => {
    const index = new Map<string, { nom: string; role: string | null; nombre: number; email: string | null }>();
    for (const e of evenements) {
      const cle = e.utilisateur.matricule || e.utilisateur.nom_complet;
      const courant = index.get(cle) ?? { nom: e.utilisateur.nom_complet, role: e.utilisateur.role, nombre: 0, email: e.utilisateur.email };
      courant.nombre += 1;
      index.set(cle, courant);
    }
    return [...index.entries()].sort((a, b) => b[1].nombre - a[1].nombre);
  }, [evenements]);

  const filtres = Boolean(recherche.trim() || categorie !== "toutes" || acteur !== "tous");
  const reinitialiser = useCallback(() => {
    setRecherche("");
    setCategorie("toutes");
    setActeur("tous");
  }, []);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const liste = evenements.filter((e) => {
      if (categorie !== "toutes" && infoType(e.type).categorie !== categorie) return false;
      if (acteur !== "tous" && (e.utilisateur.matricule || e.utilisateur.nom_complet) !== acteur) return false;
      if (q && !`${e.libelle} ${e.utilisateur.nom_complet} ${e.utilisateur.matricule}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return recentsDabord ? [...liste].reverse() : liste;
  }, [evenements, recherche, categorie, acteur, recentsDabord]);

  const ouverture = evenements.find((e) => e.type === "ouverture") ?? null;
  const derniereCloture = [...evenements].reverse().find((e) => e.type === "cloture") ?? null;
  const nbReouvertures = evenements.filter((e) => e.type === "reouverture").length;
  const cloturee = historique?.journee.etat === "cloture";
  const actions = evenements.filter((e) => !infoType(e.type).jalon).length;

  if (!chargementJournee && !journee) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl" style={{ background: theme.iconBg, color: theme.iconColor }}>
          <CalendarCheck2 className="size-6" />
        </div>
        <p className="text-[15px] font-semibold text-foreground">Aucune journée de trésorerie</p>
        <p className="max-w-md text-[13px] text-muted-foreground">
          Aucune journée n&apos;est ouverte pour le {libelleDateFr(date)}. Choisissez une journée dans le sélecteur en haut de page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-foreground sm:text-[15px]">
          Journée du {libelleDateFr(date)}
          {historique ? (
            <Badge
              className={cn(
                "border-transparent text-[10.5px]",
                cloturee ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800",
              )}
            >
              {historique.journee.etat_libelle}
            </Badge>
          ) : null}
        </h2>
        {reference ? <span className="font-mono text-[12px] text-muted-foreground">{reference}</span> : null}
      </div>

      {/* Synthèse */}
      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Indicateur
          libelle="Ouverture"
          style={STYLE_CARTE_OUVERTURE}
          valeur={ouverture ? heureCourte(ouverture.heure) : chargement ? "…" : "—"}
          pied={ouverture ? `par ${ouverture.utilisateur.nom_complet}` : undefined}
        />
        <Indicateur
          libelle={cloturee ? "Clôture" : "Durée en cours"}
          style={cloturee ? STYLE_CARTE_CLOTURE : styleCarte}
          valeur={
            cloturee && derniereCloture
              ? heureCourte(derniereCloture.heure)
              : ouverture && !cloturee
                ? duree(ouverture.date, new Date())
                : chargement ? "…" : "—"
          }
          pied={
            cloturee && derniereCloture
              ? `par ${derniereCloture.utilisateur.nom_complet}${nbReouvertures > 0 ? ` · ${nbReouvertures} réouverture${nbReouvertures > 1 ? "s" : ""}` : ""}`
              : nbReouvertures > 0 ? `${nbReouvertures} réouverture${nbReouvertures > 1 ? "s" : ""}` : "Journée non clôturée"
          }
        />
        <Indicateur
          libelle="Actions"
          style={styleCarte}
          valeur={chargement ? "…" : actions}
          pied={evenements.length > 0 ? `Dernière à ${heureCourte(evenements[evenements.length - 1].heure)}` : undefined}
        />
        <Indicateur
          libelle="Intervenants"
          style={styleCarte}
          valeur={
            <span className="flex items-center gap-2">
              <Users className="size-3.5" style={{ color: theme.iconColor }} />
              {chargement ? "…" : intervenants.length}
              <span className="flex -space-x-1.5">
                {intervenants.slice(0, 4).map(([cle, i]) => (
                  <Avatar key={cle} className="size-5 ring-2 ring-card">
                    <AvatarFallback className="text-[8px]">{initiales(i.nom)}</AvatarFallback>
                  </Avatar>
                ))}
              </span>
            </span>
          }
          pied={intervenants[0] ? `Le plus actif : ${intervenants[0][1].nom}` : undefined}
        />
      </section>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-9 min-w-[14rem] flex-1 bg-background sm:max-w-sm">
          <InputGroupAddon>
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Rechercher une action, une rubrique, une personne…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            aria-label="Rechercher dans l'audit de la journée"
          />
        </InputGroup>
        <Select value={categorie} onValueChange={(v) => setCategorie(v as Categorie | "toutes")}>
          <SelectTrigger className="h-9 w-[12.5rem]" aria-label="Catégorie">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="toutes">Toutes les catégories</SelectItem>
            {(Object.keys(CATEGORIES) as Categorie[]).filter((c) => c !== "autre").map((c) => (
              <SelectItem key={c} value={c}>{CATEGORIES[c].libelle}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={acteur} onValueChange={setActeur}>
          <SelectTrigger className="h-9 w-[13rem]" aria-label="Intervenant">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les intervenants</SelectItem>
            {intervenants.map(([cle, i]) => (
              <SelectItem key={cle} value={cle}>{i.nom} ({i.nombre})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9"
                onClick={() => setRecentsDabord((v) => !v)}
                aria-label={recentsDabord ? "Plus anciennes d'abord" : "Plus récentes d'abord"}
                aria-pressed={recentsDabord}
              >
                <ArrowDownUp className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{recentsDabord ? "Plus récentes d'abord" : "Plus anciennes d'abord"}</TooltipContent>
          </Tooltip>
          {filtres ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="size-9" onClick={reinitialiser} aria-label="Réinitialiser les filtres">
                  <FilterX className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Réinitialiser les filtres</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9"
                onClick={() => setVersion((v) => v + 1)}
                aria-label="Actualiser"
              >
                <RefreshCw className={cn("size-4", chargement && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Actualiser</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Chronologie */}
      <section className="rounded-2xl border bg-card" style={styleCarte}>
        {chargement && !historique ? (
          <div className="flex min-h-[240px] items-center justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : pret && resultat.erreur ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-center text-[13px] text-muted-foreground">
            <Inbox className="size-6" />
            {resultat.erreur}
          </div>
        ) : visibles.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-center text-[13px] text-muted-foreground">
            <Inbox className="size-6" />
            {evenements.length > 0 ? "Aucune action pour ces filtres." : "Aucune action enregistrée pour cette journée."}
          </div>
        ) : (
          <ol className="relative px-3 py-4 sm:px-5">
            {visibles.map((e, index) => (
              <LigneEvenement
                key={e.id}
                evenement={e}
                derniere={index === visibles.length - 1}
                estMoi={!!user?.email && e.utilisateur.email?.toLowerCase() === user.email.toLowerCase()}
                couleur={theme.topColor}
              />
            ))}
          </ol>
        )}
      </section>
      {pret && evenements.some((e) => e.details?.reconstitue) ? (
        <p className="text-[11.5px] text-muted-foreground">
          L&apos;auteur de l&apos;ouverture n&apos;est pas connu pour les journées créées avant la mise en place de l&apos;audit journalier.
        </p>
      ) : null}
    </div>
  );
}

function LigneEvenement({
  evenement: e,
  derniere,
  estMoi,
  couleur,
}: {
  evenement: EvenementJournee;
  derniere: boolean;
  estMoi: boolean;
  couleur: string;
}) {
  const info = infoType(e.type);
  const Icone = info.icone;
  const categorie = CATEGORIES[info.categorie];

  // Ouverture / clôture / réouverture : jalons pleine largeur.
  if (info.jalon) {
    const jalon = JALONS[info.jalon];
    return (
      <li className="relative pb-4 pl-[4.75rem] sm:pl-[5.5rem]">
        {!derniere ? <span aria-hidden className="absolute top-8 bottom-0 left-[3.4rem] w-px bg-border sm:left-[3.9rem]" /> : null}
        <span className="absolute top-2 left-0 w-[2.6rem] text-right font-mono text-[12px] font-semibold tabular-nums text-foreground sm:w-[3rem]">
          {heureCourte(e.heure)}
        </span>
        <span
          className={cn("absolute top-0.5 left-[2.6rem] flex size-8 items-center justify-center rounded-full border-2 bg-card sm:left-[3rem]", jalon.classe)}
        >
          <Icone className="size-4" />
        </span>
        <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3.5 py-2", jalon.classe)}>
          <span className="text-[13px] font-semibold">{e.libelle}</span>
          <span className="text-[12px] opacity-80">
            par <span className="font-medium">{e.utilisateur.nom_complet}</span>
            {e.utilisateur.role ? ` · ${e.utilisateur.role}` : ""}
          </span>
          {estMoi ? <BadgeVous /> : null}
        </div>
      </li>
    );
  }

  return (
    <li className="relative pb-4 pl-[4.75rem] sm:pl-[5.5rem]">
      {!derniere ? <span aria-hidden className="absolute top-8 bottom-0 left-[3.4rem] w-px bg-border sm:left-[3.9rem]" /> : null}
      <span className="absolute top-2 left-0 w-[2.6rem] text-right font-mono text-[12px] tabular-nums text-muted-foreground sm:w-[3rem]">
        {heureCourte(e.heure)}
      </span>
      <span
        className="absolute top-0.5 left-[2.6rem] flex size-8 items-center justify-center rounded-full border bg-card sm:left-[3rem]"
        style={{ borderColor: `${couleur}40` }}
      >
        <Icone className="size-3.5" style={{ color: couleur }} />
      </span>
      <div className="rounded-xl border bg-background px-3.5 py-2.5 transition-colors hover:bg-muted/40">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 text-[13px] font-medium leading-snug text-foreground">{e.libelle}</p>
          <Badge className={cn("shrink-0 border-transparent text-[10px] font-medium", categorie.classe)}>
            {categorie.libelle}
          </Badge>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
          <Avatar className="size-5">
            <AvatarFallback className={cn("text-[8px]", estMoi && "bg-primary text-primary-foreground")}>
              {initiales(e.utilisateur.nom_complet)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground/80">{e.utilisateur.nom_complet}</span>
          {estMoi ? <BadgeVous /> : null}
          {e.utilisateur.role ? <span>· {e.utilisateur.role}</span> : null}
          <span className="font-mono tabular-nums">· {e.heure}</span>
        </div>
      </div>
    </li>
  );
}
