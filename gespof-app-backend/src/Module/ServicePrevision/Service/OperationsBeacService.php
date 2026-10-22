<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Repository\ScriptPoolSp;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;

class OperationsBeacService implements OperationsBeacServiceInterface
{
    public function __construct(private readonly ScriptPoolSp $scriptPoolSp)
    {
    }

    public function listerDatesOuverture(): array
    {
        try {
            $lignes = $this->scriptPoolSp->listerDatesOuverture();
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Impossible de récupérer les dates d\'ouverture Oracle : '.$e->getMessage(),
            );
        }

        $dates = [];
        foreach ($lignes as $ligne) {
            $date = $this->formaterDate($this->cellule($ligne, 'DATE_OUVERTURE'));
            $dates[] = [
                'date_ouverture' => $date,
                'n_session' => $this->texte($this->cellule($ligne, 'N_SESSION')),
                'code' => $this->texte($this->cellule($ligne, 'CODE')),
                'libelle' => $this->texte($this->cellule($ligne, 'LIBELLE')),
            ];
        }

        return [
            'dates' => $dates,
            'message' => $dates === [] ? 'Aucune date d\'ouverture disponible.' : null,
        ];
    }

    public function listerRecettes(
        string $dateOuverture,
        ?string $recherche = null,
        ?string $origine = null,
        int $page = 1,
        int|string $limite = 15,
    ): array
    {
        $date = trim($dateOuverture);
        if (!preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $date)) {
            throw new DonneesInvalidesException(
                'La date d\'ouverture doit être au format JJ/MM/AAAA.',
            );
        }

        try {
            $lignes = $this->scriptPoolSp->listerRecettes($date);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Impossible de récupérer les recettes Oracle : '.$e->getMessage(),
            );
        }

        $operations = [];
        foreach ($lignes as $ligne) {
            $operations[] = [
                'origine' => $this->texte($this->cellule($ligne, 'ORIGINE')) ?? '',
                'date_reception' => $this->formaterDate($this->cellule($ligne, 'DATE_RECEPTION')),
                'date_validation' => $this->formaterDate($this->cellule($ligne, 'DATE_VALIDATION')),
                'type_operation' => $this->texte($this->cellule($ligne, 'TYPE_OPERATION')) ?? 'RECETTE',
                'montant' => $this->montant($this->cellule($ligne, 'MONTANT')),
                'reference' => $this->texte($this->cellule($ligne, 'REFERENCE')),
                'num_reglement' => $this->texte($this->cellule($ligne, 'NUM_REGLEMENT')),
                'libelle_tiers' => $this->texte($this->cellule($ligne, 'LIBELLE_TIERS')),
                'delai_jours' => $this->texte($this->cellule($ligne, 'DELAI_JOURS')) ?? '0',
            ];
        }

        $origines = $this->originesUniques($operations);
        $filtrees = $this->filtrerOperations($operations, $recherche, $origine);

        $totalMontant = '0.00';
        foreach ($filtrees as $operation) {
            $totalMontant = bcadd($totalMontant, $operation['montant'], 2);
        }

        $nombre = \count($filtrees);
        [$pageNormale, $pages, $limiteNormale, $tranche] = $this->paginer($filtrees, $page, $limite);

        return [
            'date' => $date,
            'operations' => $tranche,
            'total' => $totalMontant,
            'nombre' => $nombre,
            'page' => $pageNormale,
            'pages' => $pages,
            'limite' => $limiteNormale,
            'origines' => $origines,
            'message' => $nombre === 0
                ? ((trim((string) $recherche) !== '' || trim((string) $origine) !== '')
                    ? 'Aucune recette ne correspond aux filtres.'
                    : 'Aucune recette pour cette date.')
                : null,
        ];
    }

    /**
     * @param list<array<string, mixed>> $operations
     *
     * @return list<string>
     */
    private function originesUniques(array $operations): array
    {
        $origines = [];
        foreach ($operations as $operation) {
            $origine = trim((string) ($operation['origine'] ?? ''));
            if ($origine !== '') {
                $origines[$origine] = $origine;
            }
        }
        $liste = array_values($origines);
        natcasesort($liste);

        return array_values($liste);
    }

    /**
     * @param list<array<string, mixed>> $operations
     *
     * @return list<array<string, mixed>>
     */
    private function filtrerOperations(array $operations, ?string $recherche, ?string $origine): array
    {
        $origineFiltre = trim((string) $origine);
        $terme = $this->normaliserRecherche($recherche);

        $filtrees = [];
        foreach ($operations as $operation) {
            if ($origineFiltre !== '' && strcasecmp((string) $operation['origine'], $origineFiltre) !== 0) {
                continue;
            }
            if ($terme !== '' && !$this->operationCorrespond($operation, $terme)) {
                continue;
            }
            $filtrees[] = $operation;
        }

        return $filtrees;
    }

    /** @param array<string, mixed> $operation */
    private function operationCorrespond(array $operation, string $terme): bool
    {
        $champs = [
            $operation['origine'] ?? '',
            $operation['reference'] ?? '',
            $operation['num_reglement'] ?? '',
            $operation['libelle_tiers'] ?? '',
            $operation['date_reception'] ?? '',
            $operation['date_validation'] ?? '',
            $operation['montant'] ?? '',
        ];
        foreach ($champs as $champ) {
            if (str_contains($this->normaliserRecherche((string) $champ), $terme)) {
                return true;
            }
        }

        return false;
    }

    private function normaliserRecherche(?string $valeur): string
    {
        $texte = mb_strtolower(trim((string) $valeur), 'UTF-8');
        if ($texte === '') {
            return '';
        }
        if (\class_exists(\Normalizer::class)) {
            $decomp = \Normalizer::normalize($texte, \Normalizer::FORM_D);
            if (\is_string($decomp)) {
                $texte = preg_replace('/\p{Mn}/u', '', $decomp) ?? $texte;
            }
        }

        return $texte;
    }

    /**
     * @param list<array<string, mixed>> $operations
     *
     * @return array{0: int, 1: int, 2: int|string, 3: list<array<string, mixed>>}
     */
    private function paginer(array $operations, int $page, int|string $limite): array
    {
        $nombre = \count($operations);
        $tout = \is_string($limite) && strtolower($limite) === 'all';
        if ($tout || $nombre === 0) {
            return [1, 1, $tout ? 'all' : max(1, (int) $limite), $operations];
        }

        $taille = max(1, min(500, (int) $limite));
        $pages = max(1, (int) ceil($nombre / $taille));
        $pageNormale = max(1, min($page, $pages));
        $offset = ($pageNormale - 1) * $taille;

        return [$pageNormale, $pages, $taille, array_slice($operations, $offset, $taille)];
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
