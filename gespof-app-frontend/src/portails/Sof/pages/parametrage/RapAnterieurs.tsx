// Modèle cible : rap_situation — toutes lignes EX ≤ N-1 au 31/12/N-1 ;
// colonnes STATUT (Arriérés/Instances) + C_CATEG ; filtre manuel ANT trop restrictif (B14).
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { SOF_VERT } from "@/portails/Sof/components/SofCards";
import {
  importerRapAnterieurs,
  obtenirRapAnterieurs,
} from "@/portails/Sof/api/parametrage";
import type {
  RapAnterieurLigneSof,
  RapAnterieurLotSof,
} from "@/portails/Sof/types/parametrage.interface";
import { useExerciceAnneeCourante } from "@/portails/Sof/hooks/useExerciceAnneeCourante";
import { useAuth } from "@/shared/hooks/use-auth";
import { formatMontant } from "@/shared/lib/format";

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Import JSON structuré (stub Excel) : { lignes: [...] }. */
async function lireFichierJson(fichier: File): Promise<{
  lignes: RapAnterieurLigneSof[];
}> {
  const texte = await fichier.text();
  const data = JSON.parse(texte) as unknown;
  if (Array.isArray(data)) {
    return { lignes: data as RapAnterieurLigneSof[] };
  }
  if (data && typeof data === "object" && Array.isArray((data as { lignes?: unknown }).lignes)) {
    return { lignes: (data as { lignes: RapAnterieurLigneSof[] }).lignes };
  }
  throw new Error("JSON attendu : { lignes: [...] } ou un tableau de lignes.");
}

export default function RapAnterieurs() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const { annee, chargement: chargementEx } = useExerciceAnneeCourante();
  const fichierRef = useRef<HTMLInputElement>(null);

  const [lot, setLot] = useState<RapAnterieurLotSof | null>(null);
  const [lignes, setLignes] = useState<RapAnterieurLigneSof[]>([]);
  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async (ex: number) => {
    setChargement(true);
    try {
      const res = await obtenirRapAnterieurs(ex);
      setLot(res.lot);
      setLignes(res.lignes ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      setLot(null);
      setLignes([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (annee == null) return;
    void charger(annee);
  }, [annee, charger]);

  async function onImportFichier(fichier: File) {
    if (!estChef || annee == null) return;
    setEnCours(true);
    try {
      const { lignes: raw } = await lireFichierJson(fichier);
      const res = await importerRapAnterieurs(annee, {
        fichier: fichier.name,
        lignes: raw,
      });
      setLot(res.lot);
      setLignes(res.lignes ?? []);
      const ignorees = res.lignes_ignorees_ex ?? 0;
      toast.success(
        `Import OK · ${res.lot?.nb_lignes ?? 0} lignes` +
          (ignorees ? ` · ${ignorees} ignorée(s) (EX > N-1)` : ""),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setEnCours(false);
      if (fichierRef.current) fichierRef.current.value = "";
    }
  }

  const sousTitre = lot
    ? `${lot.nb_lignes} lignes · RAP ${formatMontant(Number(lot.total_rap))} · brut ${formatMontant(Number(lot.total_brut))}`
    : "En attente d'import";

  if (chargementEx || chargement) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
        <Loader2 size={16} className="animate-spin" />
        Chargement…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[12.5px] text-[#64748b]">
        Référence au 31/12/2024 : 7 884 lignes ; RAP 919 862 862 965 FCFA ; brut 1 761
        370 010 667 FCFA. Filtre : EX ≤ N-1 (conserve les lignes de l&apos;exercice N-1).
        {annee != null ? ` · Lot pour l'exercice ${annee}.` : null}
        {lot?.importe_le
          ? ` · Importé le ${new Date(lot.importe_le).toLocaleString("fr-FR")}.`
          : null}
      </p>
      <input
        ref={fichierRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImportFichier(f);
        }}
      />
      <SofEtatTablePage
        config={{
          titre: "RAP des exercices antérieurs",
          description:
            "Situation des RAP au 31/12/N-1, exercices antérieurs et N-1.",
          remplace: "« RAP antérieurs »",
          sousTitre,
          colonnes: [
            { key: "statut", label: "STATUT" },
            { key: "echeance", label: "Échéance", mono: true },
            { key: "ex", label: "Ex.", mono: true },
            { key: "ordonnance", label: "Ordonnance", mono: true },
            { key: "ministere", label: "Ministère" },
            { key: "titre", label: "Titre", mono: true },
            { key: "nature", label: "Nature", mono: true },
            { key: "beneficiaire", label: "Bénéficiaire" },
            { key: "brut", label: "Brut", align: "r", montant: true },
            { key: "rap", label: "RAP", align: "r", montant: true },
            { key: "c_categ", label: "C_CATEG", mono: true },
          ],
          lignes: lignes.map((l) => ({
            statut: l.statut_libelle ?? l.statut,
            echeance: formatDateFr(l.echeance),
            ex: String(l.exercice),
            ordonnance: l.ordonnance,
            ministere: l.ministere ?? "—",
            titre: l.titre ?? "—",
            nature: l.nature ?? "—",
            beneficiaire: l.beneficiaire ?? "—",
            brut: Number(l.brut),
            rap: Number(l.rap),
            c_categ: l.c_categ ?? "—",
          })),
          totalKeys: ["brut", "rap"],
          actionsExtra: estChef ? (
            <button
              type="button"
              disabled={enCours || annee == null}
              onClick={() => fichierRef.current?.click()}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{
                background: `linear-gradient(180deg, ${SOF_VERT} 0%, #1e6650 100%)`,
              }}
            >
              {enCours ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Importer JSON
            </button>
          ) : undefined,
        }}
      />
    </div>
  );
}
