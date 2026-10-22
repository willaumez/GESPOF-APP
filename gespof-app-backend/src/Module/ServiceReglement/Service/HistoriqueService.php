<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service;

use App\Module\ServiceReglement\Entite\HistoriqueFiche;
use App\Module\ServiceReglement\Repository\HistoriqueFicheRepository;
use App\Module\ServiceReglement\Service\Exception\DateInvalideException;
use App\Module\ServiceReglement\Service\Exception\HistoriqueIntrouvableException;
use App\Module\ServiceReglement\Service\HistoriqueServiceInterface;

class HistoriqueService implements HistoriqueServiceInterface
{
    public function __construct(
        private readonly HistoriqueFicheRepository $historiqueRepository,
    ) {
    }

    public function lister(?string $dateDebut, ?string $dateFin, ?int $utilisateurId, int $page, string $limitRaw): array
    {
        $debut = $this->parseDate($dateDebut, 'date_debut');
        $finExclusive = $this->parseDate($dateFin, 'date_fin')?->modify('+1 day');

        $page = max(1, $page);
        $limitRaw = trim($limitRaw);
        $toutAfficher = $limitRaw === 'all';
        $limit = $toutAfficher ? 0 : max(1, (int) $limitRaw);

        $resultat = $this->historiqueRepository->listerPagine(
            $debut,
            $finExclusive,
            $utilisateurId,
            $page,
            $limit,
            $toutAfficher,
        );

        $total = $resultat['total'];
        $totalPages = $toutAfficher ? 1 : max(1, (int) ceil($total / $limit));
        $page = $toutAfficher ? 1 : min($page, $totalPages);

        return [
            'historique' => array_map(
                static fn (HistoriqueFiche $h): array => self::serialiser($h),
                $resultat['historique'],
            ),
            'pagination' => [
                'page' => $page,
                'limit' => $toutAfficher ? $total : $limit,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ];
    }

    public function supprimer(int $id): void
    {
        $historique = $this->historiqueRepository->find($id);
        if ($historique === null) {
            throw new HistoriqueIntrouvableException('Entrée d\'historique introuvable.');
        }

        $this->historiqueRepository->remove($historique, true);
    }

    private static function serialiser(HistoriqueFiche $h): array
    {
        return [
            'id' => $h->getId(),
            'action' => $h->getAction(),
            'commentaire' => $h->getCommentaire(),
            'date_action' => $h->getDateAction()->format('d/m/Y H:i:s'),
            'ancien_statut' => $h->getAncienStatut(),
            'nouveau_statut' => $h->getNouveauStatut(),
            'fiche_reference' => $h->getFicheDepot()?->getReference(),
            'utilisateur' => [
                'id' => $h->getUtilisateur()->getId(),
                'nom_complet' => $h->getUtilisateur()->getPrenom() . ' ' . $h->getUtilisateur()->getNom(),
                'matricule' => $h->getUtilisateur()->getMatricule(),
            ],
        ];
    }

    private function parseDate(?string $dateStr, string $champ): ?\DateTimeImmutable
    {
        if ($dateStr === null || trim($dateStr) === '') {
            return null;
        }

        $date = \DateTimeImmutable::createFromFormat('Y-m-d', trim($dateStr));
        if ($date === false) {
            throw new DateInvalideException(sprintf('Le champ "%s" doit être au format YYYY-MM-DD.', $champ));
        }

        return $date->setTime(0, 0);
    }
}
