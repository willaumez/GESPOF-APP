<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\DcMandat;
use App\Module\ServiceOperationsFinancieres\Entite\Import\IgOperation;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\RubriqueRecette;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\SocietePetroliere;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\TvaRapprochement;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\LigneFlechee;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\TauxChange;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Enum\StatutTvaRapprochement;
use App\Module\ServiceOperationsFinancieres\Repository\CodeTofeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\DcMandatRepository;
use App\Module\ServiceOperationsFinancieres\Repository\IgOperationRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LigneFlecheeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueRecetteRepository;
use App\Module\ServiceOperationsFinancieres\Repository\SocietePetroliereRepository;
use App\Module\ServiceOperationsFinancieres\Repository\TauxChangeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\TvaRapprochementRepository;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Recettes › TVA : rapprochement DC ↔ IG, remboursements (arriérés / courants),
 * RAP TVA, synthèse TOFE et taux de change.
 */
class TvaRecettesService
{
    private const SOURCE_DC_REGLE = 'dc-tva';
    private const SOURCE_DC_RAP = 'dc-rap-tva';
    private const SOURCE_IG = 'ig-tva';
    private const SOURCE_LIGNE_REMBOURSEMENTS = 'tva_remboursements';

    /** Codes SROT remboursements (SPEC §5.4). */
    public const CODE_COURANT = '400';
    public const CODE_ARRIERE = '401';

    /** Devises gérées par défaut côté taux de change. */
    public const DEVISES = ['USD', 'EUR'];

    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly DcMandatRepository $dcMandatRepository,
        private readonly IgOperationRepository $igOperationRepository,
        private readonly TvaRapprochementRepository $tvaRapprochementRepository,
        private readonly SocietePetroliereRepository $societePetroliereRepository,
        private readonly RubriqueRecetteRepository $rubriqueRecetteRepository,
        private readonly CodeTofeRepository $codeTofeRepository,
        private readonly TauxChangeRepository $tauxChangeRepository,
        private readonly LigneFlecheeRepository $ligneFlecheeRepository,
        private readonly LotImportService $lotImportService,
        private readonly RdModelCumulService $rdModelCumulService,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
        private readonly JournalAuditService $journalAuditService,
    ) {
    }

    // ------------------------------------------------------------------
    // Rapprochement DC ↔ IG
    // ------------------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    public function obtenirRapprochement(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return ['periode' => null, 'lignes' => [], 'message' => 'Aucune période SROT.'] + $this->totauxRapprochementVides();
        }

        $pid = $periode->getId();
        $rows = $this->tvaRapprochementRepository->listerParPeriode($pid);
        $lotDc = $this->lotActif($pid, FormatImport::F4, self::SOURCE_DC_REGLE);
        $lotIg = $this->lotActif($pid, FormatImport::F1, self::SOURCE_IG);

        $lignes = [];
        $totalDc = '0.00';
        $totalIgApparie = '0.00';
        $nbApparies = 0;
        $parStatut = [
            StatutTvaRapprochement::ARRIERE->value => ['nombre' => 0, 'total_dc' => '0.00'],
            StatutTvaRapprochement::COURANT->value => ['nombre' => 0, 'total_dc' => '0.00'],
        ];
        $igUtilises = [];
        $totalPetrole = '0.00';

        foreach ($rows as $r) {
            $dc = $r->getDcMandat();
            $ig = $r->getIgOperation();
            $mDc = $dc->getMontant() ?? '0.00';
            $mIg = $ig?->getMRegl();
            $totalDc = bcadd($totalDc, $mDc, 2);
            if ($ig instanceof IgOperation && $ig->getId() !== null) {
                $igUtilises[$ig->getId()] = true;
                $totalIgApparie = bcadd($totalIgApparie, $mIg ?? '0.00', 2);
                ++$nbApparies;
            }
            $s = $r->getStatut()->value;
            ++$parStatut[$s]['nombre'];
            $parStatut[$s]['total_dc'] = bcadd($parStatut[$s]['total_dc'], $mDc, 2);
            if ($r->isPetrole()) {
                $totalPetrole = bcadd($totalPetrole, $mDc, 2);
            }

            $lignes[] = [
                'id' => $r->getId(),
                'statut' => $s,
                'statut_libelle' => $r->getStatut()->libelle(),
                'petrole' => $r->isPetrole(),
                'apparie' => $ig instanceof IgOperation,
                'dc' => $this->serialiserDc($dc),
                'ig' => $ig instanceof IgOperation ? $this->serialiserIg($ig) : null,
                'ecart' => $ig instanceof IgOperation ? bcsub($mDc, $mIg ?? '0.00', 2) : $mDc,
            ];
        }

        // Opérations IG du lot actif non rapprochées
        $igNonAppariees = [];
        $totalIgNonApparie = '0.00';
        if ($lotIg instanceof LotImport && $lotIg->getId() !== null) {
            foreach ($this->igOperationRepository->listerParLot($lotIg->getId(), 50000) as $op) {
                if ($op->getId() !== null && !isset($igUtilises[$op->getId()])) {
                    $igNonAppariees[] = $this->serialiserIg($op);
                    $totalIgNonApparie = bcadd($totalIgNonApparie, $op->getMRegl() ?? '0.00', 2);
                }
            }
        }

        return [
            'periode' => $this->serialiserPeriode($periode),
            'lot_dc' => $lotDc?->getId() !== null ? $this->lotImportService->obtenir($lotDc->getId()) : null,
            'lot_ig' => $lotIg?->getId() !== null ? $this->lotImportService->obtenir($lotIg->getId()) : null,
            'lignes' => $lignes,
            'ig_non_appariees' => $igNonAppariees,
            'nombre' => count($lignes),
            'nb_apparies' => $nbApparies,
            'nb_non_apparies' => count($lignes) - $nbApparies,
            'total_dc' => $totalDc,
            'total_ig_apparie' => $totalIgApparie,
            'total_ig_non_apparie' => $totalIgNonApparie,
            'ecart' => bcsub($totalDc, $totalIgApparie, 2),
            'total_petrole' => $totalPetrole,
            'total_hors_petrole' => bcsub($totalDc, $totalPetrole, 2),
            'par_statut' => $parStatut,
            'message' => $rows === []
                ? ($lotDc instanceof LotImport
                    ? 'Rapprochement non calculé. Lancez « Recalculer ».'
                    : 'Aucun lot F4 (règlements TVA DC) actif pour cette période.')
                : null,
        ];
    }

    /**
     * Recalcule le rapprochement : lots actifs F4 (dc-tva) ↔ F1 (ig-tva).
     *
     * @return array<string, mixed>
     */
    public function recalculerRapprochement(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }
        $pid = $periode->getId();

        $lotDc = $this->lotActif($pid, FormatImport::F4, self::SOURCE_DC_REGLE);
        if (!$lotDc instanceof LotImport || $lotDc->getId() === null) {
            throw new DonneesInvalidesException('Aucun lot F4 (règlements TVA DC) actif pour cette période.');
        }
        $lotIg = $this->lotActif($pid, FormatImport::F1, self::SOURCE_IG);

        $dcs = $this->dcMandatRepository->listerParLot($lotDc->getId());
        $igs = $lotIg instanceof LotImport && $lotIg->getId() !== null
            ? $this->igOperationRepository->listerParLot($lotIg->getId(), 50000)
            : [];

        /** @var array<string, list<IgOperation>> $parRegl */
        $parRegl = [];
        /** @var array<string, list<IgOperation>> $parMattir */
        $parMattir = [];
        foreach ($igs as $op) {
            if ($op->getNRegl() !== null) {
                $parRegl[$op->getNRegl()][] = $op;
            }
            if ($op->getNMattir() !== null) {
                $parMattir[$op->getNMattir()][] = $op;
            }
        }

        $petroliers = $this->matriculesPetroliers();
        $annee = $periode->getExercice()->getAnnee();

        $this->tvaRapprochementRepository->supprimerParPeriode($pid);
        $this->em->flush();

        /** @var array<int, true> $utilises */
        $utilises = [];
        $nbApparies = 0;
        foreach ($dcs as $dc) {
            $match = $this->trouverIg($dc, $parRegl, $parMattir, $utilises);
            if ($match instanceof IgOperation && $match->getId() !== null) {
                $utilises[$match->getId()] = true;
                ++$nbApparies;
            }
            $this->em->persist(new TvaRapprochement(
                $periode,
                $dc,
                $match,
                $this->classer($dc, $annee),
                $dc->getMatric() !== null && isset($petroliers[$dc->getMatric()]),
            ));
        }
        $this->em->flush();

        $this->journalAuditService->enregistrer(
            'RECALCULER',
            'tva_rapprochement',
            (string) $pid,
            $this->acteur(),
            null,
            ['nb_dc' => count($dcs), 'nb_apparies' => $nbApparies, 'nb_ig' => count($igs)],
        );

        $srot = $this->recalculerRemboursementsSrot($pid);

        return $this->obtenirRapprochement($pid) + ['srot_remboursements' => $srot];
    }

    /**
     * Persiste codes SROT 400 (courant) / 401 (arriéré) depuis les mandats DC appariés IG.
     * SPEC §5.4 : seuls les mandats retrouvés dans IG comptent ; REG = M_REGL IG.
     *
     * @return array{exercice: int, nb_lignes: int, total_400: string, total_401: string, ig_doublons: list<string>, cumul: array<string, mixed>}
     */
    public function recalculerRemboursementsSrot(?int $periodeId = null): array
    {
        $periodeRef = $this->resoudrePeriode($periodeId);
        if (!$periodeRef instanceof Periode || $periodeRef->getId() === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }

        $annee = $periodeRef->getExercice()->getAnnee();
        $periodes = $this->periodeRepository->listerParExercice($annee);
        $periodesParMois = [];
        foreach ($periodes as $p) {
            if ($p->getId() !== null) {
                $this->ligneFlecheeRepository->supprimerParPeriodeEtSource(
                    $p->getId(),
                    self::SOURCE_LIGNE_REMBOURSEMENTS,
                );
                $periodesParMois[$p->getMois()] = $p;
            }
        }
        $this->em->flush();

        $rows = $this->tvaRapprochementRepository->listerParPeriode($periodeRef->getId());
        if ($rows === []) {
            // Fallback : dernier rapprochement non vide de l'exercice.
            foreach (array_reverse($periodes) as $p) {
                if ($p->getId() === null) {
                    continue;
                }
                $candidats = $this->tvaRapprochementRepository->listerParPeriode($p->getId());
                if ($candidats !== []) {
                    $rows = $candidats;
                    break;
                }
            }
        }

        /** @var array<string, int> $igCompte */
        $igCompte = [];
        /** @var array<string, array{code: string, mois: int, montant: string}> $agregats */
        $agregats = [];
        $total400 = '0.00';
        $total401 = '0.00';

        foreach ($rows as $r) {
            $ig = $r->getIgOperation();
            if (!$ig instanceof IgOperation) {
                continue;
            }
            $reg = $ig->getMRegl() ?? '0.00';
            if (0 === bccomp($reg, '0.00', 2)) {
                continue;
            }
            if ($ig->getId() !== null) {
                $cleIg = (string) $ig->getId();
                $igCompte[$cleIg] = ($igCompte[$cleIg] ?? 0) + 1;
            }

            $code = $r->getStatut() === StatutTvaRapprochement::COURANT
                ? self::CODE_COURANT
                : self::CODE_ARRIERE;
            $dc = $r->getDcMandat();
            $date = $dc->getDatRegl() ?? $dc->getDEmis();
            $mois = $date instanceof \DateTimeImmutable ? (int) $date->format('n') : $periodeRef->getMois();
            if ($mois < 1 || $mois > 12) {
                $mois = $periodeRef->getMois();
            }

            $cle = $code.'|'.$mois;
            $agregats[$cle] ??= ['code' => $code, 'mois' => $mois, 'montant' => '0.00'];
            $agregats[$cle]['montant'] = bcadd($agregats[$cle]['montant'], $reg, 2);
            if ($code === self::CODE_COURANT) {
                $total400 = bcadd($total400, $reg, 2);
            } else {
                $total401 = bcadd($total401, $reg, 2);
            }
        }

        $nbLignes = 0;
        foreach ($agregats as $a) {
            $periodeCible = $periodesParMois[$a['mois']] ?? $periodeRef;
            $this->em->persist(new LigneFlechee(
                self::SOURCE_LIGNE_REMBOURSEMENTS,
                $a['code'].'-'.$a['mois'],
                $periodeCible,
                $a['code'],
                $a['mois'],
                $a['montant'],
            ));
            ++$nbLignes;
        }
        $this->em->flush();

        $doublons = [];
        foreach ($igCompte as $id => $n) {
            if ($n > 1) {
                $doublons[] = $id;
            }
        }

        $cumul = $this->rdModelCumulService->recalculerAuto($annee);

        return [
            'exercice' => $annee,
            'nb_lignes' => $nbLignes,
            'total_400' => $total400,
            'total_401' => $total401,
            'ig_doublons' => $doublons,
            'cumul' => $cumul,
        ];
    }

    /**
     * @param array<string, list<IgOperation>> $parRegl
     * @param array<string, list<IgOperation>> $parMattir
     * @param array<int, true>                 $utilises
     */
    private function trouverIg(DcMandat $dc, array $parRegl, array $parMattir, array $utilises): ?IgOperation
    {
        $montant = $dc->getMontant() ?? '0.00';
        $libres = static fn (array $liste): array => array_values(array_filter(
            $liste,
            static fn (IgOperation $o): bool => $o->getId() !== null && !isset($utilises[$o->getId()]),
        ));

        $candidats = $dc->getNRegl() !== null ? $libres($parRegl[$dc->getNRegl()] ?? []) : [];
        foreach ($candidats as $op) {
            if (bccomp($op->getMRegl() ?? '0.00', $montant, 2) === 0) {
                return $op;
            }
        }
        if ($candidats !== []) {
            return $candidats[0];
        }

        $candidats = $dc->getMatric() !== null ? $libres($parMattir[$dc->getMatric()] ?? []) : [];
        foreach ($candidats as $op) {
            if (bccomp($op->getMRegl() ?? '0.00', $montant, 2) === 0) {
                return $op;
            }
        }

        return null;
    }

    private function classer(DcMandat $dc, int $anneeExercice): StatutTvaRapprochement
    {
        $d = $dc->getDEmis();
        // SPEC §5.4 : Courant ssi YEAR(D_EMIS) = année, sinon Antérieur.
        if ($d instanceof \DateTimeImmutable && (int) $d->format('Y') === $anneeExercice) {
            return StatutTvaRapprochement::COURANT;
        }

        return StatutTvaRapprochement::ARRIERE;
    }

    /**
     * @return array<string, true>
     */
    private function matriculesPetroliers(): array
    {
        $out = [];
        foreach ($this->societePetroliereRepository->listerParMatricule() as $s) {
            if ($s instanceof SocietePetroliere && $s->isPetrole()) {
                $out[$s->getMatricule()] = true;
            }
        }

        return $out;
    }

    // ------------------------------------------------------------------
    // Remboursements (arriérés / courants)
    // ------------------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    public function obtenirRemboursements(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        $vide = fn (?array $periodeData = null): array => [
            'periode' => $periodeData,
            'lot' => null,
            'arrieres' => $this->blocVide(),
            'courants' => $this->blocVide(),
            'nombre' => 0,
            'total' => '0.00',
            'total_petrole' => '0.00',
            'total_hors_petrole' => '0.00',
            'message' => null,
        ];
        if (!$periode instanceof Periode || $periode->getId() === null) {
            $out = $vide();
            $out['message'] = 'Aucune période SROT.';

            return $out;
        }

        $pid = $periode->getId();
        $lot = $this->lotActif($pid, FormatImport::F4, self::SOURCE_DC_REGLE);
        $rapprochements = $this->tvaRapprochementRepository->listerParPeriode($pid);

        // SPEC §5.4 : seuls les mandats DC retrouvés dans IG (REG) comptent.
        if ($rapprochements === []) {
            $out = $vide($this->serialiserPeriode($periode));
            $out['message'] = $lot instanceof LotImport
                ? 'Rapprochement non calculé. Lancez « Recalculer » sur TVA › Rapprochement.'
                : 'Aucun lot F4 (règlements TVA DC) actif pour cette période.';

            return $out;
        }

        $blocs = [
            StatutTvaRapprochement::ARRIERE->value => $this->blocVide(),
            StatutTvaRapprochement::COURANT->value => $this->blocVide(),
        ];
        $total = '0.00';
        $totalPetrole = '0.00';
        $n = 0;
        $nbIgDoublons = 0;
        /** @var array<int, int> $igVu */
        $igVu = [];

        foreach ($rapprochements as $r) {
            $ig = $r->getIgOperation();
            if (!$ig instanceof IgOperation) {
                continue;
            }
            $reg = $ig->getMRegl() ?? '0.00';
            if (0 === bccomp($reg, '0.00', 2)) {
                continue;
            }
            if ($ig->getId() !== null) {
                $igVu[$ig->getId()] = ($igVu[$ig->getId()] ?? 0) + 1;
                if ($igVu[$ig->getId()] === 2) {
                    ++$nbIgDoublons;
                }
            }

            $dc = $r->getDcMandat();
            $statut = $r->getStatut()->value;
            $petrole = $r->isPetrole();
            $codeSrot = $r->getStatut() === StatutTvaRapprochement::COURANT
                ? self::CODE_COURANT
                : self::CODE_ARRIERE;
            $ligne = $this->serialiserDc($dc) + [
                'petrole' => $petrole,
                'reg' => $reg,
                'code_srot' => $codeSrot,
                'apparie' => true,
            ];
            $blocs[$statut]['lignes'][] = $ligne;
            ++$blocs[$statut]['nombre'];
            $blocs[$statut]['total'] = bcadd($blocs[$statut]['total'], $reg, 2);
            if ($petrole) {
                $blocs[$statut]['total_petrole'] = bcadd($blocs[$statut]['total_petrole'], $reg, 2);
                $totalPetrole = bcadd($totalPetrole, $reg, 2);
            }
            $total = bcadd($total, $reg, 2);
            ++$n;
        }

        foreach ($blocs as &$b) {
            $b['total_hors_petrole'] = bcsub($b['total'], $b['total_petrole'], 2);
        }
        unset($b);
        $blocs[StatutTvaRapprochement::COURANT->value]['code_srot'] = self::CODE_COURANT;
        $blocs[StatutTvaRapprochement::ARRIERE->value]['code_srot'] = self::CODE_ARRIERE;

        return [
            'periode' => $this->serialiserPeriode($periode),
            'lot' => $lot instanceof LotImport && $lot->getId() !== null
                ? $this->lotImportService->obtenir($lot->getId())
                : null,
            'arrieres' => $blocs[StatutTvaRapprochement::ARRIERE->value],
            'courants' => $blocs[StatutTvaRapprochement::COURANT->value],
            'nombre' => $n,
            'total' => $total,
            'total_petrole' => $totalPetrole,
            'total_hors_petrole' => bcsub($total, $totalPetrole, 2),
            'nb_ig_doublons' => $nbIgDoublons,
            'codes' => ['courant' => self::CODE_COURANT, 'arriere' => self::CODE_ARRIERE],
            'message' => $n === 0
                ? 'Aucun remboursement TVA apparié IG (REG).'
                : ($nbIgDoublons > 0
                    ? sprintf('%d montant(s) IG apparié(s) plusieurs fois — vérifier les faux appariements.', $nbIgDoublons)
                    : null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function blocVide(): array
    {
        return [
            'lignes' => [],
            'nombre' => 0,
            'total' => '0.00',
            'total_petrole' => '0.00',
            'total_hors_petrole' => '0.00',
        ];
    }

    // ------------------------------------------------------------------
    // RAP TVA
    // ------------------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    public function obtenirRap(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        $base = [
            'periode' => null,
            'lot' => null,
            'lignes' => [],
            'par_pc' => [],
            'nombre' => 0,
            'total' => '0.00',
            'total_petrole' => '0.00',
            'total_hors_petrole' => '0.00',
            'total_bloque' => '0.00',
            'total_non_bloque' => '0.00',
            'message' => null,
        ];
        if (!$periode instanceof Periode || $periode->getId() === null) {
            $base['message'] = 'Aucune période SROT.';

            return $base;
        }
        $base['periode'] = $this->serialiserPeriode($periode);

        $lot = $this->lotActif($periode->getId(), FormatImport::F5, self::SOURCE_DC_RAP);
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            $base['message'] = 'Aucun lot F5 (RAP TVA DC) actif pour cette période.';

            return $base;
        }

        $petroliers = $this->matriculesPetroliers();
        $lignes = [];
        $total = '0.00';
        $totalPetrole = '0.00';
        $bloque = '0.00';
        $parPc = [];
        foreach ($this->dcMandatRepository->listerParLot($lot->getId()) as $d) {
            $m = $d->getMontant() ?? '0.00';
            $total = bcadd($total, $m, 2);
            $petrole = $d->getMatric() !== null && isset($petroliers[$d->getMatric()]);
            if ($petrole) {
                $totalPetrole = bcadd($totalPetrole, $m, 2);
            }
            $estBloque = $d->getCBlocag() !== null && $d->getCBlocag() !== '';
            if ($estBloque) {
                $bloque = bcadd($bloque, $m, 2);
            }
            $pc = $d->getPc() ?? '—';
            $parPc[$pc] ??= ['pc' => $pc, 'nombre' => 0, 'total' => '0.00'];
            ++$parPc[$pc]['nombre'];
            $parPc[$pc]['total'] = bcadd($parPc[$pc]['total'], $m, 2);
            $mois = $d->getDEmis()?->format('n');
            $lignes[] = [
                'id' => $d->getId(),
                'pc' => $d->getPc(),
                'mandat' => $d->getNEmis(),
                'd_emis' => $d->getDEmis()?->format('Y-m-d'),
                'mdr' => $d->getMdr(),
                'matric' => $d->getMatric(),
                'nom' => $d->getNom(),
                'rap' => $m,
                'd_visa' => $d->getDVisa()?->format('Y-m-d'),
                'objet' => $d->getObjet(),
                'c_blocag' => $d->getCBlocag(),
                'bloque' => $estBloque,
                'petrole' => $petrole,
                'mois' => $mois !== null ? (int) $mois : null,
                'mois_libelle' => $mois !== null ? Mois::tryFrom((int) $mois)?->libelle() : null,
            ];
        }
        ksort($parPc);

        return [
            'periode' => $base['periode'],
            'lot' => $this->lotImportService->obtenir($lot->getId()),
            'lignes' => $lignes,
            'par_pc' => array_values($parPc),
            'nombre' => count($lignes),
            'total' => $total,
            'total_petrole' => $totalPetrole,
            'total_hors_petrole' => bcsub($total, $totalPetrole, 2),
            'total_bloque' => $bloque,
            'total_non_bloque' => bcsub($total, $bloque, 2),
            'message' => $lignes === [] ? 'Aucun reste à payer TVA.' : null,
        ];
    }

    // ------------------------------------------------------------------
    // Synthèse TOFE
    // ------------------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    public function obtenirTofe(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'periode' => null,
                'lignes' => [],
                'rubriques_tva' => [],
                'par_mois' => [],
                'taux_change' => [],
                'message' => 'Aucune période SROT.',
            ];
        }

        $rembs = $this->obtenirRemboursements($periode->getId());
        $rap = $this->obtenirRap($periode->getId());
        $annee = $periode->getExercice()->getAnnee();
        $moisCourant = $periode->getMois();

        $lotDc = $this->lotActif($periode->getId(), FormatImport::F4, self::SOURCE_DC_REGLE);
        $parMois = [];
        for ($m = 1; $m <= 12; ++$m) {
            $parMois[$m] = '0.00';
        }
        if ($lotDc instanceof LotImport && $lotDc->getId() !== null) {
            foreach ($this->dcMandatRepository->listerParLot($lotDc->getId()) as $dc) {
                $date = $dc->getDatRegl() ?? $dc->getDEmis();
                if (!$date instanceof \DateTimeImmutable || (int) $date->format('Y') !== $annee) {
                    continue;
                }
                $mm = (int) $date->format('n');
                $parMois[$mm] = bcadd($parMois[$mm], $dc->getMontant() ?? '0.00', 2);
            }
        }

        $taux = $this->tauxParMois($annee);
        $detailMois = [];
        $cumul = '0.00';
        foreach ($parMois as $m => $montant) {
            $cumul = bcadd($cumul, $montant, 2);
            $devises = [];
            foreach ($taux[$m] ?? [] as $devise => $t) {
                if (bccomp($t, '0', 6) > 0) {
                    $devises[$devise] = bcdiv($montant, $t, 2);
                }
            }
            $detailMois[] = [
                'mois' => $m,
                'mois_libelle' => Mois::tryFrom($m)?->libelle(),
                'remboursements_fcfa' => $montant,
                'cumul_fcfa' => $cumul,
                'devises' => $devises,
                'courant' => $m === $moisCourant,
            ];
        }

        // Lignes maquette tva-tofe : rubrique × nature (Pétrole / Hors pétrole).
        $tauxUsd = $taux[$moisCourant]['USD'] ?? '0';
        $lignes = [
            [
                'code' => 'TVA-RAP-PET',
                'libelle' => 'RAP TVA',
                'nature' => 'Pétrole',
                'montant' => $rap['total_petrole'] ?? '0.00',
            ],
            [
                'code' => 'TVA-RAP-HP',
                'libelle' => 'RAP TVA',
                'nature' => 'Hors pétrole',
                'montant' => $rap['total_hors_petrole'] ?? '0.00',
            ],
            [
                'code' => 'TVA-REMB-ARR-PET',
                'libelle' => 'Remboursements arriérés',
                'nature' => 'Pétrole',
                'montant' => $rembs['arrieres']['total_petrole'] ?? '0.00',
            ],
            [
                'code' => 'TVA-REMB-ARR-HP',
                'libelle' => 'Remboursements arriérés',
                'nature' => 'Hors pétrole',
                'montant' => $rembs['arrieres']['total_hors_petrole'] ?? '0.00',
            ],
            [
                'code' => 'TVA-REMB-COUR-PET',
                'libelle' => 'Remboursements courants',
                'nature' => 'Pétrole',
                'montant' => $rembs['courants']['total_petrole'] ?? '0.00',
            ],
            [
                'code' => 'TVA-REMB-COUR-HP',
                'libelle' => 'Remboursements courants',
                'nature' => 'Hors pétrole',
                'montant' => $rembs['courants']['total_hors_petrole'] ?? '0.00',
            ],
            [
                'code' => 'TVA-RMP-ASSALA',
                'libelle' => 'RMP Assala (convertie en XAF)',
                'nature' => 'Pétrole',
                'montant' => '0.00',
                'saisie' => true,
            ],
        ];

        $rubriques = [];
        foreach ($this->rubriqueRecetteRepository->listerAPlat() as $r) {
            if (!$r instanceof RubriqueRecette) {
                continue;
            }
            $lib = $r->getLibelle();
            if (mb_stripos($lib, 'TVA') === false && mb_stripos($lib, 'valeur ajout') === false) {
                continue;
            }
            $codeTofe = $r->getCodeTofe();
            $rubriques[] = [
                'code' => $r->getCode(),
                'libelle' => $lib,
                'code_tofe' => $codeTofe,
                'libelle_tofe' => $codeTofe !== null ? $this->codeTofeRepository->findByCode($codeTofe)?->getLibelle() : null,
            ];
        }

        return [
            'periode' => $this->serialiserPeriode($periode),
            'lignes' => $lignes,
            'rubriques_tva' => $rubriques,
            'par_mois' => $detailMois,
            'total_exercice_fcfa' => $cumul,
            'taux_change' => $this->serialiserTaux($annee),
            'conversion' => [
                'devise' => 'USD',
                'taux_usd_xaf' => $tauxUsd,
                'rmp_assala_usd' => null,
                'rmp_assala_xaf' => null,
                'note' => 'Saisir le montant RMP Assala en USD ; le taux moyen du mois est enregistré via taux_change.',
            ],
            'message' => null,
        ];
    }

    // ------------------------------------------------------------------
    // Taux de change
    // ------------------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    public function obtenirTauxChange(?int $exerciceAnnee = null, ?int $periodeId = null): array
    {
        $annee = $exerciceAnnee ?? $this->resoudrePeriode($periodeId)?->getExercice()->getAnnee();
        if ($annee === null) {
            return ['exercice_annee' => null, 'devises' => self::DEVISES, 'taux' => [], 'message' => 'Aucun exercice.'];
        }

        return [
            'exercice_annee' => $annee,
            'devises' => self::DEVISES,
            'taux' => $this->serialiserTaux($annee),
            'message' => null,
        ];
    }

    /**
     * @param list<array<string, mixed>> $taux [{mois, devise, taux}]
     *
     * @return array<string, mixed>
     */
    public function enregistrerTauxChange(int $exerciceAnnee, array $taux): array
    {
        if ($exerciceAnnee < 2000 || $exerciceAnnee > 2100) {
            throw new DonneesInvalidesException('Exercice invalide.');
        }
        if ($taux === []) {
            throw new DonneesInvalidesException('Aucun taux fourni.');
        }

        foreach ($taux as $i => $t) {
            $mois = $t['mois'] ?? null;
            $devise = strtoupper(trim((string) ($t['devise'] ?? '')));
            $valeur = $t['taux'] ?? null;
            if (!is_numeric($mois) || (int) $mois < 1 || (int) $mois > 12) {
                throw new DonneesInvalidesException(sprintf('Ligne %d : mois invalide (1–12).', $i + 1));
            }
            if (!preg_match('/^[A-Z]{3}$/', $devise)) {
                throw new DonneesInvalidesException(sprintf('Ligne %d : devise invalide (code ISO sur 3 lettres).', $i + 1));
            }
            if ($valeur === null || $valeur === '' || !is_numeric(str_replace(',', '.', (string) $valeur))) {
                throw new DonneesInvalidesException(sprintf('Ligne %d : taux invalide.', $i + 1));
            }
            $s = number_format((float) str_replace(',', '.', (string) $valeur), 6, '.', '');
            if (bccomp($s, '0', 6) <= 0) {
                throw new DonneesInvalidesException(sprintf('Ligne %d : le taux doit être > 0.', $i + 1));
            }

            $row = $this->tauxChangeRepository->trouver($exerciceAnnee, (int) $mois, $devise);
            if ($row instanceof TauxChange) {
                $row->setTaux($s);
            } else {
                $this->em->persist(new TauxChange($exerciceAnnee, (int) $mois, $devise, $s));
            }
            // Flush à chaque ligne : évite les doublons si la même clé est répétée dans le payload
            $this->em->flush();
        }

        $this->journalAuditService->enregistrer(
            'MODIFIER',
            'taux_change',
            (string) $exerciceAnnee,
            $this->acteur(),
            null,
            ['nb_taux' => count($taux)],
        );

        return $this->obtenirTauxChange($exerciceAnnee);
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function tauxParMois(int $annee): array
    {
        $out = [];
        foreach ($this->tauxChangeRepository->listerParExercice($annee) as $t) {
            $out[$t->getMois()][$t->getDevise()] = $t->getTaux();
        }

        return $out;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function serialiserTaux(int $annee): array
    {
        return array_map(
            static fn (TauxChange $t): array => [
                'mois' => $t->getMois(),
                'devise' => $t->getDevise(),
                'taux' => $t->getTaux(),
            ],
            $this->tauxChangeRepository->listerParExercice($annee),
        );
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    private function totauxRapprochementVides(): array
    {
        return [
            'lot_dc' => null,
            'lot_ig' => null,
            'ig_non_appariees' => [],
            'nombre' => 0,
            'nb_apparies' => 0,
            'nb_non_apparies' => 0,
            'total_dc' => '0.00',
            'total_ig_apparie' => '0.00',
            'total_ig_non_apparie' => '0.00',
            'ecart' => '0.00',
            'total_petrole' => '0.00',
            'total_hors_petrole' => '0.00',
            'par_statut' => [
                'ARRIERE' => ['nombre' => 0, 'total_dc' => '0.00'],
                'COURANT' => ['nombre' => 0, 'total_dc' => '0.00'],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserDc(DcMandat $d): array
    {
        return [
            'id' => $d->getId(),
            'n_emis' => $d->getNEmis(),
            'n_regl' => $d->getNRegl(),
            'd_emis' => $d->getDEmis()?->format('Y-m-d'),
            'dat_regl' => $d->getDatRegl()?->format('Y-m-d'),
            'pc' => $d->getPc(),
            'mdr' => $d->getMdr(),
            'matric' => $d->getMatric(),
            'nom' => $d->getNom(),
            'montant' => $d->getMontant(),
            'm_net' => $d->getMNet(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserIg(IgOperation $o): array
    {
        return [
            'id' => $o->getId(),
            'c_pca' => $o->getCPca(),
            'd_cpta' => $o->getDCpta()?->format('Y-m-d'),
            'n_regl' => $o->getNRegl(),
            'n_op' => $o->getNOp(),
            'n_mattir' => $o->getNMattir(),
            'l_np' => $o->getLNp(),
            'c_mdr' => $o->getCMdr(),
            'm_regl' => $o->getMRegl(),
        ];
    }

    private function lotActif(int $periodeId, FormatImport $format, string $source): ?LotImport
    {
        /** @var list<LotImport> $candidats */
        $candidats = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('IDENTITY(l.periode) = :pid')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('pid', $periodeId)
            ->setParameter('format', $format)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        foreach ($candidats as $lot) {
            if (($lot->getParametres()['source'] ?? null) === $source) {
                return $lot;
            }
        }

        return null;
    }

    private function resoudrePeriode(?int $periodeId): ?Periode
    {
        if ($periodeId !== null) {
            $p = $this->periodeRepository->find($periodeId);

            return $p instanceof Periode ? $p : null;
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
     * @return array<string, mixed>
     */
    private function serialiserPeriode(Periode $p): array
    {
        $mois = $p->getMois();

        return [
            'id' => $p->getId(),
            'mois' => $mois,
            'exercice_annee' => $p->getExercice()->getAnnee(),
            'mois_libelle' => Mois::tryFrom($mois)?->libelle(),
        ];
    }

    private function acteur(): ?Utilisateur
    {
        $u = $this->security->getUser();

        return $u instanceof Utilisateur ? $u : null;
    }
}
