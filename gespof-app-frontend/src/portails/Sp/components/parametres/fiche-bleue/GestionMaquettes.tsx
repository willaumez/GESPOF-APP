import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye, FileStack, Loader2, MoreHorizontal, Pencil, Plus, Power, RefreshCw, Search, SearchX,
  ShieldAlert, Star, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ErreurApi } from "@/shared/lib/api";
import { useAuth } from "@/shared/hooks/use-auth";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/shared/components/ui/card";
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/shared/components/ui/empty";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  detailMaquette, listerCatalogueSections, listerMaquettes, modifierMaquette,
  supprimerMaquette,
} from "@/portails/Sp/api/maquettes";
import type {
  MaquetteDetail, MaquetteResume, SectionMaquette,
} from "@/portails/Sp/types/maquette.interface";
import { DialogMaquette } from "./DialogMaquette";
import { DialogVueMaquette } from "./DialogVueMaquette";

/** Edition en cours : `maquette` a null = creation. */
type Edition = { maquette: MaquetteDetail | null };

/** Date de creation / derniere modification, ex. "19/08/2026 13:30". */
function formaterDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Gestion des maquettes de Fiche Bleue : liste, creation, modification,
 * apercu Excel ("Preview", aussi ouvert au clic sur la ligne) et suppression.
 * La suppression est reservee au chef SP (le backend l'impose
 * avec #[IsGranted('ROLE_CHEF_SP')]) et refusee des qu'une fiche a ete
 * generee depuis la maquette.
 */
export function GestionMaquettes() {
  const { hasRole } = useAuth();
  const peutSupprimer = hasRole("CHEF_SP");

  const [maquettes, setMaquettes] = useState<MaquetteResume[]>([]);
  const [catalogue, setCatalogue] = useState<SectionMaquette[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [recherche, setRecherche] = useState("");

  const [edition, setEdition] = useState<Edition | null>(null);
  const [ouvertureId, setOuvertureId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [aSupprimer, setASupprimer] = useState<MaquetteResume | null>(null);
  const [enVue, setEnVue] = useState<MaquetteResume | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  // L'etat n'est modifie que dans les callbacks de la promesse : l'effet de
  // montage ci-dessous peut appeler cette fonction sans declencher de rendu
  // en cascade (l'etat initial est deja `loading`).
  const chargerMaquettes = useCallback((terme: string) => {
    return listerMaquettes(terme.trim() || undefined)
      .then((data) => {
        setMaquettes(data.maquettes ?? []);
        setErreur(false);
      })
      .catch(() => setErreur(true))
      .finally(() => setLoading(false));
  }, []);

  // Premier chargement immediat, puis recherche avec un debounce de 300 ms
  // pour ne pas interroger l'API a chaque frappe.
  const premierChargement = useRef(true);
  useEffect(() => {
    if (premierChargement.current) {
      premierChargement.current = false;
      void chargerMaquettes(recherche);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      void chargerMaquettes(recherche);
    }, 300);
    return () => clearTimeout(timer);
  }, [recherche, chargerMaquettes]);

  /** Rechargement demande par l'utilisateur ou apres une modification. */
  const rafraichir = useCallback(() => {
    setLoading(true);
    return chargerMaquettes(recherche);
  }, [chargerMaquettes, recherche]);

  // Catalogue des sections reutilisables : charge une fois, sans bloquer la liste.
  useEffect(() => {
    listerCatalogueSections()
      .then((data) => setCatalogue(data.sections ?? []))
      .catch(() => setCatalogue([]));
  }, []);

  async function ouvrirModification(maquette: MaquetteResume) {
    setOuvertureId(maquette.id);
    try {
      const { maquette: detail } = await detailMaquette(maquette.id);
      setEdition({ maquette: detail });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de charger la maquette.");
    } finally {
      setOuvertureId(null);
    }
  }

  /** Action rapide du menu : designer cette maquette comme maquette par defaut. */
  async function definirParDefaut(maquette: MaquetteResume) {
    setActionId(maquette.id);
    try {
      await modifierMaquette(maquette.id, { est_par_defaut: true });
      toast.success(`« ${maquette.nom} » est maintenant la maquette par défaut.`);
      await rafraichir();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de changer la maquette par défaut.");
    } finally {
      setActionId(null);
    }
  }

  /** Action rapide du menu : activer / desactiver la maquette. */
  async function basculerActivation(maquette: MaquetteResume) {
    setActionId(maquette.id);
    try {
      await modifierMaquette(maquette.id, { actif: !maquette.actif });
      toast.success(maquette.actif ? "Maquette désactivée." : "Maquette activée.");
      await rafraichir();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de modifier la maquette.");
    } finally {
      setActionId(null);
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setSuppressionEnCours(true);
    try {
      await supprimerMaquette(aSupprimer.id);
      toast.success("Maquette supprimée.");
      setASupprimer(null);
      await rafraichir();
    } catch (e) {
      toast.error(
        e instanceof ErreurApi ? e.message : "Erreur lors de la suppression de la maquette.",
      );
    } finally {
      setSuppressionEnCours(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-[15px]">Maquettes de Fiche Bleue</CardTitle>
            <CardDescription>
              Structures réutilisables (colonnes BANCAIRE / PROGRAMMATION) servant de base à
              la rédaction des Fiches Bleues.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher une maquette…"
                aria-label="Rechercher une maquette"
                className="h-8 w-56 pl-8"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void rafraichir()}
              disabled={loading}
            >
              <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />
              Actualiser
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => setEdition({ maquette: null })}
            >
              <Plus className="size-3.5" />
              Nouvelle maquette
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : erreur ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShieldAlert />
              </EmptyMedia>
              <EmptyTitle>Chargement impossible</EmptyTitle>
              <EmptyDescription>
                Les maquettes n'ont pas pu être récupérées.
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" onClick={() => void rafraichir()}>
              Réessayer
            </Button>
          </Empty>
        ) : maquettes.length === 0 && recherche.trim() !== "" ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>Aucun résultat</EmptyTitle>
              <EmptyDescription>
                Aucune maquette ne correspond à « {recherche.trim()} ».
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" size="sm" onClick={() => setRecherche("")}>
              Effacer la recherche
            </Button>
          </Empty>
        ) : maquettes.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileStack />
              </EmptyMedia>
              <EmptyTitle>Aucune maquette</EmptyTitle>
              <EmptyDescription>
                Créez une première maquette pour définir la structure des Fiches Bleues.
              </EmptyDescription>
            </EmptyHeader>
            <Button size="sm" className="gap-1.5" onClick={() => setEdition({ maquette: null })}>
              <Plus className="size-3.5" />
              Nouvelle maquette
            </Button>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="w-24 text-center">Sections</TableHead>
                <TableHead className="w-24 text-center">Fiches</TableHead>
                <TableHead className="w-40">Statut</TableHead>
                <TableHead className="w-36">Date</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maquettes.map((maquette) => (
                <TableRow
                  key={maquette.id}
                  className="cursor-pointer"
                  onClick={() => setEnVue(maquette)}
                >
                  <TableCell>
                    <span className="block font-medium text-foreground">{maquette.nom}</span>
                    {maquette.description && (
                      <span className="block text-[12px] text-muted-foreground">
                        {maquette.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{maquette.nb_sections}</TableCell>
                  <TableCell className="text-center tabular-nums">{maquette.nb_fiches}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        className={
                          maquette.actif
                            ? "border-transparent bg-success/10 text-success"
                            : "border-transparent bg-muted text-muted-foreground"
                        }
                      >
                        {maquette.actif ? "Active" : "Inactive"}
                      </Badge>
                      {maquette.est_par_defaut && (
                        <Badge className="border-transparent bg-accent/10 text-accent">
                          Par défaut
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[12px] tabular-nums text-muted-foreground">
                    {formaterDate(maquette.mis_a_jour_le)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="Actions sur la maquette"
                          >
                            {ouvertureId === maquette.id || actionId === maquette.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onSelect={() => setEnVue(maquette)}>
                            <Eye className="size-4 text-accent" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={ouvertureId === maquette.id}
                            onSelect={() => void ouvrirModification(maquette)}
                          >
                            <Pencil className="size-4 text-warning" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={maquette.est_par_defaut || actionId === maquette.id}
                            title={
                              maquette.est_par_defaut
                                ? "Déjà maquette par défaut"
                                : undefined
                            }
                            onSelect={() => void definirParDefaut(maquette)}
                          >
                            <Star className="size-4 text-success" />
                            Définir par défaut
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={actionId === maquette.id}
                            onSelect={() => void basculerActivation(maquette)}
                          >
                            <Power className="size-4 text-muted-foreground" />
                            {maquette.actif ? "Désactiver" : "Activer"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={!peutSupprimer || maquette.nb_fiches > 0}
                            title={
                              !peutSupprimer
                                ? "Réservé au chef SP"
                                : maquette.nb_fiches > 0
                                  ? "Maquette déjà utilisée par des fiches"
                                  : undefined
                            }
                            onSelect={() => setASupprimer(maquette)}
                          >
                            <Trash2 className="size-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {enVue && <DialogVueMaquette maquette={enVue} onClose={() => setEnVue(null)} />}

      {edition && (
        <DialogMaquette
          maquette={edition.maquette}
          catalogue={catalogue}
          onClose={() => setEdition(null)}
          onEnregistre={() => void rafraichir()}
        />
      )}

      <AlertDialog
        open={aSupprimer !== null}
        onOpenChange={(ouvert) => { if (!ouvert) setASupprimer(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette maquette ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {aSupprimer?.nom} » sera définitivement supprimée. Les sections qu'elle
              utilise restent disponibles dans le catalogue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={suppressionEnCours}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void confirmerSuppression(); }}
              disabled={suppressionEnCours}
            >
              {suppressionEnCours && <Loader2 className="size-3.5 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
