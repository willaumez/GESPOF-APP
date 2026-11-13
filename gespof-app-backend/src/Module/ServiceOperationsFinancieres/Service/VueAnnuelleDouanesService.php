<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Import\MontantSaisiCompte;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\CompteDouane;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\LigneFlechee;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\MontantMensuel;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\OrigineMontantMensuel;
use App\Module\ServiceOperationsFinancieres\Enum\SensMontantCompte;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Enum\TypeCompteDouane;
use App\Module\ServiceOperationsFinancieres\Repository\CompteDouaneRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LigneFlecheeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\MontantMensuelRepository;
use App\Module\ServiceOperationsFinancieres\Repository\MontantSaisiCompteRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Recettes › Douanières › Vue annuelle
 * (montant_mensuel · ligne_flechee · lots F1 / F8).
 */
class VueAnnuelleDouanesService
{
    private const SOURCE = 'ig-douanes';
    private const CODE_SROT = '300';
    private const COMPTE_RUSID = '4663-218';

    private const MOIS_COURTS = [
        1 => 'Janv.', 2 => 'Févr.', 3 => 'Mars', 4 => 'Avr.',
        5 => 'Mai', 6 => 'Juin', 7 => 'Juil.', 8 => 'Août',
        9 => 'Sept.', 10 => 'Oct.', 11 => 'Nov.', 12 => 'Déc.',
    ];

    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly MontantSaisiCompteRepository $montantSaisiCompteRepository,
        private readonly MontantMensuelRepository $montantMensuelRepository,
        private readonly LigneFlecheeRepository $ligneFlecheeRepository,
        private readonly CompteDouaneRepository $compteDouaneRepository,
        private readonly RdModelCumulService $rdModelCumulService,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function synthetiser(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'exercice_annee' => null,
                'mois_courant' => null,
                'mois_libelles' => array_values(self::MOIS_COURTS),
                'lignes' => [],
                'totaux' => $this->zeros(),
                'message' => 'Aucune période SROT.',
            ];
        }

        $annee = $periode->getExercice()->getAnnee();
        $moisCourant = $periode->getMois();
        $comptes = $this->comptesDouaneActifs();
        $montants = $this->montantMensuelRepository->listerParExercice(
            $annee,
            OrigineMontantMensuel::AUTO,
        );

        /** @var array<string, list<string>> $parCompte */
        $parCompte = [];
        foreach ($comptes as $cp) {
            $parCompte[$cp] = $this->zeros();
        }
        foreach ($montants as $m) {
            $code = $m->getRubriqueCode();
            if (!isset($parCompte[$code])) {
                continue;
            }
            $mois = $m->getMois();
            if ($mois < 1 || $mois > 12) {
                continue;
            }
            $parCompte[$code][$mois - 1] = $m->getMontant();
        }

        $lignes = [];
        $totaux = $this->zeros();
        foreach ($comptes as $cp) {
            $vals = $parCompte[$cp];
            $lignes[] = [
                'compte' => $cp,
                'montants' => $vals,
            ];
            for ($i = 0; $i < 12; ++$i) {
                $totaux[$i] = bcadd($totaux[$i], $vals[$i], 2);
            }
        }

        return [
            'exercice_annee' => $annee,
            'mois_courant' => $moisCourant,
            'mois_libelles' => array_values(self::MOIS_COURTS),
            'lignes' => $lignes,
            'totaux' => $totaux,
            'message' => null,
        ];
    }

    /**
     * Recalcule montant_mensuel + ligne_flechee depuis les lots F1/F8 de l'exercice.
     *
     * @return array<string, mixed>
     */
    public function recalculer(?int $periodeId = null): array
    {
        $periodeRef = $this->resoudrePeriode($periodeId);
        if (!$periodeRef instanceof Periode || $periodeRef->getId() === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }

        $annee = $periodeRef->getExercice()->getAnnee();
        $periodes = $this->periodeRepository->listerParExercice($annee);

        foreach ($periodes as $p) {
            $pid = $p->getId();
            if ($pid === null) {
                continue;
            }
            $this->ligneFlecheeRepository->supprimerParPeriodeEtSource($pid, self::SOURCE);
        }

        foreach ($periodes as $p) {
            $pid = $p->getId();
            if ($pid === null) {
                continue;
            }
            $mois = $p->getMois();
            if ($mois < 1 || $mois > 12) {
                continue;
            }

            $totalMois = '0.00';
            foreach ($this->comptesDouaneActifs() as $compte) {
                $montant = $this->montantDomfCompte($pid, $compte);
                $totalMois = bcadd($totalMois, $montant, 2);

                if (bccomp($montant, '0.00', 2) !== 0) {
                    $this->em->persist(new LigneFlechee(
                        self::SOURCE,
                        $compte.'#'.$mois,
                        $p,
                        $compte,
                        $mois,
                        $montant,
                    ));
                }
            }
            // SPEC §5.2 : total douanes → code SROT 300.
            if (bccomp($totalMois, '0.00', 2) !== 0) {
                $this->em->persist(new LigneFlechee(
                    self::SOURCE,
                    self::CODE_SROT.'#'.$mois,
                    $p,
                    self::CODE_SROT,
                    $mois,
                    $totalMois,
                ));
            }
        }
        $this->em->flush();
        $this->rdModelCumulService->recalculerAuto($annee);

        return $this->synthetiser($periodeRef->getId());
    }

    private function montantDomfCompte(int $periodeId, string $compte): string
    {
        if ($compte === self::COMPTE_RUSID) {
            $row = $this->montantSaisiCompteRepository->trouver(
                $periodeId,
                self::COMPTE_RUSID,
                SensMontantCompte::RECETTE,
            );

            return $row instanceof MontantSaisiCompte ? $row->getMontant() : '0.00';
        }

        $lot = $this->trouverLotCompte($periodeId, $compte);

        return $lot instanceof LotImport ? ($lot->getMontantTotal() ?? '0.00') : '0.00';
    }

    private function trouverLotCompte(int $periodeId, string $compte): ?LotImport
    {
        /** @var list<LotImport> $candidats */
        $candidats = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('l.periode = :pid')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('pid', $periodeId)
            ->setParameter('format', FormatImport::F1)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        foreach ($candidats as $lot) {
            $p = $lot->getParametres();
            if (($p['source'] ?? null) === self::SOURCE
                && ($p['etape'] ?? null) === 'ig_operation'
                && ($p['compte'] ?? null) === $compte
            ) {
                return $lot;
            }
        }

        return null;
    }

    private function resoudrePeriode(?int $periodeId): ?Periode
    {
        if ($periodeId !== null) {
            $p = $this->periodeRepository->find($periodeId);
            if ($p instanceof Periode) {
                return $p;
            }
        }

        /** @var list<Periode> $periodes */
        $periodes = $this->periodeRepository->createQueryBuilder('p')
            ->orderBy('p.exercice', 'DESC')
            ->addOrderBy('p.mois', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getResult();

        return ($periodes[0] ?? null) instanceof Periode ? $periodes[0] : null;
    }

    /**
     * Comptes actifs du référentiel, ordre TypeCompteDouane puis numéro.
     *
     * @return list<string>
     */
    private function comptesDouaneActifs(): array
    {
        /** @var array<string, list<CompteDouane>> $parType */
        $parType = [];
        foreach ($this->compteDouaneRepository->listerTous() as $c) {
            if (!$c->isActif()) {
                continue;
            }
            $parType[$c->getType()->value][] = $c;
        }

        $out = [];
        foreach (TypeCompteDouane::cases() as $type) {
            $liste = $parType[$type->value] ?? [];
            usort(
                $liste,
                static fn (CompteDouane $a, CompteDouane $b): int => strcmp($a->getCompte(), $b->getCompte()),
            );
            foreach ($liste as $c) {
                $out[] = $c->getCompte();
            }
        }

        return $out;
    }

    /**
     * @return list<string>
     */
    private function zeros(): array
    {
        return array_fill(0, 12, '0.00');
    }
}
