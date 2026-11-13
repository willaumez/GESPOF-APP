<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

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
use App\Module\ServiceOperationsFinancieres\Repository\DcReglementRepository;
use App\Module\ServiceOperationsFinancieres\Repository\IgOperationRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LigneFlecheeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RegleFlechageRepository;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Pages SOF › Dépenses automatisées (ordonnances, crédits délégués, avances, correspondants).
 */
class DepensesAutomatiseesService
{
    private const NONE = 'NONE';

    /** @var array<string, array{title: string, description: string, domaine: DomaineFlechage, source_table: string, codes: array<string, string>}> */
    private const PAGES = [
        'ordonnances' => [
            'title' => 'Règlements sur ordonnances',
            'description' => 'Dépenses fléchées à partir des imports DC des règlements sur ordonnances.',
            'domaine' => DomaineFlechage::REGLEMENT,
            'source_table' => 'dep_auto_ordonnances',
            // Codes SROT produits par Reglements (SPEC §6.1) — libellés courts.
            'codes' => [
                'A' => 'Titre 2 ant. · A', 'B' => 'Titre 2 ant. · B', 'B2' => 'Titre 2 ant. · B2',
                'C' => 'Titre 1 ant.', 'D' => 'Titre 3 ant.', 'E' => 'Titre 4 ant. · E',
                'F' => 'Titre 4 ant. · F', 'G' => 'Titre 4 ant. · G', 'H' => 'Titre 4 ant. · H',
                'I' => 'Titre 5 ant.', 'M' => 'Titre 6 ant.',
                'S' => 'Titre 1 courant', 'O' => 'Titre 2 courant · O',
                'Y' => 'Titre 3 · Y', 'X' => 'Titre 3 · X', 'Z' => 'Titre 3 · Z', 'V' => 'Titre 3 · V',
                'AA' => 'Titre 4 · AA', 'AB' => 'Titre 4 · AB', 'AC' => 'Titre 4 · AC',
                'AE' => 'Titre 4 · AE', 'AG' => 'Titre 4 · AG',
                'AH' => 'Titre 5 courant', 'AK2' => 'Titre 6 courant',
                self::NONE => 'Non retenus en SROT',
            ],
        ],
        'credits-delegues' => [
            'title' => 'Crédits délégués',
            'description' => 'Dépenses fléchées à partir des imports IG crédits délégués.',
            'domaine' => DomaineFlechage::CREDIT_DELEGUE,
            'source_table' => 'dep_auto_credits_delegues',
            'codes' => [
                'AI' => 'Crédits délégués · exercice courant',
                'D1' => 'Crédits délégués · arriérés',
                self::NONE => 'Non fléchées',
            ],
        ],
        'avances' => [
            'title' => 'Avances au budget',
            'description' => 'Dépenses fléchées à partir des imports IG avances 4701-5 / 4706-1.',
            'domaine' => DomaineFlechage::AVANCE,
            'source_table' => 'dep_auto_avances',
            'codes' => [
                'A' => 'A', 'B' => 'B', 'D' => 'D', 'E' => 'E', 'F' => 'F', 'I' => 'I', 'M' => 'M',
                'V' => 'V', 'X' => 'X', 'Y' => 'Y', 'Z' => 'Z',
                'AA' => 'AA', 'AB' => 'AB', 'AH' => 'AH', 'AK1' => 'AK1', 'AK2' => 'AK2',
                'S' => 'S', 'O' => 'O', 'C' => 'C',
                self::NONE => 'Non fléchées',
            ],
        ],
        'correspondants' => [
            'title' => 'Correspondants',
            'description' => 'Dépenses des correspondants fléchées à partir des imports DSI.',
            'domaine' => DomaineFlechage::CORRESP_DEPENSE,
            'source_table' => 'dep_auto_correspondants',
            'codes' => [
                'AJ' => 'Agences Comptables / ANGT',
                'W' => 'Dettes Croisées',
                'AL' => 'CNAMGS',
                'AO' => 'Autres Correspondants',
                'AN' => 'CNSS',
                'AM' => 'Fonds Dev. Sport',
                'AY' => 'Fonds de sécurité',
                'AP' => 'Cautions',
                'AX' => 'Collectivités Locales',
                'AQ' => 'Consignations',
                'AR' => 'Excédents',
                'AS' => 'Bonus / Fonds Communs',
                'AV' => 'Fonds Divers',
                'AT' => 'Primes / Fonds Communs',
                'AU' => 'Fonds Communs (autres)',
                'AW' => 'F.E.R.',
                self::NONE => 'Non fléchées',
            ],
        ],
    ];

    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly RegleFlechageRepository $regleFlechageRepository,
        private readonly LigneFlecheeRepository $ligneFlecheeRepository,
        private readonly RdModelCumulService $rdModelCumulService,
        private readonly DcReglementRepository $dcReglementRepository,
        private readonly IgOperationRepository $igOperationRepository,
        private readonly CorrespondantMouvementRepository $correspondantMouvementRepository,
        private readonly FlechageDeterministeService $flechageDeterministe,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @param array<string, mixed> $filtres
     *
     * @return array<string, mixed>
     */
    public function obtenir(
        string $page,
        ?int $periodeId = null,
        string $vue = 'agregee',
        string $affichage = 'mois',
        array $filtres = [],
    ): array {
        $config = $this->config($page);
        $vue = $this->normaliserVue($vue);
        $affichage = $this->normaliserAffichage($affichage);
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return $this->reponseSansPeriode($config, $page, $vue, $affichage);
        }

        $lignes = $this->chargerLignes($page, $periode);

        return 'detail' === $vue
            ? $this->reponseDetail($config, $page, $periode, $affichage, $lignes, $filtres)
            : $this->reponseAgregee($config, $page, $periode, $affichage, $lignes);
    }

    /**
     * @param array<string, mixed> $filtres
     *
     * @return array<string, mixed>
     */
    public function recalculer(
        string $page,
        ?int $periodeId = null,
        string $vue = 'agregee',
        string $affichage = 'mois',
        array $filtres = [],
    ): array {
        $config = $this->config($page);
        $vue = $this->normaliserVue($vue);
        $affichage = $this->normaliserAffichage($affichage);
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }

        $lignes = $this->chargerLignes($page, $periode);
        $this->persisterRecalcul($config, $periode, $lignes);

        return 'detail' === $vue
            ? $this->reponseDetail($config, $page, $periode, $affichage, $lignes, $filtres)
            : $this->reponseAgregee($config, $page, $periode, $affichage, $lignes);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function chargerLignes(string $page, Periode $periode): array
    {
        $config = $this->config($page);
        $annee = $periode->getExercice()->getAnnee();
        $prefixeAd = $periode->getExercice()->getPrefixeAd();
        $raw = match ($page) {
            'ordonnances' => $this->chargerOrdonnances($periode),
            'credits-delegues' => $this->chargerCreditsDelegues($periode),
            'avances' => $this->chargerAvances($periode),
            'correspondants' => $this->chargerCorrespondants($periode),
            default => throw new DonneesInvalidesException('Page de dépenses automatisées inconnue.'),
        };

        return array_map(
            function (array $ligne) use ($config, $annee, $prefixeAd): array {
                $ligne['annee'] = $annee;
                $ligne['exercice_annee'] = $annee;
                $ligne['prefixe_ad'] = $prefixeAd;

                return $this->appliquerFlechageDeterministe($ligne, $config['domaine'], $config['codes']);
            },
            $raw,
        );
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function chargerOrdonnances(Periode $periodeSelectionnee): array
    {
        $lignes = [];
        foreach ($this->periodesExercice($periodeSelectionnee) as $periode) {
            $lot = $this->premierLotActif($periode->getId() ?? 0, ['dc-regl'], [FormatImport::F2]);
            if (!$lot instanceof LotImport || $lot->getId() === null) {
                continue;
            }

            $total = max(1, $this->dcReglementRepository->compterParLot($lot->getId()));
            foreach ($this->dcReglementRepository->listerTableauParLot($lot->getId(), $total, 0) as $row) {
                $mois = $this->moisDepuisDate($row['dat_regl'] ?? null)
                    ?? $this->moisDepuisDate($row['d_emis'] ?? null)
                    ?? $periode->getMois();
                $montant = $this->decimal($row['m_regl'] ?? null);
                if (0 === bccomp($montant, '0.00', 2)) {
                    continue;
                }

                $nature = $this->texte($row['nature'] ?? null) ?? $this->texte($row['nat'] ?? null);
                $beneficiaire = $this->texte($row['nom'] ?? null);
                $objet = $this->texte($row['objet'] ?? null);

                $lignes[] = [
                    'source_id' => (string) ($row['id'] ?? ''),
                    'periode' => $periode,
                    'mois' => $mois,
                    'montant' => $montant,
                    'categorie' => $this->texte($row['categ'] ?? null),
                    'compte' => $this->texte($row['pc'] ?? null),
                    'nature' => $nature,
                    'type_exercice' => $this->texte($row['ex'] ?? null),
                    'titre' => $this->texte($row['titre'] ?? null),
                    'mdr' => $this->texte($row['mdr'] ?? null),
                    'detail' => [
                        'categorie' => $this->texte($row['categ'] ?? null),
                        'type' => $this->texte($row['type'] ?? null) ?? $this->texte($row['type_1'] ?? null),
                        'titre' => $this->texte($row['titre'] ?? null),
                        'nature' => $nature,
                        'mode_reglement' => $this->texte($row['mdr'] ?? null),
                        'beneficiaire' => $beneficiaire,
                        'objet' => $objet,
                        'ordonnance' => $this->texte($row['ordonnance'] ?? null),
                        'numero_reglement' => $this->texte($row['n_regl'] ?? null),
                    ],
                    'search' => $this->searchable([
                        $row['categ'] ?? null,
                        $row['type'] ?? null,
                        $row['type_1'] ?? null,
                        $row['titre'] ?? null,
                        $nature,
                        $row['mdr'] ?? null,
                        $beneficiaire,
                        $objet,
                        $row['ordonnance'] ?? null,
                        $row['n_regl'] ?? null,
                    ]),
                ];
            }
        }

        return $lignes;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function chargerCreditsDelegues(Periode $periodeSelectionnee): array
    {
        $annee = $periodeSelectionnee->getExercice()->getAnnee();
        $lignes = [];
        foreach ($this->periodesExercice($periodeSelectionnee) as $periode) {
            foreach ($this->lotsActifs($periode->getId() ?? 0, ['ig-cdel'], null, ['etape' => 'ig_operation']) as $lot) {
                if ($lot->getId() === null) {
                    continue;
                }

                foreach ($this->igOperationRepository->listerParLot($lot->getId(), 50000) as $op) {
                    $montant = $op->getMRegl() ?? '0.00';
                    if (0 === bccomp($montant, '0.00', 2)) {
                        continue;
                    }

                    $prefixeAd = $periodeSelectionnee->getExercice()->getPrefixeAd();
                    $classement = \App\Module\ServiceOperationsFinancieres\Support\ClassementCreditDelegue::classer(
                        $op->getCRef1(),
                        $prefixeAd,
                    );
                    $typeExercice = $classement['type_exercice'];
                    $anomalieAd = $classement['anomalie'];
                    $mois = $this->moisDepuisDate($op->getDCpta()) ?? $periode->getMois();

                    $lignes[] = [
                        'source_id' => (string) ($op->getId() ?? ''),
                        'periode' => $periode,
                        'mois' => $mois,
                        'montant' => $montant,
                        'categorie' => null,
                        'compte' => $op->getCIt(),
                        'nature' => $op->getCNat(),
                        'type_exercice' => $typeExercice,
                        'titre' => $op->getCRef2() ?? $op->getCRef1(),
                        'mdr' => $op->getCMdr(),
                        'c_nop' => $op->getCNop(),
                        'c_ref1' => $op->getCRef1(),
                        'c_ref2' => $op->getCRef2(),
                        'detail' => [
                            'exercice' => $op->getCRef1(),
                            'type_exercice' => $typeExercice,
                            'anomalie' => $anomalieAd,
                            'mode' => $op->getCNop(),
                            'mdr' => $op->getCMdr(),
                            'nature' => $op->getCNat(),
                            'titre' => $op->getCRef2() ?? $op->getCRef1(),
                            'libelle' => $op->getLNp(),
                            'numero_reglement' => $op->getNRegl(),
                        ],
                        'search' => $this->searchable([
                            $op->getCRef1(),
                            $op->getCRef2(),
                            $op->getCMdr(),
                            $op->getCNat(),
                            $op->getLNp(),
                            $op->getNRegl(),
                            $op->getCIt(),
                            $op->getCNop(),
                            $typeExercice,
                            $anomalieAd,
                        ]),
                    ];
                }
            }
        }

        return $lignes;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function chargerAvances(Periode $periodeSelectionnee): array
    {
        $lignes = [];
        foreach ($this->periodesExercice($periodeSelectionnee) as $periode) {
            foreach ($this->lotsActifs($periode->getId() ?? 0, ['ig-avances-4701', 'ig-avances-4706', 'ig-avances'], null, ['etape' => 'ig_operation']) as $lot) {
                if ($lot->getId() === null) {
                    continue;
                }

                foreach ($this->igOperationRepository->listerParLot($lot->getId(), 50000) as $op) {
                    $montant = $op->getMRegl() ?? '0.00';
                    if (0 === bccomp($montant, '0.00', 2)) {
                        continue;
                    }

                    $mois = $this->moisDepuisDate($op->getDCpta()) ?? $periode->getMois();
                    $lignes[] = [
                        'source_id' => (string) ($op->getId() ?? ''),
                        'periode' => $periode,
                        'mois' => $mois,
                        'montant' => $montant,
                        'categorie' => null,
                        'compte' => $op->getCIt(),
                        'nature' => $op->getCNat(),
                        'type_exercice' => $op->getCRef1(),
                        'titre' => $op->getCRef2(),
                        'mdr' => $op->getCMdr(),
                        'c_nop' => $op->getCNop(),
                        'detail' => [
                            'compte' => $op->getCIt(),
                            'mode' => $op->getCMdr(),
                            'nature' => $op->getCNat(),
                            'exercice' => $op->getCRef1(),
                            'titre_budgetaire' => $op->getCRef2(),
                            'libelle' => $op->getLNp(),
                            'c_nop' => $op->getCNop(),
                        ],
                        'search' => $this->searchable([
                            $op->getCIt(),
                            $op->getCMdr(),
                            $op->getCNat(),
                            $op->getCRef1(),
                            $op->getCRef2(),
                            $op->getLNp(),
                            $op->getCNop(),
                        ]),
                    ];
                }
            }
        }

        return $lignes;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function chargerCorrespondants(Periode $periodeSelectionnee): array
    {
        $lignes = [];
        $periodeId = $periodeSelectionnee->getId() ?? 0;
        $lot = $this->premierLotActif(
            $periodeId,
            ['srv-correspondants'],
            [FormatImport::F10],
            ['sens' => SensMontantCompte::DEPENSE->value],
        );
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return [];
        }

        $periodesParMois = [];
        foreach ($this->periodesExercice($periodeSelectionnee) as $periode) {
            $periodesParMois[$periode->getMois()] = $periode;
        }

        foreach ($this->correspondantMouvementRepository->listerParLots([$lot->getId()], SensMontantCompte::DEPENSE) as $mouvement) {
            if (!$mouvement instanceof CorrespondantMouvement) {
                continue;
            }
            $montant = $mouvement->getMontant();
            if (0 === bccomp($montant, '0.00', 2)) {
                continue;
            }
            $mois = $mouvement->getMois();
            $periode = $periodesParMois[$mois] ?? $periodeSelectionnee;

            $lignes[] = [
                'source_id' => (string) ($mouvement->getId() ?? ''),
                'periode' => $periode,
                'mois' => $mois,
                'montant' => $montant,
                'categorie' => $mouvement->getCategorie(),
                'compte' => $mouvement->getCompte(),
                'nature' => null,
                'type_exercice' => null,
                'titre' => null,
                'mdr' => null,
                'detail' => [
                    'categorie' => $mouvement->getCategorie(),
                    'compte' => $mouvement->getCompte(),
                    'libelle' => $mouvement->getLibelle(),
                ],
                'search' => $this->searchable([
                    $mouvement->getCategorie(),
                    $mouvement->getCompte(),
                    $mouvement->getLibelle(),
                ]),
            ];
        }

        return $lignes;
    }

    /**
     * @param list<RegleFlechage>       $regles
     * @param array<string, string>     $codes
     * @param array<string, mixed>      $ligne
     *
     * @return array<string, mixed>
     */
    /**
     * Fléchage Lot 2 : fonctions déterministes SPEC §6 (plus la table CRUD maquette).
     *
     * @param array<string, mixed>      $ligne
     * @param array<string, string>     $codes
     *
     * @return array<string, mixed>
     */
    private function appliquerFlechageDeterministe(array $ligne, DomaineFlechage $domaine, array $codes): array
    {
        $res = $this->flechageDeterministe->flecher($domaine, $ligne);
        $code = $res['code'];
        if (!isset($codes[$code])) {
            // Accepter tout code SROT non vide même hors libellés de page.
            if ($code !== self::NONE && $code !== '') {
                $codes[$code] = $code;
            } else {
                $code = self::NONE;
            }
        }

        $ligne['rubrique_code'] = $code;
        $ligne['rubrique_libelle'] = $codes[$code] ?? $codes[self::NONE];
        $ligne['regle_id'] = null;
        $ligne['flechage_motif'] = $res['motif'];
        $ligne['flechage_meta'] = $res['meta'];
        if (isset($res['meta']['anomalie']) && is_string($res['meta']['anomalie'])) {
            $ligne['detail'] = is_array($ligne['detail'] ?? null) ? $ligne['detail'] : [];
            $ligne['detail']['anomalie'] = $res['meta']['anomalie'];
        }
        if (isset($res['meta']['type_exercice'])) {
            $ligne['type_exercice'] = $res['meta']['type_exercice'];
            $ligne['detail'] = is_array($ligne['detail'] ?? null) ? $ligne['detail'] : [];
            $ligne['detail']['type_exercice'] = $res['meta']['type_exercice'];
        }

        return $ligne;
    }

    /** @deprecated Conservé pour tests / couverture table — préférer appliquerFlechageDeterministe. */
    private function appliquerFlechage(array $ligne, array $regles, array $codes): array
    {
        $regle = $this->trouverRegle($regles, $ligne);
        $code = $regle?->getRubriqueCode() ?? self::NONE;
        if (!isset($codes[$code])) {
            $code = self::NONE;
        }

        $ligne['rubrique_code'] = $code;
        $ligne['rubrique_libelle'] = $codes[$code] ?? $codes[self::NONE];
        $ligne['regle_id'] = $regle?->getId();

        return $ligne;
    }

    /**
     * @param list<RegleFlechage> $regles
     * @param array<string, mixed> $ligne
     */
    private function trouverRegle(array $regles, array $ligne): ?RegleFlechage
    {
        foreach ($regles as $regle) {
            if (!$this->critereOk($regle->getCategorie(), $ligne['categorie'] ?? null)) {
                continue;
            }
            if (!$this->critereOk($regle->getCompte(), $ligne['compte'] ?? null)) {
                continue;
            }
            if (!$this->critereOk($regle->getNature(), $ligne['nature'] ?? null)) {
                continue;
            }
            if (!$this->critereOk($regle->getTypeExercice(), $ligne['type_exercice'] ?? null)) {
                continue;
            }
            if (!$this->critereOk($regle->getTitre(), $ligne['titre'] ?? null)) {
                continue;
            }
            if (!$this->critereOk($regle->getMdr(), $ligne['mdr'] ?? null)) {
                continue;
            }
            if (!$this->estValideAujourdhui($regle)) {
                continue;
            }

            return $regle;
        }

        return null;
    }

    private function critereOk(?string $attendu, ?string $valeur): bool
    {
        if (null === $attendu || '' === trim($attendu)) {
            return true;
        }

        return 0 === strcasecmp(trim($attendu), trim((string) $valeur));
    }

    private function estValideAujourdhui(RegleFlechage $regle): bool
    {
        $auj = new \DateTimeImmutable('today');
        $du = $regle->getValideDu();
        $au = $regle->getValideAu();
        if ($du instanceof \DateTimeImmutable && $auj < $du) {
            return false;
        }
        if ($au instanceof \DateTimeImmutable && $auj > $au) {
            return false;
        }

        return true;
    }

    /**
     * @param array<string, mixed> $config
     * @param list<array<string, mixed>> $lignes
     *
     * @return array<string, mixed>
     */
    private function reponseAgregee(
        array $config,
        string $page,
        Periode $periode,
        string $affichage,
        array $lignes,
    ): array {
        $agreges = [];
        foreach ($config['codes'] as $code => $libelle) {
            $agreges[$code] = [
                'code' => $code,
                'libelle' => $libelle,
                'mois' => array_fill(0, 12, '0.00'),
                'total' => '0.00',
            ];
        }

        foreach ($lignes as $ligne) {
            $code = (string) ($ligne['rubrique_code'] ?? self::NONE);
            $mois = (int) ($ligne['mois'] ?? 0);
            if ($mois < 1 || $mois > 12 || !isset($agreges[$code])) {
                continue;
            }
            $agreges[$code]['mois'][$mois - 1] = bcadd(
                $agreges[$code]['mois'][$mois - 1],
                (string) $ligne['montant'],
                2,
            );
            $agreges[$code]['total'] = bcadd($agreges[$code]['total'], (string) $ligne['montant'], 2);
        }

        $totaux = array_fill(0, 12, '0.00');
        $totalGeneral = '0.00';
        foreach ($agreges as $row) {
            foreach ($row['mois'] as $index => $montant) {
                $totaux[$index] = bcadd($totaux[$index], $montant, 2);
            }
            $totalGeneral = bcadd($totalGeneral, $row['total'], 2);
        }

        return [
            'page' => $page,
            'titre' => $config['title'],
            'description' => $config['description'],
            'periode' => $this->serialiserPeriode($periode),
            'vue' => 'agregee',
            'affichage' => $affichage,
            'codes' => array_values($agreges),
            'totaux' => [
                'mois' => $totaux,
                'total' => $totalGeneral,
            ],
            'message' => [] === $lignes ? $this->messageVide($page) : null,
        ];
    }

    /**
     * @param array<string, mixed> $config
     * @param list<array<string, mixed>> $lignes
     * @param array<string, mixed> $filtres
     *
     * @return array<string, mixed>
     */
    private function reponseDetail(
        array $config,
        string $page,
        Periode $periode,
        string $affichage,
        array $lignes,
        array $filtres,
    ): array {
        $filtrees = $this->filtrerDetail($page, $lignes, $filtres);
        $serialisees = array_map(
            fn (array $ligne): array => $this->serialiserDetailLigne($page, $ligne),
            $filtrees,
        );

        return [
            'page' => $page,
            'titre' => $config['title'],
            'description' => $config['description'],
            'periode' => $this->serialiserPeriode($periode),
            'vue' => 'detail',
            'affichage' => $affichage,
            'lignes' => $serialisees,
            'nombre_none' => count(array_filter(
                $serialisees,
                static fn (array $ligne): bool => ($ligne['code'] ?? self::NONE) === self::NONE,
            )),
            'message' => [] === $serialisees
                ? ([] === $lignes ? $this->messageVide($page) : 'Aucune ligne pour les filtres sélectionnés.')
                : null,
        ];
    }

    /**
     * @param list<array<string, mixed>> $lignes
     * @param array<string, mixed> $filtres
     *
     * @return list<array<string, mixed>>
     */
    private function filtrerDetail(string $page, array $lignes, array $filtres): array
    {
        $lignesFiltre = strtolower(trim((string) ($filtres['lignes'] ?? 'toutes')));
        $recherche = $this->normaliserTexte((string) ($filtres['recherche'] ?? $filtres['search'] ?? ''));
        $code = trim((string) ($filtres['code'] ?? ''));
        $titre = trim((string) ($filtres['titre'] ?? ''));

        return array_values(array_filter(
            $lignes,
            function (array $ligne) use ($lignesFiltre, $recherche, $code, $titre, $page): bool {
                $isNone = ($ligne['rubrique_code'] ?? self::NONE) === self::NONE;
                if ('non-flechees' === $lignesFiltre && !$isNone) {
                    return false;
                }
                if ('toutes' !== $lignesFiltre && 'non-flechees' !== $lignesFiltre && $lignesFiltre !== '') {
                    throw new DonneesInvalidesException('Filtre lignes invalide (toutes, non-flechees).');
                }
                if ('' !== $recherche && !str_contains((string) ($ligne['search'] ?? ''), $recherche)) {
                    return false;
                }
                if ('' !== $code && 0 !== strcasecmp((string) ($ligne['rubrique_code'] ?? ''), $code)) {
                    return false;
                }
                if ('ordonnances' === $page && '' !== $titre) {
                    $titreLigne = trim((string) ($ligne['detail']['titre'] ?? ''));
                    if (0 !== strcasecmp($titreLigne, $titre)) {
                        return false;
                    }
                }

                return true;
            },
        ));
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function serialiserDetailLigne(string $page, array $ligne): array
    {
        $base = [
            'source_id' => $ligne['source_id'],
            'mois' => (int) $ligne['mois'],
            'mois_libelle' => Mois::tryFrom((int) $ligne['mois'])?->libelle(),
            'montant' => (string) $ligne['montant'],
            'code' => (string) $ligne['rubrique_code'],
            'code_libelle' => (string) $ligne['rubrique_libelle'],
        ];

        return match ($page) {
            'ordonnances' => $base + [
                'categorie' => $ligne['detail']['categorie'] ?? null,
                'type' => $ligne['detail']['type'] ?? null,
                'titre' => $ligne['detail']['titre'] ?? null,
                'nature' => $ligne['detail']['nature'] ?? null,
                'mode_reglement' => $ligne['detail']['mode_reglement'] ?? null,
                'beneficiaire' => $ligne['detail']['beneficiaire'] ?? null,
                'objet' => $ligne['detail']['objet'] ?? null,
                'ordonnance' => $ligne['detail']['ordonnance'] ?? null,
                'numero_reglement' => $ligne['detail']['numero_reglement'] ?? null,
            ],
            'credits-delegues' => $base + [
                'exercice' => $ligne['detail']['exercice'] ?? null,
                'type_exercice' => $ligne['detail']['type_exercice'] ?? null,
                'anomalie' => $ligne['detail']['anomalie'] ?? null,
                'mode' => $ligne['detail']['mode'] ?? null,
                'nature' => $ligne['detail']['nature'] ?? null,
                'titre' => $ligne['detail']['titre'] ?? null,
                'libelle' => $ligne['detail']['libelle'] ?? null,
                'numero_reglement' => $ligne['detail']['numero_reglement'] ?? null,
            ],
            'avances' => $base + [
                'compte' => $ligne['detail']['compte'] ?? null,
                'mode' => $ligne['detail']['mode'] ?? null,
                'nature' => $ligne['detail']['nature'] ?? null,
                'exercice' => $ligne['detail']['exercice'] ?? null,
                'titre_budgetaire' => $ligne['detail']['titre_budgetaire'] ?? null,
                'libelle' => $ligne['detail']['libelle'] ?? null,
            ],
            'correspondants' => $base + [
                'categorie' => $ligne['detail']['categorie'] ?? null,
                'compte' => $ligne['detail']['compte'] ?? null,
                'libelle' => $ligne['detail']['libelle'] ?? null,
            ],
            default => $base,
        };
    }

    /**
     * @param array<string, mixed> $config
     * @param list<array<string, mixed>> $lignes
     */
    private function persisterRecalcul(array $config, Periode $periodeSelectionnee, array $lignes): void
    {
        foreach ($this->periodesExercice($periodeSelectionnee) as $periode) {
            $periodeId = $periode->getId();
            if (null === $periodeId) {
                continue;
            }
            $this->ligneFlecheeRepository->supprimerParPeriodeEtSource($periodeId, $config['source_table']);
        }
        $this->em->flush();

        foreach ($lignes as $ligne) {
            $periode = $ligne['periode'] ?? null;
            if (!$periode instanceof Periode || null === $periode->getId()) {
                continue;
            }
            $this->em->persist(new LigneFlechee(
                $config['source_table'],
                (string) $ligne['source_id'],
                $periode,
                (string) $ligne['rubrique_code'],
                (int) $ligne['mois'],
                (string) $ligne['montant'],
                isset($ligne['regle_id']) ? (int) $ligne['regle_id'] : null,
            ));
        }

        $this->em->flush();
        // Lot 3 : montant_mensuel AUTO = Σ toutes les ligne_flechee (évite d'écraser les autres sources).
        $this->rdModelCumulService->recalculerAuto($periodeSelectionnee->getExercice()->getAnnee());
    }

    /**
     * @return list<RegleFlechage>
     */
    private function reglesActives(DomaineFlechage $domaine): array
    {
        return $this->regleFlechageRepository->listerParDomaines([$domaine]);
    }

    /**
     * @param list<string> $sources
     * @param list<FormatImport>|null $formats
     * @param array<string, mixed> $paramFiltres
     *
     * @return list<LotImport>
     */
    private function lotsActifs(
        int $periodeId,
        array $sources,
        ?array $formats = null,
        array $paramFiltres = [],
    ): array {
        /** @var list<LotImport> $lots */
        $lots = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('l.periode = :pid')
            ->andWhere('l.statut = :actif')
            ->setParameter('pid', $periodeId)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        return array_values(array_filter(
            $lots,
            function (LotImport $lot) use ($sources, $formats, $paramFiltres): bool {
                if ($formats !== null && !in_array($lot->getFormat(), $formats, true)) {
                    return false;
                }
                $params = $lot->getParametres();
                if (!in_array((string) ($params['source'] ?? ''), $sources, true)) {
                    return false;
                }
                foreach ($paramFiltres as $cle => $valeur) {
                    if (($params[$cle] ?? null) !== $valeur) {
                        return false;
                    }
                }

                return true;
            },
        ));
    }

    /**
     * @param list<string> $sources
     * @param list<FormatImport>|null $formats
     * @param array<string, mixed> $paramFiltres
     */
    private function premierLotActif(
        int $periodeId,
        array $sources,
        ?array $formats = null,
        array $paramFiltres = [],
    ): ?LotImport {
        return $this->lotsActifs($periodeId, $sources, $formats, $paramFiltres)[0] ?? null;
    }

    /**
     * @return list<Periode>
     */
    private function periodesExercice(Periode $periode): array
    {
        return $this->periodeRepository->listerParExercice($periode->getExercice()->getAnnee());
    }

    private function resoudrePeriode(?int $periodeId): ?Periode
    {
        if (null !== $periodeId) {
            $p = $this->periodeRepository->find($periodeId);

            return $p instanceof Periode ? $p : null;
        }

        /** @var list<Periode> $periodes */
        $periodes = $this->periodeRepository->createQueryBuilder('p')
            ->leftJoin('p.exercice', 'e')->addSelect('e')
            ->orderBy('e.annee', 'DESC')
            ->addOrderBy('p.mois', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getResult();

        return ($periodes[0] ?? null) instanceof Periode ? $periodes[0] : null;
    }

    /**
     * @param array<string, mixed> $config
     *
     * @return array<string, mixed>
     */
    private function reponseSansPeriode(array $config, string $page, string $vue, string $affichage): array
    {
        return [
            'page' => $page,
            'titre' => $config['title'],
            'description' => $config['description'],
            'periode' => null,
            'vue' => $vue,
            'affichage' => $affichage,
            'codes' => 'agregee' === $vue ? array_map(
                static fn (string $code, string $libelle): array => [
                    'code' => $code,
                    'libelle' => $libelle,
                    'mois' => array_fill(0, 12, '0.00'),
                    'total' => '0.00',
                ],
                array_keys($config['codes']),
                array_values($config['codes']),
            ) : [],
            'totaux' => ['mois' => array_fill(0, 12, '0.00'), 'total' => '0.00'],
            'lignes' => [],
            'nombre_none' => 0,
            'message' => 'Aucune période SROT.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function config(string $page): array
    {
        $config = self::PAGES[$page] ?? null;
        if (\is_array($config)) {
            return $config;
        }

        throw new DonneesInvalidesException('Page de dépenses automatisées inconnue.');
    }

    private function normaliserVue(string $vue): string
    {
        $v = strtolower(trim($vue));
        if ('' === $v) {
            return 'agregee';
        }
        if (!in_array($v, ['agregee', 'detail'], true)) {
            throw new DonneesInvalidesException('Vue invalide (agregee ou detail).');
        }

        return $v;
    }

    private function normaliserAffichage(string $affichage): string
    {
        $v = strtolower(trim($affichage));
        if ('' === $v) {
            return 'mois';
        }
        if (!in_array($v, ['mois', 'cumul'], true)) {
            throw new DonneesInvalidesException('Affichage invalide (mois ou cumul).');
        }

        return $v;
    }

    private function extraireAnneeReference(?string $reference): ?int
    {
        if (null === $reference) {
            return null;
        }
        if (preg_match('/(\d{4})/', $reference, $match) !== 1) {
            return null;
        }

        return (int) $match[1];
    }

    private function moisDepuisDate(mixed $valeur): ?int
    {
        if ($valeur instanceof \DateTimeInterface) {
            return (int) $valeur->format('n');
        }
        $texte = trim((string) $valeur);
        if ('' === $texte) {
            return null;
        }
        try {
            return (int) (new \DateTimeImmutable($texte))->format('n');
        } catch (\Throwable) {
            return null;
        }
    }

    private function decimal(mixed $valeur): string
    {
        if (null === $valeur || '' === $valeur) {
            return '0.00';
        }
        if (is_string($valeur) && is_numeric($valeur)) {
            return number_format((float) $valeur, 2, '.', '');
        }
        if (is_int($valeur) || is_float($valeur)) {
            return number_format((float) $valeur, 2, '.', '');
        }

        return '0.00';
    }

    private function texte(mixed $valeur): ?string
    {
        if (null === $valeur) {
            return null;
        }
        $texte = trim((string) $valeur);

        return '' === $texte ? null : $texte;
    }

    /**
     * @param list<mixed> $valeurs
     */
    private function searchable(array $valeurs): string
    {
        $texte = implode(' ', array_map(
            static fn (mixed $v): string => trim((string) ($v ?? '')),
            $valeurs,
        ));

        return $this->normaliserTexte($texte);
    }

    private function normaliserTexte(string $texte): string
    {
        $texte = mb_strtolower(trim($texte));
        $texte = strtr($texte, [
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'à' => 'a', 'â' => 'a', 'ä' => 'a',
            'î' => 'i', 'ï' => 'i',
            'ô' => 'o', 'ö' => 'o',
            'ù' => 'u', 'û' => 'u', 'ü' => 'u',
            'ç' => 'c',
        ]);

        return preg_replace('/\s+/', ' ', $texte) ?? $texte;
    }

    private function messageVide(string $page): string
    {
        return match ($page) {
            'ordonnances' => 'Aucun lot actif de règlements sur ordonnances pour cet exercice.',
            'credits-delegues' => 'Aucun lot actif ig-cdel pour cet exercice.',
            'avances' => 'Aucun lot actif ig-avances pour cet exercice.',
            'correspondants' => 'Aucun lot F10 dépenses des correspondants pour cette période.',
            default => 'Aucune donnée.',
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserPeriode(Periode $periode): array
    {
        return [
            'id' => $periode->getId(),
            'exercice_annee' => $periode->getExercice()->getAnnee(),
            'mois' => $periode->getMois(),
            'mois_libelle' => Mois::tryFrom($periode->getMois())?->libelle(),
            'date_situation' => $periode->getDateSituation()?->format('Y-m-d'),
        ];
    }
}
