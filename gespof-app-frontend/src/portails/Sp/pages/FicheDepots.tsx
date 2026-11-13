import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Link2 } from "lucide-react";
import { formatMontant } from "@/shared/lib/format";
import { SpPageHeader } from "@/portails/Sp/components/layout/SpPageHeader";
import { SpKpiBandeau } from "@/portails/Sp/components/layout/SpKpiBandeau";
import {
  SpBoutonPrimaire,
  SpBoutonSecondaire,
} from "@/portails/Sp/components/layout/SpBoutonsPage";
import { VueListeFichesDepot } from "@/portails/Sp/components/fiche-depot/VueListeFichesDepot";
import { listerFichesDepot } from "@/portails/Sp/api/fiches-depot";
import { parseMontantNombre } from "@/portails/Sp/components/fiche-bleue/fiche-bleue-affichage";
import { useJourneeSelectionnee } from "@/portails/Sp/hooks/journee-selectionnee";
import type { FicheDepotResumeSp } from "@/portails/Sp/types/fiche-depot.interface";

function dateIlYa(jours: number): string {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Fiche des dépôts — liste archive Prototype v2
 * (KPIs 30 jours + tableau des fiches reçues du SR).
 */
export default function FicheDepots() {
  const navigate = useNavigate();
  const { journee } = useJourneeSelectionnee();
  const [kpis, setKpis] = useState<FicheDepotResumeSp[]>([]);

  useEffect(() => {
    let annule = false;
    void listerFichesDepot({
      limite: "all",
      date_debut: dateIlYa(30),
    })
      .then((data) => {
        if (!annule) setKpis(data.fiches ?? []);
      })
      .catch(() => {
        if (!annule) setKpis([]);
      });
    return () => {
      annule = true;
    };
  }, []);

  const synthese = useMemo(() => {
    const montant = kpis.reduce(
      (s, f) => s + (parseMontantNombre(f.montant_total) ?? 0),
      0,
    );
    const aRattacher = kpis.filter((f) => !f.journee_tresorerie_reference).length;
    return {
      recues: kpis.length,
      montant,
      aRattacher,
    };
  }, [kpis]);

  function ouvrirRapprochement() {
    if (!journee?.reference) {
      void navigate("/sp/fiche-matinale");
      return;
    }
    void navigate(
      `/sp/fiche-matinale/rapprochement-depenses/${encodeURIComponent(journee.reference)}`,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SpPageHeader
        eyebrow="Fiches journalières · Reçues du Service Règlement"
        title="Fiche des dépôts"
        description="Fiches de dépôt transmises par le Pool SR et rattachées aux journées de trésorerie."
        actions={
          <>
            <SpBoutonSecondaire disabled title="Export à venir">
              <Download size={16} />
              Exporter
            </SpBoutonSecondaire>
            <SpBoutonPrimaire onClick={ouvrirRapprochement}>
              <Link2 size={16} />
              Rapprochement des dépenses
            </SpBoutonPrimaire>
          </>
        }
      />

      <SpKpiBandeau
        items={[
          {
            libelle: "Fiches reçues (30 jours)",
            valeur: String(synthese.recues),
            sousTitre: "Systac, Sigma, Numéraire",
          },
          {
            libelle: "Montant cumulé",
            valeur: formatMontant(synthese.montant),
            sousTitre: "FCFA",
          },
          {
            libelle: "À rattacher",
            valeur: String(synthese.aRattacher),
            sousTitre:
              synthese.aRattacher > 0
                ? "Journée non ouverte à réception"
                : "Toutes rattachées",
            highlight: synthese.aRattacher > 0,
          },
        ]}
      />

      <VueListeFichesDepot maquette />
    </div>
  );
}
