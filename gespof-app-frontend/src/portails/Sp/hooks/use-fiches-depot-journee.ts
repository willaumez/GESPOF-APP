import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listerFichesDepotDeJournee, listerFichesDepotDuJour,
} from "@/portails/Sp/api/fiches-depot";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type { FicheDepotResumeSp } from "@/portails/Sp/types/fiche-depot.interface";

interface FichesDepotJournee {
  /** Fiches de la journée, de la plus récente à la plus ancienne (tri backend). */
  fiches: FicheDepotResumeSp[];
  chargement: boolean;
  erreur: boolean;
}

/**
 * Fiches de dépôt reçues du Service Règlement pour la journée choisie dans la TopBar.
 * Sans journée ouverte (journée du jour), repli sur les fiches de la date.
 */
export function useFichesDepotJournee(): FichesDepotJournee {
  const { journee, chargement: chargementJournee, dateIso } = useJourneeSelectionnee();
  const referenceJournee = journee?.reference ?? null;
  const cle = chargementJournee ? null : (referenceJournee ?? `date:${dateIso}`);

  const [resultat, setResultat] = useState<{
    cle: string;
    fiches: FicheDepotResumeSp[];
    erreur: boolean;
  } | null>(null);

  useEffect(() => {
    if (cle === null) return;
    let annule = false;
    const requete = referenceJournee
      ? listerFichesDepotDeJournee(referenceJournee)
      : listerFichesDepotDuJour(dateIso);
    requete
      .then(({ fiches }) => {
        if (!annule) setResultat({ cle, fiches: fiches ?? [], erreur: false });
      })
      .catch((e) => {
        if (annule) return;
        setResultat({ cle, fiches: [], erreur: true });
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger les fiches de dépôt de la journée.",
        );
      });
    return () => {
      annule = true;
    };
  }, [cle, referenceJournee, dateIso]);

  const pret = resultat !== null && resultat.cle === cle;
  return {
    fiches: pret ? resultat.fiches : [],
    chargement: !pret,
    erreur: pret && resultat.erreur,
  };
}
