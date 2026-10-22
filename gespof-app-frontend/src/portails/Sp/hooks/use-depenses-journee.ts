import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { messageDonneesOuDefaut } from "@/shared/lib/message-utilisateur";
import { depensesJour, validerDepensesJour } from "@/portails/Sp/api/journees-tresorerie";
import type { EtatDepensesJour } from "@/portails/Sp/types/journee-tresorerie.interface";

interface DepensesJournee {
  /** null tant que non chargé, ou sans journée. */
  etat: EtatDepensesJour | null;
  chargement: boolean;
  validation: boolean;
  /** Fusionne les fiches de dépôt de la journée (sans doublon) ; true si réussi. */
  valider: () => Promise<boolean>;
}

/**
 * Liste des dépenses validée d'une journée et état des fiches de dépôt reçues
 * depuis (fiches non intégrées, nouvelles dépenses, apport de chaque fiche).
 * `cleRechargement` relance la lecture (ex. nombre de fiches reçues).
 */
export function useDepensesJournee(
  referenceJournee: string | null,
  cleRechargement: unknown = null,
): DepensesJournee {
  const [resultat, setResultat] = useState<{ cle: string; etat: EtatDepensesJour | null } | null>(null);
  const [version, setVersion] = useState(0);
  const [validation, setValidation] = useState(false);
  const cle = referenceJournee ? `${referenceJournee}:${String(cleRechargement)}:${version}` : null;

  useEffect(() => {
    if (!referenceJournee || cle === null) return;
    let annule = false;
    void depensesJour(referenceJournee)
      .then((etat) => {
        if (!annule) setResultat({ cle, etat });
      })
      .catch(() => {
        if (!annule) setResultat({ cle, etat: null });
      });
    return () => {
      annule = true;
    };
  }, [referenceJournee, cle]);

  const valider = useCallback(async (): Promise<boolean> => {
    if (!referenceJournee) return false;
    setValidation(true);
    try {
      const { depenses_jour, nouvelles } = await validerDepensesJour(referenceJournee);
      const s = (n: number) => (n > 1 ? "s" : "");
      toast.success(
        `Liste validée : ${depenses_jour.nombre} dépense${s(depenses_jour.nombre)} de ${depenses_jour.fiches.length} fiche${s(depenses_jour.fiches.length)}`
        + (nouvelles > 0 ? ` (${nouvelles} nouvelle${s(nouvelles)}, sans doublon).` : "."),
      );
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      toast.error(messageDonneesOuDefaut(
        e instanceof Error ? e.message : null,
        "Impossible de valider les dépenses.",
      ));
      return false;
    } finally {
      setValidation(false);
    }
  }, [referenceJournee]);

  const pret = resultat !== null && resultat.cle === cle;
  // Pendant un rechargement de la même journée, on garde le dernier état (pas de clignotement).
  const memeJournee = resultat !== null && referenceJournee !== null
    && resultat.cle.startsWith(`${referenceJournee}:`);
  return {
    etat: memeJournee ? resultat.etat : null,
    chargement: referenceJournee !== null && !pret,
    validation,
    valider,
  };
}
