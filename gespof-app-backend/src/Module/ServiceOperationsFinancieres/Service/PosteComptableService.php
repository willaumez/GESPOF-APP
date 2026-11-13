<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\PosteComptable;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RapAnterieurLot;
use App\Module\ServiceOperationsFinancieres\Enum\CategoriePosteComptable;
use App\Module\ServiceOperationsFinancieres\Repository\PosteComptableRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RapAnterieurLigneRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RapAnterieurLotRepository;
use App\Module\ServiceOperationsFinancieres\Service\Exception\RubriqueIntrouvableException;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Référentiel des postes comptables (Chef SOF).
 */
class PosteComptableService
{
    public function __construct(
        private readonly PosteComptableRepository $posteComptableRepository,
        private readonly RapAnterieurLotRepository $rapAnterieurLotRepository,
        private readonly RapAnterieurLigneRepository $rapAnterieurLigneRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function lister(): array
    {
        $observeesParPoste = $this->categoriesObserveesDepuisDernierLot();

        return array_map(
            fn (PosteComptable $p): array => $this->serialiser($p, $observeesParPoste[$p->getCode()] ?? null),
            $this->posteComptableRepository->listerParCode(),
        );
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function creer(array $donnees): array
    {
        $code = $this->exigerCode($donnees);
        if ($this->posteComptableRepository->trouverParCode($code) instanceof PosteComptable) {
            throw new DonneesInvalidesException(sprintf('Le poste « %s » existe déjà.', $code));
        }

        $libelle = $this->exigerLibelle($donnees);
        $categorie = $this->parserCategorie((string) (
            $donnees['categorie_defaut'] ?? $donnees['categorie'] ?? ''
        ));

        $entite = new PosteComptable($code, $libelle, $categorie);
        $this->em->persist($entite);
        $this->em->flush();

        return $this->serialiser($entite);
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrer(string $code, array $donnees): array
    {
        $entite = $this->exiger($code);

        if (array_key_exists('libelle', $donnees)) {
            $entite->setLibelle($this->exigerLibelle($donnees));
        }
        if (array_key_exists('categorie_defaut', $donnees) || array_key_exists('categorie', $donnees)) {
            $entite->setCategorieDefaut($this->parserCategorie((string) (
                $donnees['categorie_defaut'] ?? $donnees['categorie'] ?? ''
            )));
        }

        $this->em->flush();

        return $this->serialiser($entite);
    }

    public function supprimer(string $code): void
    {
        $entite = $this->exiger($code);
        $this->em->remove($entite);
        $this->em->flush();
    }

    private function exiger(string $code): PosteComptable
    {
        $entite = $this->posteComptableRepository->trouverParCode($code);
        if (!$entite instanceof PosteComptable) {
            throw new RubriqueIntrouvableException(sprintf('Poste comptable « %s » introuvable.', $code));
        }

        return $entite;
    }

    /**
     * @param array<string, mixed> $donnees
     */
    private function exigerCode(array $donnees): string
    {
        $code = strtoupper(trim((string) ($donnees['code'] ?? '')));
        if ($code === '') {
            throw new DonneesInvalidesException('Le code du poste est obligatoire.');
        }
        if (mb_strlen($code) > 16) {
            throw new DonneesInvalidesException('Le code du poste est trop long (16 caractères max).');
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

    private function parserCategorie(string $valeur): CategoriePosteComptable
    {
        $normalise = strtoupper(trim($valeur));
        $categorie = CategoriePosteComptable::tryFrom($normalise);
        if ($categorie instanceof CategoriePosteComptable) {
            return $categorie;
        }

        throw new DonneesInvalidesException('Catégorie invalide (TPG, AGC, ENT).');
    }

    /**
     * Agrège C_CATEG × poste depuis le dernier lot RAP antérieurs (proxy XRAV tant que dc-xrav n'est pas branché).
     *
     * @return array<string, string> code poste → "ENT:n|TPG:n"
     */
    private function categoriesObserveesDepuisDernierLot(): array
    {
        /** @var RapAnterieurLot|null $lot */
        $lot = $this->rapAnterieurLotRepository->createQueryBuilder('l')
            ->orderBy('l.importeLe', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        if (!$lot instanceof RapAnterieurLot || $lot->getId() === null) {
            return [];
        }

        /** @var list<array{poste: ?string, categ: ?string, n: string}> $rows */
        $rows = $this->rapAnterieurLigneRepository->createQueryBuilder('lig')
            ->select('lig.poste AS poste, lig.cCateg AS categ, COUNT(lig.id) AS n')
            ->andWhere('lig.lot = :lot')
            ->setParameter('lot', $lot->getId())
            ->groupBy('lig.poste')
            ->addGroupBy('lig.cCateg')
            ->getQuery()
            ->getArrayResult();

        $agg = [];
        foreach ($rows as $row) {
            $poste = trim((string) ($row['poste'] ?? ''));
            $categ = strtoupper(trim((string) ($row['categ'] ?? '')));
            if ($poste === '' || $categ === '') {
                continue;
            }
            $agg[$poste][$categ] = (int) $row['n'];
        }

        $out = [];
        foreach ($agg as $poste => $cats) {
            ksort($cats);
            $parts = [];
            foreach ($cats as $c => $n) {
                $parts[] = sprintf('%s:%d', $c, $n);
            }
            $out[$poste] = implode('|', $parts);
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(PosteComptable $p, ?string $observeesCalculees = null): array
    {
        $categorie = $p->getCategorieDefaut();
        $observees = $observeesCalculees ?? $p->getCategoriesObservees();

        return [
            'code' => $p->getCode(),
            'libelle' => $p->getLibelle(),
            'categorie_defaut' => $categorie->value,
            'categorie_defaut_libelle' => $categorie->libelle(),
            // Compat API
            'categorie' => $categorie->value,
            'categorie_libelle' => $categorie->libelle(),
            'categories_observees' => $observees,
        ];
    }
}
