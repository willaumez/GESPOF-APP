<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\SocietePetroliere;
use App\Module\ServiceOperationsFinancieres\Repository\SocietePetroliereRepository;
use App\Module\ServiceOperationsFinancieres\Service\Exception\RubriqueIntrouvableException;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Référentiel des sociétés pétrolières (Chef SOF).
 */
class SocietePetroliereService
{
    public function __construct(
        private readonly SocietePetroliereRepository $societePetroliereRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function lister(): array
    {
        return array_map(
            fn (SocietePetroliere $s): array => $this->serialiser($s),
            $this->societePetroliereRepository->listerParMatricule(),
        );
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function creer(array $donnees): array
    {
        $matricule = $this->exigerMatricule($donnees);
        if ($this->societePetroliereRepository->trouverParMatricule($matricule) instanceof SocietePetroliere) {
            throw new DonneesInvalidesException(sprintf('Le matricule « %s » existe déjà.', $matricule));
        }

        $nom = $this->exigerNom($donnees);
        $champNif = $this->parserChampNif($donnees['champ_nif'] ?? null);
        $redevance = array_key_exists('redevance_sup_min', $donnees)
            ? $this->parserRedevance($donnees['redevance_sup_min'])
            : null;
        $petrole = $this->parserBool($donnees['petrole'] ?? true);

        $entite = new SocietePetroliere($matricule, $nom, $champNif, $redevance, $petrole);
        $this->em->persist($entite);
        $this->em->flush();

        return $this->serialiser($entite);
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrer(string $matricule, array $donnees): array
    {
        $entite = $this->exiger($matricule);

        if (array_key_exists('nom', $donnees)) {
            $entite->setNom($this->exigerNom($donnees));
        }
        if (array_key_exists('champ_nif', $donnees)) {
            $entite->setChampNif($this->parserChampNif($donnees['champ_nif']));
        }
        if (array_key_exists('redevance_sup_min', $donnees)) {
            $entite->setRedevanceSupMin($this->parserRedevance($donnees['redevance_sup_min']));
        }
        if (array_key_exists('petrole', $donnees)) {
            $entite->setPetrole($this->parserBool($donnees['petrole']));
        }

        $this->em->flush();

        return $this->serialiser($entite);
    }

    public function supprimer(string $matricule): void
    {
        $entite = $this->exiger($matricule);
        $this->em->remove($entite);
        $this->em->flush();
    }

    private function exiger(string $matricule): SocietePetroliere
    {
        $entite = $this->societePetroliereRepository->trouverParMatricule($matricule);
        if (!$entite instanceof SocietePetroliere) {
            throw new RubriqueIntrouvableException(sprintf('Société « %s » introuvable.', $matricule));
        }

        return $entite;
    }

    /**
     * @param array<string, mixed> $donnees
     */
    private function exigerMatricule(array $donnees): string
    {
        $matricule = trim((string) ($donnees['matricule'] ?? ''));
        if ($matricule === '') {
            throw new DonneesInvalidesException('Le matricule est obligatoire.');
        }
        if (mb_strlen($matricule) > 32) {
            throw new DonneesInvalidesException('Le matricule est trop long (32 caractères max).');
        }

        return $matricule;
    }

    /**
     * @param array<string, mixed> $donnees
     */
    private function exigerNom(array $donnees): string
    {
        $nom = trim((string) ($donnees['nom'] ?? ''));
        if ($nom === '') {
            throw new DonneesInvalidesException('Le nom de la société est obligatoire.');
        }
        if (mb_strlen($nom) > 255) {
            throw new DonneesInvalidesException('Le nom est trop long (255 caractères max).');
        }

        return $nom;
    }

    private function parserChampNif(mixed $valeur): ?string
    {
        if ($valeur === null) {
            return null;
        }
        $t = trim((string) $valeur);
        if ($t === '') {
            return null;
        }
        if (mb_strlen($t) > 64) {
            throw new DonneesInvalidesException('Le champ / NIF est trop long (64 caractères max).');
        }

        return $t;
    }

    private function parserRedevance(mixed $brut): ?string
    {
        if ($brut === null) {
            return null;
        }
        if (is_int($brut) || is_float($brut)) {
            return number_format((float) $brut, 2, '.', '');
        }
        $s = trim((string) $brut);
        if ($s === '') {
            return null;
        }
        $s = str_replace(["\u{202f}", ' ', ','], ['', '', '.'], $s);
        if (!is_numeric($s)) {
            throw new DonneesInvalidesException('La redevance superficiaire minimale est invalide.');
        }
        if ((float) $s < 0) {
            throw new DonneesInvalidesException('La redevance superficiaire minimale doit être ≥ 0.');
        }

        return number_format((float) $s, 2, '.', '');
    }

    private function parserBool(mixed $valeur): bool
    {
        if (is_bool($valeur)) {
            return $valeur;
        }
        if (is_int($valeur) || is_float($valeur)) {
            return (bool) $valeur;
        }
        $s = strtolower(trim((string) $valeur));

        return in_array($s, ['1', 'true', 'oui', 'yes', 'o', 'petrole', 'pétrole'], true);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(SocietePetroliere $s): array
    {
        return [
            'matricule' => $s->getMatricule(),
            'nom' => $s->getNom(),
            'champ_nif' => $s->getChampNif(),
            'redevance_sup_min' => $s->getRedevanceSupMin(),
            'petrole' => $s->isPetrole(),
            'perimetre' => $s->isPetrole() ? 'Pétrole' : 'Hors pétrole',
        ];
    }
}
