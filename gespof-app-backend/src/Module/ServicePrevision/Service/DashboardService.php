<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\FicheBleu\FicheBleue;
use App\Module\ServicePrevision\Entite\FicheBleu\Section;
use App\Module\ServicePrevision\Entite\FicheExecution\FicheExecution;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;
use App\Module\ServicePrevision\Enum\EtatJournee;
use App\Module\ServicePrevision\Enum\TypeSection;
use App\Module\ServicePrevision\Repository\JourneeTresorerieRepository;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use App\Module\ServicePrevision\Service\Exception\JourneeTresorerieIntrouvableException;
use App\Module\ServiceReglement\Enum\StatutFiche as StatutFicheDepot;
use App\Module\ServiceReglement\Service\FicheDepotServiceInterface;

class DashboardService implements DashboardServiceInterface
{
    public function __construct(
        private readonly JourneeTresorerieRepository $journeeRepository,
        private readonly FicheDepotServiceInterface $ficheDepotService,
    ) {
    }

    public function resume(?string $dateIso = null, ?string $referenceJournee = null): array
    {
        $journee = $this->resoudreJournee($dateIso, $referenceJournee);
        if ($journee === null) {
            return $this->payloadVide($dateIso);
        }

        $ficheBleue = $journee->getFicheBleue();
        $ficheExecution = $journee->getFicheExecution();
        $sourceSections = $ficheExecution ?? $ficheBleue;

        [$recettes, $sourceRecettes] = $this->lignesRecettes(
            $sourceSections,
            $ficheExecution !== null,
        );
        [$depenses, $sourceDepenses] = $this->lignesDepenses(
            $sourceSections,
            $ficheExecution !== null,
        );
        $depot = $ficheBleue === null
            ? ['nombre' => 0, 'montant_total' => '0.00']
            : $this->resumeFichesDepot($journee->getReference());
        $ficheBleueResume = $this->resumeFicheBleue($ficheBleue);

        $soldeOuverture = $this->montantOuZero($journee->getSoldeOuverture());
        if (bccomp($soldeOuverture, '0', 2) === 0 && $ficheBleue !== null) {
            $soldeRacine = $ficheBleue->getSectionSoldeRacine();
            if ($soldeRacine !== null) {
                $soldeOuverture = $this->montantOuZero($soldeRacine->getMontantProgramme());
            }
        }

        $totalRecettes = $this->sommeColonne($recettes, 'montant');
        $totalDepensesRealise = $this->sommeColonne($depenses, 'realise');
        $totalDepensesProgramme = '0.00';
        foreach ($depenses as $ligne) {
            $totalDepensesProgramme = bcadd(
                $totalDepensesProgramme,
                $this->montantOuZero($ligne['programme']),
                2,
            );
        }

        if (
            $ficheExecution !== null
            && bccomp($this->montantOuZero($journee->getTotalRecettes()), '0', 2) !== 0
        ) {
            $totalRecettes = $this->montantOuZero($journee->getTotalRecettes());
        }
        if (
            $ficheExecution !== null
            && bccomp($this->montantOuZero($journee->getTotalDepenses()), '0', 2) !== 0
        ) {
            $totalDepensesRealise = $this->montantOuZero($journee->getTotalDepenses());
        }

        $soldeCloture = $this->montantOuZero($journee->getSoldeCloture());
        $clotureEstimee = false;
        if (
            $journee->getEtat() !== EtatJournee::CLOTURE
            && bccomp($soldeCloture, '0', 2) === 0
        ) {
            $soldeCloture = bcsub(bcadd($soldeOuverture, $totalRecettes, 2), $totalDepensesRealise, 2);
            $clotureEstimee = true;
        }

        $enAttente = '0.00';
        foreach ($depenses as $ligne) {
            if (($ligne['statut'] ?? '') === 'en_attente' || ($ligne['statut'] ?? '') === 'partielle') {
                $reste = bcsub(
                    $this->montantOuZero($ligne['programme']),
                    $this->montantOuZero($ligne['realise']),
                    2,
                );
                if (bccomp($reste, '0', 2) === 1) {
                    $enAttente = bcadd($enAttente, $reste, 2);
                }
            }
        }

        $horsProgramme = array_values(array_filter(
            $depenses,
            static fn (array $l): bool => (bool) ($l['hors_programme'] ?? false),
        ));

        $soldeVeille = $this->montantOuZero(
            $this->journeeRepository->soldeOuverturePrecedente($journee),
        );
        $variationOuverture = null;
        if (bccomp($soldeVeille, '0', 2) === 1) {
            $variationOuverture = bcmul(
                bcdiv(bcsub($soldeOuverture, $soldeVeille, 4), $soldeVeille, 4),
                '100',
                1,
            );
        }

        $dateIsoJournee = $this->dateIsoJournee($journee);
        $miseAJour = $journee->getDateDerniereMiseAJour() ?? $journee->getDateCreation();

        return [
            'journee' => [
                'reference' => $journee->getReference(),
                'date' => $dateIsoJournee,
                'etat' => $journee->getEtat()->value,
                'etat_libelle' => $journee->getEtat()->libelle(),
                'date_derniere_mise_a_jour' => $miseAJour->format(\DateTimeInterface::ATOM),
                'fiche_bleue_reference' => $ficheBleue?->getReference(),
                'fiche_execution_reference' => $ficheExecution?->getReference(),
            ],
            'indicateurs' => [
                'solde_ouverture' => $soldeOuverture,
                'total_recettes' => $totalRecettes,
                'total_depenses' => $totalDepensesRealise,
                'solde_cloture' => $soldeCloture,
                'solde_cloture_estime' => $clotureEstimee,
                'variation_ouverture_pct' => $variationOuverture,
                'depenses_en_attente' => $enAttente,
                'nombre_postes_recettes' => count($recettes),
                'source_recettes' => $sourceRecettes,
                'source_depenses' => $sourceDepenses,
            ],
            'recettes' => $recettes,
            'depenses' => $depenses,
            'totaux' => [
                'recettes' => $totalRecettes,
                'depenses_programme' => $totalDepensesProgramme,
                'depenses_realise' => $totalDepensesRealise,
            ],
            'resume' => [
                'fiche_bleue' => $ficheBleueResume,
                'fiches_depot' => $depot,
                'ecarts' => [
                    'nombre_hors_programme' => count($horsProgramme),
                    'montant_ecart' => $ficheExecution?->getEcartTotal()
                        ?? $ficheBleue?->getMontantTotalEcart()
                        ?? '0.00',
                ],
                'archivage' => [
                    'cloturee' => $journee->getEtat()->value === 'cloture',
                    'date' => $dateIsoJournee,
                ],
            ],
        ];
    }

    private function resoudreJournee(?string $dateIso, ?string $referenceJournee): ?JourneeTresorerie
    {
        if ($referenceJournee !== null && trim($referenceJournee) !== '') {
            $reference = trim($referenceJournee);
            if (preg_match('/^JT-\d{2}-\d{2}-\d{4}-\d{3}$/', $reference) !== 1) {
                throw new DonneesInvalidesException('Le paramètre "journee" est invalide (JT-jj-mm-aaaa-nnn).');
            }

            return $this->journeeRepository->find($reference)
                ?? throw new JourneeTresorerieIntrouvableException('Journée de trésorerie introuvable.');
        }

        if ($dateIso !== null && trim($dateIso) !== '') {
            $date = \DateTimeImmutable::createFromFormat('Y-m-d', trim($dateIso));
            if ($date === false || $date->format('Y-m-d') !== trim($dateIso)) {
                throw new DonneesInvalidesException('Le paramètre "date" est invalide (YYYY-MM-DD).');
            }

            return $this->journeeRepository->trouverDuJour($date->setTime(0, 0, 0));
        }

        return $this->journeeRepository->trouverDuJour(new \DateTimeImmutable('today'));
    }

    /**
     * @return array<string, mixed>
     */
    private function payloadVide(?string $dateIso): array
    {
        return [
            'journee' => null,
            'indicateurs' => [
                'solde_ouverture' => '0.00',
                'total_recettes' => '0.00',
                'total_depenses' => '0.00',
                'solde_cloture' => '0.00',
                'solde_cloture_estime' => true,
                'variation_ouverture_pct' => null,
                'depenses_en_attente' => '0.00',
                'nombre_postes_recettes' => 0,
                'source_recettes' => null,
                'source_depenses' => null,
            ],
            'recettes' => [],
            'depenses' => [],
            'totaux' => [
                'recettes' => '0.00',
                'depenses_programme' => '0.00',
                'depenses_realise' => '0.00',
            ],
            'resume' => [
                'fiche_bleue' => [
                    'reference' => null,
                    'nombre_depenses' => 0,
                    'montant_programme' => '0.00',
                ],
                'fiches_depot' => [
                    'nombre' => 0,
                    'montant_total' => '0.00',
                ],
                'ecarts' => [
                    'nombre_hors_programme' => 0,
                    'montant_ecart' => '0.00',
                ],
                'archivage' => [
                    'cloturee' => false,
                    'date' => $dateIso,
                ],
            ],
        ];
    }

    /**
     * @return array{0: list<array<string, mixed>>, 1: ?string}
     */
    private function lignesRecettes(
        FicheBleue|FicheExecution|null $source,
        bool $depuisExecution,
    ): array {
        if ($source !== null) {
            $lignes = [];
            foreach ($this->racinesDeType($source, TypeSection::RECETTE) as $section) {
                $montant = $depuisExecution
                    ? $this->montantOuZero($section->getMontantRealise())
                    : $this->montantOuZero($section->getMontantProgramme());
                $programme = $this->montantOuZero($section->getMontantProgramme());
                $statut = $this->statutRecette($montant, $programme, $depuisExecution);
                $lignes[] = [
                    'libelle' => $section->getNom(),
                    'montant' => $montant,
                    'montant_programme' => $programme,
                    'statut' => $statut,
                    'statut_libelle' => $this->libelleStatutRecette($statut),
                ];
            }

            if ($lignes !== []) {
                return [$lignes, $depuisExecution ? 'fiche_execution' : 'fiche_bleue'];
            }
        }

        return [[], null];
    }

    /**
     * @return array{0: list<array<string, mixed>>, 1: ?string}
     */
    private function lignesDepenses(
        FicheBleue|FicheExecution|null $source,
        bool $depuisExecution,
    ): array {
        if ($source !== null) {
            $lignes = [];
            foreach ($this->feuillesDeType($source, TypeSection::DEPENSE) as $section) {
                $programme = $this->montantOuZero($section->getMontantProgramme());
                $realise = $depuisExecution
                    ? $this->montantOuZero($section->getMontantRealise())
                    : '0.00';
                $horsProgramme = bccomp($programme, '0', 2) === 0 && bccomp($realise, '0', 2) === 1;
                $statut = $this->statutDepense($programme, $realise, $horsProgramme);
                $lignes[] = [
                    'libelle' => $section->getNom(),
                    'programme' => bccomp($programme, '0', 2) === 0 && !$horsProgramme ? null : $programme,
                    'realise' => $realise,
                    'statut' => $statut,
                    'statut_libelle' => $this->libelleStatutDepense($statut),
                    'hors_programme' => $horsProgramme,
                ];
            }

            if ($lignes !== []) {
                return [$lignes, $depuisExecution ? 'fiche_execution' : 'fiche_bleue'];
            }
        }

        return [[], null];
    }

    /**
     * @return array{reference: ?string, nombre_depenses: int, montant_programme: string}
     */
    private function resumeFicheBleue(?FicheBleue $fiche): array
    {
        if ($fiche === null) {
            return [
                'reference' => null,
                'nombre_depenses' => 0,
                'montant_programme' => '0.00',
            ];
        }

        $feuilles = $this->feuillesDeType($fiche, TypeSection::DEPENSE);
        $total = '0.00';
        foreach ($this->racinesDeType($fiche, TypeSection::DEPENSE) as $section) {
            $total = bcadd($total, $this->montantOuZero($section->getMontantProgramme()), 2);
        }

        return [
            'reference' => $fiche->getReference(),
            'nombre_depenses' => count($feuilles),
            'montant_programme' => $total,
        ];
    }

    /**
     * @return array{nombre: int, montant_total: string}
     */
    private function resumeFichesDepot(string $referenceJournee): array
    {
        try {
            $page = $this->ficheDepotService->listerParJourneeTresorerie(
                $referenceJournee,
                [StatutFicheDepot::ENVOYEE->value, StatutFicheDepot::RECUE->value],
            );
        } catch (\Throwable) {
            return [
                'nombre' => 0,
                'montant_total' => '0.00',
            ];
        }

        $fiches = is_array($page['fiches'] ?? null) ? $page['fiches'] : [];
        $total = '0.00';
        foreach ($fiches as $fiche) {
            if (!is_array($fiche)) {
                continue;
            }
            $total = bcadd($total, $this->montantOuZero($fiche['montant_total'] ?? '0'), 2);
        }

        return [
            'nombre' => count($fiches),
            'montant_total' => $total,
        ];
    }

    /**
     * @return list<Section>
     */
    private function racinesDeType(FicheBleue|FicheExecution $fiche, TypeSection $type): array
    {
        $racines = [];
        foreach ($fiche->getSections() as $section) {
            if ($section->estSousSection()) {
                continue;
            }
            if ($section->getType() === $type) {
                $racines[] = $section;
            }
        }
        usort(
            $racines,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId()] <=> [$b->getOrdre(), $b->getId()],
        );

        return $racines;
    }

    /**
     * @return list<Section>
     */
    private function feuillesDeType(FicheBleue|FicheExecution $fiche, TypeSection $type): array
    {
        $feuilles = [];
        foreach ($this->racinesDeType($fiche, $type) as $racine) {
            $this->collecterFeuilles($racine, $feuilles);
        }

        return $feuilles;
    }

    /**
     * @param list<Section> $feuilles
     */
    private function collecterFeuilles(Section $section, array &$feuilles): void
    {
        if ($section->getSousSections()->isEmpty()) {
            $feuilles[] = $section;

            return;
        }
        $enfants = $section->getSousSections()->toArray();
        usort(
            $enfants,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId()] <=> [$b->getOrdre(), $b->getId()],
        );
        foreach ($enfants as $enfant) {
            $this->collecterFeuilles($enfant, $feuilles);
        }
    }

    private function statutRecette(string $montant, string $programme, bool $depuisExecution): string
    {
        if (!$depuisExecution) {
            return 'en_attente';
        }
        if (bccomp($montant, '0', 2) === 0) {
            return 'en_attente';
        }
        if (bccomp($programme, '0', 2) === 1 && bccomp($montant, $programme, 2) === -1) {
            return 'partiel';
        }

        return 'valide';
    }

    private function libelleStatutRecette(string $statut): string
    {
        return match ($statut) {
            'valide' => 'Validé',
            'partiel' => 'Partiel',
            'manuel' => 'Manuel',
            default => 'En attente',
        };
    }

    private function statutDepense(string $programme, string $realise, bool $horsProgramme): string
    {
        if ($horsProgramme) {
            return 'urgence';
        }
        if (bccomp($realise, '0', 2) === 0) {
            return 'en_attente';
        }
        if (bccomp($programme, '0', 2) === 1 && bccomp($realise, $programme, 2) === -1) {
            return 'partielle';
        }

        return 'payee';
    }

    private function libelleStatutDepense(string $statut): string
    {
        return match ($statut) {
            'payee' => 'Payée',
            'partielle' => 'Partielle',
            'urgence' => 'Urgence',
            default => 'En attente',
        };
    }

    /**
     * @param list<array<string, mixed>> $lignes
     */
    private function sommeColonne(array $lignes, string $cle): string
    {
        $total = '0.00';
        foreach ($lignes as $ligne) {
            $total = bcadd($total, $this->montantOuZero($ligne[$cle] ?? '0'), 2);
        }

        return $total;
    }

    private function montantOuZero(mixed $valeur): string
    {
        if ($valeur === null || $valeur === '') {
            return '0.00';
        }
        $normalise = str_replace([' ', ','], ['', '.'], (string) $valeur);
        if ($normalise === '' || !is_numeric($normalise)) {
            return '0.00';
        }

        return number_format((float) $normalise, 2, '.', '');
    }

    private function dateIsoJournee(JourneeTresorerie $journee): string
    {
        if (preg_match('/^JT-(\d{2})-(\d{2})-(\d{4})-/', $journee->getReference(), $m) === 1) {
            return sprintf('%s-%s-%s', $m[3], $m[2], $m[1]);
        }

        return $journee->getDateCreation()->format('Y-m-d');
    }
}
