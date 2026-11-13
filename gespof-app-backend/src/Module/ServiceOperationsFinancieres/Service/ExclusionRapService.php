<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\ExclusionRap;
use App\Module\ServiceOperationsFinancieres\Repository\ExclusionRapRepository;
use App\Module\ServiceOperationsFinancieres\Service\Exception\RubriqueIntrouvableException;
use App\Module\ServiceOperationsFinancieres\Support\CalculRapFiltres;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

class ExclusionRapService
{
    public function __construct(
        private readonly ExclusionRapRepository $repository,
        private readonly EntityManagerInterface $em,
        private readonly CalculRapService $calculRapService,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function lister(?string $type = null): array
    {
        $this->assurerNatureFixe();

        return array_map(
            fn (ExclusionRap $e): array => $this->serialiser($e),
            $this->repository->lister($type),
        );
    }

    /**
     * @return array{regles_fixes: list<array<string, mixed>>, natures: list<array<string, mixed>>}
     */
    public function meta(): array
    {
        $this->assurerNatureFixe();

        return [
            'regles_fixes' => $this->calculRapService->reglesFixes(),
            'natures' => array_map(
                fn (ExclusionRap $e): array => $this->serialiser($e),
                $this->repository->lister('NATURE'),
            ),
        ];
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function creer(array $donnees): array
    {
        $type = strtoupper(trim((string) ($donnees['type'] ?? '')));
        $code = trim((string) ($donnees['code'] ?? ''));
        // NATURE en lecture seule (règle fixe) — création réservée ORDONNANCE | MDR.
        if (!in_array($type, ['ORDONNANCE', 'MDR'], true) || $code === '') {
            throw new DonneesInvalidesException('Type (ORDONNANCE|MDR) et code obligatoires.');
        }

        $entite = new ExclusionRap($type, $code);
        $entite->setLibelle(isset($donnees['libelle']) ? (string) $donnees['libelle'] : null);
        $entite->setMotif(isset($donnees['motif']) ? (string) $donnees['motif'] : null);
        $entite->setAuteur(isset($donnees['auteur']) ? (string) $donnees['auteur'] : null);
        $entite->setPortee(
            $type === 'MDR' ? 'RAP_MODE_BOP' : (isset($donnees['portee']) ? (string) $donnees['portee'] : 'TOUTES'),
        );
        if (!empty($donnees['date_exclusion'])) {
            $entite->setDateExclusion(new \DateTimeImmutable((string) $donnees['date_exclusion']));
        } else {
            $entite->setDateExclusion(new \DateTimeImmutable('today'));
        }

        $this->em->persist($entite);
        $this->em->flush();

        return $this->serialiser($entite);
    }

    public function supprimer(int $id, ?string $motif = null): void
    {
        $entite = $this->repository->find($id);
        if (!$entite instanceof ExclusionRap) {
            throw new RubriqueIntrouvableException(sprintf('Exclusion RAP #%d introuvable.', $id));
        }
        if ($entite->getType() === 'NATURE') {
            throw new DonneesInvalidesException(
                'Les natures exclues sont en lecture seule (règle Methods.donnees_rap).',
            );
        }
        if ($motif !== null && $motif !== '') {
            $entite->setMotif($motif);
            $this->em->flush();
        }
        $this->em->remove($entite);
        $this->em->flush();
    }

    private function assurerNatureFixe(): void
    {
        foreach ($this->repository->lister('NATURE') as $e) {
            if (strcasecmp($e->getCode(), CalculRapFiltres::NATURE_EXCLUE_AVANT_BOP) === 0) {
                if ($e->getPortee() !== 'RAP_AVANT_BOP') {
                    $e->setPortee('RAP_AVANT_BOP');
                    $this->em->flush();
                }

                return;
            }
        }

        $entite = new ExclusionRap('NATURE', CalculRapFiltres::NATURE_EXCLUE_AVANT_BOP);
        $entite->setLibelle('Cotisations internationales');
        $entite->setMotif('Methods.donnees_rap — RAP avant BOP uniquement');
        $entite->setPortee('RAP_AVANT_BOP');
        $entite->setAuteur('SYSTEME');
        $entite->setDateExclusion(new \DateTimeImmutable('today'));
        $this->em->persist($entite);
        $this->em->flush();
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(ExclusionRap $e): array
    {
        return [
            'id' => $e->getId(),
            'type' => $e->getType(),
            'code' => $e->getCode(),
            'libelle' => $e->getLibelle(),
            'motif' => $e->getMotif(),
            'date_exclusion' => $e->getDateExclusion()?->format('Y-m-d'),
            'auteur' => $e->getAuteur(),
            'portee' => $e->getPortee(),
            'lecture_seule' => $e->getType() === 'NATURE',
        ];
    }
}
