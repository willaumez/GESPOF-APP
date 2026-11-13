<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\MontantMensuel;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RubriqueDepense;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\RubriqueRecette;
use App\Module\ServiceOperationsFinancieres\Enum\OrigineMontantMensuel;
use App\Module\ServiceOperationsFinancieres\Repository\LigneFlecheeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\MontantMensuelRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueDepenseRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueRecetteRepository;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Lot 3 — cumul montant_mensuel AUTO et états RD Model (SPEC §6.6 / §16).
 *
 * Montant AUTO = Σ ligne_flechee (toutes sources) par code × mois.
 * Affichage états : FCFA (stockage GESPOF) ; RD Model Excel est en millions.
 */
class RdModelCumulService
{
    public function __construct(
        private readonly LigneFlecheeRepository $ligneFlecheeRepository,
        private readonly MontantMensuelRepository $montantMensuelRepository,
        private readonly RubriqueDepenseRepository $rubriqueDepenseRepository,
        private readonly RubriqueRecetteRepository $rubriqueRecetteRepository,
        private readonly PeriodeRepository $periodeRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * Reconstruit sof_montant_mensuel (origine AUTO) depuis sof_ligne_flechee.
     *
     * @return array{exercice: int, nb_cellules: int, nb_codes: int, total: string}
     */
    public function recalculerAuto(int $exerciceAnnee): array
    {
        if ($exerciceAnnee < 2000 || $exerciceAnnee > 2100) {
            throw new DonneesInvalidesException('Exercice invalide.');
        }

        $agregats = $this->ligneFlecheeRepository->agregatsParExercice($exerciceAnnee);
        $this->montantMensuelRepository->supprimerParExerciceEtOrigine(
            $exerciceAnnee,
            OrigineMontantMensuel::AUTO,
        );
        $this->em->flush();

        $codes = [];
        $total = '0.00';
        foreach ($agregats as $a) {
            $code = $a['rubrique_code'];
            $mois = $a['mois'];
            $montant = $a['montant'];
            if ($mois < 1 || $mois > 12 || $code === '') {
                continue;
            }
            $this->em->persist(new MontantMensuel(
                $exerciceAnnee,
                $code,
                $mois,
                OrigineMontantMensuel::AUTO,
                $montant,
            ));
            $codes[$code] = true;
            $total = bcadd($total, $montant, 2);
        }
        $this->em->flush();

        return [
            'exercice' => $exerciceAnnee,
            'nb_cellules' => \count($agregats),
            'nb_codes' => \count($codes),
            'total' => $total,
        ];
    }

    /**
     * État Dépenses — mode auto (RD Model §6.6) ou srot (§8.1 = AUTO+MANUEL+AJUSTEMENT).
     *
     * @return array<string, mixed>
     */
    public function etatDepenses(?int $periodeId = null, string $mode = 'auto'): array
    {
        [$annee, $mois] = $this->resoudreAnneeMois($periodeId);
        $consolide = strtolower($mode) === 'srot';
        $index = $consolide ? $this->indexMontantsConsolides($annee) : $this->indexMontantsAuto($annee);
        $rubriques = $this->rubriqueDepenseRepository->listerAPlat();

        $lignes = [];
        $totalMois = '0.00';
        $totalCumul = '0.00';
        foreach ($rubriques as $r) {
            if (!$r instanceof RubriqueDepense || !$r->isActif()) {
                continue;
            }
            if ($r->isCodeSynthetique() || !$r->getEnfants()->isEmpty()) {
                $moisMt = $this->sommeSousArbre($r, $index, $mois, false);
                $cumulMt = $this->sommeSousArbre($r, $index, $mois, true);
            } else {
                $moisMt = $index[$r->getCode()][$mois] ?? '0.00';
                $cumulMt = $this->cumulJusqua($index[$r->getCode()] ?? [], $mois);
            }
            $lignes[] = [
                'code' => $r->getCode(),
                'libelle' => $r->getLibelle(),
                'nature' => $r->getNature()->value,
                'nature_libelle' => $r->getNature()->libelle(),
                'niveau' => $r->getNiveau(),
                'code_synthetique' => $r->isCodeSynthetique(),
                'mois' => $moisMt,
                'cumul' => $cumulMt,
                'millions_mois' => $this->enMillions($moisMt),
                'millions_cumul' => $this->enMillions($cumulMt),
            ];
            if (!$r->isCodeSynthetique() && $r->getEnfants()->isEmpty()) {
                $totalMois = bcadd($totalMois, $moisMt, 2);
                $totalCumul = bcadd($totalCumul, $cumulMt, 2);
            }
        }

        return [
            'exercice' => $annee,
            'mois' => $mois,
            'origine' => $consolide ? 'AUTO+MANUEL+AJUSTEMENT' : OrigineMontantMensuel::AUTO->value,
            'mode' => $consolide ? 'srot' : 'auto',
            'unite' => 'FCFA',
            'formule' => $consolide
                ? 'SROT §8.1 : RD Model (AUTO+MANUEL) + ajustements'
                : 'Correspondants_D + Manuelles + Règlements + Avances (+ CDEL) — part AUTO',
            'lignes' => $lignes,
            'totaux' => [
                'mois' => $totalMois,
                'cumul' => $totalCumul,
                'millions_mois' => $this->enMillions($totalMois),
                'millions_cumul' => $this->enMillions($totalCumul),
            ],
        ];
    }

    /**
     * État Recettes — mode auto ou srot (§8.1).
     *
     * @return array<string, mixed>
     */
    public function etatRecettes(?int $periodeId = null, string $mode = 'auto'): array
    {
        [$annee, $mois] = $this->resoudreAnneeMois($periodeId);
        $consolide = strtolower($mode) === 'srot';
        $index = $consolide ? $this->indexMontantsConsolides($annee) : $this->indexMontantsAuto($annee);
        $rubriques = $this->rubriqueRecetteRepository->listerAPlat();

        $lignes = [];
        $totalMois = '0.00';
        $totalCumul = '0.00';
        foreach ($rubriques as $r) {
            if (!$r instanceof RubriqueRecette || !$r->isActif()) {
                continue;
            }
            if ($r->isCodeSynthetique() || !$r->getEnfants()->isEmpty()) {
                $moisMt = $this->sommeSousArbreRecette($r, $index, $mois, false);
                $cumulMt = $this->sommeSousArbreRecette($r, $index, $mois, true);
            } else {
                $moisMt = $index[$r->getCode()][$mois] ?? '0.00';
                $cumulMt = $this->cumulJusqua($index[$r->getCode()] ?? [], $mois);
            }
            $lignes[] = [
                'code' => $r->getCode(),
                'libelle' => $r->getLibelle(),
                'section' => $r->getSection()->value,
                'section_libelle' => $r->getSection()->libelle(),
                'niveau' => $r->getNiveau(),
                'code_synthetique' => $r->isCodeSynthetique(),
                'mois' => $moisMt,
                'cumul' => $cumulMt,
                'millions_mois' => $this->enMillions($moisMt),
                'millions_cumul' => $this->enMillions($cumulMt),
            ];
            if (!$r->isCodeSynthetique() && $r->getEnfants()->isEmpty()) {
                $totalMois = bcadd($totalMois, $moisMt, 2);
                $totalCumul = bcadd($totalCumul, $cumulMt, 2);
            }
        }

        return [
            'exercice' => $annee,
            'mois' => $mois,
            'origine' => $consolide ? 'AUTO+MANUEL+AJUSTEMENT' : OrigineMontantMensuel::AUTO->value,
            'mode' => $consolide ? 'srot' : 'auto',
            'unite' => 'FCFA',
            'formule' => $consolide
                ? 'SROT §8.1 : RD Model (AUTO+MANUEL) + ajustements'
                : 'PETROLE + HORS PETROLE — part AUTO via ligne_flechee',
            'lignes' => $lignes,
            'totaux' => [
                'mois' => $totalMois,
                'cumul' => $totalCumul,
                'millions_mois' => $this->enMillions($totalMois),
                'millions_cumul' => $this->enMillions($totalCumul),
            ],
        ];
    }

    /**
     * @return array{0: int, 1: int}
     */
    private function resoudreAnneeMois(?int $periodeId): array
    {
        if ($periodeId !== null && $periodeId > 0) {
            $p = $this->periodeRepository->find($periodeId);
            if ($p === null) {
                throw new DonneesInvalidesException('Période introuvable.');
            }

            return [$p->getExercice()->getAnnee(), $p->getMois()];
        }

        /** @var list<\App\Module\ServiceOperationsFinancieres\Entite\Periode> $periodes */
        $periodes = $this->periodeRepository->createQueryBuilder('p')
            ->leftJoin('p.exercice', 'e')
            ->addSelect('e')
            ->orderBy('e.annee', 'DESC')
            ->addOrderBy('p.mois', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getResult();
        if ($periodes === []) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }
        $p = $periodes[0];

        return [$p->getExercice()->getAnnee(), $p->getMois()];
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function indexMontantsAuto(int $annee): array
    {
        $out = [];
        foreach ($this->montantMensuelRepository->listerParExercice($annee, OrigineMontantMensuel::AUTO) as $m) {
            $out[$m->getRubriqueCode()][$m->getMois()] = $m->getMontant();
        }

        return $out;
    }

    /**
     * Σ toutes origines (AUTO + MANUEL + AJUSTEMENT) — SROT §8.1.
     *
     * @return array<string, array<int, string>>
     */
    private function indexMontantsConsolides(int $annee): array
    {
        $out = [];
        foreach ($this->montantMensuelRepository->listerParExercice($annee) as $m) {
            $code = $m->getRubriqueCode();
            $mois = $m->getMois();
            $out[$code][$mois] = bcadd($out[$code][$mois] ?? '0.00', $m->getMontant(), 2);
        }

        return $out;
    }

    /**
     * @param array<int, string> $parMois
     */
    private function cumulJusqua(array $parMois, int $mois): string
    {
        $s = '0.00';
        for ($i = 1; $i <= $mois; ++$i) {
            $s = bcadd($s, $parMois[$i] ?? '0.00', 2);
        }

        return $s;
    }

    /**
     * @param array<string, array<int, string>> $index
     */
    private function sommeSousArbre(RubriqueDepense $noeud, array $index, int $mois, bool $cumul): string
    {
        if ($noeud->getEnfants()->isEmpty()) {
            $par = $index[$noeud->getCode()] ?? [];

            return $cumul ? $this->cumulJusqua($par, $mois) : ($par[$mois] ?? '0.00');
        }
        $s = '0.00';
        foreach ($noeud->getEnfants() as $enfant) {
            if ($enfant instanceof RubriqueDepense) {
                $s = bcadd($s, $this->sommeSousArbre($enfant, $index, $mois, $cumul), 2);
            }
        }

        return $s;
    }

    /**
     * @param array<string, array<int, string>> $index
     */
    private function sommeSousArbreRecette(RubriqueRecette $noeud, array $index, int $mois, bool $cumul): string
    {
        if ($noeud->getEnfants()->isEmpty()) {
            $par = $index[$noeud->getCode()] ?? [];

            return $cumul ? $this->cumulJusqua($par, $mois) : ($par[$mois] ?? '0.00');
        }
        $s = '0.00';
        foreach ($noeud->getEnfants() as $enfant) {
            if ($enfant instanceof RubriqueRecette) {
                $s = bcadd($s, $this->sommeSousArbreRecette($enfant, $index, $mois, $cumul), 2);
            }
        }

        return $s;
    }

    private function enMillions(string $fcfa): string
    {
        return bcdiv($fcfa, '1000000', 6);
    }
}
