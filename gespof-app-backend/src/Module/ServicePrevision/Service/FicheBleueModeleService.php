<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\FicheBleu\FicheBleueModele;
use App\Module\ServicePrevision\Entite\FicheBleu\FicheBleueModeleSection;
use App\Module\ServicePrevision\Entite\FicheBleu\SectionModele;
use App\Module\ServicePrevision\Enum\TypeSection;
use App\Module\ServicePrevision\Repository\FicheBleueModeleRepository;
use App\Module\ServicePrevision\Repository\SectionModeleRepository;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use App\Module\ServicePrevision\Service\Exception\MaquetteIntrouvableException;
use App\Module\ServicePrevision\Service\Exception\MaquetteUtiliseeException;
use App\Module\ServicePrevision\Service\Exception\SectionModeleIntrouvableException;

class FicheBleueModeleService implements FicheBleueModeleServiceInterface
{
    public function __construct(
        private readonly FicheBleueModeleRepository $modeleRepository,
        private readonly SectionModeleRepository $sectionModeleRepository,
    ) {
    }

    public function lister(?string $recherche = null): array
    {
        return [
            'maquettes' => array_map(
                static fn (FicheBleueModele $m): array => [
                    'id' => $m->getId(),
                    'nom' => $m->getNom(),
                    'description' => $m->getDescription(),
                    'actif' => $m->isActif(),
                    'est_par_defaut' => $m->estParDefaut(),
                    'mis_a_jour_le' => $m->getMisAJourLe()->format(\DateTimeInterface::ATOM),
                    'nb_sections' => $m->getStructure()->count(),
                    'nb_fiches' => $m->getFichesInstanciees()->count(),
                ],
                $this->modeleRepository->listerOrdonne($recherche),
            ),
        ];
    }

    public function detail(int $id): array
    {
        return ['maquette' => $this->serialiserModele($this->trouver($id))];
    }

    public function listerCatalogueSections(): array
    {
        return [
            'sections' => array_map(
                fn (SectionModele $s): array => $this->serialiserSection($s),
                $this->sectionModeleRepository->listerRacines(),
            ),
        ];
    }

    public function creer(array $donnees): array
    {
        $nom = trim((string) ($donnees['nom'] ?? ''));
        if ($nom === '') {
            throw new DonneesInvalidesException('Le nom de la maquette est obligatoire.');
        }

        $modele = new FicheBleueModele($nom);
        $modele->setDescription($this->extraireDescription($donnees));
        $modele->setActif((bool) ($donnees['actif'] ?? true));

        if ((bool) ($donnees['est_par_defaut'] ?? false)) {
            $this->modeleRepository->retirerDefautSauf(null);
            $modele->setEstParDefaut(true);
        }

        $this->remplacerStructure($modele, $donnees['sections'] ?? []);
        $this->modeleRepository->save($modele, true);

        return ['maquette' => $this->serialiserModele($modele)];
    }

    public function modifier(int $id, array $donnees): array
    {
        $modele = $this->trouver($id);

        if (array_key_exists('nom', $donnees)) {
            $nom = trim((string) $donnees['nom']);
            if ($nom === '') {
                throw new DonneesInvalidesException('Le nom de la maquette ne peut pas être vide.');
            }
            $modele->setNom($nom);
        }
        if (array_key_exists('description', $donnees)) {
            $modele->setDescription($this->extraireDescription($donnees));
        }
        if (array_key_exists('actif', $donnees)) {
            $modele->setActif((bool) $donnees['actif']);
        }
        if (array_key_exists('est_par_defaut', $donnees)) {
            $estParDefaut = (bool) $donnees['est_par_defaut'];
            if ($estParDefaut) {
                $this->modeleRepository->retirerDefautSauf($modele->getId());
            }
            $modele->setEstParDefaut($estParDefaut);
        }
        if (array_key_exists('sections', $donnees)) {
            $this->remplacerStructure($modele, $donnees['sections']);
        }

        $modele->toucher();
        $this->modeleRepository->flush();

        return ['maquette' => $this->serialiserModele($modele)];
    }

    public function supprimer(int $id): void
    {
        $modele = $this->trouver($id);

        if (!$modele->getFichesInstanciees()->isEmpty()) {
            throw new MaquetteUtiliseeException(
                'Cette maquette a déjà servi à générer des fiches bleues, elle ne peut pas être supprimée.',
            );
        }

        $this->modeleRepository->remove($modele, true);
    }

    private function trouver(int $id): FicheBleueModele
    {
        return $this->modeleRepository->find($id)
            ?? throw new MaquetteIntrouvableException('Maquette introuvable.');
    }

    private function extraireDescription(array $donnees): ?string
    {
        $description = $donnees['description'] ?? null;
        if ($description === null) {
            return null;
        }
        $description = trim((string) $description);

        return $description === '' ? null : $description;
    }

    /**
     * Remplace la structure de la maquette par celle du payload : chaque item
     * référence une SectionModele existante (id) ou en crée une nouvelle ;
     * les associations absentes du payload sont retirées (le catalogue, lui,
     * n'est jamais supprimé ici).
     */
    private function remplacerStructure(FicheBleueModele $modele, mixed $sections): void
    {
        if (!is_array($sections)) {
            throw new DonneesInvalidesException('Le champ "sections" doit être une liste.');
        }

        $associationsExistantes = [];
        foreach ($modele->getStructure() as $association) {
            $associationsExistantes[$association->getSectionModele()?->getId()] = $association;
        }

        $conservees = [];
        $position = 0;
        foreach ($sections as $donneesSection) {
            if (!is_array($donneesSection)) {
                throw new DonneesInvalidesException('Chaque section doit être un objet.');
            }
            ++$position;

            $section = $this->synchroniserSection($donneesSection, racine: true, position: $position);
            $ordre = (int) ($donneesSection['ordre'] ?? $position);

            $association = $associationsExistantes[$section->getId()] ?? null;
            if ($association !== null && $section->getId() !== null) {
                $association->setOrdre($ordre);
            } else {
                $association = new FicheBleueModeleSection($section, $ordre);
                $modele->ajouterStructureSection($association);
            }
            $conservees[] = $association;
        }

        foreach ($modele->getStructure()->toArray() as $association) {
            if (!in_array($association, $conservees, true)) {
                $modele->supprimerStructureSection($association);
            }
        }
    }

    /**
     * item avec "id" => met à jour la SectionModele existante ; sans "id" =>
     * en crée une nouvelle. "sous_sections" (si présent) est synchronisé
     * récursivement selon la même règle, les enfants absents sont supprimés.
     */
    private function synchroniserSection(array $donnees, bool $racine, int $position): SectionModele
    {
        if (isset($donnees['id'])) {
            $section = $this->sectionModeleRepository->find((int) $donnees['id'])
                ?? throw new SectionModeleIntrouvableException(sprintf('Section de catalogue #%d introuvable.', (int) $donnees['id']));

            if (array_key_exists('nom', $donnees)) {
                $nom = trim((string) $donnees['nom']);
                if ($nom === '') {
                    throw new DonneesInvalidesException('Le nom d\'une section ne peut pas être vide.');
                }
                $section->setNom($nom);
            }
        } else {
            $nom = trim((string) ($donnees['nom'] ?? ''));
            if ($nom === '') {
                throw new DonneesInvalidesException('Chaque nouvelle section doit avoir un nom.');
            }
            $section = new SectionModele(
                $nom,
                $racine ? TypeSection::PRINCIPALE : TypeSection::SOUS_SECTION,
                (int) ($donnees['ordre'] ?? $position),
            );
            $this->sectionModeleRepository->save($section);
        }

        if (array_key_exists('code', $donnees)) {
            $code = $donnees['code'] !== null ? trim((string) $donnees['code']) : null;
            $section->setCode($code === '' ? null : $code);
        }
        if (array_key_exists('type_section', $donnees)) {
            $section->setTypeSection(
                TypeSection::tryFrom((string) $donnees['type_section'])
                    ?? throw new DonneesInvalidesException(sprintf('Type de section inconnu : "%s".', (string) $donnees['type_section'])),
            );
        }
        if (array_key_exists('ordre', $donnees)) {
            $section->setOrdreParDefaut((int) $donnees['ordre']);
        }
        if (array_key_exists('est_calculee', $donnees)) {
            $section->setEstCalculee((bool) $donnees['est_calculee']);
        }
        if (array_key_exists('formule', $donnees)) {
            $formule = $donnees['formule'] !== null ? trim((string) $donnees['formule']) : null;
            $section->setFormule($formule === '' ? null : $formule);
        }

        $this->validerCalcul($section);

        if (array_key_exists('sous_sections', $donnees)) {
            $this->synchroniserSousSections($section, $donnees['sous_sections']);
        }

        return $section;
    }

    private function synchroniserSousSections(SectionModele $parente, mixed $sousSections): void
    {
        if (!is_array($sousSections)) {
            throw new DonneesInvalidesException('Le champ "sous_sections" doit être une liste.');
        }

        $conservees = [];
        $position = 0;
        foreach ($sousSections as $donneesEnfant) {
            if (!is_array($donneesEnfant)) {
                throw new DonneesInvalidesException('Chaque sous-section doit être un objet.');
            }
            ++$position;

            $enfant = $this->synchroniserSection($donneesEnfant, racine: false, position: $position);
            $parente->ajouterSousSection($enfant);
            $conservees[] = $enfant;
        }

        foreach ($parente->getSousSections()->toArray() as $enfant) {
            if (!in_array($enfant, $conservees, true)) {
                $parente->supprimerSousSection($enfant);
            }
        }
    }

    private function validerCalcul(SectionModele $section): void
    {
        if ($section->estCalculee()) {
            if ($section->getTypeSection() !== TypeSection::PRINCIPALE) {
                throw new DonneesInvalidesException(
                    sprintf('La section "%s" ne peut pas être calculée : seule une section principale peut porter une formule.', $section->getNom()),
                );
            }
            if ($section->getFormule() === null) {
                throw new DonneesInvalidesException(
                    sprintf('La section calculée "%s" doit définir une formule (ex. "I+II-III-IV").', $section->getNom()),
                );
            }
            if (preg_match('/^[+-]?\s*[A-Za-z0-9]+(\s*[+-]\s*[A-Za-z0-9]+)*$/', $section->getFormule()) !== 1) {
                throw new DonneesInvalidesException(
                    sprintf('Formule invalide pour la section "%s" : seuls les codes de sections et les opérateurs + et - sont acceptés.', $section->getNom()),
                );
            }
        } elseif ($section->getFormule() !== null) {
            throw new DonneesInvalidesException(
                sprintf('La section "%s" porte une formule mais n\'est pas marquée comme calculée.', $section->getNom()),
            );
        }
    }

    private function serialiserModele(FicheBleueModele $modele): array
    {
        $sections = [];
        foreach ($modele->getStructure() as $association) {
            $sectionModele = $association->getSectionModele();
            if ($sectionModele === null) {
                continue;
            }
            $sections[] = $this->serialiserSection($sectionModele, $association->getOrdre());
        }
        usort($sections, static fn (array $a, array $b): int => $a['ordre'] <=> $b['ordre']);

        return [
            'id' => $modele->getId(),
            'nom' => $modele->getNom(),
            'description' => $modele->getDescription(),
            'actif' => $modele->isActif(),
            'est_par_defaut' => $modele->estParDefaut(),
            'mis_a_jour_le' => $modele->getMisAJourLe()->format(\DateTimeInterface::ATOM),
            'nb_fiches' => $modele->getFichesInstanciees()->count(),
            'sections' => $sections,
        ];
    }

    private function serialiserSection(SectionModele $section, ?int $ordre = null): array
    {
        return [
            'id' => $section->getId(),
            'code' => $section->getCode(),
            'nom' => $section->getNom(),
            'type_section' => $section->getTypeSection()->value,
            'ordre' => $ordre ?? $section->getOrdreParDefaut(),
            'est_calculee' => $section->estCalculee(),
            'formule' => $section->getFormule(),
            'sous_sections' => array_map(
                fn (SectionModele $enfant): array => $this->serialiserSection($enfant),
                $section->getSousSections()->toArray(),
            ),
        ];
    }
}
