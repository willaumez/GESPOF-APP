import { useEffect, useState } from "react";
import { Download, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { requeteApiBlob } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { SERVICE_PREVISION_ENDPOINTS } from "@/portails/Sp/api/endpoints";
import type { MaquetteResume } from "@/portails/Sp/types/maquette.interface";

const COULEUR_ENTETE = "#17375E";
const COULEUR_SECTION = "#1F4E79";

interface DialogVueMaquetteProps {
  maquette: MaquetteResume;
  onClose: () => void;
}

interface FeuilleExcel {
  lignes: (string | number | null)[][];
  /** Index (0-based) de la ligne d'en-tête BANCAIRE / PROGRAMMATION. */
  ligneEntete: number;
  /** Index du titre du document ("SITUATION DE TRESORERIE"), -1 si absent. */
  ligneTitre: number;
}

/**
 * Vue Excel d'une maquette : le fichier .xlsx est genere par le backend
 * (GET /maquettes/{id}/excel) puis lu ici avec SheetJS (xlsx) et rendu en
 * grille type tableur. Les bandeaux (en-tete de colonnes, sections) sont
 * reconnus par la forme du document que produit MaquetteExcelGenerator :
 * la ligne "BANCAIRE" marque l'en-tete, et apres elle une ligne sans valeur
 * en colonne PROGRAMMATION est un bandeau de section (les sous-sections
 * portent un "-").
 */
export function DialogVueMaquette({ maquette, onClose }: DialogVueMaquetteProps) {
  const [feuille, setFeuille] = useState<FeuilleExcel | null>(null);
  const [fichier, setFichier] = useState<Blob | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;
    requeteApiBlob(`${SERVICE_PREVISION_ENDPOINTS.MAQUETTES}/${maquette.id}/excel`)
      .then(async (blob) => {
        // xlsx (SheetJS) n'est charge qu'a l'ouverture de la vue : il pese
        // plus lourd que toute la page Parametres reunie.
        const { read, utils } = await import("xlsx");
        const classeur = read(await blob.arrayBuffer());
        const premiere = classeur.Sheets[classeur.SheetNames[0]];
        const lignes = utils.sheet_to_json<(string | number | null)[]>(premiere, {
          header: 1,
          defval: null,
        });
        if (annule) return;
        const ligneEntete = lignes.findIndex((l) => l[0] === "BANCAIRE");
        // Titre du document : premiere ligne non vide apres les 4 lignes
        // ministerielles et avant l'en-tete de colonnes.
        const ligneTitre = lignes.findIndex(
          (l, idx) =>
            idx >= 4
            && (ligneEntete === -1 || idx < ligneEntete)
            && l[0] != null
            && String(l[0]).trim() !== "",
        );
        setFichier(blob);
        setFeuille({ lignes, ligneEntete, ligneTitre });
      })
      .catch(() => {
        if (!annule) setErreur(true);
      });
    return () => {
      annule = true;
    };
  }, [maquette.id]);

  function telecharger() {
    if (!fichier) return;
    const url = URL.createObjectURL(fichier);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `Maquette-${maquette.nom.replace(/[^\p{L}\p{N}]+/gu, "-")}.xlsx`;
    // Le lien doit etre dans le DOM pour que le clic declenche le telechargement
    // sur tous les navigateurs (Firefox notamment).
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    URL.revokeObjectURL(url);
    toast.success("Fichier Excel téléchargé.");
  }

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader className="pr-10">
          <DialogTitle>{maquette.nom}</DialogTitle>
          <DialogDescription>
            Aperçu Excel de la maquette — colonnes BANCAIRE / PROGRAMMATION.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[68vh] overflow-auto rounded-lg border">
          {erreur ? (
            <p className="flex items-center gap-2 px-4 py-8 text-[12.5px] text-muted-foreground">
              <ShieldAlert className="size-4 shrink-0" />
              Le fichier Excel de la maquette n'a pas pu être chargé.
            </p>
          ) : feuille === null ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
              <p className="flex items-center gap-2 pt-2 text-[12px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Génération du fichier Excel…
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse bg-white text-[12px] text-[#1a1a2e]">
              <tbody>
                {feuille.lignes.map((ligne, i) => {
                  const avantEntete = feuille.ligneEntete !== -1 && i < feuille.ligneEntete;
                  const estEntete = i === feuille.ligneEntete;
                  const libelle = ligne[0] == null ? "" : String(ligne[0]);
                  const montant = ligne[1] == null ? "" : String(ligne[1]);
                  const estSection =
                    feuille.ligneEntete !== -1 && i > feuille.ligneEntete
                    && libelle !== "" && montant === "";

                  if (avantEntete) {
                    // En-tete du document (ministere, titre, nom de la maquette) :
                    // hors tableau, sans bordures.
                    const estTitre = i === feuille.ligneTitre;
                    const estNomMaquette = feuille.ligneTitre !== -1 && i > feuille.ligneTitre;
                    return (
                      <tr key={i}>
                        <td
                          colSpan={2}
                          className={cn(
                            "px-2.5 py-0.5",
                            i < 4 && "text-[10.5px] font-semibold",
                            estTitre && "pt-2 text-center text-[13px] font-bold tracking-wide",
                            estNomMaquette && "text-center italic text-[#5a5a6e]",
                            libelle === "" && "h-4",
                          )}
                        >
                          {libelle}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={i}
                      style={
                        estEntete
                          ? { background: COULEUR_ENTETE }
                          : estSection
                            ? { background: COULEUR_SECTION }
                            : undefined
                      }
                    >
                      <td
                        className={cn(
                          "border border-[#b8c4d9] px-2.5 py-1",
                          (estEntete || estSection) && "font-bold text-white",
                          !estEntete && !estSection && "pl-5",
                        )}
                      >
                        {libelle}
                      </td>
                      <td
                        className={cn(
                          "w-40 border border-[#b8c4d9] px-2.5 py-1",
                          estEntete && "text-center font-bold text-white",
                          !estEntete && "text-right tabular-nums",
                        )}
                      >
                        {montant}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="sm:items-center">
          <p className="flex-1 text-[11.5px] text-muted-foreground">
            La colonne PROGRAMMATION est vide dans la maquette : elle sera calculée à la
            rédaction d'une fiche (le montant d'une section est le total de ses sous-sections).
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={telecharger}
            disabled={!fichier}
          >
            <Download className="size-3.5" />
            Télécharger (.xlsx)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
