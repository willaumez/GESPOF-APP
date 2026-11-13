<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\CodeTofe;
use App\Module\ServiceOperationsFinancieres\Repository\CodeTofeRepository;
use App\Module\ServiceOperationsFinancieres\Service\Exception\RubriqueIntrouvableException;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Référentiel des codes TOFE (Chef SOF).
 */
class CodeTofeService
{
    public function __construct(
        private readonly CodeTofeRepository $codeTofeRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function lister(): array
    {
        return array_map(
            fn (CodeTofe $c): array => $this->serialiser($c),
            $this->codeTofeRepository->listerParCode(),
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
        if ($this->codeTofeRepository->findByCode($code) instanceof CodeTofe) {
            throw new DonneesInvalidesException(sprintf('Le code TOFE « %s » existe déjà.', $code));
        }

        $libelle = $this->exigerLibelle($donnees);
        $entite = new CodeTofe($code, $libelle);
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
        $entite->setLibelle($this->exigerLibelle($donnees));
        $this->em->flush();

        return $this->serialiser($entite);
    }

    public function supprimer(string $code): void
    {
        $entite = $this->exiger($code);
        $this->em->remove($entite);
        $this->em->flush();
    }

    private function exiger(string $code): CodeTofe
    {
        $entite = $this->codeTofeRepository->findByCode($code);
        if (!$entite instanceof CodeTofe) {
            throw new RubriqueIntrouvableException(sprintf('Code TOFE « %s » introuvable.', $code));
        }

        return $entite;
    }

    /**
     * @param array<string, mixed> $donnees
     */
    private function exigerCode(array $donnees): string
    {
        $brut = trim((string) ($donnees['code'] ?? ''));
        if ($brut === '') {
            throw new DonneesInvalidesException('Le code TOFE est obligatoire.');
        }
        // Accepte « 11 » ou « 11.Impôt… » (préfixe numérique du classeur).
        if (preg_match('/^(\d{1,2})\b/', $brut, $m) !== 1) {
            throw new DonneesInvalidesException('Le code TOFE doit être un entier entre 1 et 99.');
        }
        $n = (int) $m[1];
        if ($n < 1 || $n > 99) {
            throw new DonneesInvalidesException('Le code TOFE doit être un entier entre 1 et 99.');
        }

        return (string) $n;
    }

    /**
     * @param array<string, mixed> $donnees
     */
    private function exigerLibelle(array $donnees): string
    {
        $libelle = trim((string) ($donnees['libelle'] ?? ''));
        if ($libelle === '') {
            throw new DonneesInvalidesException('La rubrique TOFE est obligatoire.');
        }
        if (mb_strlen($libelle) > 255) {
            throw new DonneesInvalidesException('La rubrique TOFE est trop longue (255 caractères max).');
        }

        return $libelle;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(CodeTofe $c): array
    {
        return [
            'code' => $c->getCode(),
            'libelle' => $c->getLibelle(),
        ];
    }
}
