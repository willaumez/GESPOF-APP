import { History, LogOut, Radio, TimerOff } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { SessionConnexion } from "@/shared/types/audit-connexion.interface";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { AvatarUtilisateur } from "@/shared/components/utilisateurs/AvatarUtilisateur";
import { BadgeVous, estCompteConnecte, partieDate } from "./affichage";

type ColonneId = "en_ligne" | "deconnexion" | "inactivite" | "expiration";

const COLONNES: {
  id: ColonneId;
  titre: string;
  description: string;
  icone: typeof Radio;
  accent: string;
}[] = [
  {
    id: "en_ligne",
    titre: "En ligne",
    description: "Session ouverte",
    icone: Radio,
    accent: "text-emerald-700 bg-emerald-500/10",
  },
  {
    id: "deconnexion",
    titre: "Déconnexion",
    description: "Fermeture volontaire",
    icone: LogOut,
    accent: "text-primary bg-primary/10",
  },
  {
    id: "inactivite",
    titre: "Inactivité",
    description: "Fermée pour inactivité",
    icone: TimerOff,
    accent: "text-amber-800 bg-amber-500/10",
  },
  {
    id: "expiration",
    titre: "Expiration",
    description: "Jeton expiré",
    icone: History,
    accent: "text-muted-foreground bg-muted",
  },
];

function colonneDe(session: SessionConnexion): ColonneId {
  if (session.statut === "EN_LIGNE") return "en_ligne";
  const motif = session.motif_deconnexion?.valeur;
  if (motif === "INACTIVITE") return "inactivite";
  if (motif === "EXPIRATION") return "expiration";
  return "deconnexion";
}

function CarteSession({
  session,
  emailConnecte,
  afficherService,
}: {
  session: SessionConnexion;
  emailConnecte?: string;
  afficherService: boolean;
}) {
  const moi = estCompteConnecte(session.utilisateur.email, emailConnecte);

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-3 shadow-sm",
        moi && "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="relative shrink-0">
          <AvatarUtilisateur
            id={session.utilisateur.id}
            nom={session.utilisateur.nom}
            prenom={session.utilisateur.prenom}
            aPhoto={!!session.utilisateur.a_photo}
            taille={32}
            fondInitiales={moi ? "hsl(var(--primary))" : undefined}
            couleurInitiales={
              moi ? "hsl(var(--primary-foreground))" : undefined
            }
          />
          {session.statut === "EN_LIGNE" && (
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium leading-tight">
            <span className="truncate">{session.utilisateur.nom_complet}</span>
            {moi && <BadgeVous />}
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
            {session.utilisateur.matricule}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1">
        <Badge className="border-transparent bg-muted font-normal text-muted-foreground">
          {session.role.libelle}
        </Badge>
        {afficherService && session.portail && (
          <Badge variant="outline" className="font-normal">
            {session.portail.valeur}
          </Badge>
        )}
      </div>

      <dl className="mt-2.5 space-y-1 text-[11.5px] text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Connexion</dt>
          <dd className="font-mono tabular-nums text-foreground">
            {partieDate(session.date_connexion)} {session.heure_connexion}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Durée</dt>
          <dd className="font-mono tabular-nums">{session.duree}</dd>
        </div>
      </dl>
    </article>
  );
}

interface VueKanbanAuditProps {
  sessions: SessionConnexion[];
  loading: boolean;
  error: boolean;
  emailConnecte?: string;
  afficherService: boolean;
}

export function VueKanbanAudit({
  sessions,
  loading,
  error,
  emailConnecte,
  afficherService,
}: VueKanbanAuditProps) {
  if (loading) {
    return (
      <div className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3 overflow-x-auto p-4 lg:grid-flow-row lg:grid-cols-4">
        {COLONNES.map((col) => (
          <div key={col.id} className="rounded-xl bg-muted/40 p-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-3 h-24 w-full rounded-xl" />
            <Skeleton className="mt-2 h-24 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-10">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <History />
            </EmptyMedia>
            <EmptyTitle>Erreur de chargement</EmptyTitle>
            <EmptyDescription>Veuillez rafraîchir la page.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const parColonne: Record<ColonneId, SessionConnexion[]> = {
    en_ligne: [],
    deconnexion: [],
    inactivite: [],
    expiration: [],
  };
  for (const session of sessions) {
    parColonne[colonneDe(session)].push(session);
  }
  for (const id of Object.keys(parColonne) as ColonneId[]) {
    parColonne[id].sort((a, b) => {
      const aMoi = estCompteConnecte(a.utilisateur.email, emailConnecte) ? 0 : 1;
      const bMoi = estCompteConnecte(b.utilisateur.email, emailConnecte) ? 0 : 1;
      return aMoi - bMoi;
    });
  }

  return (
    <div className="grid auto-cols-[minmax(250px,1fr)] grid-flow-col gap-3 overflow-x-auto p-4 lg:grid-flow-row lg:grid-cols-4">
      {COLONNES.map((col) => {
        const Icone = col.icone;
        const items = parColonne[col.id];
        return (
          <section
            key={col.id}
            className="flex max-h-[640px] min-w-[250px] flex-col rounded-xl bg-muted/40"
          >
            <header className="flex items-start justify-between gap-2 px-3 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className={cn("flex size-6 items-center justify-center rounded-md", col.accent)}>
                    <Icone className="size-3.5" />
                  </span>
                  {col.titre}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{col.description}</p>
              </div>
              <Badge variant="secondary" className="tabular-nums">
                {items.length}
              </Badge>
            </header>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  Aucune session
                </p>
              ) : (
                items.map((session) => (
                  <CarteSession
                    key={session.id}
                    session={session}
                    emailConnecte={emailConnecte}
                    afficherService={afficherService}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
