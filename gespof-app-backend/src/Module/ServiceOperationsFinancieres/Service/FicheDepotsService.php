<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\FicheDepotLigne;
use App\Module\ServiceOperationsFinancieres\Repository\ExerciceRepository;
use App\Module\ServiceOperationsFinancieres\Repository\FicheDepotLigneRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Fiche de dépôts CUT — SPEC §8.3 (saisie Chef SOF).
 */
class FicheDepotsService
{
    public function __construct(
        private readonly FicheDepotLigneRepository $ficheDepotLigneRepository,
        private readonly ExerciceRepository $exerciceRepository,
        private readonly PeriodeRepository $periodeRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function lister(?int $periodeId = null, ?int $exerciceAnnee = null): array
    {
        $annee = $this->resoudreAnnee($periodeId, $exerciceAnnee);
        $lignes = $this->ficheDepotLigneRepository->listerParExercice($annee);
        if ($lignes === []) {
            $this->ensemencer($annee);
            $lignes = $this->ficheDepotLigneRepository->listerParExercice($annee);
        }

        $total0101 = '0.00';
        $totalSit = '0.00';
        $out = [];
        foreach ($lignes as $l) {
            $total0101 = bcadd($total0101, $l->getMontant0101(), 2);
            $totalSit = bcadd($totalSit, $l->getMontantSituation(), 2);
            $out[] = $this->serialiser($l);
        }

        return [
            'exercice' => $annee,
            'lignes' => $out,
            'totaux' => [
                'montant_01_01' => $total0101,
                'montant_situation' => $totalSit,
            ],
            'disponibilites' => $this->disponibilites($annee),
        ];
    }

    /**
     * @param list<array<string, mixed>> $lignes
     *
     * @return array<string, mixed>
     */
    public function enregistrer(int $exerciceAnnee, array $lignes): array
    {
        if ($this->exerciceRepository->find($exerciceAnnee) === null) {
            throw new DonneesInvalidesException('Exercice introuvable.');
        }
        foreach ($lignes as $row) {
            if (!\is_array($row) || !isset($row['code'])) {
                continue;
            }
            $code = trim((string) $row['code']);
            $entite = $this->ficheDepotLigneRepository->trouverParExerciceEtCode($exerciceAnnee, $code);
            if ($entite === null) {
                continue;
            }
            if (isset($row['montant_01_01'])) {
                $entite->setMontant0101(Montant::normaliser((string) $row['montant_01_01']));
            }
            if (isset($row['montant_situation'])) {
                $entite->setMontantSituation(Montant::normaliser((string) $row['montant_situation']));
            }
            if (isset($row['libelle']) && trim((string) $row['libelle']) !== '') {
                $entite->setLibelle(trim((string) $row['libelle']));
            }
            if (array_key_exists('domiciliation', $row)) {
                $d = $row['domiciliation'];
                $entite->setDomiciliation($d !== null && trim((string) $d) !== '' ? trim((string) $d) : null);
            }
            if (isset($row['devise']) && trim((string) $row['devise']) !== '') {
                $entite->setDevise(strtoupper(trim((string) $row['devise'])));
            }
        }
        $this->em->flush();

        return $this->lister(null, $exerciceAnnee);
    }

    /**
     * Totaux utilisés par la situation §8.2 H (disponibilités / oisive).
     *
     * @return array{
     *   cut: string,
     *   postes: string,
     *   cheques: string,
     *   citi: string,
     *   bgfi: string,
     *   tresorerie_oisive: string,
     *   total_disponibilites: string
     * }
     */
    public function disponibilites(int $exerciceAnnee): array
    {
        $cut = '0.00';
        $postes = '0.00';
        $cheques = '0.00';
        $citi = '0.00';
        $bgfi = '0.00';
        $oisive = '0.00';
        foreach ($this->ficheDepotLigneRepository->listerParExercice($exerciceAnnee) as $l) {
            $m = $l->getMontantSituation();
            $cat = $l->getCategorie();
            $dom = strtoupper((string) $l->getDomiciliation());
            if ($cat === 'compte') {
                if (str_contains($dom, 'BGFI')) {
                    $bgfi = bcadd($bgfi, $m, 2);
                } else {
                    $cut = bcadd($cut, $m, 2);
                }
            } elseif ($cat === 'poste') {
                $postes = bcadd($postes, $m, 2);
            } elseif ($cat === 'cheque') {
                $cheques = bcadd($cheques, $m, 2);
            } elseif ($cat === 'citi') {
                $citi = bcadd($citi, $m, 2);
            } elseif ($cat === 'tresorerie_oisive') {
                $oisive = bcadd($oisive, $m, 2);
            }
        }
        $dispo = bcadd(bcadd(bcadd($cut, $postes, 2), $cheques, 2), $citi, 2);

        return [
            'cut' => $cut,
            'postes' => $postes,
            'cheques' => $cheques,
            'citi' => $citi,
            'bgfi' => $bgfi,
            'tresorerie_oisive' => $oisive,
            'total_disponibilites' => $dispo,
        ];
    }

    private function ensemencer(int $annee): void
    {
        $defs = [
            ['CUT01', 'compte', 'BEAC', 'Compte unique du Trésor', 'XAF', 1],
            ['CUT02', 'compte', 'BEAC', 'Compte séquestre pétrole', 'XAF', 2],
            ['CUT03', 'compte', 'BEAC', 'Compte en devises', 'USD', 3],
            ['CUT04', 'compte', 'CDC', 'Compte CDC', 'XAF', 4],
            ['CUT05', 'compte', 'BGFIBank', 'Comptes de dépôt BGFI', 'XAF', 5],
            ['POSTE01', 'poste', null, 'Postes comptables (total)', 'XAF', 20],
            ['CHEQ', 'cheque', null, 'Chèques', 'XAF', 30],
            ['CITI', 'citi', null, 'Citi', 'XAF', 40],
            ['TOIS1', 'tresorerie_oisive', null, 'Carte Trésor', 'XAF', 50],
            ['TOIS2', 'tresorerie_oisive', null, 'Virements bancaires non régularisés', 'XAF', 51],
            ['TOIS3', 'tresorerie_oisive', null, 'Virements non effectués', 'XAF', 52],
            ['TOIS4', 'tresorerie_oisive', null, 'Transferts de dépenses non dénoués', 'XAF', 53],
            ['TOIS5', 'tresorerie_oisive', null, 'Mouvements d\'effets', 'XAF', 54],
            ['TOIS6', 'tresorerie_oisive', null, 'Mouvements de fonds', 'XAF', 55],
        ];
        foreach ($defs as [$code, $cat, $dom, $lib, $dev, $ord]) {
            $this->em->persist(new FicheDepotLigne(
                $annee,
                $code,
                $cat,
                $lib,
                $dev,
                $dom,
                $ord,
            ));
        }
        $this->em->flush();
    }

    private function resoudreAnnee(?int $periodeId, ?int $exerciceAnnee): int
    {
        if ($exerciceAnnee !== null && $exerciceAnnee > 0) {
            return $exerciceAnnee;
        }
        if ($periodeId !== null && $periodeId > 0) {
            $p = $this->periodeRepository->find($periodeId);
            if ($p === null) {
                throw new DonneesInvalidesException('Période introuvable.');
            }

            return $p->getExercice()->getAnnee();
        }
        $ex = $this->exerciceRepository->createQueryBuilder('e')
            ->orderBy('e.annee', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
        if ($ex === null) {
            throw new DonneesInvalidesException('Aucun exercice.');
        }

        return $ex->getAnnee();
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(FicheDepotLigne $l): array
    {
        return [
            'id' => $l->getId(),
            'code' => $l->getCode(),
            'categorie' => $l->getCategorie(),
            'domiciliation' => $l->getDomiciliation(),
            'libelle' => $l->getLibelle(),
            'devise' => $l->getDevise(),
            'montant_01_01' => $l->getMontant0101(),
            'montant_situation' => $l->getMontantSituation(),
            'ordre' => $l->getOrdre(),
        ];
    }
}
