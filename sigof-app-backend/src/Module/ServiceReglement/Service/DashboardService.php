<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service;

use App\Module\ServiceReglement\Model\FicheDepot;
use App\Module\ServiceReglement\Repository\FicheDepotRepository;
use App\Module\ServiceReglement\Repository\HistoriqueFicheRepository;
use App\Module\ServiceReglement\Service\DashboardServiceInterface;

class DashboardService implements DashboardServiceInterface
{
    public function __construct(
        private readonly FicheDepotRepository $ficheRepository,
        private readonly HistoriqueFicheRepository $historiqueRepository,
    ) {
    }

    public function resume(): array
    {
        $today  = new \DateTimeImmutable('today');
        $demain = $today->modify('+1 day');

        $ficheDuJour = $this->ficheRepository->createQueryBuilder('f')
            ->andWhere('f.datePresentation >= :today')
            ->andWhere('f.datePresentation < :demain')
            ->setParameter('today', $today)
            ->setParameter('demain', $demain)
            ->orderBy('f.dateCreation', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        $dernierHistoriqueRecu = $this->historiqueRepository->createQueryBuilder('h')
            ->andWhere('h.nouveauStatut = :statut')
            ->setParameter('statut', 'recue')
            ->orderBy('h.dateAction', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        $enAttenteSp = $this->ficheRepository->createQueryBuilder('f')
            ->select('COUNT(f.reference)')
            ->andWhere('f.statut = :statut')
            ->setParameter('statut', 'envoyee')
            ->getQuery()
            ->getSingleScalarResult();

        return [
            'fiche_du_jour' => $ficheDuJour !== null
                ? [
                    'existe'        => true,
                    'date'          => $ficheDuJour->getDatePresentation()->format('d/m/Y'),
                    'montant_total' => number_format($ficheDuJour->getTotal(), 2, '.', ''),
                    'statut'        => $ficheDuJour->getStatut(),
                    'reference'     => $ficheDuJour->getReference(),
                ]
                : [
                    'existe'        => false,
                    'date'          => $today->format('d/m/Y'),
                    'montant_total' => null,
                    'statut'        => null,
                    'reference'     => null,
                ],

            'dernier_transmis' => $dernierHistoriqueRecu !== null
                ? [
                    'montant_total' => number_format($dernierHistoriqueRecu->getFicheDepot()->getTotal(), 2, '.', ''),
                    'date'          => $dernierHistoriqueRecu->getDateAction()->format('d/m/Y'),
                    'reference'     => $dernierHistoriqueRecu->getFicheDepot()->getReference(),
                ]
                : null,

            'en_attente_sp' => [
                'nombre' => (int) $enAttenteSp,
            ],
        ];
    }

    public function fichesRecentes(): array
    {
        $fiches = $this->ficheRepository->createQueryBuilder('f')
            ->leftJoin('f.utilisateur', 'u')
            ->addSelect('u')
            ->orderBy('f.dateCreation', 'DESC')
            ->setMaxResults(6)
            ->getQuery()
            ->getResult();

        return array_map(fn(FicheDepot $f) => [
            'reference'      => $f->getReference(),
            'date_creation'  => $f->getDateCreation()->format('d/m/Y'),
            'datePresentation' => $f->getDatePresentation()->format('d/m/Y'),
            'montant_total'  => number_format($f->getTotal(), 2, '.', ''),
            'genere_par'     => $f->getUtilisateur()->getPrenom() . ' ' . $f->getUtilisateur()->getNom(),
            'statut'         => $f->getStatut(),
            'chemin_fichier' => $f->getCheminFichier(),
        ], $fiches);
    }
}
