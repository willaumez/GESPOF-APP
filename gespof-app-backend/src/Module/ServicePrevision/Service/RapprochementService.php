<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\FicheBleu\Section;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\EvenementJournee;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;
use App\Module\ServicePrevision\Enum\EtatJournee;
use App\Module\ServicePrevision\Repository\JourneeTresorerieRepository;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use App\Module\ServicePrevision\Service\Exception\JourneeTresorerieIntrouvableException;
use App\Module\ServiceReglement\Enum\StatutFiche;
use App\Module\ServiceReglement\Service\FicheDepotServiceInterface;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Chaque élément d'une liste validée porte une clé métier stable (`cle`) :
 * les lignes d'une fiche de dépôt complémentaire ont de nouveaux id en base,
 * c'est cette clé qui permet de reconnaître un élément déjà reçu.
 * Un compteur d'occurrence (#1, #2…) distingue les vrais doublons d'une même fiche.
 */
class RapprochementService implements RapprochementServiceInterface
{
    private const FAMILLES_DEPENSES = [
        'numeraire' => 'mouvements_numeraire',
        'sygma' => 'mouvements_sygma',
        'systac' => 'mouvements_systac',
    ];

    public function __construct(
        private readonly JourneeTresorerieRepository $journeeRepository,
        private readonly OperationsBeacServiceInterface $operationsBeacService,
        private readonly FicheDepotServiceInterface $ficheDepotService,
        private readonly FicheExecutionServiceInterface $ficheExecutionService,
        private readonly EntityManagerInterface $entityManager,
        private readonly JournalJourneeServiceInterface $journal,
    ) {
    }

    public function recettes(string $referenceJournee): array
    {
        $liste = $this->trouver($referenceJournee)->getRecettesJour();

        return ['recettes_jour' => $liste === null ? null : $this->normaliserRecettes($liste)];
    }

    public function validerRecettes(string $referenceJournee, string $dateOuverture, string $validePar): array
    {
        $journee = $this->trouverModifiable($referenceJournee);
        $resultat = $this->operationsBeacService->listerRecettes($dateOuverture, null, null, 1, 'all');

        $nouvelles = $this->avecCles(
            $resultat['operations'],
            static fn (array $r): string => implode('|', [
                $r['origine'] ?? '',
                $r['reference'] ?? '',
                $r['num_reglement'] ?? '',
                $r['date_validation'] ?? '',
                $r['montant'] ?? '0.00',
            ]),
        );

        $precedente = $journee->getRecettesJour();
        $elements = $this->fusionnerAvecRapproches(
            $nouvelles,
            $precedente === null ? [] : $this->normaliserRecettes($precedente)['recettes'],
        );

        $liste = [
            'date_ouverture' => $resultat['date'],
            'validee_le' => $this->maintenant(),
            'validee_par' => $validePar,
            ...$this->totaux($elements),
            'recettes' => $elements,
        ];
        $journee->setRecettesJour($liste);
        $journee->toucher();
        $this->entityManager->flush();
        $this->journal->enregistrer(
            $journee,
            JournalJourneeServiceInterface::RECETTES_VALIDEES,
            sprintf(
                '%s des recettes du %s : %d recette%s · %s',
                $precedente === null ? 'Validation' : 'Revalidation',
                $resultat['date'],
                $liste['nombre'],
                $liste['nombre'] > 1 ? 's' : '',
                EvenementJournee::formaterMontant($liste['total']),
            ),
            ['date_ouverture' => $resultat['date'], 'nombre' => $liste['nombre'], 'total' => $liste['total']],
        );

        return ['recettes_jour' => $liste];
    }

    public function depenses(string $referenceJournee): array
    {
        $journee = $this->trouver($referenceJournee);
        $liste = $journee->getDepensesJour();
        [$fiches, $courantes] = $this->depensesDesFiches($referenceJournee);

        $integrees = $liste['fiches'] ?? [];
        $clesValidees = array_flip(array_column($liste['depenses'] ?? [], 'cle'));
        $nouvelles = 0;
        foreach ($courantes as $element) {
            if (!isset($clesValidees[$element['cle']])) {
                ++$nouvelles;
            }
        }

        return [
            'depenses_jour' => $liste,
            'fiches_disponibles' => $fiches,
            'fiches_non_integrees' => array_values(array_diff(array_column($fiches, 'reference'), $integrees)),
            'nouvelles' => $liste === null ? 0 : $nouvelles,
        ];
    }

    public function validerDepenses(string $referenceJournee, string $validePar): array
    {
        $journee = $this->trouverModifiable($referenceJournee);
        [$fiches, $courantes] = $this->depensesDesFiches($referenceJournee);
        if ($fiches === []) {
            throw new DonneesInvalidesException('Aucune fiche de dépôt reçue pour cette journée.');
        }

        $precedente = $journee->getDepensesJour();
        $anciennes = [];
        foreach ($precedente['depenses'] ?? [] as $element) {
            $anciennes[$element['cle']] = $element;
        }

        $maintenant = $this->maintenant();
        $nouvelles = 0;
        $elements = [];
        foreach ($courantes as $cle => $element) {
            $ancien = $anciennes[$cle] ?? null;
            if ($ancien === null) {
                ++$nouvelles;
            }
            $elements[$cle] = [
                ...$element,
                // Un élément déjà validé garde sa fiche d'origine et son rapprochement.
                'fiche_reference' => $ancien['fiche_reference'] ?? $element['fiche_reference'],
                'integree_le' => $ancien['integree_le'] ?? $maintenant,
                'nouvelle' => $precedente !== null && $ancien === null,
                'rapprochement' => $ancien['rapprochement'] ?? null,
            ];
        }
        // Un élément rapproché reste dans la liste même s'il a disparu des fiches :
        // son montant est déjà compté dans le réalisé.
        foreach ($anciennes as $cle => $ancien) {
            if (!isset($elements[$cle]) && ($ancien['rapprochement'] ?? null) !== null) {
                $elements[$cle] = [...$ancien, 'nouvelle' => false];
            }
        }
        $elements = array_values($elements);

        $liste = [
            'validee_le' => $maintenant,
            'validee_par' => $validePar,
            'fiches' => array_column($fiches, 'reference'),
            ...$this->totaux($elements),
            'depenses' => $elements,
        ];
        $journee->setDepensesJour($liste);
        $journee->toucher();
        $this->entityManager->flush();
        $this->journal->enregistrer(
            $journee,
            JournalJourneeServiceInterface::DEPENSES_VALIDEES,
            $precedente === null
                ? sprintf(
                    'Validation des dépenses : %d dépense%s issues de %d fiche%s de dépôt · %s',
                    $liste['nombre'],
                    $liste['nombre'] > 1 ? 's' : '',
                    \count($fiches),
                    \count($fiches) > 1 ? 's' : '',
                    EvenementJournee::formaterMontant($liste['total']),
                )
                : sprintf(
                    'Intégration des fiches de dépôt : %d nouvelle%s dépense%s (%d au total, sans doublon)',
                    $nouvelles,
                    $nouvelles > 1 ? 's' : '',
                    $nouvelles > 1 ? 's' : '',
                    $liste['nombre'],
                ),
            ['fiches' => $liste['fiches'], 'nombre' => $liste['nombre'], 'nouvelles' => $nouvelles, 'total' => $liste['total']],
        );

        return ['depenses_jour' => $liste, 'nouvelles' => $nouvelles];
    }

    public function rapprocher(
        string $referenceJournee,
        string $type,
        array $cles,
        int $sectionId,
        string $par,
    ): array {
        if ($cles === []) {
            throw new DonneesInvalidesException('Aucun élément à rapprocher.');
        }

        return $this->entityManager->wrapInTransaction(function () use ($referenceJournee, $type, $cles, $sectionId, $par): array {
            $journee = $this->trouverModifiable($referenceJournee);
            [$cleListe, $liste] = $this->liste($journee, $type);
            $section = $this->sectionCible($journee, $type, $sectionId);

            $demandees = array_flip(array_map('strval', $cles));
            $total = '0.00';
            $trouvees = 0;
            foreach ($liste[$cleListe] as $element) {
                if (!isset($demandees[$element['cle']])) {
                    continue;
                }
                if (($element['rapprochement'] ?? null) !== null) {
                    throw new DonneesInvalidesException(sprintf(
                        'Un élément est déjà rapproché sur « %s ».',
                        $element['rapprochement']['section_nom'],
                    ));
                }
                $total = bcadd($total, (string) $element['montant'], 2);
                ++$trouvees;
            }
            if ($trouvees !== \count($demandees)) {
                throw new DonneesInvalidesException(
                    'Certains éléments sont introuvables dans la liste validée : rechargez la page.',
                );
            }

            $fiche = $this->ecrireRealise($journee, $section, bcadd($section->getMontantRealise(), $total, 2));

            $rapprochement = [
                'section_id' => $sectionId,
                'section_nom' => $section->getNom(),
                'groupe' => bin2hex(random_bytes(8)),
                'le' => $this->maintenant(),
                'par' => $par,
            ];
            foreach ($liste[$cleListe] as $i => $element) {
                if (isset($demandees[$element['cle']])) {
                    $liste[$cleListe][$i]['rapprochement'] = $rapprochement;
                }
            }
            $this->enregistrerListe($journee, $type, $liste);
            $this->journal->enregistrer(
                $journee,
                JournalJourneeServiceInterface::RAPPROCHEMENT,
                sprintf(
                    '%d %s%s rapprochée%s sur « %s » : +%s',
                    $trouvees,
                    $type === self::TYPE_RECETTE ? 'recette' : 'dépense',
                    $trouvees > 1 ? 's' : '',
                    $trouvees > 1 ? 's' : '',
                    $section->getNom(),
                    EvenementJournee::formaterMontant($total),
                ),
                [
                    'type' => $type,
                    'section_id' => $sectionId,
                    'rubrique' => $section->getNom(),
                    'nombre' => $trouvees,
                    'montant' => $total,
                    'groupe' => $rapprochement['groupe'],
                ],
            );

            return ['liste' => $liste, 'fiche' => $fiche];
        });
    }

    public function annulerRapprochement(string $referenceJournee, string $type, string $groupe): array
    {
        return $this->entityManager->wrapInTransaction(function () use ($referenceJournee, $type, $groupe): array {
            $journee = $this->trouverModifiable($referenceJournee);
            [$cleListe, $liste] = $this->liste($journee, $type);

            $total = '0.00';
            $sectionId = null;
            foreach ($liste[$cleListe] as $element) {
                if (($element['rapprochement']['groupe'] ?? null) === $groupe) {
                    $total = bcadd($total, (string) $element['montant'], 2);
                    $sectionId = (int) $element['rapprochement']['section_id'];
                }
            }
            if ($sectionId === null) {
                throw new DonneesInvalidesException('Rapprochement introuvable (déjà annulé ?).');
            }

            $section = $this->sectionCible($journee, $type, $sectionId);
            $restant = bcsub($section->getMontantRealise(), $total, 2);
            $fiche = $this->ecrireRealise(
                $journee,
                $section,
                bccomp($restant, '0', 2) < 0 ? '0.00' : $restant,
            );

            $nombre = 0;
            foreach ($liste[$cleListe] as $i => $element) {
                if (($element['rapprochement']['groupe'] ?? null) === $groupe) {
                    $liste[$cleListe][$i]['rapprochement'] = null;
                    ++$nombre;
                }
            }
            $this->enregistrerListe($journee, $type, $liste);
            $this->journal->enregistrer(
                $journee,
                JournalJourneeServiceInterface::RAPPROCHEMENT_ANNULE,
                sprintf(
                    'Rapprochement annulé sur « %s » : %d %s%s, −%s',
                    $section->getNom(),
                    $nombre,
                    $type === self::TYPE_RECETTE ? 'recette' : 'dépense',
                    $nombre > 1 ? 's' : '',
                    EvenementJournee::formaterMontant($total),
                ),
                ['type' => $type, 'section_id' => $sectionId, 'rubrique' => $section->getNom(), 'nombre' => $nombre, 'montant' => $total, 'groupe' => $groupe],
            );

            return ['liste' => $liste, 'fiche' => $fiche];
        });
    }

    /**
     * Fiches de dépôt de la journée (de la plus ancienne à la plus récente) et
     * union dédoublonnée de leurs dépenses, indexée par clé.
     *
     * @return array{0: list<array<string, mixed>>, 1: array<string, array<string, mixed>>}
     */
    private function depensesDesFiches(string $referenceJournee): array
    {
        $resumes = $this->ficheDepotService->listerParJourneeTresorerie(
            $referenceJournee,
            [StatutFiche::ENVOYEE->value, StatutFiche::RECUE->value],
        )['fiches'];
        $resumes = array_reverse($resumes);

        $fiches = [];
        $union = [];
        foreach ($resumes as $resume) {
            $detail = $this->ficheDepotService->detail((string) $resume['reference'], false);

            $lignes = [];
            foreach (self::FAMILLES_DEPENSES as $famille => $champ) {
                foreach ($detail[$champ] ?? [] as $mouvement) {
                    $lignes[] = $this->elementDepense($famille, $mouvement, $detail['reference']);
                }
            }

            // Union : une ligne déjà vue dans une fiche précédente n'est pas ajoutée.
            $apport = 0;
            foreach ($this->avecCles($lignes, static fn (array $l): string => $l['cle_base']) as $element) {
                unset($element['cle_base']);
                if (!isset($union[$element['cle']])) {
                    $union[$element['cle']] = $element;
                    ++$apport;
                }
            }

            $fiches[] = [
                'reference' => $detail['reference'],
                'date_creation' => $detail['date_creation'],
                'montant_total' => $detail['montant_total'],
                'nombre_elements' => \count($lignes),
                // Éléments absents des fiches précédentes de la journée.
                'nouveaux_elements' => $apport,
            ];
        }

        return [$fiches, $union];
    }

    /**
     * @param array<string, mixed> $mouvement
     *
     * @return array<string, mixed>
     */
    private function elementDepense(string $famille, array $mouvement, string $ficheReference): array
    {
        $montant = $famille === 'systac'
            ? ($mouvement['montant_groupe'] ?? $mouvement['depenses'] ?? 0)
            : ($mouvement['depenses'] ?? 0);
        $montant = number_format((float) $montant, 2, '.', '');
        $beneficiaire = $famille === 'systac'
            ? (($mouvement['designation'] ?? '') !== '' ? $mouvement['designation'] : ($mouvement['beneficiaire'] ?? ''))
            : ($mouvement['beneficiaire'] ?? '');

        return [
            'cle_base' => implode('|', [
                $famille,
                $mouvement['numero_ov'] ?? '',
                mb_strtoupper(trim((string) $beneficiaire)),
                $mouvement['date_virement'] ?? '',
                $montant,
            ]),
            'famille' => $famille,
            'beneficiaire' => $beneficiaire,
            'numero_ov' => $mouvement['numero_ov'] ?? null,
            'banque' => $mouvement['banque'] ?? null,
            'date_virement' => $mouvement['date_virement'] ?? null,
            'montant' => $montant,
            'fiche_reference' => $ficheReference,
        ];
    }

    /**
     * Ajoute `cle` = base + n° d'occurrence dans la liste (doublons légitimes).
     *
     * @param list<array<string, mixed>>        $elements
     * @param callable(array<string, mixed>): string $base
     *
     * @return list<array<string, mixed>>
     */
    private function avecCles(array $elements, callable $base): array
    {
        $occurrences = [];
        $out = [];
        foreach ($elements as $element) {
            $b = $base($element);
            $occurrences[$b] = ($occurrences[$b] ?? 0) + 1;
            $out[] = ['cle' => $b.'#'.$occurrences[$b], ...$element];
        }

        return $out;
    }

    /**
     * Nouvelle liste + éléments rapprochés de l'ancienne (rapprochement conservé).
     *
     * @param list<array<string, mixed>> $nouvelles
     * @param list<array<string, mixed>> $anciennes
     *
     * @return list<array<string, mixed>>
     */
    private function fusionnerAvecRapproches(array $nouvelles, array $anciennes): array
    {
        $rapproches = [];
        foreach ($anciennes as $ancien) {
            if (($ancien['rapprochement'] ?? null) !== null) {
                $rapproches[$ancien['cle']] = $ancien;
            }
        }

        $out = [];
        foreach ($nouvelles as $element) {
            $out[] = [...$element, 'rapprochement' => $rapproches[$element['cle']]['rapprochement'] ?? null];
            unset($rapproches[$element['cle']]);
        }

        return [...$out, ...array_values($rapproches)];
    }

    /**
     * Listes validées avant l'ajout des clés : complète `cle` et `rapprochement`.
     *
     * @param array<string, mixed> $liste
     *
     * @return array<string, mixed>
     */
    private function normaliserRecettes(array $liste): array
    {
        $recettes = $liste['recettes'] ?? [];
        if ($recettes !== [] && !isset($recettes[0]['cle'])) {
            $recettes = $this->avecCles($recettes, static fn (array $r): string => implode('|', [
                $r['origine'] ?? '',
                $r['reference'] ?? '',
                $r['num_reglement'] ?? '',
                $r['date_validation'] ?? '',
                $r['montant'] ?? '0.00',
            ]));
        }
        $liste['recettes'] = array_map(
            static fn (array $r): array => [...$r, 'rapprochement' => $r['rapprochement'] ?? null],
            $recettes,
        );

        return $liste;
    }

    /**
     * @param list<array<string, mixed>> $elements
     *
     * @return array{total: string, nombre: int}
     */
    private function totaux(array $elements): array
    {
        $total = '0.00';
        foreach ($elements as $element) {
            $total = bcadd($total, (string) $element['montant'], 2);
        }

        return ['total' => $total, 'nombre' => \count($elements)];
    }

    /** @return array{0: string, 1: array<string, mixed>} */
    private function liste(JourneeTresorerie $journee, string $type): array
    {
        if ($type === self::TYPE_RECETTE) {
            $liste = $journee->getRecettesJour();
            if ($liste === null) {
                throw new DonneesInvalidesException('Aucune liste de recettes validée pour cette journée.');
            }

            return ['recettes', $this->normaliserRecettes($liste)];
        }
        if ($type === self::TYPE_DEPENSE) {
            $liste = $journee->getDepensesJour();
            if ($liste === null) {
                throw new DonneesInvalidesException('Aucune liste de dépenses validée pour cette journée.');
            }

            return ['depenses', $liste];
        }

        throw new DonneesInvalidesException('Le type doit être « recette » ou « depense ».');
    }

    /** @param array<string, mixed> $liste */
    private function enregistrerListe(JourneeTresorerie $journee, string $type, array $liste): void
    {
        if ($type === self::TYPE_RECETTE) {
            $journee->setRecettesJour($liste);
        } else {
            $journee->setDepensesJour($liste);
        }
        $journee->toucher();
        $this->entityManager->flush();
    }

    /** Rubrique feuille de la fiche d'exécution, du même type (recette / dépense) que la liste. */
    private function sectionCible(JourneeTresorerie $journee, string $type, int $sectionId): Section
    {
        $fiche = $journee->getFicheExecution();
        if ($fiche === null) {
            throw new DonneesInvalidesException('Aucune Fiche d\'exécution n\'est liée à cette journée.');
        }

        foreach ($fiche->getSections() as $section) {
            if ($section->getId() !== $sectionId) {
                continue;
            }
            if (!$section->getSousSections()->isEmpty()) {
                throw new DonneesInvalidesException(sprintf(
                    'La rubrique « %s » a des sous-rubriques : déposez sur l\'une d\'elles.',
                    $section->getNom(),
                ));
            }
            $racine = $section;
            while ($racine->getSectionParente() !== null) {
                $racine = $racine->getSectionParente();
            }
            if ($racine->getType()->value !== $type) {
                throw new DonneesInvalidesException(sprintf(
                    'La rubrique « %s » n\'est pas une rubrique de %s.',
                    $section->getNom(),
                    $type === self::TYPE_RECETTE ? 'recette' : 'dépense',
                ));
            }

            return $section;
        }

        throw new DonneesInvalidesException(sprintf('Rubrique #%d introuvable sur la Fiche d\'exécution.', $sectionId));
    }

    /** @return array<string, mixed> détail de la fiche d'exécution après mise à jour */
    private function ecrireRealise(JourneeTresorerie $journee, Section $section, string $montant): array
    {
        return $this->ficheExecutionService->appliquerMontantsRealise(
            (int) $journee->getFicheExecution()?->getId(),
            ['montants' => [['section_id' => $section->getId(), 'montant_realise' => $montant]]],
            false,
        )['fiche'];
    }

    private function trouver(string $reference): JourneeTresorerie
    {
        return $this->journeeRepository->find($reference)
            ?? throw new JourneeTresorerieIntrouvableException('Journée de trésorerie introuvable.');
    }

    private function trouverModifiable(string $reference): JourneeTresorerie
    {
        $journee = $this->trouver($reference);
        if ($journee->getEtat() === EtatJournee::CLOTURE) {
            throw new DonneesInvalidesException('Cette journée est clôturée : elle ne peut plus être modifiée.');
        }

        return $journee;
    }

    private function maintenant(): string
    {
        return (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM);
    }
}
