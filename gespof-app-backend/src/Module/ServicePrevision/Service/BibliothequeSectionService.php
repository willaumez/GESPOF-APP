<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\FicheBleu\BibliothequeSection;
use App\Module\ServicePrevision\Enum\TypeSection;
use App\Module\ServicePrevision\Maquettes\MaquetteFicheBleue;
use App\Module\ServicePrevision\Repository\BibliothequeSectionRepository;
use App\Module\ServicePrevision\Service\Exception\BibliothequeSectionIntrouvableException;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;

/**
 * Gestion de la Bibliothèque des sections : arbre des sections et
 * sous-sections réutilisables à la composition des Fiches Bleues.
 */
class BibliothequeSectionService implements BibliothequeSectionServiceInterface
{
    public function __construct(
        private readonly BibliothequeSectionRepository $repository,
    ) {
    }

    /**
     * Arbre paginé de la bibliothèque : la pagination porte sur les sections
     * racines (chacune livrée avec toute sa descendance). La recherche
     * conserve une racine si son libellé ou celui de l'une de ses
     * sous-sections (à n'importe quelle profondeur) contient le terme.
     * `type` (solde|recette|depense) filtre les racines sur leur type métier.
     */
    public function lister(?string $recherche = null, int $page = 1, int $limite = 10, ?string $type = null): array
    {
        $this->assurerMaquetteParDefaut();
        $racines = $this->repository->listerRacines();

        if ($type !== null && trim($type) !== '') {
            $typeFiltre = $this->resoudreType($type);
            $racines = array_values(array_filter(
                $racines,
                static fn (BibliothequeSection $s): bool => $s->getType() === $typeFiltre,
            ));
        }

        if ($recherche !== null && trim($recherche) !== '') {
            $terme = mb_strtolower(trim($recherche));
            $racines = array_values(array_filter(
                $racines,
                fn (BibliothequeSection $s): bool => $this->correspondALaRecherche($s, $terme),
            ));
        }

        $total = count($racines);
        $limite = max(1, $limite);
        $pages = max(1, (int) ceil($total / $limite));
        $page = max(1, min($page, $pages));

        return [
            'sections' => array_map(
                fn (BibliothequeSection $s): array => $this->serialiser($s),
                array_slice($racines, ($page - 1) * $limite, $limite),
            ),
            'total' => $total,
            'page' => $page,
            'pages' => $pages,
            'limite' => $limite,
        ];
    }

    /** Une section (racine ou non) avec toute son arborescence de sous-sections. */
    public function detail(int $id): array
    {
        return ['section' => $this->serialiser($this->trouver($id))];
    }

    private function correspondALaRecherche(BibliothequeSection $section, string $terme): bool
    {
        if (str_contains(mb_strtolower($section->getLibelle()), $terme)) {
            return true;
        }
        foreach ($section->getSousSections() as $enfant) {
            if ($this->correspondALaRecherche($enfant, $terme)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Crée une section (racine, ou sous-section de `parent_id`), avec
     * éventuellement ses sous-sections liées : `sous_sections` accepte une
     * liste récursive de `{ libelle, sous_sections? }`, créée en une fois.
     * Pour une racine, `type` (solde|recette|depense) est obligatoire ; pour
     * une sous-section, le type du parent est hérité.
     */
    public function creer(array $donnees, string $createur): array
    {
        $parent = null;
        if (($donnees['parent_id'] ?? null) !== null) {
            $parent = $this->trouver((int) $donnees['parent_id']);
        }

        $type = $parent !== null
            ? $parent->getType()
            : $this->resoudreType($donnees['type'] ?? null, obligatoire: true);

        $section = $this->construireSection($donnees, $createur, count($this->freresDe($parent)) + 1, $type);
        $parent?->ajouterSousSection($section);

        $this->repository->save($section, true);

        return ['section' => $this->serialiser($section)];
    }

    /**
     * Construit une BibliothequeSection et, récursivement, ses sous-sections
     * décrites dans le payload (persistées par cascade). Toutes partagent
     * le même `$type` (hérité de la racine).
     */
    private function construireSection(array $donnees, string $createur, int $position, TypeSection $type): BibliothequeSection
    {
        $libelle = trim((string) ($donnees['libelle'] ?? ''));
        if ($libelle === '') {
            throw new DonneesInvalidesException('Le libellé de chaque section est obligatoire.');
        }

        $section = new BibliothequeSection($libelle, $createur, $type);
        $section->setOrdre($position);

        $sousSections = $donnees['sous_sections'] ?? [];
        if (!is_array($sousSections)) {
            throw new DonneesInvalidesException('Le champ "sous_sections" doit être une liste.');
        }

        $rang = 0;
        foreach ($sousSections as $donneesEnfant) {
            if (!is_array($donneesEnfant)) {
                throw new DonneesInvalidesException('Chaque sous-section doit être un objet.');
            }
            $section->ajouterSousSection($this->construireSection($donneesEnfant, $createur, ++$rang, $type));
        }

        return $section;
    }

    public function modifier(int $id, array $donnees): array
    {
        $section = $this->trouver($id);

        if (array_key_exists('libelle', $donnees)) {
            $libelle = trim((string) $donnees['libelle']);
            if ($libelle === '') {
                throw new DonneesInvalidesException('Le libellé de la section ne peut pas être vide.');
            }
            $section->setLibelle($libelle);
        }

        if (array_key_exists('type', $donnees)) {
            // Le type se propage à toute la branche : une sous-section suit
            // toujours le type de sa racine.
            $section->appliquerTypeEnCascade($this->resoudreType($donnees['type'], obligatoire: true));
        }

        $this->repository->flush();

        return ['section' => $this->serialiser($section)];
    }

    /**
     * Déplace une section : `direction` ("haut" / "bas") la permute avec sa
     * voisine de même niveau ; `position` (1..n, glisser-déposer) la place à
     * ce rang parmi ses voisines de même niveau ; `parent_id` (id ou null
     * pour la racine) la rattache, avec toute sa descendance, à un autre
     * parent. Retourne l'arbre complet mis à jour.
     */
    public function deplacer(int $id, array $donnees): array
    {
        $section = $this->trouver($id);

        if (array_key_exists('parent_id', $donnees)) {
            $this->changerParent($section, $donnees['parent_id']);
            // Flush intermédiaire : les calculs d'ordre ci-dessous relisent la
            // base (sections racines), qui doit refléter le rattachement.
            $this->repository->flush();
        }

        if (($donnees['position'] ?? null) !== null) {
            $this->deplacerAPosition($section, (int) $donnees['position']);
        }

        if (($donnees['direction'] ?? null) !== null) {
            $direction = (string) $donnees['direction'];
            if (!in_array($direction, ['haut', 'bas'], true)) {
                throw new DonneesInvalidesException('Direction de déplacement inconnue : attendu "haut" ou "bas".');
            }
            $this->permuterAvecVoisine($section, $direction === 'haut' ? -1 : 1);
        }

        $this->repository->flush();

        return $this->lister();
    }

    public function supprimer(int $id): void
    {
        $section = $this->trouver($id);

        // Détache du parent avant suppression pour ne pas être re-persistée
        // par cascade ; les sous-sections suivent (cascade remove).
        $parent = $section->getSectionParente();
        $parent?->supprimerSousSection($section);
        $this->repository->remove($section, true);

        $this->renumeroter($this->freresDe($parent));
        $this->repository->flush();
    }

    public function assurerMaquetteParDefaut(string $createur = MaquetteFicheBleue::CREATEUR_SYSTEME): int
    {
        $modifs = $this->normaliserRacineSoldeCanonique();
        $modifs += $this->extraireHorsConteneursType();
        if ($modifs > 0) {
            $this->repository->flush();
        }

        $ordreRacine = count($this->repository->listerRacines());
        foreach (MaquetteFicheBleue::arbre() as $definition) {
            $type = $definition['type'];
            $racine = $this->repository->trouverRacineParLibelleEtType($definition['libelle'], $type);
            if ($racine === null) {
                $racine = new BibliothequeSection($definition['libelle'], $createur, $type);
                $racine->setOrdre(++$ordreRacine);
                $this->repository->save($racine);
                $modifs++;
            }
            $modifs += $this->assurerSousArbre(
                $racine,
                $definition['sous_sections'] ?? [],
                $type,
                $createur,
            );
        }

        $modifs += $this->elaguerSoldeCanonique();

        if ($modifs > 0) {
            $this->repository->flush();
        }

        return $modifs;
    }

    /**
     * Aligne l'ancienne racine « SOLDE BANCAIRE D'ENTREE » sur
     * « SOLDES BANCAIRES D'OUVERTURE » et renomme SOLDE BGFI RG XAF.
     */
    private function normaliserRacineSoldeCanonique(): int
    {
        $modifs = 0;
        $cible = $this->repository->trouverRacineParLibelleEtType(
            MaquetteFicheBleue::LIBELLE_SOLDE,
            TypeSection::SOLDE,
        );

        foreach (MaquetteFicheBleue::LIBELLES_SOLDE_ANCIENS as $ancien) {
            $existant = $this->repository->trouverRacineParLibelleEtType($ancien, TypeSection::SOLDE);
            if ($existant === null) {
                continue;
            }
            if ($cible === null) {
                $existant->setLibelle(MaquetteFicheBleue::LIBELLE_SOLDE);
                $cible = $existant;
            } else {
                $this->retirerArbreBibliotheque($existant);
            }
            $modifs++;
        }

        if ($cible === null) {
            return $modifs;
        }

        foreach ($cible->getSousSections()->toArray() as $enfant) {
            $nouveau = MaquetteFicheBleue::RENOMMAGES_SOLDE[$enfant->getLibelle()] ?? null;
            if ($nouveau === null || $enfant->getLibelle() === $nouveau) {
                continue;
            }
            $deja = $this->trouverEnfantParLibelle($cible, $nouveau);
            if ($deja !== null) {
                $this->retirerArbreBibliotheque($enfant);
            } else {
                $enfant->setLibelle($nouveau);
            }
            $modifs++;
        }

        return $modifs;
    }

    /**
     * Remonte les vraies sections (Salaires, RECETTES IMPOTS, …) au niveau
     * racine et supprime les anciens conteneurs de type (RECETTES,
     * 1-RECETTES PROGRAMMEES, DEPENSES, 2-DEPENSES).
     */
    private function extraireHorsConteneursType(): int
    {
        $modifs = 0;
        foreach ($this->repository->listerRacines() as $racine) {
            $modifs += $this->aplatirConteneurType($racine);
        }

        return $modifs;
    }

    private function aplatirConteneurType(BibliothequeSection $noeud): int
    {
        $modifs = 0;
        foreach ($noeud->getSousSections()->toArray() as $enfant) {
            $modifs += $this->aplatirConteneurType($enfant);
        }

        if (!MaquetteFicheBleue::estConteneurType(
            $noeud->getLibelle(),
            $noeud->getType(),
            $noeud->getSectionParente() === null,
        )) {
            return $modifs;
        }

        $parentId = $noeud->getSectionParente()?->getId();
        foreach ($noeud->getSousSections()->toArray() as $enfant) {
            $this->changerParent($enfant, $parentId);
            $modifs++;
        }
        // Le FK section_parente_id exige que les enfants soient détachés
        // en base avant la suppression du conteneur.
        $this->repository->flush();

        $this->retirerArbreBibliotheque($noeud);

        return $modifs + 1;
    }

    /**
     * La racine Solde canonique ne conserve que SOLDE BEAC et SOLDE BGFI
     * (sans sous-niveaux).
     */
    private function elaguerSoldeCanonique(): int
    {
        $racine = $this->repository->trouverRacineParLibelleEtType(
            MaquetteFicheBleue::LIBELLE_SOLDE,
            TypeSection::SOLDE,
        );
        if ($racine === null) {
            return 0;
        }

        $autorises = [
            MaquetteFicheBleue::LIBELLE_SOLDE_BEAC,
            MaquetteFicheBleue::LIBELLE_SOLDE_BGFI,
        ];
        $modifs = 0;

        foreach ($racine->getSousSections()->toArray() as $enfant) {
            if (!in_array($enfant->getLibelle(), $autorises, true)) {
                $this->retirerArbreBibliotheque($enfant);
                $modifs++;
                continue;
            }
            foreach ($enfant->getSousSections()->toArray() as $petit) {
                $this->retirerArbreBibliotheque($petit);
                $modifs++;
            }
        }

        if ($modifs > 0) {
            $this->renumeroter($this->freresDe($racine));
        }

        return $modifs;
    }

    private function retirerArbreBibliotheque(BibliothequeSection $section): void
    {
        foreach ($section->getSousSections()->toArray() as $enfant) {
            $this->retirerArbreBibliotheque($enfant);
        }
        $section->getSectionParente()?->supprimerSousSection($section);
        $this->repository->remove($section);
    }

    /**
     * @param list<array<string, mixed>> $definitions
     */
    private function assurerSousArbre(
        BibliothequeSection $parent,
        array $definitions,
        TypeSection $type,
        string $createur,
    ): int {
        $crees = 0;
        $rang = 0;
        foreach ($definitions as $definition) {
            if (!is_array($definition)) {
                continue;
            }
            $libelle = trim((string) ($definition['libelle'] ?? ''));
            if ($libelle === '') {
                continue;
            }
            $rang++;
            $enfant = $this->trouverEnfantParLibelle($parent, $libelle);
            if ($enfant === null) {
                $enfant = new BibliothequeSection($libelle, $createur, $type);
                $enfant->setOrdre($rang);
                $parent->ajouterSousSection($enfant);
                $this->repository->save($enfant);
                $crees++;
            }
            $petits = $definition['sous_sections'] ?? [];
            if (is_array($petits) && $petits !== []) {
                $crees += $this->assurerSousArbre($enfant, $petits, $type, $createur);
            }
        }

        return $crees;
    }

    private function trouverEnfantParLibelle(BibliothequeSection $parent, string $libelle): ?BibliothequeSection
    {
        foreach ($parent->getSousSections() as $enfant) {
            if ($enfant->getLibelle() === $libelle) {
                return $enfant;
            }
        }

        return null;
    }

    private function trouver(int $id): BibliothequeSection
    {
        return $this->repository->find($id)
            ?? throw new BibliothequeSectionIntrouvableException('Section de bibliothèque introuvable.');
    }

    private function resoudreType(mixed $valeur, bool $obligatoire = false): TypeSection
    {
        if ($valeur === null || (is_string($valeur) && trim($valeur) === '')) {
            if ($obligatoire) {
                throw new DonneesInvalidesException(
                    'Le type de section est obligatoire (solde, recette ou depense).',
                );
            }

            throw new DonneesInvalidesException(
                'Type de section inconnu : attendu solde, recette ou depense.',
            );
        }

        $type = TypeSection::tryFrom(mb_strtolower(trim((string) $valeur)));
        if ($type === null) {
            throw new DonneesInvalidesException(
                'Type de section inconnu : attendu solde, recette ou depense.',
            );
        }

        return $type;
    }

    /**
     * Rattache la section à `$parentId` (null : remonte à la racine), en fin
     * de liste de ses nouvelles voisines. Refus si la cible est la section
     * elle-même ou l'une de ses descendantes (cycle). Lors d'un rattachement
     * à un parent, le type de la branche suit celui du nouveau parent.
     */
    private function changerParent(BibliothequeSection $section, mixed $parentId): void
    {
        $nouveauParent = null;
        if ($parentId !== null) {
            $nouveauParent = $this->trouver((int) $parentId);

            if ($nouveauParent === $section) {
                throw new DonneesInvalidesException('Une section ne peut pas être déplacée dans elle-même.');
            }
            if ($section->estAncetreDe($nouveauParent)) {
                throw new DonneesInvalidesException('Une section ne peut pas être déplacée dans l\'une de ses sous-sections.');
            }
        }

        $ancienParent = $section->getSectionParente();
        if ($nouveauParent === $ancienParent) {
            return;
        }

        $ancienParent?->supprimerSousSection($section);
        $section->setSectionParente(null);

        if ($nouveauParent !== null) {
            $nouveauParent->ajouterSousSection($section);
            // La fratrie en mémoire inclut déjà la section : count() la place en fin de liste.
            $section->setOrdre(count($this->freresDe($nouveauParent)));
            $section->appliquerTypeEnCascade($nouveauParent->getType());
        } else {
            // La requête sur les racines ne renvoie pas encore la section (non flushée).
            $section->setOrdre(count($this->freresDe(null)) + 1);
        }

        $this->renumeroter($this->freresDe($ancienParent));
    }

    /**
     * Place la section au rang `$position` (1..n) parmi ses voisines de même
     * niveau, les autres glissant d'un cran (sémantique du glisser-déposer).
     */
    private function deplacerAPosition(BibliothequeSection $section, int $position): void
    {
        $fratrie = $this->freresDe($section->getSectionParente());
        $index = array_search($section, $fratrie, true);
        if ($index === false) {
            return;
        }

        array_splice($fratrie, $index, 1);
        $cible = max(0, min(count($fratrie), $position - 1));
        array_splice($fratrie, $cible, 0, [$section]);

        $this->renumeroter($fratrie);
    }

    /** Permute la section avec sa voisine du dessus (-1) ou du dessous (+1). */
    private function permuterAvecVoisine(BibliothequeSection $section, int $sens): void
    {
        $fratrie = $this->freresDe($section->getSectionParente());
        $index = array_search($section, $fratrie, true);
        if ($index === false) {
            return;
        }

        $cible = $index + $sens;
        if ($cible < 0 || $cible >= count($fratrie)) {
            return;
        }

        [$fratrie[$index], $fratrie[$cible]] = [$fratrie[$cible], $fratrie[$index]];
        $this->renumeroter($fratrie);
    }

    /**
     * Sections de même niveau (racines si `$parent` est null), triées par
     * ordre. Les racines sont relues en base puis re-filtrées sur l'état en
     * mémoire : une section tout juste rattachée à un parent (non flushée)
     * ne doit plus compter parmi elles.
     *
     * @return BibliothequeSection[]
     */
    private function freresDe(?BibliothequeSection $parent): array
    {
        $sections = $parent === null
            ? array_filter(
                $this->repository->listerRacines(),
                static fn (BibliothequeSection $s): bool => $s->getSectionParente() === null,
            )
            : $parent->getSousSections()->toArray();

        usort(
            $sections,
            static fn (BibliothequeSection $a, BibliothequeSection $b): int => [$a->getOrdre(), $a->getId()] <=> [$b->getOrdre(), $b->getId()],
        );

        return array_values($sections);
    }

    /**
     * @param BibliothequeSection[] $sections
     */
    private function renumeroter(array $sections): void
    {
        foreach ($sections as $index => $section) {
            $section->setOrdre($index + 1);
        }
    }

    private function serialiser(BibliothequeSection $section): array
    {
        $sousSections = $section->getSousSections()->toArray();
        usort(
            $sousSections,
            static fn (BibliothequeSection $a, BibliothequeSection $b): int => [$a->getOrdre(), $a->getId()] <=> [$b->getOrdre(), $b->getId()],
        );

        return [
            'id' => $section->getId(),
            'libelle' => $section->getLibelle(),
            'type' => $section->getType()->value,
            'ordre' => $section->getOrdre(),
            'date_creation' => $section->getDateCreation()->format(\DateTimeInterface::ATOM),
            'createur' => $section->getCreateur(),
            'sous_sections' => array_map(
                fn (BibliothequeSection $enfant): array => $this->serialiser($enfant),
                $sousSections,
            ),
        ];
    }
}
