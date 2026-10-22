import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { dateIsoDepuisReferenceJournee } from "@/portails/Sp/components/archives/archives-affichage";
import { dateIsoJour } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { lireFinSession } from "@/shared/lib/auth-stockage";
import {
  detailJourneeTresorerie,
  journeeTresorerieDuJour,
} from "@/portails/Sp/api/journees-tresorerie";
import {
  JourneeSelectionneeContext,
  type JourneeSelectionneeValue,
} from "@/portails/Sp/hooks/journee-selectionnee";
import type { JourneeTresorerie } from "@/portails/Sp/types/journee-tresorerie.interface";

const CLE_STOCKAGE = "sp.journee-selectionnee";

interface SelectionStockee {
  reference: string | null;
  /**
   * Sélection mémorisée avant la dernière fin de session (déconnexion, inactivité,
   * expiration) : à revérifier à la reconnexion — seule une journée encore ouverte
   * (réouverte) est conservée, une journée clôturée cède la place à celle du jour.
   */
  aVerifier: boolean;
}

function lireSelectionStockee(): SelectionStockee {
  try {
    const brute = window.sessionStorage.getItem(CLE_STOCKAGE);
    if (!brute) return { reference: null, aVerifier: false };
    let reference: string | null = brute;
    let le = 0;
    // Ancien format : référence seule (sans horodatage) → considérée comme antérieure.
    if (brute.startsWith("{")) {
      const lu = JSON.parse(brute) as { reference?: unknown; le?: unknown };
      reference = typeof lu.reference === "string" ? lu.reference : null;
      le = Number(lu.le) || 0;
    }
    return { reference, aVerifier: reference !== null && le < lireFinSession() };
  } catch {
    return { reference: null, aVerifier: false };
  }
}

function stockerReference(reference: string | null) {
  try {
    if (reference) {
      window.sessionStorage.setItem(
        CLE_STOCKAGE,
        JSON.stringify({ reference, le: Date.now() }),
      );
    } else {
      window.sessionStorage.removeItem(CLE_STOCKAGE);
    }
  } catch {
    /* stockage indisponible : la sélection reste valable pour la session courante */
  }
}

function dateDepuisIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Une journée du jour calendaire se suit en mode « du jour » (référence null). */
function referencePour(journee: JourneeTresorerie): string | null {
  return dateIsoDepuisReferenceJournee(journee.reference) === dateIsoJour()
    ? null
    : journee.reference;
}

interface Etat {
  reference: string | null;
  journee: JourneeTresorerie | null;
  /** Incrémentée à chaque demande de (re)chargement. */
  version: number;
  /** Version dont la journée est à jour : chargement tant qu'elle diffère de `version`. */
  versionChargee: number;
}

type Action =
  | { type: "selectionner"; reference: string | null }
  | { type: "rafraichir" }
  | { type: "chargee"; version: number; journee: JourneeTresorerie | null }
  | { type: "appliquer"; journee: JourneeTresorerie };

function reducteur(etat: Etat, action: Action): Etat {
  switch (action.type) {
    case "selectionner":
      return { ...etat, reference: action.reference, version: etat.version + 1 };
    case "rafraichir":
      return { ...etat, version: etat.version + 1 };
    case "chargee":
      if (action.version !== etat.version) return etat;
      return { ...etat, journee: action.journee, versionChargee: action.version };
    case "appliquer": {
      const version = etat.version + 1;
      return {
        reference: referencePour(action.journee),
        journee: action.journee,
        version,
        versionChargee: version,
      };
    }
  }
}

/** Journée de trésorerie unique du portail SP — partagée par les pages via la TopBar. */
export function JourneeSelectionneeProvider({ children }: { children: ReactNode }) {
  const [restauration] = useState(lireSelectionStockee);
  const [etat, dispatch] = useReducer(reducteur, undefined, () => ({
    reference: restauration.reference,
    journee: null,
    version: 0,
    versionChargee: -1,
  }));
  const { reference, journee, version, versionChargee } = etat;
  /** Sélection héritée d'une session précédente, pas encore revérifiée. */
  const verificationEnAttente = useRef(restauration.aVerifier);

  useEffect(() => {
    // Ne pas réhorodater une sélection héritée tant qu'elle n'est pas revérifiée.
    if (verificationEnAttente.current) return;
    stockerReference(reference);
  }, [reference]);

  useEffect(() => {
    // Journée déjà fournie par appliquerJournee() : rien à recharger.
    if (versionChargee === version) return;
    let annule = false;
    const requete = reference
      ? detailJourneeTresorerie(reference)
      : journeeTresorerieDuJour();

    requete
      .then(({ journee: chargee }) => {
        if (annule) return;
        if (verificationEnAttente.current && reference) {
          verificationEnAttente.current = false;
          // Reconnexion sur une journée passée clôturée (non réouverte) : journée du jour.
          if (chargee?.etat === "cloture") {
            dispatch({ type: "selectionner", reference: null });
            return;
          }
          stockerReference(reference);
        }
        dispatch({ type: "chargee", version, journee: chargee });
      })
      .catch((e) => {
        if (annule) return;
        if (reference) {
          verificationEnAttente.current = false;
          // Journée supprimée ou introuvable : retour à la journée du jour.
          toast.error(
            e instanceof Error ? e.message : "Journée de trésorerie introuvable.",
          );
          dispatch({ type: "selectionner", reference: null });
          return;
        }
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger la journée du jour.",
        );
        dispatch({ type: "chargee", version, journee: null });
      });

    return () => {
      annule = true;
    };
    // `reference` et `versionChargee` sont lus pour la version demandée uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // Un choix explicite de l'utilisateur remplace la sélection héritée : plus rien à revérifier.
  const selectionner = useCallback((prochaine: string | null) => {
    verificationEnAttente.current = false;
    dispatch({ type: "selectionner", reference: prochaine });
  }, []);
  const appliquerJournee = useCallback((maj: JourneeTresorerie) => {
    verificationEnAttente.current = false;
    dispatch({ type: "appliquer", journee: maj });
  }, []);
  const rafraichir = useCallback(() => dispatch({ type: "rafraichir" }), []);

  const aujourdhui = dateIsoJour();
  const dateIso =
    (reference ? dateIsoDepuisReferenceJournee(reference) : null) ?? aujourdhui;
  const chargement = versionChargee !== version;

  const value = useMemo<JourneeSelectionneeValue>(
    () => ({
      reference,
      journee,
      chargement,
      date: dateDepuisIso(dateIso),
      dateIso,
      estDuJour: dateIso === aujourdhui,
      selectionner,
      appliquerJournee,
      rafraichir,
    }),
    [reference, journee, chargement, dateIso, aujourdhui, selectionner, appliquerJournee, rafraichir],
  );

  return (
    <JourneeSelectionneeContext.Provider value={value}>
      {children}
    </JourneeSelectionneeContext.Provider>
  );
}
