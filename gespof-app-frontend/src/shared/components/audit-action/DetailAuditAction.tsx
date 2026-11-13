import type { ReactNode } from "react";
import {
  AlertTriangle, CalendarClock, CheckCircle2, Copy, FileJson, Globe,
  Layers, UserRound, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getPortalMenu } from "@/shared/config/menu";
import { portalThemeVars } from "@/shared/lib/color";
import { cn } from "@/shared/lib/utils";
import type { Portail } from "@/shared/hooks/auth-context";
import { AvatarUtilisateur } from "@/shared/components/utilisateurs/AvatarUtilisateur";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  BadgeVous, partieDate,
} from "@/shared/components/audit-connexion/affichage";
import type { AuditAction } from "@/shared/types/audit-action.interface";

const LIBELLES_HTTP: Record<number, string> = {
  200: "Succès",
  201: "Créé",
  202: "Acceptée",
  204: "Effectuée",
  400: "Requête invalide",
  401: "Non authentifié",
  403: "Accès refusé",
  404: "Introuvable",
  409: "Conflit",
  422: "Données invalides",
  500: "Erreur serveur",
  502: "Service indisponible",
  503: "Service indisponible",
};

const CLASSES_METHODE: Record<string, string> = {
  POST: "bg-sky-500/10 text-sky-700",
  PUT: "bg-amber-500/10 text-amber-700",
  PATCH: "bg-amber-500/10 text-amber-700",
  DELETE: "bg-destructive/10 text-destructive",
};

/** Résultat de l'action, déduit du code HTTP : couleurs, icône, libellé. */
function resultat(code: number) {
  if (code >= 200 && code < 300) {
    return {
      libelle: "Action réussie",
      icone: CheckCircle2,
      bandeau: "border-emerald-200 bg-emerald-50",
      pastille: "bg-emerald-100 text-emerald-700",
      texte: "text-emerald-800",
    };
  }
  if (code >= 400 && code < 500) {
    return {
      libelle: "Action refusée",
      icone: AlertTriangle,
      bandeau: "border-amber-200 bg-amber-50",
      pastille: "bg-amber-100 text-amber-700",
      texte: "text-amber-900",
    };
  }
  return {
    libelle: code >= 500 ? "Erreur serveur" : "Statut inattendu",
    icone: XCircle,
    bandeau: "border-rose-200 bg-rose-50",
    pastille: "bg-rose-100 text-rose-700",
    texte: "text-rose-800",
  };
}

function copier(texte: string, quoi: string) {
  void navigator.clipboard
    ?.writeText(texte)
    .then(() => toast.success(`${quoi} copié.`))
    .catch(() => toast.error("Copie impossible."));
}

function Info({
  icone: Icone,
  libelle,
  couleur,
  children,
  className,
}: {
  icone: typeof Globe;
  libelle: string;
  /** Couleur du portail (bordure teintée + icône). */
  couleur: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("min-w-0 rounded-lg border bg-card px-3 py-2.5", className)}
      style={{ borderColor: `${couleur}2e` }}
    >
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Icone className="size-3.5" style={{ color: couleur }} />
        {libelle}
      </p>
      <div className="mt-1 min-w-0 text-[13px] text-foreground">{children}</div>
    </div>
  );
}

interface DetailAuditActionProps {
  action: AuditAction | null;
  /** Portail dont on reprend les couleurs (Admin si absent). */
  portail?: Portail;
  /** Compte connecté : badge « Vous ». */
  estMoi: boolean;
  onClose: () => void;
}

/** Détail d'une action d'audit : résultat, requête, contexte et corps envoyé. */
export function DetailAuditAction({ action, portail = "admin", estMoi, onClose }: DetailAuditActionProps) {
  const theme = getPortalMenu(portail).theme;
  const r = resultat(action?.code_http ?? 0);
  const Icone = r.icone;
  const corpsJson = action?.corps ? JSON.stringify(action.corps, null, 2) : null;
  const nbChamps = action?.corps ? Object.keys(action.corps).length : 0;
  // Libellé backend « Création / envoi — /sp/… » : le chemin est déjà dans le bloc requête.
  const titre = action?.action.split(" — ")[0] || action?.action;

  return (
    <Dialog open={action !== null} onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] w-[min(96vw,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
        // Rendu hors du shell du portail : on réapplique ses couleurs (--primary…).
        style={portalThemeVars(theme.topColor)}
      >
        {action ? (
          <>
            {/* En-tête : le résultat d'abord, l'action ensuite. */}
            <DialogHeader className={cn("shrink-0 gap-2 border-b px-5 py-4 pr-12 text-left", r.bandeau)}>
              <div className="flex items-start gap-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", r.pastille)}>
                  <Icone className="size-5" />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <DialogTitle className="text-[15px] leading-snug" title={action.action}>{titre}</DialogTitle>
                  <DialogDescription className={cn("text-[12.5px] font-medium", r.texte)}>
                    {r.libelle} · {action.code_http}
                    {LIBELLES_HTTP[action.code_http] ? ` ${LIBELLES_HTTP[action.code_http]}` : ""}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* Requête */}
              <div
                className="flex items-center gap-2 rounded-lg border py-1.5 pr-1.5 pl-2.5"
                style={{ borderColor: `${theme.topColor}2e`, background: `${theme.topColor}0a` }}
              >
                <Badge
                  className={cn(
                    "shrink-0 border-transparent font-mono text-[11px]",
                    CLASSES_METHODE[action.methode] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {action.methode}
                </Badge>
                <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground" title={action.chemin}>
                  {action.chemin}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label="Copier la requête"
                  title="Copier la requête"
                  onClick={() => copier(`${action.methode} ${action.chemin}`, "Requête")}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>

              {/* Contexte */}
              <div className="grid gap-2 sm:grid-cols-2">
                <Info icone={UserRound} libelle="Utilisateur" couleur={theme.iconColor} className="sm:col-span-2">
                  <div className="flex items-center gap-2.5">
                    <AvatarUtilisateur
                      id={action.utilisateur.id}
                      nom={action.utilisateur.nom}
                      prenom={action.utilisateur.prenom}
                      aPhoto={!!action.utilisateur.a_photo}
                      taille={32}
                      fondInitiales={
                        estMoi ? "hsl(var(--primary))" : undefined
                      }
                      couleurInitiales={
                        estMoi
                          ? "hsl(var(--primary-foreground))"
                          : undefined
                      }
                    />
                    <div className="min-w-0 leading-tight">
                      <p className="flex items-center gap-1.5 font-medium">
                        <span className="truncate">{action.utilisateur.nom_complet || "—"}</span>
                        {estMoi ? <BadgeVous /> : null}
                      </p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {[action.utilisateur.matricule, action.utilisateur.email].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <Badge className="ml-auto shrink-0 border-transparent bg-primary/10 font-normal text-primary">
                      {action.role.libelle}
                    </Badge>
                  </div>
                </Info>
                <Info icone={CalendarClock} libelle="Date et heure" couleur={theme.iconColor}>
                  <span className="tabular-nums">
                    {partieDate(action.date_action)}
                    <span className="mx-1.5 text-muted-foreground">·</span>
                    <span className="font-mono">{action.heure_action}</span>
                  </span>
                </Info>
                <Info icone={Layers} libelle="Service" couleur={theme.iconColor}>
                  {action.portail?.libelle ?? action.module}
                </Info>
                <Info icone={Globe} libelle="Adresse IP" couleur={theme.iconColor} className="sm:col-span-2">
                  <span className="font-mono text-[12.5px]">{action.adresse_ip ?? "Non renseignée"}</span>
                </Info>
              </div>

              {/* Corps */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
                    <FileJson className="size-3.5" style={{ color: theme.iconColor }} />
                    Corps de la requête
                    {corpsJson ? (
                      <span className="font-normal text-muted-foreground">
                        · {nbChamps} champ{nbChamps > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </p>
                  {corpsJson ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-[12px]"
                      onClick={() => copier(corpsJson, "Corps")}
                    >
                      <Copy className="size-3.5" />
                      Copier
                    </Button>
                  ) : null}
                </div>
                {corpsJson ? (
                  <pre className="max-h-72 overflow-auto rounded-lg border bg-slate-950 p-3 font-mono text-[11.5px] leading-relaxed text-slate-100">
                    {corpsJson}
                  </pre>
                ) : (
                  <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[12.5px] text-muted-foreground">
                    Aucun corps envoyé avec cette requête.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter
              className="shrink-0 border-t px-5 py-3"
              style={{ borderColor: `${theme.topColor}22`, background: `${theme.topColor}08` }}
            >
              <Button type="button" variant="outline" onClick={onClose}>
                Fermer
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
