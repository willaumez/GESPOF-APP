<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Audit\JournalAudit;
use App\Module\ServiceOperationsFinancieres\Repository\JournalAuditRepository;
use App\Shared\Entite\Utilisateur;

/**
 * Écriture / lecture du journal d'audit métier SOF.
 */
class JournalAuditService
{
    public function __construct(
        private readonly JournalAuditRepository $journalAuditRepository,
    ) {
    }

    /**
     * @param array<string, mixed>|null $avant
     * @param array<string, mixed>|null $apres
     */
    public function enregistrer(
        string $action,
        string $objetType,
        string $objetId,
        ?Utilisateur $utilisateur = null,
        ?array $avant = null,
        ?array $apres = null,
    ): JournalAudit {
        $entree = new JournalAudit(
            action: mb_substr(trim($action), 0, 64),
            objetType: mb_substr(trim($objetType), 0, 64),
            objetId: mb_substr(trim($objetId), 0, 128),
            utilisateur: $utilisateur,
            avant: $avant,
            apres: $apres,
        );
        $this->journalAuditRepository->save($entree, true);

        return $entree;
    }

    /**
     * @return array{entrees: list<array<string, mixed>>, total: int, page: int, limit: int}
     */
    public function lister(
        ?string $objetType = null,
        ?string $objetId = null,
        ?string $action = null,
        ?int $utilisateurId = null,
        int $page = 1,
        int $limit = 50,
    ): array {
        $resultat = $this->journalAuditRepository->listerPagine(
            $objetType,
            $objetId,
            $action,
            $utilisateurId,
            $page,
            $limit,
        );

        return [
            'entrees' => array_map(
                fn (JournalAudit $e): array => $this->serialiser($e),
                $resultat['entrees'],
            ),
            'total' => $resultat['total'],
            'page' => max(1, $page),
            'limit' => max(1, min(200, $limit)),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serialiser(JournalAudit $e): array
    {
        $u = $e->getUtilisateur();

        return [
            'id' => $e->getId(),
            'horodatage' => $e->getHorodatage()->format(\DateTimeInterface::ATOM),
            'utilisateur_id' => $u?->getId(),
            'matricule' => $e->getMatricule(),
            'utilisateur_nom' => $u !== null
                ? trim($u->getPrenom().' '.$u->getNom())
                : null,
            'action' => $e->getAction(),
            'objet_type' => $e->getObjetType(),
            'objet_id' => $e->getObjetId(),
            'avant' => $e->getAvant(),
            'apres' => $e->getApres(),
        ];
    }
}
