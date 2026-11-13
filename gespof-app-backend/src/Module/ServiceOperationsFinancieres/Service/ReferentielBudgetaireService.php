<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RubriqueDepense;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\RubriqueRecette;
use App\Module\ServiceOperationsFinancieres\Enum\NatureDepense;
use App\Module\ServiceOperationsFinancieres\Enum\SectionRecette;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueDepenseRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueRecetteRepository;
use App\Module\ServiceOperationsFinancieres\Service\Exception\RubriqueIntrouvableException;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Consultation / édition du référentiel budgétaire SOF (nomenclature).
 * Les exercices sont gérés par ExerciceService.
 */
class ReferentielBudgetaireService
{
    public function __construct(
        private readonly RubriqueRecetteRepository $rubriqueRecetteRepository,
        private readonly RubriqueDepenseRepository $rubriqueDepenseRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function arbreRubriquesRecettes(): array
    {
        return array_map(
            fn (RubriqueRecette $r): array => $this->serialiserRubriqueRecette($r),
            $this->rubriqueRecetteRepository->findRacines(),
        );
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function arbreRubriquesDepenses(): array
    {
        return array_map(
            fn (RubriqueDepense $r): array => $this->serialiserRubriqueDepense($r),
            $this->rubriqueDepenseRepository->findRacines(),
        );
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function creerRubriqueRecette(array $donnees): array
    {
        $code = $this->exigerCode($donnees);
        if ($this->rubriqueRecetteRepository->findByCode($code) instanceof RubriqueRecette) {
            throw new DonneesInvalidesException(sprintf('Le code « %s » existe déjà.', $code));
        }

        $libelle = $this->exigerLibelle($donnees);
        $parent = $this->resoudreParentRecette($donnees['parent_code'] ?? null);
        $section = $parent instanceof RubriqueRecette
            ? $parent->getSection()
            : $this->parserSection((string) ($donnees['section'] ?? ''));

        $ordre = isset($donnees['ordre']) ? (int) $donnees['ordre'] : $this->prochainOrdreRecette($parent);
        $codeTofe = array_key_exists('code_tofe', $donnees)
            ? ($donnees['code_tofe'] !== null && trim((string) $donnees['code_tofe']) !== ''
                ? trim((string) $donnees['code_tofe'])
                : null)
            : null;
        $actif = array_key_exists('actif', $donnees) ? (bool) $donnees['actif'] : true;

        $rubrique = new RubriqueRecette(
            $code,
            $libelle,
            $section,
            $parent,
            false,
            $ordre,
            $codeTofe,
            $actif,
        );
        $this->em->persist($rubrique);
        $this->em->flush();

        return $this->serialiserRubriqueRecette($rubrique, false);
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function creerRubriqueDepense(array $donnees): array
    {
        $code = $this->exigerCode($donnees);
        if ($this->rubriqueDepenseRepository->findByCode($code) instanceof RubriqueDepense) {
            throw new DonneesInvalidesException(sprintf('Le code « %s » existe déjà.', $code));
        }

        $libelle = $this->exigerLibelle($donnees);
        $parent = $this->resoudreParentDepense($donnees['parent_code'] ?? null);
        $nature = $parent instanceof RubriqueDepense
            ? $parent->getNature()
            : $this->parserNature((string) ($donnees['nature'] ?? ''));

        $ordre = isset($donnees['ordre']) ? (int) $donnees['ordre'] : $this->prochainOrdreDepense($parent);
        $codeTofe = array_key_exists('code_tofe', $donnees)
            ? ($donnees['code_tofe'] !== null && trim((string) $donnees['code_tofe']) !== ''
                ? trim((string) $donnees['code_tofe'])
                : null)
            : null;
        $actif = array_key_exists('actif', $donnees) ? (bool) $donnees['actif'] : true;

        $rubrique = new RubriqueDepense(
            $code,
            $libelle,
            $nature,
            $parent,
            false,
            $ordre,
            $codeTofe,
            $actif,
        );
        $this->em->persist($rubrique);
        $this->em->flush();

        return $this->serialiserRubriqueDepense($rubrique, false);
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrerRubriqueRecette(string $code, array $donnees): array
    {
        $rubrique = $this->rubriqueRecetteRepository->findByCode($code);
        if (!$rubrique instanceof RubriqueRecette) {
            throw new RubriqueIntrouvableException(sprintf('Rubrique de recette « %s » introuvable.', $code));
        }

        $this->appliquerChampsCommuns($rubrique, $donnees);
        $this->em->flush();

        return $this->serialiserRubriqueRecette($rubrique, false);
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrerRubriqueDepense(string $code, array $donnees): array
    {
        $rubrique = $this->rubriqueDepenseRepository->findByCode($code);
        if (!$rubrique instanceof RubriqueDepense) {
            throw new RubriqueIntrouvableException(sprintf('Rubrique de dépense « %s » introuvable.', $code));
        }

        $this->appliquerChampsCommuns($rubrique, $donnees);
        $this->em->flush();

        return $this->serialiserRubriqueDepense($rubrique, false);
    }

    /**
     * Réordonne les frères d'un même parent (codes dans le nouvel ordre).
     *
     * @param list<string> $codes
     *
     * @return list<array<string, mixed>>
     */
    public function reordonnerRubriquesRecettes(?string $parentCode, array $codes): array
    {
        $parent = $this->resoudreParentRecette($parentCode);
        $freres = $parent instanceof RubriqueRecette
            ? $parent->getEnfants()->toArray()
            : $this->rubriqueRecetteRepository->findRacines();

        return $this->appliquerOrdre(
            $freres,
            $codes,
            fn (RubriqueRecette $r): array => $this->serialiserRubriqueRecette($r, false),
        );
    }

    /**
     * @param list<string> $codes
     *
     * @return list<array<string, mixed>>
     */
    public function reordonnerRubriquesDepenses(?string $parentCode, array $codes): array
    {
        $parent = $this->resoudreParentDepense($parentCode);
        $freres = $parent instanceof RubriqueDepense
            ? $parent->getEnfants()->toArray()
            : $this->rubriqueDepenseRepository->findRacines();

        return $this->appliquerOrdre(
            $freres,
            $codes,
            fn (RubriqueDepense $r): array => $this->serialiserRubriqueDepense($r, false),
        );
    }

    /**
     * @param list<object>                  $freres
     * @param list<string>                  $codes
     * @param callable(object): array       $serialiser
     *
     * @return list<array<string, mixed>>
     */
    private function appliquerOrdre(array $freres, array $codes, callable $serialiser): array
    {
        if ($codes === []) {
            throw new DonneesInvalidesException('La liste des codes est vide.');
        }

        /** @var array<string, object> $parCode */
        $parCode = [];
        foreach ($freres as $f) {
            /** @var RubriqueRecette|RubriqueDepense $f */
            $parCode[$f->getCode()] = $f;
        }

        if (count($codes) !== count($parCode) || count(array_unique($codes)) !== count($codes)) {
            throw new DonneesInvalidesException(
                'La liste doit contenir exactement tous les frères, sans doublon.',
            );
        }

        foreach ($codes as $code) {
            if (!isset($parCode[$code])) {
                throw new DonneesInvalidesException(
                    sprintf('Le code « %s » n\'appartient pas à ce niveau.', $code),
                );
            }
        }

        foreach ($codes as $i => $code) {
            /** @var RubriqueRecette|RubriqueDepense $rubrique */
            $rubrique = $parCode[$code];
            $rubrique->setOrdre($i + 1);
        }
        $this->em->flush();

        return array_map(
            fn (string $code): array => $serialiser($parCode[$code]),
            $codes,
        );
    }

    /**
     * @param array<string, mixed> $donnees
     */
    private function exigerCode(array $donnees): string
    {
        $code = strtoupper(trim((string) ($donnees['code'] ?? '')));
        if ($code === '') {
            throw new DonneesInvalidesException('Le code est obligatoire.');
        }
        if (mb_strlen($code) > 10) {
            throw new DonneesInvalidesException('Le code est trop long (10 caractères max).');
        }
        if (!preg_match('/^[A-Z0-9_]+$/', $code)) {
            throw new DonneesInvalidesException('Le code ne doit contenir que A–Z, 0–9 et _.');
        }

        return $code;
    }

    /**
     * @param array<string, mixed> $donnees
     */
    private function exigerLibelle(array $donnees): string
    {
        $libelle = trim((string) ($donnees['libelle'] ?? ''));
        if ($libelle === '') {
            throw new DonneesInvalidesException('Le libellé est obligatoire.');
        }
        if (mb_strlen($libelle) > 255) {
            throw new DonneesInvalidesException('Le libellé est trop long (255 caractères max).');
        }

        return $libelle;
    }

    private function resoudreParentRecette(mixed $parentCode): ?RubriqueRecette
    {
        if ($parentCode === null || $parentCode === '') {
            return null;
        }
        $parent = $this->rubriqueRecetteRepository->findByCode(trim((string) $parentCode));
        if (!$parent instanceof RubriqueRecette) {
            throw new RubriqueIntrouvableException(
                sprintf('Parent « %s » introuvable.', (string) $parentCode),
            );
        }

        return $parent;
    }

    private function resoudreParentDepense(mixed $parentCode): ?RubriqueDepense
    {
        if ($parentCode === null || $parentCode === '') {
            return null;
        }
        $parent = $this->rubriqueDepenseRepository->findByCode(trim((string) $parentCode));
        if (!$parent instanceof RubriqueDepense) {
            throw new RubriqueIntrouvableException(
                sprintf('Parent « %s » introuvable.', (string) $parentCode),
            );
        }

        return $parent;
    }

    private function prochainOrdreRecette(?RubriqueRecette $parent): int
    {
        $freres = $parent instanceof RubriqueRecette
            ? $parent->getEnfants()->toArray()
            : $this->rubriqueRecetteRepository->findRacines();
        $max = 0;
        foreach ($freres as $f) {
            $max = max($max, $f->getOrdre());
        }

        return $max + 1;
    }

    private function prochainOrdreDepense(?RubriqueDepense $parent): int
    {
        $freres = $parent instanceof RubriqueDepense
            ? $parent->getEnfants()->toArray()
            : $this->rubriqueDepenseRepository->findRacines();
        $max = 0;
        foreach ($freres as $f) {
            $max = max($max, $f->getOrdre());
        }

        return $max + 1;
    }

    private function parserSection(string $valeur): SectionRecette
    {
        $section = SectionRecette::tryFrom(trim($valeur));
        if ($section instanceof SectionRecette) {
            return $section;
        }

        throw new DonneesInvalidesException('Section invalide pour une rubrique racine.');
    }

    private function parserNature(string $valeur): NatureDepense
    {
        $nature = NatureDepense::tryFrom(trim($valeur));
        if ($nature instanceof NatureDepense) {
            return $nature;
        }

        throw new DonneesInvalidesException('Nature invalide pour une rubrique racine.');
    }

    /**
     * @param RubriqueRecette|RubriqueDepense $rubrique
     * @param array<string, mixed>            $donnees
     */
    private function appliquerChampsCommuns(object $rubrique, array $donnees): void
    {
        if (array_key_exists('libelle', $donnees)) {
            $libelle = trim((string) $donnees['libelle']);
            if ($libelle === '') {
                throw new DonneesInvalidesException('Le libellé est obligatoire.');
            }
            if (mb_strlen($libelle) > 255) {
                throw new DonneesInvalidesException('Le libellé est trop long (255 caractères max).');
            }
            $rubrique->setLibelle($libelle);
        }

        if (array_key_exists('ordre', $donnees)) {
            $ordre = (int) $donnees['ordre'];
            if ($ordre < 0) {
                throw new DonneesInvalidesException('L\'ordre d\'affichage doit être ≥ 0.');
            }
            $rubrique->setOrdre($ordre);
        }

        if (array_key_exists('code_tofe', $donnees)) {
            $rubrique->setCodeTofe(
                $donnees['code_tofe'] === null ? null : (string) $donnees['code_tofe'],
            );
        }

        if (array_key_exists('actif', $donnees)) {
            $rubrique->setActif((bool) $donnees['actif']);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserRubriqueRecette(RubriqueRecette $rubrique, bool $avecEnfants = true): array
    {
        $base = [
            'code' => $rubrique->getCode(),
            'libelle' => $rubrique->getLibelle(),
            'niveau' => $rubrique->getNiveau(),
            'niveau_libelle' => $this->libelleNiveau($rubrique->getNiveau()),
            'ordre' => $rubrique->getOrdre(),
            'code_tofe' => $rubrique->getCodeTofe(),
            'actif' => $rubrique->isActif(),
            'section' => $rubrique->getSection()->value,
            'section_libelle' => $rubrique->getSection()->libelle(),
            'code_synthetique' => $rubrique->isCodeSynthetique(),
            'est_racine' => $rubrique->estRacine(),
            'parent_code' => $rubrique->getParent()?->getCode(),
            'parent_libelle' => $rubrique->getParent()?->getLibelle(),
        ];

        if (!$avecEnfants) {
            return $base;
        }

        $base['enfants'] = array_map(
            fn (RubriqueRecette $enfant): array => $this->serialiserRubriqueRecette($enfant),
            $rubrique->getEnfants()->toArray(),
        );

        return $base;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserRubriqueDepense(RubriqueDepense $rubrique, bool $avecEnfants = true): array
    {
        $base = [
            'code' => $rubrique->getCode(),
            'libelle' => $rubrique->getLibelle(),
            'niveau' => $rubrique->getNiveau(),
            'niveau_libelle' => $this->libelleNiveau($rubrique->getNiveau()),
            'ordre' => $rubrique->getOrdre(),
            'code_tofe' => $rubrique->getCodeTofe(),
            'actif' => $rubrique->isActif(),
            'nature' => $rubrique->getNature()->value,
            'nature_libelle' => $rubrique->getNature()->libelle(),
            'code_synthetique' => $rubrique->isCodeSynthetique(),
            'code_synthese' => $rubrique->getCodeSynthese(),
            // Compat
            'code_exclusion' => $rubrique->getCodeSynthese(),
            'est_racine' => $rubrique->estRacine(),
            'parent_code' => $rubrique->getParent()?->getCode(),
            'parent_libelle' => $rubrique->getParent()?->getLibelle(),
        ];

        if (!$avecEnfants) {
            return $base;
        }

        $base['enfants'] = array_map(
            fn (RubriqueDepense $enfant): array => $this->serialiserRubriqueDepense($enfant),
            $rubrique->getEnfants()->toArray(),
        );

        return $base;
    }

    private function libelleNiveau(int $niveau): string
    {
        return match ($niveau) {
            1 => 'Titre',
            2 => 'Chapitre',
            3 => 'Article',
            default => 'Paragraphe',
        };
    }
}
