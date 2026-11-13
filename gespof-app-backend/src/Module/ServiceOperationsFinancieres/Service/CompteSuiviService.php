<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\CompteSuivi;
use App\Module\ServiceOperationsFinancieres\Enum\FamilleCompteSuivi;
use App\Module\ServiceOperationsFinancieres\Repository\CompteSuiviRepository;
use App\Module\ServiceOperationsFinancieres\Service\Exception\RubriqueIntrouvableException;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Référentiel comptes douanes / pétrole (Chef SOF).
 */
class CompteSuiviService
{
    private const OBJET_TYPE = 'compte_suivi';

    public function __construct(
        private readonly CompteSuiviRepository $compteSuiviRepository,
        private readonly EntityManagerInterface $em,
        private readonly JournalAuditService $journalAuditService,
        private readonly Security $security,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function lister(): array
    {
        return array_map(
            fn (CompteSuivi $c): array => $this->serialiser($c),
            $this->compteSuiviRepository->listerParOrdre(),
        );
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function creer(array $donnees): array
    {
        $compte = $this->exigerCompte($donnees);
        $nature = $this->exigerNature($donnees);
        if ($this->compteSuiviRepository->trouver($compte, $nature) instanceof CompteSuivi) {
            throw new DonneesInvalidesException(
                sprintf('Le compte « %s » / nature « %s » existe déjà.', $compte, $nature),
            );
        }

        $libelle = $this->exigerLibelle($donnees);
        $famille = $this->parserFamille((string) ($donnees['famille'] ?? ''));
        $type = $this->exigerType($donnees);
        $ordre = isset($donnees['ordre']) ? (int) $donnees['ordre'] : $this->prochainOrdre();
        if ($ordre < 1) {
            throw new DonneesInvalidesException('L\'ordre doit être ≥ 1.');
        }
        $bancaire = $this->parserBool($donnees['bancaire_seulement'] ?? false);

        $entite = new CompteSuivi($compte, $nature, $libelle, $famille, $type, $ordre, $bancaire);
        $this->em->persist($entite);
        $this->em->flush();

        $apres = $this->serialiser($entite);
        $this->journalAuditService->enregistrer(
            'CREER',
            self::OBJET_TYPE,
            $this->cleObjet($compte, $nature),
            $this->acteur(),
            null,
            $apres,
        );

        return $apres;
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrer(string $compte, string $nature, array $donnees): array
    {
        $entite = $this->exiger($compte, $nature);
        $avant = $this->serialiser($entite);

        if (array_key_exists('libelle', $donnees)) {
            $entite->setLibelle($this->exigerLibelle($donnees));
        }
        if (array_key_exists('famille', $donnees)) {
            $entite->setFamille($this->parserFamille((string) $donnees['famille']));
        }
        if (array_key_exists('type', $donnees)) {
            $entite->setType($this->exigerType($donnees));
        }
        if (array_key_exists('bancaire_seulement', $donnees)) {
            $entite->setBancaireSeulement($this->parserBool($donnees['bancaire_seulement']));
        }
        if (array_key_exists('ordre', $donnees)) {
            $ordre = (int) $donnees['ordre'];
            if ($ordre < 1) {
                throw new DonneesInvalidesException('L\'ordre doit être ≥ 1.');
            }
            $entite->setOrdre($ordre);
        }

        $this->em->flush();

        $apres = $this->serialiser($entite);
        $this->journalAuditService->enregistrer(
            'MODIFIER',
            self::OBJET_TYPE,
            $this->cleObjet($compte, $nature),
            $this->acteur(),
            $avant,
            $apres,
        );

        return $apres;
    }

    public function supprimer(string $compte, string $nature): void
    {
        $entite = $this->exiger($compte, $nature);
        $avant = $this->serialiser($entite);
        $this->em->remove($entite);
        $this->em->flush();

        $this->journalAuditService->enregistrer(
            'SUPPRIMER',
            self::OBJET_TYPE,
            $this->cleObjet($compte, $nature),
            $this->acteur(),
            $avant,
            null,
        );
    }

    private function cleObjet(string $compte, string $nature): string
    {
        return $compte.'/'.$nature;
    }

    private function acteur(): ?Utilisateur
    {
        $u = $this->security->getUser();

        return $u instanceof Utilisateur ? $u : null;
    }

    private function prochainOrdre(): int
    {
        $max = $this->em->createQueryBuilder()
            ->select('MAX(c.ordre)')
            ->from(CompteSuivi::class, 'c')
            ->getQuery()
            ->getSingleScalarResult();

        return ((int) $max) + 1;
    }

    private function exiger(string $compte, string $nature): CompteSuivi
    {
        $entite = $this->compteSuiviRepository->trouver($compte, $nature);
        if (!$entite instanceof CompteSuivi) {
            throw new RubriqueIntrouvableException(
                sprintf('Compte « %s » / nature « %s » introuvable.', $compte, $nature),
            );
        }

        return $entite;
    }

    /**
     * @param array<string, mixed> $donnees
     */
    private function exigerCompte(array $donnees): string
    {
        $compte = trim((string) ($donnees['compte'] ?? ''));
        if ($compte === '') {
            throw new DonneesInvalidesException('Le numéro de compte est obligatoire.');
        }
        if (mb_strlen($compte) > 32) {
            throw new DonneesInvalidesException('Le numéro de compte est trop long (32 caractères max).');
        }

        return $compte;
    }

    /**
     * @param array<string, mixed> $donnees
     */
    private function exigerNature(array $donnees): string
    {
        $nature = trim((string) ($donnees['nature'] ?? ''));
        if ($nature === '') {
            throw new DonneesInvalidesException('La nature est obligatoire.');
        }
        if (mb_strlen($nature) > 16) {
            throw new DonneesInvalidesException('La nature est trop longue (16 caractères max).');
        }

        return $nature;
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

    /**
     * @param array<string, mixed> $donnees
     */
    private function exigerType(array $donnees): string
    {
        $type = trim((string) ($donnees['type'] ?? ''));
        if ($type === '') {
            throw new DonneesInvalidesException('Le type est obligatoire.');
        }
        if (mb_strlen($type) > 64) {
            throw new DonneesInvalidesException('Le type est trop long (64 caractères max).');
        }

        return $type;
    }

    private function parserFamille(string $valeur): FamilleCompteSuivi
    {
        $normalise = strtoupper(str_replace([' ', '-'], '_', trim($valeur)));
        $alias = match ($normalise) {
            'DOUANES' => 'DOUANE',
            'PETROL', 'PETROLIER', 'PÉTROLE' => 'PETROLE',
            default => $normalise,
        };
        $famille = FamilleCompteSuivi::tryFrom($alias);
        if ($famille instanceof FamilleCompteSuivi) {
            return $famille;
        }

        throw new DonneesInvalidesException('Famille invalide (DOUANE, PETROLE).');
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

        return in_array($s, ['1', 'true', 'oui', 'yes', 'o'], true);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(CompteSuivi $c): array
    {
        $famille = $c->getFamille();

        return [
            'compte' => $c->getCompte(),
            'nature' => $c->getNature(),
            'libelle' => $c->getLibelle(),
            'famille' => $famille->value,
            'famille_libelle' => $famille->libelle(),
            'type' => $c->getType(),
            'bancaire_seulement' => $c->isBancaireSeulement(),
            'ordre' => $c->getOrdre(),
            'fichier' => $c->getFichier(),
        ];
    }
}
