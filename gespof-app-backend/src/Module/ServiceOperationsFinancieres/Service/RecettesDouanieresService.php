<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Enum\TypeCompteDouane;
use App\Module\ServiceOperationsFinancieres\Repository\CompteDouaneRepository;
use App\Module\ServiceOperationsFinancieres\Repository\ScriptPoolSof;
use App\Shared\Exception\DonneesInvalidesException;

class RecettesDouanieresService
{
    public function __construct(
        private readonly CompteDouaneRepository $compteDouaneRepository,
        private readonly ScriptPoolSof $scriptPoolSof,
    ) {
    }

    /**
     * Comptes douane groupés par type.
     *
     * @return list<array{type: string, type_libelle: string, comptes: list<array{compte: string, libelle_compte: string}>}>
     */
    public function listerComptes(): array
    {
        $parType = [];
        foreach (TypeCompteDouane::cases() as $type) {
            $parType[$type->value] = [
                'type' => $type->value,
                'type_libelle' => $type->libelle(),
                'comptes' => [],
            ];
        }

        foreach ($this->compteDouaneRepository->listerTous() as $compte) {
            $cle = $compte->getType()->value;
            $parType[$cle]['comptes'][] = [
                'compte' => $compte->getCompte(),
                'libelle_compte' => $compte->getLibelleCompte(),
            ];
        }

        return array_values(array_filter(
            $parType,
            static fn (array $groupe): bool => $groupe['comptes'] !== [],
        ));
    }

    /**
     * Extraction Oracle d'un seul compte (hors RUSID = requête 1, RUSID = requête 2).
     *
     * @return array<string, mixed>
     */
    public function extraireCompte(string $dateDebut, string $dateFin, string $numeroCompte): array
    {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $compte = $this->compteDouaneRepository->trouverParCompte(trim($numeroCompte));
        if ($compte === null) {
            throw new DonneesInvalidesException(
                sprintf('Compte douane inconnu : %s.', trim($numeroCompte)),
            );
        }

        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');
        $estRusid = $compte->getType() === TypeCompteDouane::RUSID;

        try {
            if ($estRusid) {
                $lignes = $this->scriptPoolSof->extraireRecettesDouanieresRusid($dateDeb, $dateFinFmt);
            } else {
                $lignes = $this->scriptPoolSof->extraireRecettesDouanieresCompte(
                    $dateDeb,
                    $dateFinFmt,
                    [$compte->getCompte()],
                );
            }
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                sprintf(
                    'Impossible d\'extraire le compte %s : %s',
                    $compte->getCompte(),
                    $e->getMessage(),
                ),
            );
        }

        $operations = [];
        $rusid = [];
        if ($estRusid) {
            foreach ($lignes as $ligne) {
                $rusid[] = $this->normaliserRusid($ligne);
            }
        } else {
            foreach ($lignes as $ligne) {
                $operations[] = $this->normaliserOperation($ligne);
            }
        }

        $nombre = $estRusid ? \count($rusid) : \count($operations);

        return [
            'date_debut' => $dateDeb,
            'date_fin' => $dateFinFmt,
            'compte' => $compte->getCompte(),
            'libelle_compte' => $compte->getLibelleCompte(),
            'type' => $compte->getType()->value,
            'type_libelle' => $compte->getType()->libelle(),
            'operations' => $operations,
            'rusid' => $rusid,
            'nombre' => $nombre,
            'message' => $nombre === 0
                ? sprintf('Aucune recette pour le compte %s sur cette période.', $compte->getCompte())
                : null,
        ];
    }

    /**
     * Extraction groupée : 1 requête Oracle pour tous les comptes hors RUSID,
     * 1 pour le RUSID. En cas de coupure (ORA-03113…), bascule en lots puis compte à compte.
     *
     * @return array<string, mixed>
     */
    public function extraireLot(string $dateDebut, string $dateFin): array
    {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        $referentiel = $this->compteDouaneRepository->listerTous();
        if ($referentiel === []) {
            throw new DonneesInvalidesException('Aucun compte douane dans le référentiel.');
        }

        $horsRusid = [];
        $rusidCompte = null;
        foreach ($referentiel as $compte) {
            if ($compte->getType() === TypeCompteDouane::RUSID) {
                $rusidCompte = $compte;
                continue;
            }
            $horsRusid[] = $compte;
        }

        usort(
            $horsRusid,
            static fn ($a, $b): int => strcmp($a->getCompte(), $b->getCompte()),
        );

        $parCompte = [];
        foreach ($horsRusid as $compte) {
            $parCompte[$compte->getCompte()] = [
                'compte' => $compte->getCompte(),
                'libelle_compte' => $compte->getLibelleCompte(),
                'type' => $compte->getType()->value,
                'type_libelle' => $compte->getType()->libelle(),
                'operations' => [],
                'rusid' => [],
                'nombre' => 0,
                'erreur' => null,
            ];
        }

        $numeros = array_map(static fn ($c): string => $c->getCompte(), $horsRusid);
        $this->remplirOperationsHorsRusid($dateDeb, $dateFinFmt, $numeros, $parCompte);

        if ($rusidCompte !== null) {
            $entreeRusid = [
                'compte' => $rusidCompte->getCompte(),
                'libelle_compte' => $rusidCompte->getLibelleCompte(),
                'type' => $rusidCompte->getType()->value,
                'type_libelle' => $rusidCompte->getType()->libelle(),
                'operations' => [],
                'rusid' => [],
                'nombre' => 0,
                'erreur' => null,
            ];
            try {
                $lignes = $this->scriptPoolSof->extraireRecettesDouanieresRusid($dateDeb, $dateFinFmt);
                foreach ($lignes as $ligne) {
                    $entreeRusid['rusid'][] = $this->normaliserRusid($ligne);
                }
                $entreeRusid['nombre'] = \count($entreeRusid['rusid']);
            } catch (\Throwable $e) {
                $entreeRusid['erreur'] = $e->getMessage();
            }
            $parCompte[$rusidCompte->getCompte()] = $entreeRusid;
        }

        $comptes = array_values($parCompte);
        usort(
            $comptes,
            static fn (array $a, array $b): int => strcmp((string) $a['compte'], (string) $b['compte']),
        );

        $nombreTotal = 0;
        $echecs = 0;
        foreach ($comptes as $entree) {
            $nombreTotal += (int) $entree['nombre'];
            if ($entree['erreur'] !== null) {
                ++$echecs;
            }
        }

        return [
            'date_debut' => $dateDeb,
            'date_fin' => $dateFinFmt,
            'nombre' => $nombreTotal,
            'echecs' => $echecs,
            'comptes' => $comptes,
            'message' => $nombreTotal === 0 && $echecs === 0
                ? 'Aucune recette douanière pour cette période.'
                : null,
        ];
    }

    /**
     * @param list<string>                                                              $numeros
     * @param array<string, array{compte: string, libelle_compte: string, type: string, type_libelle: string, operations: list<array<string, mixed>>, rusid: list<array<string, mixed>>, nombre: int, erreur: ?string}> $parCompte
     */
    private function remplirOperationsHorsRusid(
        string $dateDeb,
        string $dateFinFmt,
        array $numeros,
        array &$parCompte,
    ): void {
        if ($numeros === []) {
            return;
        }

        try {
            $lignes = $this->scriptPoolSof->extraireRecettesDouanieresCompte($dateDeb, $dateFinFmt, $numeros);
            $this->repartirOperations($lignes, $parCompte);

            return;
        } catch (\Throwable $e) {
            if (!$this->estCoupureOracle($e) || \count($numeros) <= 1) {
                foreach ($numeros as $numero) {
                    if (isset($parCompte[$numero])) {
                        $parCompte[$numero]['erreur'] = $e->getMessage();
                    }
                }

                return;
            }
        }

        // Coupure sur un gros lot : découpe en paquets, puis compte à compte si besoin.
        $tailleLot = max(1, (int) ceil(\count($numeros) / 4));
        foreach (array_chunk($numeros, $tailleLot) as $paquet) {
            try {
                $lignes = $this->scriptPoolSof->extraireRecettesDouanieresCompte($dateDeb, $dateFinFmt, $paquet);
                $this->repartirOperations($lignes, $parCompte);
            } catch (\Throwable $e) {
                if (!$this->estCoupureOracle($e) || \count($paquet) <= 1) {
                    foreach ($paquet as $numero) {
                        if (isset($parCompte[$numero])) {
                            $parCompte[$numero]['erreur'] = $e->getMessage();
                        }
                    }
                    continue;
                }
                foreach ($paquet as $numero) {
                    try {
                        $lignes = $this->scriptPoolSof->extraireRecettesDouanieresCompte(
                            $dateDeb,
                            $dateFinFmt,
                            [$numero],
                        );
                        $this->repartirOperations($lignes, $parCompte);
                    } catch (\Throwable $erreurCompte) {
                        if (isset($parCompte[$numero])) {
                            $parCompte[$numero]['erreur'] = $erreurCompte->getMessage();
                        }
                    }
                }
            }
        }
    }

    /**
     * @param list<array<string, mixed>> $lignes
     * @param array<string, array{compte: string, libelle_compte: string, type: string, type_libelle: string, operations: list<array<string, mixed>>, rusid: list<array<string, mixed>>, nombre: int, erreur: ?string}> $parCompte
     */
    private function repartirOperations(array $lignes, array &$parCompte): void
    {
        foreach ($lignes as $ligne) {
            $operation = $this->normaliserOperation($ligne);
            $compte = (string) ($operation['c_it'] ?? '');
            if ($compte === '' || !isset($parCompte[$compte])) {
                continue;
            }
            $parCompte[$compte]['operations'][] = $operation;
            $parCompte[$compte]['nombre'] = \count($parCompte[$compte]['operations']);
            $parCompte[$compte]['erreur'] = null;
        }
    }

    private function estCoupureOracle(\Throwable $e): bool
    {
        $msg = strtoupper($e->getMessage());

        return str_contains($msg, 'ORA-03113')
            || str_contains($msg, 'ORA-03114')
            || str_contains($msg, 'ORA-03135')
            || str_contains($msg, 'ORA-01012')
            || str_contains($msg, 'ORA-00028')
            || str_contains($msg, 'BROKEN PIPE')
            || str_contains($msg, 'END-OF-FILE');
    }

    /**
     * Requête RUSID dédiée (V_FMI / PCAG / VBAL, compte 4663-218).
     *
     * @return array<string, mixed>
     */
    public function extraireRusid(string $dateDebut, string $dateFin): array
    {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $lignes = $this->scriptPoolSof->extraireRecettesDouanieresRusid($dateDeb, $dateFinFmt);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Impossible d\'extraire le RUSID (4663-218) : '.$e->getMessage(),
            );
        }

        $rusid = [];
        foreach ($lignes as $ligne) {
            $rusid[] = $this->normaliserRusid($ligne);
        }

        return [
            'date_debut' => $dateDeb,
            'date_fin' => $dateFinFmt,
            'compte' => '4663-218',
            'libelle_compte' => 'RUSID',
            'type' => TypeCompteDouane::RUSID->value,
            'type_libelle' => TypeCompteDouane::RUSID->libelle(),
            'operations' => [],
            'rusid' => $rusid,
            'nombre' => \count($rusid),
            'message' => $rusid === []
                ? 'Aucune recette RUSID pour cette période.'
                : null,
        ];
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
     * @return array<string, mixed>
     */
    private function normaliserOperation(array $ligne): array
    {
        return [
            'c_pca' => $this->texte($this->cellule($ligne, 'C_PCA')),
            'n_op' => $this->texte($this->cellule($ligne, 'N_OP')),
            'c_guic' => $this->texte($this->cellule($ligne, 'C_GUIC')),
            'n_mattir' => $this->texte($this->cellule($ligne, 'N_MATTIR')),
            'l_tiers' => $this->texte($this->cellule($ligne, 'L_TIERS')),
            'l_np' => $this->texte($this->cellule($ligne, 'L_NP')),
            'n_lig_op' => $this->texte($this->cellule($ligne, 'N_LIG_OP')),
            'c_ope' => $this->texte($this->cellule($ligne, 'C_OPE')),
            'c_it' => $this->texte($this->cellule($ligne, 'C_IT')),
            'c_nat' => $this->texte($this->cellule($ligne, 'C_NAT')),
            'c_ref1' => $this->texte($this->cellule($ligne, 'C_REF1')),
            'c_ref2' => $this->texte($this->cellule($ligne, 'C_REF2')),
            'm_oper' => $this->montant($this->cellule($ligne, 'M_OPER')),
            'n_regl' => $this->texte($this->cellule($ligne, 'N_REGL')),
            'n_lig_r' => $this->texte($this->cellule($ligne, 'N_LIG_R')),
            'm_regl' => $this->montant($this->cellule($ligne, 'M_REGL')),
            'c_nop' => $this->texte($this->cellule($ligne, 'C_NOP')),
            'c_mdr' => $this->texte($this->cellule($ligne, 'C_MDR')),
            'n_cheq' => $this->texte($this->cellule($ligne, 'N_CHEQ')),
            'd_cpta' => $this->formaterDate($this->cellule($ligne, 'D_CPTA')),
            'c_cais' => $this->texte($this->cellule($ligne, 'C_CAIS')),
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function normaliserRusid(array $ligne): array
    {
        return [
            'mm' => $this->texte($this->cellule($ligne, 'MM')),
            'mois' => $this->texte($this->cellule($ligne, 'MOIS')),
            'c_pca' => $this->texte($this->cellule($ligne, 'C_PCA')),
            'libelle' => $this->texte($this->cellule($ligne, 'LIBELLE')),
            'c_it' => $this->texte($this->cellule($ligne, 'C_IT')),
            'l_compte' => $this->texte($this->cellule($ligne, 'L_COMPTE')),
            'm_oper' => $this->montant($this->cellule($ligne, 'M_OPER')),
            'operation' => $this->texte($this->cellule($ligne, 'OPERATION')),
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
