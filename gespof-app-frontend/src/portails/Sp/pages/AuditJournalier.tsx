import { useEffect, useMemo, useState } from "react";
import { Download, Inbox, Loader2 } from "lucide-react";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { SpPageHeader } from "@/portails/Sp/components/layout/SpPageHeader";
import { SpKpiBandeau } from "@/portails/Sp/components/layout/SpKpiBandeau";
import { SpBoutonSecondaire } from "@/portails/Sp/components/layout/SpBoutonsPage";
import { SpTag, type SpTagKind } from "@/portails/Sp/components/layout/SpTag";
import { historiqueJournee } from "@/portails/Sp/api/journees-tresorerie";
import { libelleDateFr } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type { HistoriqueJournee } from "@/portails/Sp/types/journal-journee.interface";

type Categorie =
  | "cycle"
  | "fiche_bleue"
  | "fiche_execution"
  | "depots"
  | "listes"
  | "rapprochement"
  | "autre";

const CATEGORIES: Record<Categorie, { libelle: string; kind: SpTagKind }> = {
  cycle: { libelle: "Cycle de la journée", kind: "neu" },
  fiche_bleue: { libelle: "Fiche Bleue", kind: "info" },
  fiche_execution: { libelle: "Fiche d'exécution", kind: "info" },
  depots: { libelle: "Fiches de dépôt", kind: "warn" },
  listes: { libelle: "Recettes et dépenses", kind: "ok" },
  rapprochement: { libelle: "Rapprochement", kind: "ok" },
  autre: { libelle: "Autre", kind: "neu" },
};

const TYPES: Record<string, { categorie: Categorie; action: string }> = {
  ouverture: { categorie: "cycle", action: "Ouverture" },
  cloture: { categorie: "cycle", action: "Clôture" },
  reouverture: { categorie: "cycle", action: "Réouverture" },
  fiche_bleue_liee: { categorie: "fiche_bleue", action: "Liaison" },
  fiche_bleue_modifiee: { categorie: "fiche_bleue", action: "Modification" },
  programme_saisi: { categorie: "fiche_bleue", action: "Saisie" },
  fiche_execution_creee: { categorie: "fiche_execution", action: "Création" },
  realise_saisi: { categorie: "fiche_execution", action: "Mise à jour" },
  rubrique_ajoutee: { categorie: "fiche_execution", action: "Ajout" },
  rubrique_modifiee: { categorie: "fiche_execution", action: "Modification" },
  rubrique_supprimee: { categorie: "fiche_execution", action: "Suppression" },
  rubriques_reordonnees: { categorie: "fiche_execution", action: "Réordonnancement" },
  fiche_depot_demandee: { categorie: "depots", action: "Demande" },
  fiche_depot_envoyee: { categorie: "depots", action: "Envoi" },
  fiche_depot_recue: { categorie: "depots", action: "Réception" },
  recettes_validees: { categorie: "listes", action: "Liste validée" },
  depenses_validees: { categorie: "listes", action: "Liste validée" },
  rapprochement: { categorie: "rapprochement", action: "Rapprochement" },
  rapprochement_annule: { categorie: "rapprochement", action: "Annulation" },
};

const GRILLE = "80px 190px 130px minmax(260px, 2fr) 170px";

function heureCourte(heure: string): string {
  return heure.slice(0, 5);
}

function infoType(type: string) {
  return TYPES[type] ?? { categorie: "autre" as const, action: "Action" };
}

/**
 * Audit journalier — chronologie Prototype v2 de la journée sélectionnée.
 */
export default function AuditJournalier() {
  const { journee, date, chargement: chargementJournee } = useJourneeSelectionnee();
  const reference = journee?.reference ?? null;

  const [resultat, setResultat] = useState<{
    reference: string;
    donnees: HistoriqueJournee | null;
    erreur: string | null;
  } | null>(null);

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
            erreur: messageDonneesOuDefaut(
              e instanceof Error ? e.message : null,
              "Impossible de charger l'audit de la journée.",
            ),
          });
        }
      });
    return () => {
      annule = true;
    };
  }, [reference]);

  const pret = resultat !== null && resultat.reference === reference;
  const chargement = chargementJournee || (reference !== null && !pret);
  const historique = pret ? resultat.donnees : null;
  const evenements = useMemo(
    () => [...(historique?.evenements ?? [])].reverse(),
    [historique],
  );

  const agentsHorsSysteme = useMemo(() => {
    const noms = new Set<string>();
    for (const e of historique?.evenements ?? []) {
      const nom = e.utilisateur.nom_complet;
      if (!nom || /^syst[eè]me/i.test(nom)) continue;
      noms.add(nom);
    }
    return noms.size;
  }, [historique]);

  const ouverture = (historique?.evenements ?? []).find(
    (e) => e.type === "ouverture",
  );
  const derniere = evenements[0] ?? null;

  if (!chargementJournee && !journee) {
    return (
      <div className="flex flex-col gap-6">
        <SpPageHeader
          eyebrow={`Fiches journalières · ${libelleDateFr(date)}`}
          title="Audit journalier"
          description="Chronologie des opérations réalisées sur la journée de trésorerie sélectionnée."
        />
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#e2e8f0] bg-white text-[#64748b]">
          <Inbox className="size-6" />
          <p className="text-[14px]">
            Aucune journée ouverte pour le {libelleDateFr(date)}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SpPageHeader
        eyebrow={`Fiches journalières · ${reference ?? "—"}`}
        title="Audit journalier"
        description="Chronologie des opérations réalisées sur la journée de trésorerie sélectionnée."
        actions={
          <SpBoutonSecondaire disabled title="Export à venir">
            <Download size={16} />
            Exporter le journal
          </SpBoutonSecondaire>
        }
      />

      <SpKpiBandeau
        items={[
          {
            libelle: "Événements",
            valeur: chargement ? "…" : String(evenements.length),
            sousTitre: ouverture
              ? `Depuis l'ouverture à ${heureCourte(ouverture.heure)}`
              : "—",
          },
          {
            libelle: "Agents intervenus",
            valeur: chargement ? "…" : String(agentsHorsSysteme),
            sousTitre: "Hors traitements système",
          },
          {
            libelle: "Dernière action",
            valeur: chargement
              ? "…"
              : derniere
                ? heureCourte(derniere.heure)
                : "—",
            sousTitre: derniere
              ? infoType(derniere.type).action
              : "Aucune action",
          },
        ]}
      />

      <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 820 }}>
            <div
              className="grid items-center border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]"
              style={{
                gridTemplateColumns: GRILLE,
                gap: 12,
                padding: "10px 18px",
              }}
            >
              <span>Heure</span>
              <span>Catégorie</span>
              <span>Action</span>
              <span>Détail</span>
              <span>Utilisateur</span>
            </div>

            {chargement ? (
              <div className="flex items-center justify-center gap-2 py-12 text-[#64748b]">
                <Loader2 className="size-5 animate-spin" />
                Chargement…
              </div>
            ) : pret && resultat.erreur ? (
              <div className="flex flex-col items-center gap-1.5 py-12 text-[#64748b]">
                <Inbox className="size-5" />
                <span className="text-sm">{resultat.erreur}</span>
              </div>
            ) : evenements.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-12 text-[#64748b]">
                <Inbox className="size-5" />
                <span className="text-sm">
                  Aucune action enregistrée pour cette journée.
                </span>
              </div>
            ) : (
              evenements.map((e) => {
                const info = infoType(e.type);
                const cat = CATEGORIES[info.categorie];
                return (
                  <div
                    key={e.id}
                    className="grid items-center border-b border-[#f1f5f9] text-[13.5px]"
                    style={{
                      gridTemplateColumns: GRILLE,
                      gap: 12,
                      minHeight: 46,
                      padding: "8px 18px",
                    }}
                  >
                    <span
                      className="tabular-nums text-[#475569]"
                      style={{
                        fontFamily:
                          '"IBM Plex Mono", ui-monospace, monospace',
                        fontSize: 12.5,
                      }}
                    >
                      {heureCourte(e.heure)}
                    </span>
                    <span>
                      <SpTag kind={cat.kind}>{cat.libelle}</SpTag>
                    </span>
                    <span className="font-semibold text-[#0f172a]">
                      {info.action}
                    </span>
                    <span className="min-w-0 truncate text-[#334155]">
                      {e.libelle}
                    </span>
                    <span className="truncate text-[#0f172a]">
                      {e.utilisateur.nom_complet}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
