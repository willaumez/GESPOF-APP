<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\FicheBleu\FicheBleue;
use App\Module\ServicePrevision\Entite\FicheBleu\Section;
use App\Module\ServicePrevision\Entite\FicheExecution\FicheExecution;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\EvenementJournee;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;
use App\Module\ServicePrevision\Enum\EtatJournee;
use App\Module\ServicePrevision\Enum\StatutFiche;
use App\Module\ServicePrevision\Enum\TypeSection;
use App\Module\ServicePrevision\Repository\FicheExecutionRepository;
use App\Module\ServicePrevision\Repository\JourneeTresorerieRepository;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use App\Module\ServicePrevision\Service\Exception\FicheExecutionIntrouvableException;
use App\Module\ServicePrevision\Service\Exception\JourneeTresorerieIntrouvableException;

class FicheExecutionService implements FicheExecutionServiceInterface
{
    public function __construct(
        private readonly JourneeTresorerieRepository $journeeRepository,
        private readonly FicheExecutionRepository $ficheRepository,
        private readonly FicheExecutionConsoServiceInterface $ficheExecutionConsoService,
        private readonly JournalJourneeServiceInterface $journal,
    ) {
    }

    public function trouverPourJournee(string $referenceJournee): array
    {
        $journee = $this->trouverJournee($referenceJournee);
        $fiche = $journee->getFicheExecution()
            ?? $this->ficheRepository->trouverParJourneeReference($referenceJournee);

        if ($fiche === null) {
            return ['fiche' => null];
        }

        $fiche->calculerEcart();
        $this->ficheRepository->flush();

        return ['fiche' => $this->serialiserDetail($fiche)];
    }

    public function creerPourJournee(string $referenceJournee, string $createur): array
    {
        $existant = $this->trouverPourJournee($referenceJournee);
        if ($existant['fiche'] !== null) {
            return $existant;
        }

        $journee = $this->trouverJournee($referenceJournee);
        if ($journee->estCloturee()) {
            throw new DonneesInvalidesException(
                'Cette journée est clôturée : la Fiche d\'exécution ne peut plus être créée.',
            );
        }
        $ficheBleue = $journee->getFicheBleue();
        if ($ficheBleue === null) {
            throw new DonneesInvalidesException(
                'Liez d\'abord une Fiche Bleue à la journée pour créer la Fiche d\'exécution.',
            );
        }

        $aujourdhui = new \DateTimeImmutable('today');
        $reference = FicheExecution::genererReference(
            $aujourdhui,
            $this->ficheRepository->prochainIncrementPourDate($aujourdhui),
        );

        $fiche = new FicheExecution($reference, $createur);

        foreach ($ficheBleue->getSections() as $section) {
            if ($section->estSousSection()) {
                continue;
            }
            $copie = $section->copier();
            $this->reinitialiserRealise($copie);
            $fiche->ajouterSection($copie);
        }

        $fiche->calculerMontantTotalProgramme();
        $fiche->calculerEcart();

        $journee->setFicheExecution($fiche);
        if ($journee->getEtat() === EtatJournee::BROUILLON) {
            $journee->setEtat(EtatJournee::EN_COURS);
        }
        $journee->synchroniserDepuisFicheExecution();
        $journee->toucher();

        $this->ficheRepository->save($fiche, true);
        $this->journal->enregistrer(
            $journee,
            JournalJourneeServiceInterface::FICHE_EXECUTION_CREEE,
            sprintf('Fiche d\'exécution %s créée depuis la Fiche Bleue %s', $fiche->getReference(), $ficheBleue->getReference()),
            ['fiche_execution' => $fiche->getReference(), 'fiche_bleue' => $ficheBleue->getReference()],
        );

        return ['fiche' => $this->serialiserDetail($fiche)];
    }

    public function detail(int $id): array
    {
        return ['fiche' => $this->serialiserDetail($this->trouver($id))];
    }

    public function appliquerMontantsRealise(int $ficheId, array $donnees, bool $journaliser = true): array
    {
        $fiche = $this->trouver($ficheId);
        if (
            $fiche->getStatut() === StatutFiche::CLOTURE
            || $fiche->getJourneeTresorerie()?->estCloturee()
        ) {
            throw new DonneesInvalidesException(
                'Cette journée est clôturée : le réalisé ne peut plus être modifié.',
            );
        }
        $entrees = $donnees['montants'] ?? null;
        if (!is_array($entrees)) {
            throw new DonneesInvalidesException(
                'Le corps doit contenir "montants" (liste de { section_id, montant_realise }).',
            );
        }

        /** @var list<array<string, mixed>> $modifications */
        $modifications = [];
        /** @var array<int, Section> $index */
        $index = [];
        foreach ($fiche->getSections() as $section) {
            $id = $section->getId();
            if ($id !== null) {
                $index[$id] = $section;
            }
        }

        foreach ($entrees as $entree) {
            if (!is_array($entree) || !isset($entree['section_id'], $entree['montant_realise'])) {
                throw new DonneesInvalidesException(
                    'Chaque entrée de "montants" doit contenir "section_id" et "montant_realise".',
                );
            }
            $sectionId = (int) $entree['section_id'];
            $section = $index[$sectionId] ?? null;
            if ($section === null) {
                throw new DonneesInvalidesException(
                    sprintf('Section #%d introuvable sur cette Fiche d\'exécution.', $sectionId),
                );
            }
            if (!$section->getSousSections()->isEmpty()) {
                throw new DonneesInvalidesException(
                    sprintf(
                        'La section « %s » a des sous-sections : son réalisé est calculé, non saisi.',
                        $section->getNom(),
                    ),
                );
            }

            $avant = $section->getMontantRealise();
            $section->setMontantRealise($this->normaliserMontant((string) $entree['montant_realise']));
            if (bccomp($avant, $section->getMontantRealise(), 2) !== 0) {
                $modifications[] = [
                    'section_id' => $sectionId,
                    'rubrique' => $section->getNom(),
                    'avant' => $avant,
                    'apres' => $section->getMontantRealise(),
                ];
            }
        }

        $fiche->calculerEcart();
        $fiche->toucher();

        $journee = $fiche->getJourneeTresorerie();
        if ($journee !== null) {
            $journee->synchroniserDepuisFicheExecution();
            $journee->toucher();
        }

        $this->ficheRepository->save($fiche, true);
        $this->propagerVersConso($fiche);

        if ($journaliser && $journee !== null) {
            foreach ($modifications as $m) {
                $this->journal->enregistrer(
                    $journee,
                    JournalJourneeServiceInterface::REALISE_SAISI,
                    sprintf(
                        'Réalisé de « %s » : %s → %s',
                        $m['rubrique'],
                        EvenementJournee::formaterMontant($m['avant']),
                        EvenementJournee::formaterMontant($m['apres']),
                    ),
                    $m,
                );
            }
        }

        return ['fiche' => $this->serialiserDetail($fiche)];
    }

    public function synchroniserDepuisFicheBleue(FicheExecution $fiche, FicheBleue $ficheBleue): void
    {
        if ($fiche->getStatut() === StatutFiche::CLOTURE) {
            return;
        }
        $journee = $fiche->getJourneeTresorerie();
        if ($journee !== null && $journee->getEtat() === EtatJournee::CLOTURE) {
            return;
        }

        $consommees = [];
        foreach ($this->sectionsRacines($ficheBleue->getSections()->toArray()) as $source) {
            $cible = $this->apparierOuCreerProgrammee($fiche, null, $source, $consommees);
            $this->fusionnerArbreProgramme($fiche, $source, $cible, $consommees);
        }
        $this->retirerProgrammesNonConsommes($fiche, $consommees);

        $fiche->calculerMontantTotalProgramme();
        $fiche->calculerEcart();
        $fiche->toucher();
        if ($journee !== null) {
            $journee->synchroniserDepuisFicheExecution();
            $journee->toucher();
        }
        $this->ficheRepository->save($fiche, true);
        $this->propagerVersConso($fiche);
    }

    public function ajouterSectionNonProgrammee(int $ficheId, array $donnees): array
    {
        $fiche = $this->trouver($ficheId);
        $this->assertFicheModifiable($fiche);

        $nom = trim((string) ($donnees['nom'] ?? ''));
        if ($nom === '') {
            throw new DonneesInvalidesException('Le libellé est requis.');
        }

        $parentIdBrut = $donnees['parent_id'] ?? null;
        $parent = null;
        if ($parentIdBrut !== null && $parentIdBrut !== '') {
            $parent = $this->sectionParId($fiche, (int) $parentIdBrut);
            if ($parent === null) {
                throw new DonneesInvalidesException('Section parente introuvable sur cette fiche.');
            }
            if ($parent->getType() === TypeSection::SOLDE) {
                throw new DonneesInvalidesException(
                    'Impossible d\'ajouter une sous-section à la section Solde.',
                );
            }
        }

        if ($parent !== null) {
            $type = $parent->getType();
        } else {
            $typeBrut = strtolower(trim((string) ($donnees['type'] ?? '')));
            $type = TypeSection::tryFrom($typeBrut);
            if ($type === null || $type === TypeSection::SOLDE) {
                throw new DonneesInvalidesException('Le type doit être « recette » ou « depense ».');
            }
            $parent = $this->assurerConteneurNonProgramme($fiche, $type);
        }

        $realise = '0.00';
        if (isset($donnees['montant_realise']) && trim((string) $donnees['montant_realise']) !== '') {
            $realise = $this->normaliserMontant((string) $donnees['montant_realise']);
        }

        $section = new Section($nom, $type);
        $section->setNonProgramme(true);
        $section->setOrdre($this->prochainOrdre($fiche, $parent));
        $section->setMontantProgramme('0.00');
        $section->setMontantRealise($realise);

        $parent->ajouterSousSection($section);
        $fiche->ajouterSection($section);

        $resultat = $this->persisterFiche($fiche);
        $this->journaliser(
            $fiche,
            JournalJourneeServiceInterface::RUBRIQUE_AJOUTEE,
            sprintf(
                '%s non programmée « %s » ajoutée%s',
                $type === TypeSection::RECETTE ? 'Recette' : 'Dépense',
                $nom,
                bccomp($realise, '0', 2) !== 0 ? ' (réalisé '.EvenementJournee::formaterMontant($realise).')' : '',
            ),
            ['rubrique' => $nom, 'type' => $type->value, 'parent' => $parent->getNom(), 'realise' => $realise],
        );

        return $resultat;
    }

    public function modifierSectionNonProgrammee(int $ficheId, int $sectionId, array $donnees): array
    {
        $fiche = $this->trouver($ficheId);
        $this->assertFicheModifiable($fiche);

        $section = $this->sectionParId($fiche, $sectionId);
        if ($section === null) {
            throw new DonneesInvalidesException('Rubrique introuvable sur cette fiche.');
        }
        if (!$section->estNonProgramme()) {
            throw new DonneesInvalidesException(
                'Seules les rubriques non programmées peuvent être modifiées ici.',
            );
        }

        $nomAvant = $section->getNom();
        $realiseAvant = $section->getMontantRealise();
        $aNom = array_key_exists('nom', $donnees);
        $aRealise = array_key_exists('montant_realise', $donnees);
        if (!$aNom && !$aRealise) {
            throw new DonneesInvalidesException(
                'Aucun champ à modifier (nom ou montant_realise).',
            );
        }

        if ($aNom) {
            $conteneur = $this->trouverConteneurNonProgramme($fiche, $section->getType());
            if ($conteneur === $section) {
                throw new DonneesInvalidesException(
                    'Le libellé du regroupement « non programmé » ne peut pas être modifié.',
                );
            }
            $nom = trim((string) $donnees['nom']);
            if ($nom === '') {
                throw new DonneesInvalidesException('Le libellé est requis.');
            }
            $section->setNom($nom);
        }

        if ($aRealise) {
            if (!$section->getSousSections()->isEmpty()) {
                throw new DonneesInvalidesException(
                    sprintf(
                        'La rubrique « %s » a des sous-sections : son réalisé est calculé, non saisi.',
                        $section->getNom(),
                    ),
                );
            }
            $section->setMontantRealise(
                $this->normaliserMontant((string) $donnees['montant_realise']),
            );
        }

        $resultat = $this->persisterFiche($fiche);
        $changements = [];
        if ($nomAvant !== $section->getNom()) {
            $changements[] = sprintf('renommée en « %s »', $section->getNom());
        }
        if (bccomp($realiseAvant, $section->getMontantRealise(), 2) !== 0) {
            $changements[] = sprintf(
                'réalisé %s → %s',
                EvenementJournee::formaterMontant($realiseAvant),
                EvenementJournee::formaterMontant($section->getMontantRealise()),
            );
        }
        if ($changements !== []) {
            $this->journaliser(
                $fiche,
                JournalJourneeServiceInterface::RUBRIQUE_MODIFIEE,
                sprintf('Rubrique non programmée « %s » : %s', $nomAvant, implode(', ', $changements)),
                [
                    'rubrique' => $nomAvant,
                    'nouveau_nom' => $section->getNom(),
                    'avant' => $realiseAvant,
                    'apres' => $section->getMontantRealise(),
                ],
            );
        }

        return $resultat;
    }

    public function supprimerSectionNonProgrammee(int $ficheId, int $sectionId): array
    {
        $fiche = $this->trouver($ficheId);
        $this->assertFicheModifiable($fiche);

        $section = $this->sectionParId($fiche, $sectionId);
        if ($section === null) {
            throw new DonneesInvalidesException('Rubrique introuvable sur cette fiche.');
        }
        if (!$section->estNonProgramme()) {
            throw new DonneesInvalidesException(
                'Seules les rubriques non programmées peuvent être supprimées ici.',
            );
        }

        $nom = $section->getNom();
        $realise = $section->getMontantRealise();
        $this->retirerSectionEtDescendants($fiche, $section);

        $resultat = $this->persisterFiche($fiche);
        $this->journaliser(
            $fiche,
            JournalJourneeServiceInterface::RUBRIQUE_SUPPRIMEE,
            sprintf('Rubrique non programmée « %s » supprimée (réalisé %s)', $nom, EvenementJournee::formaterMontant($realise)),
            ['rubrique' => $nom, 'realise' => $realise],
        );

        return $resultat;
    }

    public function reordonnerSectionsNonProgrammees(int $ficheId, array $donnees): array
    {
        $fiche = $this->trouver($ficheId);
        $this->assertFicheModifiable($fiche);

        $idsBruts = $donnees['ids'] ?? null;
        if (!is_array($idsBruts) || $idsBruts === []) {
            throw new DonneesInvalidesException('Le champ "ids" doit être une liste d\'identifiants.');
        }

        /** @var list<int> $ids */
        $ids = array_values(array_map(static fn (mixed $id): int => (int) $id, $idsBruts));
        $sections = [];
        foreach ($ids as $id) {
            $section = $this->sectionParId($fiche, $id);
            if ($section === null || !$section->estNonProgramme()) {
                throw new DonneesInvalidesException(
                    'Toutes les rubriques à réordonner doivent être non programmées.',
                );
            }
            $sections[] = $section;
        }

        $parent = $sections[0]->getSectionParente();
        foreach ($sections as $section) {
            if ($section->getSectionParente() !== $parent) {
                throw new DonneesInvalidesException(
                    'Le réordonnancement ne concerne que des rubriques de même niveau.',
                );
            }
        }

        $fratrie = $parent !== null
            ? $parent->getSousSections()->toArray()
            : array_values(array_filter(
                $fiche->getSections()->toArray(),
                static fn (Section $s): bool => !$s->estSousSection(),
            ));

        $idsSet = array_flip($ids);
        $autres = array_values(array_filter(
            $fratrie,
            static fn (Section $s): bool => $s->getId() !== null && !isset($idsSet[$s->getId()]),
        ));
        usort(
            $autres,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId() ?? 0] <=> [$b->getOrdre(), $b->getId() ?? 0],
        );

        $ordre = 1;
        foreach ($sections as $section) {
            $section->setOrdre($ordre);
            $ordre++;
        }
        foreach ($autres as $section) {
            $section->setOrdre($ordre);
            $ordre++;
        }

        $resultat = $this->persisterFiche($fiche);
        $this->journaliser(
            $fiche,
            JournalJourneeServiceInterface::RUBRIQUES_REORDONNEES,
            sprintf(
                'Rubriques non programmées réordonnées : %s',
                implode(', ', array_map(static fn (Section $s): string => '« '.$s->getNom().' »', $sections)),
            ),
            ['ordre' => array_map(static fn (Section $s): string => $s->getNom(), $sections)],
        );

        return $resultat;
    }

    private function assertFicheModifiable(FicheExecution $fiche): void
    {
        if ($fiche->getStatut() === StatutFiche::CLOTURE) {
            throw new DonneesInvalidesException(
                'Impossible de modifier les rubriques : la fiche d\'exécution est clôturée.',
            );
        }
        $journee = $fiche->getJourneeTresorerie();
        if ($journee !== null && $journee->getEtat() === EtatJournee::CLOTURE) {
            throw new DonneesInvalidesException(
                'Impossible de modifier les rubriques : la journée est clôturée.',
            );
        }
    }

    /** @param array<string, mixed> $details */
    private function journaliser(FicheExecution $fiche, string $type, string $libelle, array $details = []): void
    {
        $journee = $fiche->getJourneeTresorerie();
        if ($journee !== null) {
            $this->journal->enregistrer($journee, $type, $libelle, $details);
        }
    }

    private function persisterFiche(FicheExecution $fiche): array
    {
        $fiche->calculerEcart();
        $fiche->toucher();
        $journee = $fiche->getJourneeTresorerie();
        if ($journee !== null) {
            $journee->synchroniserDepuisFicheExecution();
            $journee->toucher();
        }
        $this->ficheRepository->save($fiche, true);
        $this->propagerVersConso($fiche);

        return ['fiche' => $this->serialiserDetail($fiche)];
    }

    private function retirerSectionEtDescendants(FicheExecution $fiche, Section $section): void
    {
        foreach ($section->getSousSections()->toArray() as $enfant) {
            $this->retirerSectionEtDescendants($fiche, $enfant);
        }
        $section->getSectionParente()?->supprimerSousSection($section);
        $fiche->supprimerSection($section);
    }

    private function nomConteneurNonProgramme(TypeSection $type): string
    {
        return $type === TypeSection::DEPENSE
            ? 'DEPENSES NON PROGRAMMEES'
            : 'RECETTES NON PROGRAMMEES';
    }

    private function estLibelleNonProgramme(string $nom): bool
    {
        $normalise = str_replace(
            ['É', 'È', 'Ê', 'é', 'è', 'ê'],
            ['E', 'E', 'E', 'E', 'E', 'E'],
            mb_strtoupper($nom),
        );

        return str_contains($normalise, 'NON PROGRAMM');
    }

    private function racineDuType(FicheExecution $fiche, TypeSection $type): ?Section
    {
        foreach ($this->racines($fiche) as $racine) {
            if ($racine->getType() === $type) {
                return $racine;
            }
        }

        return null;
    }

    private function trouverConteneurNonProgramme(FicheExecution $fiche, TypeSection $type): ?Section
    {
        foreach ($fiche->getSections() as $section) {
            if ($section->getType() === $type && $this->estLibelleNonProgramme($section->getNom())) {
                return $section;
            }
        }

        return null;
    }

    private function assurerConteneurNonProgramme(FicheExecution $fiche, TypeSection $type): Section
    {
        $existant = $this->trouverConteneurNonProgramme($fiche, $type);
        if ($existant !== null) {
            return $existant;
        }

        $racine = $this->racineDuType($fiche, $type);
        $conteneur = new Section($this->nomConteneurNonProgramme($type), $type);
        $conteneur->setNonProgramme(true);
        $conteneur->setMontantProgramme('0.00');
        $conteneur->setMontantRealise('0.00');
        $conteneur->setOrdre($this->prochainOrdre($fiche, $racine));

        if ($racine !== null) {
            $racine->ajouterSousSection($conteneur);
        }
        $fiche->ajouterSection($conteneur);

        return $conteneur;
    }

    private function normaliserMontant(string $brut): string
    {
        $normalise = str_replace([' ', ','], ['', '.'], trim($brut));
        if ($normalise === '' || !is_numeric($normalise)) {
            throw new DonneesInvalidesException(
                sprintf('Montant réalisé invalide : « %s ».', $brut),
            );
        }
        $valeur = (float) $normalise;
        if ($valeur < 0) {
            throw new DonneesInvalidesException('Le montant réalisé ne peut pas être négatif.');
        }

        return number_format($valeur, 2, '.', '');
    }

    private function reinitialiserRealise(Section $section): void
    {
        if ($section->getSousSections()->isEmpty()) {
            $section->setMontantRealise('0.00');
        }
        foreach ($section->getSousSections() as $enfant) {
            $this->reinitialiserRealise($enfant);
        }
    }

    private function trouverJournee(string $reference): JourneeTresorerie
    {
        return $this->journeeRepository->find($reference)
            ?? throw new JourneeTresorerieIntrouvableException('Journée de trésorerie introuvable.');
    }

    private function trouver(int $id): FicheExecution
    {
        return $this->ficheRepository->find($id)
            ?? throw new FicheExecutionIntrouvableException('Fiche d\'exécution introuvable.');
    }

    private function sectionParId(FicheExecution $fiche, int $id): ?Section
    {
        foreach ($fiche->getSections() as $section) {
            if ($section->getId() === $id) {
                return $section;
            }
        }

        return null;
    }

    private function prochainOrdre(FicheExecution $fiche, ?Section $parente): int
    {
        $fratrie = $parente !== null
            ? $parente->getSousSections()->toArray()
            : array_values(array_filter(
                $fiche->getSections()->toArray(),
                static fn (Section $s): bool => !$s->estSousSection(),
            ));

        $max = 0;
        foreach ($fratrie as $section) {
            $max = max($max, $section->getOrdre());
        }

        return $max + 1;
    }

    /**
     * @return list<Section>
     */
    private function racines(FicheExecution $fiche): array
    {
        $racines = array_values(array_filter(
            $fiche->getSections()->toArray(),
            static fn (Section $s): bool => !$s->estSousSection(),
        ));
        usort(
            $racines,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId()] <=> [$b->getOrdre(), $b->getId()],
        );

        return $racines;
    }

    /**
     * @param list<Section> $sections
     *
     * @return list<Section>
     */
    private function sectionsRacines(array $sections): array
    {
        $racines = array_values(array_filter(
            $sections,
            static fn (Section $s): bool => !$s->estSousSection(),
        ));
        usort(
            $racines,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId() ?? 0] <=> [$b->getOrdre(), $b->getId() ?? 0],
        );

        return $racines;
    }

    /**
     * @return list<Section>
     */
    private function enfants(Section $section): array
    {
        $enfants = $section->getSousSections()->toArray();
        usort(
            $enfants,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId() ?? 0] <=> [$b->getOrdre(), $b->getId() ?? 0],
        );

        return $enfants;
    }

    /**
     * @param array<int, true> $consommees
     */
    private function fusionnerArbreProgramme(
        FicheExecution $fiche,
        Section $source,
        Section $cible,
        array &$consommees,
    ): void {
        $cible->setNom($source->getNom());
        $cible->setOrdre($source->getOrdre());
        $cible->setEstAffichee($source->estAffichee());
        $cible->setEstSelectionnable($source->estSelectionnable());

        $enfantsSource = $this->enfants($source);
        if ($enfantsSource === []) {
            $cible->setMontantProgramme($source->getMontantProgramme());

            return;
        }

        foreach ($enfantsSource as $enfantSource) {
            $enfantCible = $this->apparierOuCreerProgrammee($fiche, $cible, $enfantSource, $consommees);
            $this->fusionnerArbreProgramme($fiche, $enfantSource, $enfantCible, $consommees);
        }
    }

    /**
     * @param array<int, true> $consommees
     */
    private function apparierOuCreerProgrammee(
        FicheExecution $fiche,
        ?Section $parent,
        Section $source,
        array &$consommees,
    ): Section {
        $candidats = [];
        foreach ($this->fratrieProgrammee($fiche, $parent) as $candidat) {
            $id = $candidat->getId();
            if ($id === null || isset($consommees[$id]) || $candidat->estNonProgramme()) {
                continue;
            }
            if ($candidat->getType() !== $source->getType()) {
                continue;
            }
            $candidats[] = $candidat;
        }

        $nomNorm = $this->normaliserNomSection($source->getNom());
        foreach ($candidats as $candidat) {
            if ($this->normaliserNomSection($candidat->getNom()) === $nomNorm) {
                $consommees[$candidat->getId()] = true;

                return $candidat;
            }
        }
        foreach ($candidats as $candidat) {
            if ($candidat->getOrdre() === $source->getOrdre()) {
                $consommees[$candidat->getId()] = true;

                return $candidat;
            }
        }
        if (\count($candidats) === 1) {
            $seul = $candidats[0];
            $consommees[$seul->getId()] = true;

            return $seul;
        }

        $nouvelle = new Section($source->getNom(), $source->getType());
        $nouvelle->setOrdre($source->getOrdre());
        $nouvelle->setMontantProgramme($source->getMontantProgramme());
        $nouvelle->setMontantRealise('0.00');
        $nouvelle->setEstAffichee($source->estAffichee());
        $nouvelle->setEstSelectionnable($source->estSelectionnable());
        if ($parent !== null) {
            $parent->ajouterSousSection($nouvelle);
        }
        $fiche->ajouterSection($nouvelle);
        $this->ficheRepository->flush();
        if ($nouvelle->getId() !== null) {
            $consommees[$nouvelle->getId()] = true;
        }

        return $nouvelle;
    }

    /**
     * @return list<Section>
     */
    private function fratrieProgrammee(FicheExecution $fiche, ?Section $parent): array
    {
        if ($parent !== null) {
            return $this->enfants($parent);
        }

        return $this->racines($fiche);
    }

    /**
     * @param array<int, true> $consommees
     */
    private function retirerProgrammesNonConsommes(FicheExecution $fiche, array $consommees): void
    {
        foreach ($fiche->getSections()->toArray() as $section) {
            if ($section->estNonProgramme()) {
                continue;
            }
            $id = $section->getId();
            if ($id !== null && isset($consommees[$id])) {
                continue;
            }
            if ($this->aDescendantNonProgramme($section)) {
                continue;
            }
            $this->retirerSectionEtDescendants($fiche, $section);
        }
    }

    private function aDescendantNonProgramme(Section $section): bool
    {
        foreach ($this->enfants($section) as $enfant) {
            if ($enfant->estNonProgramme() || $this->aDescendantNonProgramme($enfant)) {
                return true;
            }
        }

        return false;
    }

    private function normaliserNomSection(string $nom): string
    {
        $haut = mb_strtoupper(trim($nom));
        $sansAccents = strtr($haut, [
            'À' => 'A', 'Á' => 'A', 'Â' => 'A', 'Ä' => 'A',
            'È' => 'E', 'É' => 'E', 'Ê' => 'E', 'Ë' => 'E',
            'Ì' => 'I', 'Í' => 'I', 'Î' => 'I', 'Ï' => 'I',
            'Ò' => 'O', 'Ó' => 'O', 'Ô' => 'O', 'Ö' => 'O',
            'Ù' => 'U', 'Ú' => 'U', 'Û' => 'U', 'Ü' => 'U',
            'Ç' => 'C', 'Œ' => 'OE', 'Æ' => 'AE',
        ]);
        $compact = preg_replace('/\s+/', ' ', $sansAccents) ?? $sansAccents;

        return trim($compact);
    }

    private function propagerVersConso(FicheExecution $fiche): void
    {
        $journee = $fiche->getJourneeTresorerie();
        if ($journee === null || $journee->getEtat() === EtatJournee::CLOTURE) {
            return;
        }
        $this->ficheExecutionConsoService->fusionnerDepuisJournee($journee, $fiche);
    }

    private function serialiserDetail(FicheExecution $fiche): array
    {
        $racines = $this->racines($fiche);

        return [
            'id' => $fiche->getId(),
            'reference' => $fiche->getReference(),
            'date_creation' => $fiche->getDateCreation()->format(\DateTimeInterface::ATOM),
            'date_dernier_mise_jour' => $fiche->getDateDernierMiseJour()?->format(\DateTimeInterface::ATOM),
            'statut' => $fiche->getStatut()->value,
            'createur' => $fiche->getCreateur(),
            'montant_total_programme' => $fiche->getMontantTotalProgramme(),
            'montant_total_realise' => $fiche->getMontantTotalRealisation(),
            'montant_total_ecart' => $fiche->getEcartTotal(),
            'total_solde_bancaire_entree' => $fiche->getTotalSoldeBancaireEntree(),
            'solde_bancaire_cloture' => $fiche->getSoldeBancaireCloture(),
            'section_solde' => $fiche->getSectionSoldeRacine()?->getNom(),
            'journee_tresorerie_reference' => $fiche->getJourneeTresorerie()?->getReference(),
            'sections' => array_map(fn (Section $s): array => $this->serialiserSection($s), $racines),
        ];
    }

    private function serialiserSection(Section $section): array
    {
        $sous = $section->getSousSections()->toArray();
        usort(
            $sous,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId()] <=> [$b->getOrdre(), $b->getId()],
        );

        return [
            'id' => $section->getId(),
            'nom' => $section->getNom(),
            'type' => $section->getType()->value,
            'ordre' => $section->getOrdre(),
            'montant_programme' => $section->getMontantProgramme(),
            'montant_realise' => $section->getMontantRealise(),
            'montant_ecart' => $section->getMontantEcart(),
            'est_affichee' => $section->estAffichee(),
            'est_selectionnable' => $section->estSelectionnable(),
            'non_programme' => $section->estNonProgramme(),
            'sous_sections' => array_map(fn (Section $e): array => $this->serialiserSection($e), $sous),
        ];
    }
}
