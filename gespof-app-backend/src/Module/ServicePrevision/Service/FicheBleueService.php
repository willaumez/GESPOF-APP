<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\FicheBleu\BibliothequeSection;
use App\Module\ServicePrevision\Entite\FicheBleu\FicheBleue;
use App\Module\ServicePrevision\Entite\FicheBleu\Section;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\EvenementJournee;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;
use App\Module\ServicePrevision\Enum\EtatJournee;
use App\Module\ServicePrevision\Enum\StatutFiche;
use App\Module\ServicePrevision\Enum\TypeSection;
use App\Module\ServicePrevision\Maquettes\MaquetteFicheBleue;
use App\Module\ServicePrevision\Repository\BibliothequeSectionRepository;
use App\Module\ServicePrevision\Repository\FicheBleueRepository;
use App\Module\ServicePrevision\Repository\JourneeTresorerieRepository;
use App\Module\ServicePrevision\Service\Exception\BibliothequeSectionIntrouvableException;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use App\Module\ServicePrevision\Service\Exception\FicheBleueIntrouvableException;

/**
 * Création et consultation des Fiches Bleues : composition à partir de la
 * bibliothèque des sections (copie des libellés / types / sous-sections).
 */
class FicheBleueService implements FicheBleueServiceInterface
{
    public function __construct(
        private readonly FicheBleueRepository $ficheRepository,
        private readonly BibliothequeSectionRepository $bibliothequeRepository,
        private readonly BibliothequeSectionServiceInterface $bibliothequeService,
        private readonly JourneeTresorerieRepository $journeeRepository,
        private readonly FicheExecutionServiceInterface $ficheExecutionService,
        private readonly JournalJourneeServiceInterface $journal,
    ) {
    }

    public function lister(
        int $page = 1,
        int $limite = 10,
        ?string $date = null,
        ?string $recherche = null,
        ?string $statut = null,
        ?string $dateDebut = null,
        ?string $dateFin = null,
    ): array {
        $limite = max(1, min(500, $limite));
        $page = max(1, $page);

        $jour = $this->parserDateOptionnelle($date, 'date');
        $debut = $this->parserDateOptionnelle($dateDebut, 'date_debut');
        $fin = $this->parserDateOptionnelle($dateFin, 'date_fin');

        $statutEnum = null;
        if ($statut !== null && $statut !== '') {
            $statutEnum = StatutFiche::tryFrom(mb_strtolower(trim($statut)));
            if ($statutEnum === null) {
                throw new DonneesInvalidesException(
                    'Le paramètre "statut" doit être brouillon, valide, en_cours ou cloture.',
                );
            }
        }

        $terme = $recherche !== null ? trim($recherche) : null;
        if ($terme === '') {
            $terme = null;
        }

        $resultat = $this->ficheRepository->filtrer(
            $page,
            $limite,
            $terme,
            $statutEnum,
            $jour,
            $debut,
            $fin,
        );

        $total = $resultat['total'];
        $pages = max(1, (int) ceil($total / $limite));
        $page = min($page, $pages);

        $payload = [
            'fiches' => array_map(
                fn (FicheBleue $f): array => $this->serialiserResume($f),
                $resultat['fiches'],
            ),
            'total' => $total,
            'page' => $page,
            'pages' => $pages,
            'limite' => $limite,
        ];

        if ($jour !== null) {
            $payload['date'] = $jour->format('Y-m-d');
        }

        return $payload;
    }

    private function parserDateOptionnelle(?string $valeur, string $nomParametre): ?\DateTimeImmutable
    {
        if ($valeur === null || $valeur === '') {
            return null;
        }

        $date = \DateTimeImmutable::createFromFormat('Y-m-d', $valeur);
        if ($date === false) {
            throw new DonneesInvalidesException(
                sprintf('Le paramètre "%s" doit être au format YYYY-MM-DD.', $nomParametre),
            );
        }

        return $date;
    }

    public function detail(int $id): array
    {
        return ['fiche' => $this->serialiserDetail($this->trouver($id))];
    }

    /**
     * Payload attendu :
     * - solde : { bibliotheque_id } OU { libelle, sous_sections? }
     *   (dans le 2e cas, la section Solde est créée dans la bibliothèque)
     * - autres_sections : liste ordonnée de { bibliotheque_id } (types ≠ solde)
     */
    public function creer(array $donnees, string $createur): array
    {
        $journee = $this->exigerJourneeOuverteDuJour();
        $this->bibliothequeService->assurerMaquetteParDefaut();
        $soldeBib = $this->resoudreSectionSolde($donnees['solde'] ?? null, $createur);
        // Fallback : toutes les sections Recette puis Dépense si le client
        // n'envoie pas "autres_sections".
        if (!array_key_exists('autres_sections', $donnees) || $donnees['autres_sections'] === null) {
            $autresBib = $this->sectionsCanoniquesHorsSolde();
        } else {
            $autresBib = $this->resoudreAutresSections($donnees['autres_sections'] ?? [], $soldeBib);
        }

        $aujourdhui = new \DateTimeImmutable('today');
        $reference = FicheBleue::genererReference(
            $aujourdhui,
            $this->ficheRepository->prochainIncrementPourDate($aujourdhui),
        );

        $fiche = new FicheBleue($reference, $createur);

        $ordre = 1;
        $sectionSolde = $this->copierDepuisBibliotheque($soldeBib);
        $sectionSolde->setOrdre($ordre++);
        $fiche->ajouterSection($sectionSolde);

        foreach ($autresBib as $bib) {
            $section = $this->copierDepuisBibliotheque($bib);
            $section->setOrdre($ordre++);
            $fiche->ajouterSection($section);
        }

        $fiche->validerCompositionSolde();

        $this->ficheRepository->save($fiche, true);

        if ($journee->getFicheBleue() === null) {
            $journee->setFicheBleue($fiche);
            $fiche->setStatut(StatutFiche::EN_COURS);
            $journee->toucher();
            $this->ficheRepository->flush();
        }

        return ['fiche' => $this->serialiserDetail($fiche)];
    }

    public function modifier(int $id, array $donnees, string $createur): array
    {
        $fiche = $this->trouver($id);
        $this->exigerFicheModifiable($fiche);
        $soldeBib = $this->resoudreSectionSolde($donnees['solde'] ?? null, $createur);
        $autresBib = $this->resoudreAutresSections($donnees['autres_sections'] ?? [], $soldeBib);

        foreach ($fiche->getSections()->toArray() as $section) {
            $fiche->getSections()->removeElement($section);
            $section->setFicheBleue(null);
            $section->setSectionParente(null);
        }
        $this->ficheRepository->flush();

        $ordre = 1;
        $sectionSolde = $this->copierDepuisBibliotheque($soldeBib);
        $sectionSolde->setOrdre($ordre++);
        $fiche->ajouterSection($sectionSolde);

        foreach ($autresBib as $bib) {
            $section = $this->copierDepuisBibliotheque($bib);
            $section->setOrdre($ordre++);
            $fiche->ajouterSection($section);
        }

        $fiche->validerCompositionSolde();
        $fiche->toucher();
        $this->ficheRepository->save($fiche, true);
        $this->propagerVersFicheExecution($fiche);

        $journee = $fiche->getJourneeTresorerie();
        if ($journee !== null) {
            $this->journal->enregistrer(
                $journee,
                JournalJourneeServiceInterface::FICHE_BLEUE_MODIFIEE,
                sprintf('Fiche Bleue %s modifiée (rubriques reportées sur la fiche d\'exécution)', $fiche->getReference()),
                ['fiche_bleue' => $fiche->getReference()],
            );
        }

        return ['fiche' => $this->serialiserDetail($fiche)];
    }

    public function appliquerMontantsProgramme(int $ficheId, array $donnees): array
    {
        $fiche = $this->trouver($ficheId);
        if (
            $fiche->getStatut() === StatutFiche::CLOTURE
            || $fiche->getJourneeTresorerie()?->getEtat() === EtatJournee::CLOTURE
        ) {
            throw new DonneesInvalidesException(
                'La journée de cette Fiche Bleue est clôturée : le programmé ne peut plus être modifié.',
            );
        }
        $entrees = $donnees['montants'] ?? null;
        if (!is_array($entrees)) {
            throw new DonneesInvalidesException(
                'Le corps doit contenir "montants" (liste de { section_id, montant_programme }).',
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
            if (!is_array($entree) || !isset($entree['section_id'], $entree['montant_programme'])) {
                throw new DonneesInvalidesException(
                    'Chaque entrée de "montants" doit contenir "section_id" et "montant_programme".',
                );
            }
            $sectionId = (int) $entree['section_id'];
            $section = $index[$sectionId] ?? null;
            if ($section === null) {
                throw new DonneesInvalidesException(
                    sprintf('Section #%d introuvable sur cette Fiche Bleue.', $sectionId),
                );
            }
            if (!$section->getSousSections()->isEmpty()) {
                throw new DonneesInvalidesException(
                    sprintf(
                        'La section « %s » a des sous-sections : son montant est calculé, non saisi.',
                        $section->getNom(),
                    ),
                );
            }

            $montant = $this->normaliserMontant((string) $entree['montant_programme']);
            $avant = $section->getMontantProgramme();
            $section->setMontantProgramme($montant);
            if (bccomp($avant, $montant, 2) !== 0) {
                $modifications[] = ['section_id' => $sectionId, 'rubrique' => $section->getNom(), 'avant' => $avant, 'apres' => $montant];
            }
        }

        $fiche->calculerMontantTotalProgramme();
        $fiche->calculerEcart();
        $fiche->toucher();
        $this->ficheRepository->save($fiche, true);
        $this->propagerVersFicheExecution($fiche);

        $journee = $fiche->getJourneeTresorerie();
        if ($journee !== null) {
            foreach ($modifications as $m) {
                $this->journal->enregistrer(
                    $journee,
                    JournalJourneeServiceInterface::PROGRAMME_SAISI,
                    sprintf(
                        'Programmé de « %s » : %s → %s',
                        $m['rubrique'],
                        EvenementJournee::formaterMontant($m['avant']),
                        EvenementJournee::formaterMontant($m['apres']),
                    ),
                    ['fiche_bleue' => $fiche->getReference(), ...$m],
                );
            }
        }

        return ['fiche' => $this->serialiserDetail($fiche)];
    }

    public function programmerSections(int $ficheId, array $donnees): array
    {
        $fiche = $this->trouver($ficheId);
        $this->exigerFicheModifiable($fiche);

        /** @var array<int, Section> $index */
        $index = [];
        foreach ($fiche->getSections() as $section) {
            $id = $section->getId();
            if ($id !== null) {
                $index[$id] = $section;
            }
        }

        $misesAJour = $donnees['mises_a_jour'] ?? [];
        if (!is_array($misesAJour)) {
            throw new DonneesInvalidesException('Le champ "mises_a_jour" doit être une liste.');
        }
        $ordresParId = [];
        foreach ($misesAJour as $entree) {
            if (!is_array($entree) || !isset($entree['section_id'])) {
                throw new DonneesInvalidesException(
                    'Chaque mise à jour doit contenir "section_id".',
                );
            }
            $section = $index[(int) $entree['section_id']] ?? null;
            if ($section === null) {
                throw new DonneesInvalidesException(
                    sprintf('Section #%d introuvable sur cette Fiche Bleue.', (int) $entree['section_id']),
                );
            }
            if (array_key_exists('nom', $entree)) {
                $nom = trim((string) $entree['nom']);
                if ($nom === '') {
                    throw new DonneesInvalidesException('Le libellé d\'une section ne peut pas être vide.');
                }
                $section->setNom($nom);
            }
            if (array_key_exists('montant_programme', $entree) && $section->getSousSections()->isEmpty()) {
                $section->setMontantProgramme(
                    $this->normaliserMontant((string) $entree['montant_programme']),
                );
            }
            if (array_key_exists('ordre', $entree)) {
                $ordresParId[(int) $entree['section_id']] = max(1, (int) $entree['ordre']);
            }
        }

        $insertions = $donnees['insertions'] ?? [];
        if (!is_array($insertions)) {
            throw new DonneesInvalidesException('Le champ "insertions" doit être une liste.');
        }
        foreach ($insertions as $noeud) {
            if (!is_array($noeud)) {
                throw new DonneesInvalidesException('Chaque insertion doit être un objet.');
            }
            $parent = null;
            if (($noeud['parent_id'] ?? null) !== null) {
                $parent = $index[(int) $noeud['parent_id']] ?? null;
                if ($parent === null) {
                    throw new DonneesInvalidesException(
                        sprintf('Parent #%d introuvable pour l\'insertion.', (int) $noeud['parent_id']),
                    );
                }
            }
            $this->insererNoeudProgrammation($fiche, $noeud, $parent);
        }

        $this->appliquerOrdresProgrammation($fiche, $ordresParId);

        $fiche->calculerMontantTotalProgramme();
        $fiche->calculerEcart();
        $fiche->toucher();
        $this->ficheRepository->save($fiche, true);
        $this->propagerVersFicheExecution($fiche);

        return ['fiche' => $this->serialiserDetail($fiche)];
    }

    /**
     * @param array<string, mixed> $noeud
     */
    private function insererNoeudProgrammation(FicheBleue $fiche, array $noeud, ?Section $parent): Section
    {
        $nom = trim((string) ($noeud['nom'] ?? ''));
        if ($nom === '') {
            throw new DonneesInvalidesException('Chaque insertion doit avoir un "nom".');
        }

        if ($parent !== null) {
            $type = $parent->getType();
        } else {
            $type = TypeSection::tryFrom((string) ($noeud['type'] ?? ''));
            if ($type === null) {
                throw new DonneesInvalidesException(
                    'Chaque insertion racine doit indiquer un "type" (recette ou depense).',
                );
            }
            if ($type === TypeSection::SOLDE) {
                throw new DonneesInvalidesException('Impossible d\'ajouter une seconde section Solde.');
            }
        }

        $enfants = $noeud['enfants'] ?? [];
        if (!is_array($enfants)) {
            throw new DonneesInvalidesException('Le champ "enfants" doit être une liste.');
        }

        $nouvelle = new Section($nom, $type);
        if ($enfants === [] && array_key_exists('montant_programme', $noeud)) {
            $nouvelle->setMontantProgramme(
                $this->normaliserMontant((string) $noeud['montant_programme']),
            );
        }

        $position = max(1, (int) ($noeud['position'] ?? 1));

        if ($parent !== null) {
            $parent->ajouterSousSection($nouvelle);
            $fiche->ajouterSection($nouvelle);
            $this->placerDansListe($parent->getSousSections()->toArray(), $nouvelle, $position);
        } else {
            $fiche->ajouterSection($nouvelle);
            $this->placerRacine($fiche, $nouvelle, $type, $position);
        }

        $rang = 1;
        foreach ($enfants as $enfant) {
            if (!is_array($enfant)) {
                continue;
            }
            $enfant['position'] = $enfant['position'] ?? $rang;
            $this->insererNoeudProgrammation($fiche, $enfant, $nouvelle);
            $rang++;
        }

        return $nouvelle;
    }

    /**
     * Réordonne les fratries selon les rangs demandés (1..n), sans changer
     * de parent : une sous-section reste dans sa section.
     *
     * @param array<int, int> $ordresParId
     */
    private function appliquerOrdresProgrammation(FicheBleue $fiche, array $ordresParId): void
    {
        if ($ordresParId === []) {
            return;
        }

        $groupes = [];
        foreach ($fiche->getSections() as $section) {
            $id = $section->getId();
            if ($id === null || !isset($ordresParId[$id])) {
                continue;
            }
            $cle = $section->estSousSection()
                ? (string) ($section->getSectionParente()?->getId() ?? 'sous')
                : 'root-'.$section->getType()->value;
            $groupes[$cle][] = $section;
        }

        foreach ($groupes as $fratrieTouchee) {
            $temoin = $fratrieTouchee[0];
            $parent = $temoin->getSectionParente();
            if ($parent !== null) {
                $tous = $parent->getSousSections()->toArray();
            } else {
                $tous = array_values(array_filter(
                    $fiche->getSections()->toArray(),
                    static fn (Section $s): bool => !$s->estSousSection()
                        && $s->getType() === $temoin->getType(),
                ));
            }
            usort(
                $tous,
                static function (Section $a, Section $b) use ($ordresParId): int {
                    $oa = $ordresParId[$a->getId() ?? 0] ?? $a->getOrdre();
                    $ob = $ordresParId[$b->getId() ?? 0] ?? $b->getOrdre();

                    return $oa <=> $ob;
                },
            );
            foreach ($tous as $index => $section) {
                $section->setOrdre($index + 1);
            }
        }

        if ($fiche->getSections()->exists(
            static fn (int $i, Section $s): bool => !$s->estSousSection() && $s->getType() === TypeSection::SOLDE,
        )) {
            $racines = array_values(array_filter(
                $fiche->getSections()->toArray(),
                static fn (Section $s): bool => !$s->estSousSection(),
            ));
            $soldes = array_values(array_filter(
                $racines,
                static fn (Section $s): bool => $s->getType() === TypeSection::SOLDE,
            ));
            $recettes = array_values(array_filter(
                $racines,
                static fn (Section $s): bool => $s->getType() === TypeSection::RECETTE,
            ));
            $depenses = array_values(array_filter(
                $racines,
                static fn (Section $s): bool => $s->getType() === TypeSection::DEPENSE,
            ));
            usort($recettes, static fn (Section $a, Section $b): int => $a->getOrdre() <=> $b->getOrdre());
            usort($depenses, static fn (Section $a, Section $b): int => $a->getOrdre() <=> $b->getOrdre());
            $ordre = 1;
            foreach ([...$soldes, ...$recettes, ...$depenses] as $section) {
                $section->setOrdre($ordre++);
            }
        }
    }

    /**
     * @param list<Section> $liste
     */
    private function placerDansListe(array $liste, Section $cible, int $position): void
    {
        $liste = array_values(array_filter(
            $liste,
            static fn (Section $s): bool => $s !== $cible,
        ));
        $position = max(1, min($position, count($liste) + 1));
        array_splice($liste, $position - 1, 0, [$cible]);
        foreach ($liste as $index => $section) {
            $section->setOrdre($index + 1);
        }
    }

    private function placerRacine(
        FicheBleue $fiche,
        Section $cible,
        TypeSection $type,
        int $position,
    ): void {
        $racines = array_values(array_filter(
            $fiche->getSections()->toArray(),
            static fn (Section $s): bool => !$s->estSousSection(),
        ));
        $soldes = array_values(array_filter(
            $racines,
            static fn (Section $s): bool => $s->getType() === TypeSection::SOLDE,
        ));
        $recettes = array_values(array_filter(
            $racines,
            static fn (Section $s): bool => $s !== $cible && $s->getType() === TypeSection::RECETTE,
        ));
        $depenses = array_values(array_filter(
            $racines,
            static fn (Section $s): bool => $s !== $cible && $s->getType() === TypeSection::DEPENSE,
        ));

        if ($type === TypeSection::RECETTE) {
            $recettes = $this->listeAvecCible($recettes, $cible, $position);
        } else {
            $depenses = $this->listeAvecCible($depenses, $cible, $position);
        }

        $ordre = 1;
        foreach ([...$soldes, ...$recettes, ...$depenses] as $section) {
            $section->setOrdre($ordre++);
        }
    }

    /**
     * @param list<Section> $liste
     * @return list<Section>
     */
    private function listeAvecCible(array $liste, Section $cible, int $position): array
    {
        $liste = array_values(array_filter(
            $liste,
            static fn (Section $s): bool => $s !== $cible,
        ));
        $position = max(1, min($position, count($liste) + 1));
        array_splice($liste, $position - 1, 0, [$cible]);

        return $liste;
    }

    private function normaliserMontant(string $brut): string
    {
        $normalise = str_replace([' ', ','], ['', '.'], trim($brut));
        if ($normalise === '' || !is_numeric($normalise)) {
            throw new DonneesInvalidesException(
                sprintf('Montant programmé invalide : « %s ».', $brut),
            );
        }
        $valeur = (float) $normalise;
        if ($valeur < 0) {
            throw new DonneesInvalidesException('Le montant programmé ne peut pas être négatif.');
        }

        return number_format($valeur, 2, '.', '');
    }

    /**
     * @param mixed $soldePayload
     */
    private function resoudreSectionSolde(mixed $soldePayload, string $createur): BibliothequeSection
    {
        if (!is_array($soldePayload)) {
            throw new DonneesInvalidesException(
                'La section Solde est obligatoire : fournissez "solde.bibliotheque_id" '
                . 'ou "solde.libelle" pour en créer une dans la bibliothèque.',
            );
        }

        if (($soldePayload['bibliotheque_id'] ?? null) !== null) {
            $section = $this->trouverBibliotheque((int) $soldePayload['bibliotheque_id']);
            if ($section->getType() !== TypeSection::SOLDE) {
                throw new DonneesInvalidesException(
                    'La section d\'en-tête doit être de type Solde.',
                );
            }
            if ($section->estSousSection()) {
                throw new DonneesInvalidesException(
                    'Seule une section racine de la bibliothèque peut servir d\'en-tête Solde.',
                );
            }

            return $section;
        }

        $libelle = trim((string) ($soldePayload['libelle'] ?? ''));
        if ($libelle === '') {
            throw new DonneesInvalidesException(
                'Le libellé de la nouvelle section Solde est obligatoire.',
            );
        }

        $nouvelle = new BibliothequeSection($libelle, $createur, TypeSection::SOLDE);
        $nouvelle->setOrdre(count($this->bibliothequeRepository->listerRacines()) + 1);

        $sousSections = $soldePayload['sous_sections'] ?? [];
        if (!is_array($sousSections)) {
            throw new DonneesInvalidesException('Le champ "sous_sections" doit être une liste.');
        }
        $this->ajouterSousSectionsBibliotheque($nouvelle, $sousSections, $createur);

        $this->bibliothequeRepository->save($nouvelle, true);

        return $nouvelle;
    }

    /**
     * Gabarit de création : uniquement les sections de
     * {@see MaquetteFicheBleue::compositionParDefaut()}, dans l'ordre.
     *
     * @return list<BibliothequeSection>
     */
    private function sectionsCanoniquesHorsSolde(): array
    {
        $canoniques = [];
        foreach (MaquetteFicheBleue::compositionParDefaut() as $definition) {
            $racine = $this->bibliothequeRepository->trouverRacineParLibelleEtType(
                $definition['libelle'],
                $definition['type'],
            );
            if ($racine !== null) {
                $canoniques[] = $racine;
            }
        }

        return $canoniques;
    }

    /**
     * @param mixed $autresPayload
     *
     * @return list<BibliothequeSection>
     */
    private function resoudreAutresSections(mixed $autresPayload, BibliothequeSection $soldeBib): array
    {
        if (!is_array($autresPayload)) {
            throw new DonneesInvalidesException('Le champ "autres_sections" doit être une liste.');
        }

        $autresBib = [];
        foreach ($autresPayload as $entree) {
            if (!is_array($entree) || !isset($entree['bibliotheque_id'])) {
                throw new DonneesInvalidesException(
                    'Chaque entrée de "autres_sections" doit contenir "bibliotheque_id".',
                );
            }
            $sectionBib = $this->trouverBibliotheque((int) $entree['bibliotheque_id']);
            if ($sectionBib->getType() === TypeSection::SOLDE) {
                throw new DonneesInvalidesException(
                    'Les sections Solde ne peuvent pas figurer dans "autres_sections" : '
                    . 'une seule Solde est placée en en-tête.',
                );
            }
            if ($sectionBib->getId() === $soldeBib->getId()) {
                throw new DonneesInvalidesException(
                    'La section Solde d\'en-tête ne peut pas être reprise dans les autres sections.',
                );
            }
            $autresBib[] = $sectionBib;
        }

        return $autresBib;
    }

    /**
     * @param list<mixed> $sousSections
     */
    private function ajouterSousSectionsBibliotheque(
        BibliothequeSection $parent,
        array $sousSections,
        string $createur,
    ): void {
        $rang = 0;
        foreach ($sousSections as $donnees) {
            if (!is_array($donnees)) {
                throw new DonneesInvalidesException('Chaque sous-section doit être un objet.');
            }
            $libelle = trim((string) ($donnees['libelle'] ?? ''));
            if ($libelle === '') {
                throw new DonneesInvalidesException('Le libellé de chaque sous-section est obligatoire.');
            }
            $enfant = new BibliothequeSection($libelle, $createur, $parent->getType());
            $enfant->setOrdre(++$rang);
            $parent->ajouterSousSection($enfant);

            $petits = $donnees['sous_sections'] ?? [];
            if (!is_array($petits)) {
                throw new DonneesInvalidesException('Le champ "sous_sections" doit être une liste.');
            }
            $this->ajouterSousSectionsBibliotheque($enfant, $petits, $createur);
        }
    }

    private function copierDepuisBibliotheque(BibliothequeSection $bib): Section
    {
        $section = new Section($bib->getLibelle(), $bib->getType());
        $section->setOrdre($bib->getOrdre());

        $enfants = $bib->getSousSections()->toArray();
        usort(
            $enfants,
            static fn (BibliothequeSection $a, BibliothequeSection $b): int =>
                [$a->getOrdre(), $a->getId()] <=> [$b->getOrdre(), $b->getId()],
        );

        foreach ($enfants as $enfantBib) {
            $section->ajouterSousSection($this->copierDepuisBibliotheque($enfantBib));
        }

        return $section;
    }

    /** Fiche rattachée à une journée clôturée : lecture seule. */
    private function exigerFicheModifiable(FicheBleue $fiche): void
    {
        if (
            $fiche->getStatut() === StatutFiche::CLOTURE
            || $fiche->getJourneeTresorerie()?->getEtat() === EtatJournee::CLOTURE
        ) {
            throw new DonneesInvalidesException(
                'La journée de cette Fiche Bleue est clôturée : la fiche ne peut plus être modifiée.',
            );
        }
    }

    private function exigerJourneeOuverteDuJour(): JourneeTresorerie
    {
        $journee = $this->journeeRepository->trouverDuJour(new \DateTimeImmutable('today'));
        if ($journee === null) {
            throw new DonneesInvalidesException(
                'Ouvrez d\'abord une journée de trésorerie avant de créer une Fiche Bleue.',
            );
        }
        if ($journee->getEtat() === EtatJournee::CLOTURE) {
            throw new DonneesInvalidesException(
                'La journée de trésorerie du jour est clôturée. Impossible de créer une Fiche Bleue.',
            );
        }

        return $journee;
    }

    private function propagerVersFicheExecution(FicheBleue $fiche): void
    {
        $execution = $fiche->getJourneeTresorerie()?->getFicheExecution();
        if ($execution === null) {
            return;
        }
        $this->ficheExecutionService->synchroniserDepuisFicheBleue($execution, $fiche);
    }

    private function trouver(int $id): FicheBleue
    {
        return $this->ficheRepository->find($id)
            ?? throw new FicheBleueIntrouvableException('Fiche Bleue introuvable.');
    }

    private function trouverBibliotheque(int $id): BibliothequeSection
    {
        return $this->bibliothequeRepository->find($id)
            ?? throw new BibliothequeSectionIntrouvableException('Section de bibliothèque introuvable.');
    }

    private function serialiserResume(FicheBleue $fiche): array
    {
        $solde = $fiche->getSectionSoldeRacine();

        return [
            'id' => $fiche->getId(),
            'reference' => $fiche->getReference(),
            'date_creation' => $fiche->getDateCreation()->format(\DateTimeInterface::ATOM),
            'date_modification' => $fiche->getDateModification()?->format(\DateTimeInterface::ATOM),
            'statut' => $fiche->getStatut()->value,
            'createur' => $fiche->getCreateur(),
            'montant_total_programme' => $fiche->getMontantTotalProgramme(),
            'montant_total_realise' => $fiche->getMontantTotalRealise(),
            'montant_total_ecart' => $fiche->getMontantTotalEcart(),
            'section_solde' => $solde?->getNom(),
            'nombre_sections' => count(array_filter(
                $fiche->getSections()->toArray(),
                static fn (Section $s): bool => !$s->estSousSection(),
            )),
            'journee_tresorerie_reference' => $fiche->getJourneeTresorerie()?->getReference(),
        ];
    }

    private function serialiserDetail(FicheBleue $fiche): array
    {
        $racines = array_values(array_filter(
            $fiche->getSections()->toArray(),
            static fn (Section $s): bool => !$s->estSousSection(),
        ));
        usort(
            $racines,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId()] <=> [$b->getOrdre(), $b->getId()],
        );

        return [
            ...$this->serialiserResume($fiche),
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
            'sous_sections' => array_map(fn (Section $e): array => $this->serialiserSection($e), $sous),
        ];
    }
}
