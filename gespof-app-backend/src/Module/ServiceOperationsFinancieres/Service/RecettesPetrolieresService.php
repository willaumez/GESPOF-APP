<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Repository\ScriptPoolSof;
use App\Shared\Exception\DonneesInvalidesException;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

class RecettesPetrolieresService
{
    private const TTL_DETAIL_ETAX = 21_600; // 6 h

    public function __construct(
        private readonly ScriptPoolSof $scriptPoolSof,
        private readonly CacheInterface $cache,
    ) {
    }

    /**
     * Extraction OP BEAC agrégée (STAT.VM_REC_BEAC) sur une période.
     *
     * @return array<string, mixed>
     */
    public function extraireOpBeac(string $dateDebut, string $dateFin): array
    {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $lignesBrutes = $this->scriptPoolSof->extraireRecettesPetrolieresOpBeac($dateDeb, $dateFinFmt);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Impossible d\'extraire les recettes pétrolières (OP BEAC) : '.$e->getMessage(),
            );
        }

        $lignes = [];
        $total = 0.0;
        foreach ($lignesBrutes as $ligne) {
            $normalisee = $this->normaliserLigneAgregee($ligne);
            $lignes[] = $normalisee;
            $total += (float) $normalisee['montant'];
        }

        return [
            'date_debut' => $dateDeb,
            'date_fin' => $dateFinFmt,
            'etape' => 'op_beac',
            'etape_libelle' => 'Encaissements OP BEAC (agrégé)',
            'compte' => null,
            'lignes' => $lignes,
            'nombre' => \count($lignes),
            'total' => number_format($total, 2, '.', ''),
            'message' => $lignes === []
                ? 'Aucune recette pétrolière OP BEAC pour cette période.'
                : null,
        ];
    }

    /**
     * Extraction états par compte (détail OP_BEAC + E-TAX).
     *
     * @return array<string, mixed>
     */
    public function extraireEtatParCompte(string $dateDebut, string $dateFin): array
    {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $lignesBrutes = $this->scriptPoolSof->extraireRecettesPetrolieresEtatParCompte($dateDeb, $dateFinFmt);
            $detailsBruts = $this->scriptPoolSof->extraireRecettesPetrolieresEtatParCompteDetailsEtaxPeriode(
                $dateDeb,
                $dateFinFmt,
            );
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Impossible d\'extraire les états par compte : '.$e->getMessage(),
            );
        }

        $lignes = [];
        $total = 0.0;
        foreach ($lignesBrutes as $ligne) {
            $normalisee = $this->normaliserLigneEtatParCompte($ligne);
            $lignes[] = $normalisee;
            $total += (float) $normalisee['montant'];
        }

        $detailsEtax = $this->assemblerDetailsEtaxParRef($detailsBruts);

        return [
            'date_debut' => $dateDeb,
            'date_fin' => $dateFinFmt,
            'etape' => 'etat_par_compte',
            'etape_libelle' => 'États par compte (détail OP BEAC)',
            'compte' => null,
            'lignes' => $lignes,
            'details_etax' => $detailsEtax,
            'nombre' => \count($lignes),
            'total' => number_format($total, 2, '.', ''),
            'message' => $lignes === []
                ? 'Aucune opération OP BEAC pour cette période.'
                : null,
        ];
    }

    /**
     * Extraction compte 1812-201 — lignes hors N/A.
     *
     * @return array<string, mixed>
     */
    public function extraireCompte1812201(string $dateDebut, string $dateFin): array
    {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $lignesBrutes = $this->scriptPoolSof->extraireRecettesPetrolieres1812201($dateDeb, $dateFinFmt);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Impossible d\'extraire le compte 1812-201 : '.$e->getMessage(),
            );
        }

        $lignes = [];
        $total = 0.0;
        foreach ($lignesBrutes as $ligne) {
            $normalisee = $this->normaliserLigneDetail($ligne);
            $lignes[] = $normalisee;
            $total += (float) $normalisee['montant'];
        }

        return [
            'date_debut' => $dateDeb,
            'date_fin' => $dateFinFmt,
            'etape' => 'compte_1812_201',
            'etape_libelle' => 'Compte 1812-201 (transferts hors N/A)',
            'compte' => '1812-201',
            'lignes' => $lignes,
            'nombre' => \count($lignes),
            'total' => number_format($total, 2, '.', ''),
            'message' => $lignes === []
                ? 'Aucune ligne 1812-201 (hors N/A) pour cette période.'
                : null,
        ];
    }

    /**
     * Lignes du détail E-TAX pour une référence.
     *
     * @return array<string, mixed>
     */
    public function extraireDetailEtax(string $refEtax): array
    {
        $ref = trim($refEtax);
        if ($ref === '') {
            throw new DonneesInvalidesException('Le paramètre "ref_etax" est requis.');
        }

        $cle = 'sof.detail_etax.'.hash('xxh128', $ref);

        return $this->cache->get($cle, function (ItemInterface $item) use ($ref): array {
            $item->expiresAfter(self::TTL_DETAIL_ETAX);

            try {
                $lignesBrutes = $this->scriptPoolSof->extraireRecettesPetrolieresEtatParCompteDetailEtax($ref);
            } catch (\Throwable $e) {
                throw new DonneesInvalidesException(
                    'Impossible d\'extraire le détail E-TAX : '.$e->getMessage(),
                );
            }

            $lignes = [];
            $total = 0.0;
            foreach ($lignesBrutes as $ligne) {
                $normalisee = $this->normaliserLigneDetailEtax($ligne);
                $lignes[] = $normalisee;
                $total += (float) $normalisee['montant'];
            }

            return [
                'ref_etax' => $ref,
                'lignes' => $lignes,
                'nombre' => \count($lignes),
                'total' => number_format($total, 2, '.', ''),
                'message' => $lignes === []
                    ? 'Aucune ligne de détail E-TAX pour cette référence.'
                    : null,
            ];
        });
    }

    /**
     * @return array{0: \DateTimeImmutable, 1: \DateTimeImmutable}
     */
    private function validerPeriode(string $dateDebut, string $dateFin): array
    {
        $debut = $this->parserDate($dateDebut, 'date de début');
        $fin = $this->parserDate($dateFin, 'date de fin');
        if ($fin < $debut) {
            throw new DonneesInvalidesException(
                'La date de fin doit être postérieure ou égale à la date de début.',
            );
        }

        return [$debut, $fin];
    }

    private function parserDate(string $valeur, string $libelle): \DateTimeImmutable
    {
        $brut = trim($valeur);
        foreach (['Y-m-d', 'd/m/Y'] as $format) {
            $date = \DateTimeImmutable::createFromFormat('!'.$format, $brut);
            if ($date instanceof \DateTimeImmutable) {
                $erreurs = \DateTimeImmutable::getLastErrors();
                if (($erreurs['warning_count'] ?? 0) === 0 && ($erreurs['error_count'] ?? 0) === 0) {
                    return $date;
                }
            }
        }

        throw new DonneesInvalidesException(
            sprintf('La %s doit être au format AAAA-MM-JJ ou JJ/MM/AAAA.', $libelle),
        );
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array{code: ?string, type_recette: ?string, montant: string}
     */
    private function normaliserLigneAgregee(array $ligne): array
    {
        return [
            'code' => $this->texte($this->cellule($ligne, 'CODE')),
            'type_recette' => $this->texte($this->cellule($ligne, 'TYPE_RECETTE')),
            'montant' => $this->montant($this->cellule($ligne, 'MONTANT')),
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function normaliserLigneEtatParCompte(array $ligne): array
    {
        return [
            'd_oper' => $this->formaterDate($this->cellule($ligne, 'D_OPER')),
            'orig' => $this->texte($this->cellule($ligne, 'ORIG')),
            'c_typ' => $this->texte($this->cellule($ligne, 'C_TYP')),
            'c_ref' => $this->texte($this->cellule($ligne, 'C_REF')),
            'l_tiers' => $this->texte($this->cellule($ligne, 'L_TIERS')),
            'l_obj' => $this->texte($this->cellule($ligne, 'L_OBJ')),
            'l_com' => $this->texte($this->cellule($ligne, 'L_COM')),
            'l_exp' => $this->texte($this->cellule($ligne, 'L_EXP')),
            'l_dest' => $this->texte($this->cellule($ligne, 'L_DEST')),
            'montant' => $this->montant($this->cellule($ligne, 'MONTANT')),
            'c_pc' => $this->texte($this->cellule($ligne, 'C_PC')),
            'n_regl' => $this->texte($this->cellule($ligne, 'N_REGL')),
            'd_cpta' => $this->formaterDate($this->cellule($ligne, 'D_CPTA')),
            'n_mattir' => $this->texte($this->cellule($ligne, 'N_MATTIR')),
            'compte' => $this->texte($this->cellule($ligne, 'COMPTE')),
            'libelle_compte' => $this->texte($this->cellule($ligne, 'LIBELLE_COMPTE')),
            'ref_etax' => $this->texte($this->cellule($ligne, 'REF_ETAX')),
            'motif_etax' => $this->texte($this->cellule($ligne, 'MOTIF_ETAX')),
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function normaliserLigneDetail(array $ligne): array
    {
        return [
            'c_pca' => $this->texte($this->cellule($ligne, 'C_PCA')),
            'n_op' => $this->texte($this->cellule($ligne, 'N_OP')),
            'd_cpta' => $this->formaterDate($this->cellule($ligne, 'D_CPTA')),
            'n_lig_op' => $this->texte($this->cellule($ligne, 'N_LIG_OP')),
            'c_typ_det' => $this->texte($this->cellule($ligne, 'C_TYP_DET')),
            'c_it' => $this->texte($this->cellule($ligne, 'C_IT')),
            'c_ope' => $this->texte($this->cellule($ligne, 'C_OPE')),
            'c_ref1' => $this->texte($this->cellule($ligne, 'C_REF1')),
            'c_ref2' => $this->texte($this->cellule($ligne, 'C_REF2')),
            'code' => $this->texte($this->cellule($ligne, 'CODE')),
            'type_recette' => $this->texte($this->cellule($ligne, 'TYPE_RECETTE')),
            'libelle_nature' => $this->texte($this->cellule($ligne, 'LIBELLE_NATURE')),
            'montant' => $this->montant($this->cellule($ligne, 'MONTANT')),
        ];
    }

    /**
     * Groupe les lignes E-TAX par référence et chauffe le cache détail.
     *
     * @param list<array<string, mixed>> $lignesBrutes
     *
     * @return array<string, array{ref_etax: string, lignes: list<array{nature: ?string, libelle_nature: ?string, montant: string}>, nombre: int, total: string, message: ?string}>
     */
    private function assemblerDetailsEtaxParRef(array $lignesBrutes): array
    {
        /** @var array<string, list<array{nature: ?string, libelle_nature: ?string, montant: string}>> $parRef */
        $parRef = [];
        foreach ($lignesBrutes as $ligne) {
            $ref = $this->texte($this->cellule($ligne, 'REF_ETAX'));
            if ($ref === null || $ref === '') {
                continue;
            }
            $parRef[$ref][] = $this->normaliserLigneDetailEtax($ligne);
        }

        $details = [];
        foreach ($parRef as $ref => $lignes) {
            $total = 0.0;
            foreach ($lignes as $ligne) {
                $total += (float) $ligne['montant'];
            }
            $payload = [
                'ref_etax' => $ref,
                'lignes' => $lignes,
                'nombre' => \count($lignes),
                'total' => number_format($total, 2, '.', ''),
                'message' => $lignes === []
                    ? 'Aucune ligne de détail E-TAX pour cette référence.'
                    : null,
            ];
            $details[$ref] = $payload;

            $cle = 'sof.detail_etax.'.hash('xxh128', $ref);
            $this->cache->get($cle, function (ItemInterface $item) use ($payload): array {
                $item->expiresAfter(self::TTL_DETAIL_ETAX);

                return $payload;
            });
        }

        return $details;
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array{nature: ?string, libelle_nature: ?string, montant: string}
     */
    private function normaliserLigneDetailEtax(array $ligne): array
    {
        return [
            'nature' => $this->texte($this->cellule($ligne, 'NATURE')),
            'libelle_nature' => $this->texte($this->cellule($ligne, 'LIBELLE_NATURE')),
            'montant' => $this->montant($this->cellule($ligne, 'MONTANT')),
        ];
    }

    /** @param array<string, mixed> $ligne */
    private function cellule(array $ligne, string $cle): mixed
    {
        foreach ($ligne as $nom => $valeur) {
            if (strcasecmp((string) $nom, $cle) === 0) {
                return $valeur;
            }
        }

        return null;
    }

    private function formaterDate(mixed $valeur): ?string
    {
        if ($valeur === null || $valeur === '') {
            return null;
        }
        if ($valeur instanceof \DateTimeInterface) {
            return $valeur->format('d/m/Y');
        }
        $brut = trim((string) $valeur);
        foreach (['Y-m-d H:i:s', 'Y-m-d', 'd/m/Y', 'd-M-y'] as $format) {
            $date = \DateTimeImmutable::createFromFormat('!'.$format, $brut);
            if ($date instanceof \DateTimeImmutable) {
                return $date->format('d/m/Y');
            }
        }

        return $brut;
    }

    private function texte(mixed $valeur): ?string
    {
        if ($valeur === null) {
            return null;
        }
        $texte = trim((string) $valeur);

        return $texte === '' ? null : $texte;
    }

    private function montant(mixed $valeur): string
    {
        if ($valeur === null || $valeur === '') {
            return '0.00';
        }
        $n = is_numeric($valeur) ? (string) $valeur : preg_replace('/[^\d.,-]/', '', (string) $valeur) ?? '0';
        $n = str_replace(',', '.', $n);
        if (!is_numeric($n)) {
            return '0.00';
        }

        return number_format((float) $n, 2, '.', '');
    }
}
