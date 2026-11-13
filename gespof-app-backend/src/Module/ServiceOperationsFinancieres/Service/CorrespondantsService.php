<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\AnomalieImport;
use App\Module\ServiceOperationsFinancieres\Entite\Import\CorrespondantMouvement;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\LigneFlechee;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RegleFlechage;
use App\Module\ServiceOperationsFinancieres\Enum\DomaineFlechage;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\SensMontantCompte;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Repository\CorrespondantMouvementRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LigneFlecheeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RegleFlechageRepository;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\CorrespondantsR;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Imports › Services › Correspondants (F10 · DSI) et page Recettes › Correspondants.
 *
 * Excel : CATÉGORIE, C_IT, LIBELLÉ, M01…M12 — montants en millions de FCFA → FCFA.
 * Un classeur peut contenir deux onglets (dépenses / recettes).
 */
class CorrespondantsService
{
    public const SOURCE = 'srv-correspondants';
    public const SOURCE_LIGNE_RECETTE = 'corr_recettes';
    private const ETAPE = 'correspondant_mouvement';
    private const MILLION = '1000000';

    public const COLONNES = [
        'CATÉGORIE', 'C_IT', 'LIBELLÉ',
        'M01', 'M02', 'M03', 'M04', 'M05', 'M06',
        'M07', 'M08', 'M09', 'M10', 'M11', 'M12',
    ];

    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly CorrespondantMouvementRepository $mouvementRepository,
        private readonly RegleFlechageRepository $regleFlechageRepository,
        private readonly LigneFlecheeRepository $ligneFlecheeRepository,
        private readonly LotImportService $lotImportService,
        private readonly RdModelCumulService $rdModelCumulService,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
        private readonly JournalAuditService $journalAuditService,
    ) {
    }

    // ------------------------------------------------------------------
    // Imports › Services › Correspondants (F10)
    // ------------------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    public function obtenirEtat(?int $periodeId = null, ?string $sens = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'periode' => null,
                'source' => self::SOURCE,
                'format' => FormatImport::F10->value,
                'colonnes' => self::COLONNES,
                'onglets' => [],
                'message' => 'Aucune période SROT.',
            ];
        }

        $sensFiltre = $this->parserSens($sens, false);
        $onglets = [];
        foreach (SensMontantCompte::cases() as $s) {
            if ($sensFiltre !== null && $sensFiltre !== $s) {
                continue;
            }
            $onglets[$s->value] = $this->construireOnglet($periode->getId(), $s);
        }

        return [
            'periode' => $this->serialiserPeriode($periode),
            'source' => self::SOURCE,
            'format' => FormatImport::F10->value,
            'colonnes' => self::COLONNES,
            'unite_import' => 'millions FCFA',
            'onglets' => $onglets,
            'message' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function importerExcel(UploadedFile $fichier, ?int $periodeId = null, ?string $sens = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }

        $ext = strtolower($fichier->getClientOriginalExtension() ?: '');
        if (!\in_array($ext, ['xlsx', 'xls', 'csv'], true)) {
            throw new DonneesInvalidesException('Fichier attendu : Excel (.xlsx / .xls) ou CSV.');
        }
        $sensDefaut = $this->parserSens($sens, false);

        try {
            $spreadsheet = IOFactory::load($fichier->getPathname());
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException('Impossible de lire le fichier Excel : '.$e->getMessage());
        }

        $nbFeuilles = $spreadsheet->getSheetCount();
        /** @var array<string, array{lignes: list<array<string, mixed>>, anomalies: list<array<string, mixed>>}> $parSens */
        $parSens = [];

        foreach ($spreadsheet->getAllSheets() as $feuille) {
            $sensFeuille = $this->deduireSensFeuille($feuille->getTitle())
                ?? ($nbFeuilles === 1 || $sensDefaut !== null ? $sensDefaut : null);
            $rows = $feuille->toArray(null, true, true, false);
            if ($rows === []) {
                continue;
            }
            [$map, $idxEntete] = $this->detecterEntetes($rows);
            if ($map === null) {
                continue;
            }
            if ($sensFeuille === null) {
                throw new DonneesInvalidesException(
                    sprintf('Onglet « %s » : sens indéterminé (nommer l\'onglet « Dépenses » ou « Recettes », ou fournir le paramètre « sens »).', $feuille->getTitle()),
                );
            }

            $lues = $this->lireFeuille($rows, $idxEntete, $map, $sensFeuille);
            $parSens[$sensFeuille->value]['lignes'] = array_merge($parSens[$sensFeuille->value]['lignes'] ?? [], $lues['lignes']);
            $parSens[$sensFeuille->value]['anomalies'] = array_merge($parSens[$sensFeuille->value]['anomalies'] ?? [], $lues['anomalies']);
        }

        if ($parSens === []) {
            throw new DonneesInvalidesException(
                'En-têtes introuvables (attendu CATÉGORIE, C_IT, LIBELLÉ, M01…M12).',
            );
        }

        $sha = hash_file('sha256', $fichier->getPathname()) ?: null;
        $nom = $fichier->getClientOriginalName() ?: 'correspondants.xlsx';
        $resultats = [];
        foreach ($parSens as $sensValeur => $data) {
            $s = SensMontantCompte::from($sensValeur);
            $lot = $this->persisterLot($periode, $s, $data['lignes'], $data['anomalies'], $nom, $sha);
            $resultats[$sensValeur] = [
                'lot_id' => $lot->getId(),
                'nb_lignes' => $lot->getNbLignes(),
                'montant_total' => $lot->getMontantTotal(),
                'nb_anomalies' => count($data['anomalies']),
            ];
        }

        $this->journalAuditService->enregistrer(
            'IMPORTER',
            'correspondant_mouvement',
            (string) $periode->getId(),
            $this->acteur(),
            null,
            ['fichier' => $nom, 'lots' => $resultats],
        );

        $etat = $this->obtenirEtat($periode->getId());
        $etat['imports'] = $resultats;

        return $etat;
    }

    /**
     * @param list<array<string, mixed>> $lignes
     * @param list<array<string, mixed>> $anomalies
     */
    private function persisterLot(
        Periode $periode,
        SensMontantCompte $sens,
        array $lignes,
        array $anomalies,
        string $fichierNom,
        ?string $sha,
    ): LotImport {
        $pid = $periode->getId() ?? 0;
        foreach ($this->lotsActifs($pid, $sens) as $ancien) {
            $ancien->setStatut(StatutLotImport::REMPLACE);
        }
        $this->em->flush();

        $total = '0.00';
        foreach ($lignes as $l) {
            foreach ($l['mois'] as $montant) {
                $total = bcadd($total, $montant, 2);
            }
        }

        $lot = new LotImport($periode, FormatImport::F10, [
            'source' => self::SOURCE,
            'source_libelle' => 'Correspondants (DSI) · '.$sens->libelle(),
            'etape' => self::ETAPE,
            'sens' => $sens->value,
            'mode' => 'excel',
            'unite_import' => 'millions',
        ]);
        $lot->setNbLignes(count($lignes));
        $lot->setMontantTotal($total);
        $lot->setFichierNom($fichierNom);
        if ($sha !== null) {
            $lot->setFichierSha256($sha);
        }
        $acteur = $this->acteur();
        if ($acteur instanceof Utilisateur) {
            $lot->setImportePar($acteur);
        }
        $this->em->persist($lot);
        $this->em->flush();

        foreach ($lignes as $l) {
            foreach ($l['mois'] as $mois => $montant) {
                $this->em->persist(new CorrespondantMouvement(
                    $lot,
                    $sens,
                    (int) $mois,
                    $montant,
                    $l['categorie'],
                    $l['compte'],
                    $l['libelle'],
                ));
            }
        }
        foreach ($anomalies as $a) {
            $this->em->persist(new AnomalieImport(
                $lot,
                (int) $a['ligne'],
                (string) $a['motif'],
                isset($a['colonne']) && $a['colonne'] !== '' ? (string) $a['colonne'] : null,
            ));
        }
        $this->em->flush();

        return $lot;
    }

    /**
     * @param list<list<mixed>>  $rows
     * @param array<string, int> $map
     *
     * @return array{lignes: list<array<string, mixed>>, anomalies: list<array<string, mixed>>}
     */
    private function lireFeuille(array $rows, int $idxEntete, array $map, SensMontantCompte $sens): array
    {
        $domaine = $sens === SensMontantCompte::RECETTE ? DomaineFlechage::CORRESP_RECETTE : DomaineFlechage::CORRESP_DEPENSE;
        $connues = $this->categoriesConnues($domaine);

        $lignes = [];
        $anomalies = [];
        for ($i = $idxEntete + 1, $n = count($rows); $i < $n; ++$i) {
            $row = $rows[$i];
            if (!\is_array($row) || $this->ligneVide($row)) {
                continue;
            }
            $numLigne = $i + 1;
            $categorie = $this->texte($row[$map['CATEGORIE']] ?? null);
            $compte = isset($map['C_IT']) ? $this->texte($row[$map['C_IT']] ?? null) : null;
            $libelle = isset($map['LIBELLE']) ? $this->texte($row[$map['LIBELLE']] ?? null) : null;

            if ($categorie === null) {
                $anomalies[] = ['ligne' => $numLigne, 'colonne' => 'CATÉGORIE', 'motif' => 'Catégorie vide'];
            } elseif ($connues !== [] && !isset($connues[mb_strtolower($categorie)])) {
                $anomalies[] = ['ligne' => $numLigne, 'colonne' => 'CATÉGORIE', 'motif' => 'Catégorie inconnue « '.$categorie.' » (aucune règle de fléchage)'];
            }

            $mois = [];
            for ($m = 1; $m <= 12; ++$m) {
                if (!isset($map['M'.$m])) {
                    continue;
                }
                $brut = $this->montantMillions($row[$map['M'.$m]] ?? null);
                if ($brut === null) {
                    $anomalies[] = ['ligne' => $numLigne, 'colonne' => sprintf('M%02d', $m), 'motif' => 'Montant non numérique'];
                    continue;
                }
                // Millions → FCFA
                $fcfa = bcmul($brut, self::MILLION, 2);
                if (bccomp($fcfa, '0', 2) !== 0) {
                    $mois[$m] = $fcfa;
                }
            }

            $lignes[] = [
                'categorie' => $categorie !== null ? mb_substr($categorie, 0, 128) : null,
                'compte' => $compte !== null ? mb_substr($compte, 0, 32) : null,
                'libelle' => $libelle !== null ? mb_substr($libelle, 0, 255) : null,
                'mois' => $mois,
            ];
        }

        return ['lignes' => $lignes, 'anomalies' => $anomalies];
    }

    /**
     * @param list<list<mixed>> $rows
     *
     * @return array{0: array<string, int>|null, 1: int}
     */
    private function detecterEntetes(array $rows): array
    {
        foreach ($rows as $i => $row) {
            if (!\is_array($row)) {
                continue;
            }
            $map = [];
            foreach ($row as $idx => $cell) {
                $norm = $this->normaliserEnTete((string) ($cell ?? ''));
                if ($norm === '') {
                    continue;
                }
                $canon = match (true) {
                    $norm === 'CATEGORIE' => 'CATEGORIE',
                    $norm === 'C_IT' || $norm === 'COMPTE' => 'C_IT',
                    $norm === 'LIBELLE' => 'LIBELLE',
                    (bool) preg_match('/^M0?([1-9]|1[0-2])$/', $norm, $mm) => 'M'.(int) $mm[1],
                    default => null,
                };
                if ($canon !== null && !isset($map[$canon])) {
                    $map[$canon] = (int) $idx;
                }
            }
            if (isset($map['CATEGORIE']) && \count(array_filter(array_keys($map), static fn (string $k): bool => $k[0] === 'M')) >= 1) {
                return [$map, (int) $i];
            }
        }

        return [null, 0];
    }

    private function deduireSensFeuille(string $titre): ?SensMontantCompte
    {
        $t = $this->normaliserEnTete($titre);
        if (str_contains($t, 'DEP')) {
            return SensMontantCompte::DEPENSE;
        }
        if (str_contains($t, 'REC')) {
            return SensMontantCompte::RECETTE;
        }

        return null;
    }

    /**
     * @return array<string, true>
     */
    private function categoriesConnues(DomaineFlechage $domaine): array
    {
        $out = [];
        foreach ($this->regleFlechageRepository->listerParDomaines([$domaine]) as $r) {
            if ($r instanceof RegleFlechage && $r->getCategorie() !== null && $r->getCategorie() !== '') {
                $out[mb_strtolower($r->getCategorie())] = true;
            }
        }

        return $out;
    }

    // ------------------------------------------------------------------
    // Recettes › Correspondants
    // ------------------------------------------------------------------

    /**
     * Recettes correspondants (lot F10 RECETTE actif) : lignes compte × mois + code de fléchage.
     *
     * @return array<string, mixed>
     */
    public function obtenirRecettes(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'periode' => null,
                'lot' => null,
                'lignes' => [],
                'categories' => [],
                'total_mois' => '0.00',
                'total_cumul' => '0.00',
                'total_annee' => '0.00',
                'message' => 'Aucune période SROT.',
            ];
        }

        $lots = $this->lotsActifs($periode->getId(), SensMontantCompte::RECETTE);
        $lot = $lots[0] ?? null;
        $out = [
            'periode' => $this->serialiserPeriode($periode),
            'lot' => $lot?->getId() !== null ? $this->lotImportService->obtenir($lot->getId()) : null,
            'lignes' => [],
            'categories' => [],
            'total_mois' => '0.00',
            'total_cumul' => '0.00',
            'total_annee' => '0.00',
            'message' => null,
        ];
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            $out['message'] = 'Aucun lot F10 (correspondants · recettes) actif pour cette période.';

            return $out;
        }

        $moisPeriode = $periode->getMois();
        /** @var array<string, array<string, mixed>> $grille */
        $grille = [];
        foreach ($this->mouvementRepository->listerParLots([$lot->getId()], SensMontantCompte::RECETTE) as $m) {
            $cle = ($m->getCategorie() ?? '').'|'.($m->getCompte() ?? '').'|'.($m->getLibelle() ?? '');
            $grille[$cle] ??= [
                'categorie' => $m->getCategorie() ?? '(sans catégorie)',
                'compte' => $m->getCompte(),
                'libelle' => $m->getLibelle(),
                'rubrique_code' => null,
                'mois' => array_fill(1, 12, '0.00'),
                'montant_mois' => '0.00',
                'cumul' => '0.00',
                'total_annee' => '0.00',
            ];
            $mois = $m->getMois();
            $mt = $m->getMontant();
            $grille[$cle]['mois'][$mois] = bcadd($grille[$cle]['mois'][$mois], $mt, 2);
            $grille[$cle]['total_annee'] = bcadd($grille[$cle]['total_annee'], $mt, 2);
            if ($mois === $moisPeriode) {
                $grille[$cle]['montant_mois'] = bcadd($grille[$cle]['montant_mois'], $mt, 2);
            }
            if ($mois <= $moisPeriode) {
                $grille[$cle]['cumul'] = bcadd($grille[$cle]['cumul'], $mt, 2);
            }
        }

        $totalMois = '0.00';
        $totalCumul = '0.00';
        $totalAnnee = '0.00';
        $catsUniques = [];
        foreach ($grille as &$ligne) {
            $ligne['rubrique_code'] = CorrespondantsR::code(
                is_string($ligne['categorie']) ? $ligne['categorie'] : null,
            );
            $ligne['mois'] = array_values($ligne['mois']);
            $totalMois = bcadd($totalMois, $ligne['montant_mois'], 2);
            $totalCumul = bcadd($totalCumul, $ligne['cumul'], 2);
            $totalAnnee = bcadd($totalAnnee, $ligne['total_annee'], 2);
            $catsUniques[$ligne['categorie']] = true;
        }
        unset($ligne);

        $out['lignes'] = array_values($grille);
        $out['categories'] = array_keys($catsUniques);
        sort($out['categories']);
        $out['total_mois'] = $totalMois;
        $out['total_cumul'] = $totalCumul;
        $out['total_annee'] = $totalAnnee;
        $out['message'] = $grille === [] ? 'Aucun mouvement.' : null;

        return $out;
    }

    /**
     * Persiste ligne_flechee recettes correspondants (exercice) puis reconstruit montant_mensuel AUTO.
     * Un seul lot F10 recettes de la période de référence ; chaque mois est rattaché à la période homonyme.
     *
     * @return array<string, mixed>
     */
    public function recalculerRecettes(?int $periodeId = null): array
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
                    self::SOURCE_LIGNE_RECETTE,
                );
                $periodesParMois[$p->getMois()] = $p;
            }
        }
        $this->em->flush();

        $lots = $this->lotsActifs($periodeRef->getId(), SensMontantCompte::RECETTE);
        $lot = $lots[0] ?? null;
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            // Fallback : dernier lot recettes actif de l'exercice.
            foreach ($periodes as $p) {
                if ($p->getId() === null) {
                    continue;
                }
                $candidats = $this->lotsActifs($p->getId(), SensMontantCompte::RECETTE);
                if ($candidats !== []) {
                    $lot = $candidats[0];
                    break;
                }
            }
        }
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            throw new DonneesInvalidesException(
                'Aucun lot F10 (correspondants · recettes) actif pour cette période.',
            );
        }

        /** @var array<string, array{code: string, mois: int, montant: string}> $agregats */
        $agregats = [];
        foreach ($this->mouvementRepository->listerParLots([$lot->getId()], SensMontantCompte::RECETTE) as $m) {
            $code = CorrespondantsR::code($m->getCategorie());
            if ($code === '' || $code === 'NONE') {
                continue;
            }
            $mois = $m->getMois();
            if ($mois < 1 || $mois > 12) {
                continue;
            }
            $cle = $code.'|'.$mois;
            $agregats[$cle] ??= ['code' => $code, 'mois' => $mois, 'montant' => '0.00'];
            $agregats[$cle]['montant'] = bcadd($agregats[$cle]['montant'], $m->getMontant(), 2);
        }

        $nbLignes = 0;
        foreach ($agregats as $a) {
            $periodeCible = $periodesParMois[$a['mois']] ?? $periodeRef;
            $this->em->persist(new LigneFlechee(
                self::SOURCE_LIGNE_RECETTE,
                $a['code'].'-'.$a['mois'],
                $periodeCible,
                $a['code'],
                $a['mois'],
                $a['montant'],
            ));
            ++$nbLignes;
        }

        $this->em->flush();
        $cumul = $this->rdModelCumulService->recalculerAuto($annee);

        return [
            'periode' => $this->serialiserPeriode($periodeRef),
            'lot_id' => $lot->getId(),
            'nb_lignes_flechees' => $nbLignes,
            'cumul' => $cumul,
            'etat' => $this->obtenirRecettes($periodeRef->getId()),
        ];
    }

    /**
     * @return array{par_compte: array<string, string>, par_categorie: array<string, string>}
     */
    private function indexFlechage(DomaineFlechage $domaine): array
    {
        $parCompte = [];
        $parCategorie = [];
        foreach ($this->regleFlechageRepository->listerParDomaines([$domaine]) as $r) {
            if (!$r instanceof RegleFlechage) {
                continue;
            }
            $code = $r->getRubriqueCode();
            if ($r->getCompte() !== null && $r->getCompte() !== '') {
                $parCompte[mb_strtolower($r->getCompte())] ??= $code;
            }
            if ($r->getCategorie() !== null && $r->getCategorie() !== '') {
                $parCategorie[mb_strtolower($r->getCategorie())] ??= $code;
            }
        }

        return ['par_compte' => $parCompte, 'par_categorie' => $parCategorie];
    }

    /**
     * @param array{par_compte: array<string, string>, par_categorie: array<string, string>} $index
     */
    private function resoudreCodeFlechage(array $index, ?string $categorie, ?string $compte): ?string
    {
        if ($compte !== null && $compte !== '') {
            $c = $index['par_compte'][mb_strtolower($compte)] ?? null;
            if ($c !== null) {
                return $c;
            }
        }
        if ($categorie !== null && $categorie !== '') {
            return $index['par_categorie'][mb_strtolower($categorie)] ?? null;
        }

        return null;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    private function construireOnglet(int $periodeId, SensMontantCompte $sens): array
    {
        $lot = ($this->lotsActifs($periodeId, $sens)[0] ?? null);
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return [
                'sens' => $sens->value,
                'lot' => null,
                'lignes' => [],
                'anomalies' => [],
                'nombre' => 0,
                'total' => '0.00',
            ];
        }

        /** @var array<string, array<string, mixed>> $grille */
        $grille = [];
        foreach ($this->mouvementRepository->listerParLot($lot->getId()) as $m) {
            $cle = ($m->getCategorie() ?? '').'|'.($m->getCompte() ?? '').'|'.($m->getLibelle() ?? '');
            $grille[$cle] ??= [
                'categorie' => $m->getCategorie(),
                'compte' => $m->getCompte(),
                'libelle' => $m->getLibelle(),
                'mois' => array_fill(1, 12, '0.00'),
                'total' => '0.00',
            ];
            $grille[$cle]['mois'][$m->getMois()] = bcadd($grille[$cle]['mois'][$m->getMois()], $m->getMontant(), 2);
            $grille[$cle]['total'] = bcadd($grille[$cle]['total'], $m->getMontant(), 2);
        }
        foreach ($grille as &$g) {
            $g['mois'] = array_values($g['mois']);
        }
        unset($g);

        return [
            'sens' => $sens->value,
            'lot' => $this->lotImportService->obtenir($lot->getId()),
            'lignes' => array_values($grille),
            'anomalies' => $this->lotImportService->listerAnomalies($lot->getId()),
            'nombre' => count($grille),
            'total' => $lot->getMontantTotal(),
        ];
    }

    /**
     * @return list<LotImport>
     */
    private function lotsActifs(int $periodeId, SensMontantCompte $sens): array
    {
        /** @var list<LotImport> $candidats */
        $candidats = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('IDENTITY(l.periode) = :pid')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('pid', $periodeId)
            ->setParameter('format', FormatImport::F10)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        return array_values(array_filter(
            $candidats,
            static function (LotImport $l) use ($sens): bool {
                $p = $l->getParametres();

                return ($p['source'] ?? null) === self::SOURCE && ($p['sens'] ?? null) === $sens->value;
            },
        ));
    }

    private function parserSens(?string $sens, bool $obligatoire): ?SensMontantCompte
    {
        $s = strtoupper(trim((string) $sens));
        if ($s === '') {
            if ($obligatoire) {
                throw new DonneesInvalidesException('Sens requis (RECETTE ou DEPENSE).');
            }

            return null;
        }
        $s = strtr($s, ['É' => 'E']);
        $enum = SensMontantCompte::tryFrom($s)
            ?? (str_starts_with($s, 'DEP') ? SensMontantCompte::DEPENSE : (str_starts_with($s, 'REC') ? SensMontantCompte::RECETTE : null));
        if ($enum === null) {
            throw new DonneesInvalidesException('Sens invalide (RECETTE ou DEPENSE).');
        }

        return $enum;
    }

    private function normaliserEnTete(string $s): string
    {
        $s = mb_strtoupper(trim($s));
        $s = strtr($s, ['É' => 'E', 'È' => 'E', 'Ê' => 'E', 'À' => 'A', 'Ù' => 'U', 'Ô' => 'O', 'Î' => 'I', 'Ç' => 'C']);
        $s = preg_replace('/[^A-Z0-9]+/', '_', $s) ?? $s;

        return trim($s, '_');
    }

    /**
     * @param list<mixed> $row
     */
    private function ligneVide(array $row): bool
    {
        foreach ($row as $c) {
            if (trim((string) ($c ?? '')) !== '') {
                return false;
            }
        }

        return true;
    }

    private function texte(mixed $v): ?string
    {
        if ($v === null) {
            return null;
        }
        $s = trim((string) $v);

        return $s === '' ? null : $s;
    }

    /**
     * Montant en millions (décimal, 6 chiffres) ; null si non numérique ; '0.000000' si vide.
     */
    private function montantMillions(mixed $v): ?string
    {
        if ($v === null || $v === '') {
            return '0.000000';
        }
        if (\is_int($v) || \is_float($v)) {
            return number_format((float) $v, 6, '.', '');
        }
        $s = preg_replace('/[\s\x{00A0}\x{202F}\']+/u', '', (string) $v) ?? '';
        $s = str_replace(',', '.', $s);
        if ($s === '' || $s === '-') {
            return '0.000000';
        }

        return is_numeric($s) ? number_format((float) $s, 6, '.', '') : null;
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
