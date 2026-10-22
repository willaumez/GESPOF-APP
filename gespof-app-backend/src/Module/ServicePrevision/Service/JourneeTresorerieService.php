<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\FicheBleu\FicheBleue;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;
use App\Module\ServicePrevision\Enum\EtatJournee;
use App\Module\ServicePrevision\Enum\StatutFiche;
use App\Module\ServicePrevision\Repository\FicheBleueRepository;
use App\Module\ServicePrevision\Repository\FicheExecutionRepository;
use App\Module\ServicePrevision\Repository\JourneeTresorerieRepository;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use App\Module\ServicePrevision\Service\Exception\FicheBleueIntrouvableException;
use App\Module\ServicePrevision\Service\Exception\JourneeTresorerieIntrouvableException;
use App\Module\ServiceReglement\Repository\FicheDepotRepository;
use App\Module\ServiceReglement\Service\FicheDepotServiceInterface;
use App\Shared\Enum\Portail;
use App\Shared\Exception\ActionInterditeException;
use App\Shared\Service\NotificationServiceInterface;

class JourneeTresorerieService implements JourneeTresorerieServiceInterface
{
    public function __construct(
        private readonly JourneeTresorerieRepository $repository,
        private readonly FicheBleueRepository $ficheBleueRepository,
        private readonly FicheExecutionRepository $ficheExecutionRepository,
        private readonly FicheDepotRepository $ficheDepotRepository,
        private readonly FicheDepotServiceInterface $ficheDepotService,
        private readonly NotificationServiceInterface $notificationService,
        private readonly FicheExecutionConsoServiceInterface $ficheExecutionConsoService,
        private readonly JournalJourneeServiceInterface $journal,
    ) {
    }

    public function creer(): array
    {
        $aujourdhui = new \DateTimeImmutable('today');

        // Une seule journée par jour calendaire : réutilise celle déjà ouverte.
        $existante = $this->repository->trouverDuJour($aujourdhui);
        if ($existante !== null) {
            return ['journee' => $this->serialiser($existante)];
        }

        $reference = JourneeTresorerie::genererReference(
            $aujourdhui,
            $this->repository->prochainIncrementPourDate($aujourdhui),
        );

        $journee = new JourneeTresorerie($reference);
        $this->repository->save($journee, true);
        $this->journal->enregistrer($journee, JournalJourneeServiceInterface::OUVERTURE, 'Ouverture de la journée');

        return ['journee' => $this->serialiser($journee)];
    }

    public function detail(string $reference): array
    {
        return ['journee' => $this->serialiser($this->trouver($reference))];
    }

    public function derniere(): ?array
    {
        /** @var JourneeTresorerie|null $journee */
        $journee = $this->repository->createQueryBuilder('j')
            ->orderBy('j.dateCreation', 'DESC')
            ->addOrderBy('j.reference', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return $journee === null ? null : ['journee' => $this->serialiser($journee)];
    }

    /** Journée de trésorerie du jour calendaire (null si aucune). */
    public function duJour(): array
    {
        $journee = $this->repository->trouverDuJour(new \DateTimeImmutable('today'));

        return ['journee' => $journee === null ? null : $this->serialiser($journee)];
    }

    public function parDate(string $dateIso): array
    {
        $date = \DateTimeImmutable::createFromFormat('Y-m-d', $dateIso);
        if ($date === false || $date->format('Y-m-d') !== $dateIso) {
            throw new DonneesInvalidesException('Le paramètre "date" est invalide (YYYY-MM-DD).');
        }

        $journee = $this->repository->trouverDuJour($date->setTime(0, 0, 0));

        return ['journee' => $journee === null ? null : $this->serialiser($journee)];
    }

    /**
     * Rattache une Fiche Bleue à la journée (remplace le lien éventuel).
     * Passe la fiche en statut EN_COURS.
     */
    public function lierFicheBleue(string $referenceJournee, int $ficheBleueId): array
    {
        $journee = $this->trouverModifiable($referenceJournee);
        $fiche = $this->ficheBleueRepository->find($ficheBleueId)
            ?? throw new FicheBleueIntrouvableException('Fiche Bleue introuvable.');

        $autreJournee = $fiche->getJourneeTresorerie();
        if ($autreJournee !== null && $autreJournee->getReference() !== $journee->getReference()) {
            throw new DonneesInvalidesException(
                sprintf(
                    'La Fiche Bleue %s est déjà liée à la journée %s.',
                    $fiche->getReference(),
                    $autreJournee->getReference(),
                ),
            );
        }

        $precedente = $journee->getFicheBleue();
        if ($precedente !== null && $precedente->getId() === $fiche->getId()) {
            return ['journee' => $this->serialiser($journee)];
        }

        if ($precedente !== null && $precedente->getId() !== $fiche->getId()) {
            $precedente->setJourneeTresorerie(null);
            if ($precedente->getStatut() === StatutFiche::EN_COURS) {
                $precedente->setStatut(StatutFiche::BROUILLON);
            }
        }

        $journee->setFicheBleue($fiche);
        $fiche->setStatut(StatutFiche::EN_COURS);
        $journee->toucher();
        $this->notifierEnvoiAuSr($journee, $fiche);
        $this->repository->flush();
        $this->journal->enregistrer(
            $journee,
            JournalJourneeServiceInterface::FICHE_BLEUE_LIEE,
            $precedente !== null
                ? sprintf('Fiche Bleue %s liée (remplace %s) et envoyée au Service Règlement', $fiche->getReference(), $precedente->getReference())
                : sprintf('Fiche Bleue %s liée et envoyée au Service Règlement', $fiche->getReference()),
            ['fiche_bleue' => $fiche->getReference(), 'precedente' => $precedente?->getReference()],
        );

        return ['journee' => $this->serialiser($journee)];
    }

    public function cloturer(string $reference): array
    {
        $journee = $this->trouver($reference);
        if ($journee->getEtat() === EtatJournee::CLOTURE) {
            throw new DonneesInvalidesException('Cette journée est déjà clôturée.');
        }

        $journee->synchroniserDepuisFicheExecution();
        $ficheExecution = $journee->getFicheExecution();
        if ($ficheExecution === null) {
            throw new DonneesInvalidesException(
                'Impossible de clôturer : aucune Fiche d\'exécution n\'est liée à cette journée.',
            );
        }
        $this->ficheExecutionConsoService->fusionnerDepuisJournee($journee, $ficheExecution);
        $journee->cloturer();
        $journee->getFicheBleue()?->setStatut(StatutFiche::CLOTURE);
        $ficheExecution->setStatut(StatutFiche::CLOTURE);
        $this->repository->flush();
        $this->journal->enregistrer($journee, JournalJourneeServiceInterface::CLOTURE, 'Clôture de la journée', [
            'total_recettes' => $journee->getTotalRecettes(),
            'total_depenses' => $journee->getTotalDepenses(),
            'solde_cloture' => $journee->getSoldeCloture(),
        ]);

        return ['journee' => $this->serialiser($journee)];
    }

    public function reouvrir(string $reference, bool $journeeAnterieureAutorisee = false): array
    {
        $journee = $this->trouver($reference);
        if ($journee->getEtat() !== EtatJournee::CLOTURE) {
            throw new DonneesInvalidesException('Cette journée n\'est pas clôturée.');
        }

        // Corriger une journée déjà suivie d'autres journées relève du chef de service.
        if (!$journeeAnterieureAutorisee) {
            $derniere = $this->repository->trouverDerniere();
            if ($derniere !== null && $derniere->getReference() !== $journee->getReference()) {
                throw new ActionInterditeException(sprintf(
                    'Seule la dernière journée de trésorerie (%s) peut être réouverte. '
                    . 'La réouverture d\'une journée antérieure est réservée au chef de service.',
                    $derniere->getReference(),
                ));
            }
        }

        $this->ficheExecutionConsoService->supprimerValeursJournee($journee->getReference());
        $journee->reouvrir();
        $journee->getFicheBleue()?->setStatut(StatutFiche::EN_COURS);
        $journee->getFicheExecution()?->setStatut(StatutFiche::EN_COURS);
        $this->repository->flush();
        $this->journal->enregistrer(
            $journee,
            JournalJourneeServiceInterface::REOUVERTURE,
            $journeeAnterieureAutorisee
                ? 'Réouverture de la journée (journée antérieure, autorisation chef de service)'
                : 'Réouverture de la journée',
        );

        return ['journee' => $this->serialiser($journee)];
    }

    public function demanderFicheDepot(string $reference): array
    {
        $journee = $this->trouverModifiable($reference);
        $fiche = $journee->getFicheBleue();
        $date = $this->dateIsoJournee($journee);
        $dateLibelle = \DateTimeImmutable::createFromFormat('Y-m-d', $date)?->format('d/m/Y') ?? $date;

        if ($this->notificationService->existePourCible(
            Portail::SR->value,
            'demande_fiche_depot',
            'journee_tresorerie',
            $journee->getReference(),
        )) {
            return ['envoye' => true, 'deja_envoyee' => true];
        }

        $this->notificationService->creer(
            Portail::SR->value,
            'demande_fiche_depot',
            'Fiche de dépôt attendue',
            $fiche !== null
                ? sprintf(
                    'Le Service Prévision attend la fiche de dépôt pour la Fiche Bleue %s (journée du %s).',
                    $fiche->getReference(),
                    $dateLibelle,
                )
                : sprintf(
                    'Le Service Prévision attend la fiche de dépôt pour la journée du %s.',
                    $dateLibelle,
                ),
            'journee_tresorerie',
            $journee->getReference(),
            sprintf('/sr/generer?date=%s', $date),
            [
                'date' => $date,
                'journee_reference' => $journee->getReference(),
                'fiche_bleue_reference' => $fiche?->getReference(),
            ],
            true,
        );
        $this->journal->enregistrer(
            $journee,
            JournalJourneeServiceInterface::FICHE_DEPOT_DEMANDEE,
            'Fiche de dépôt demandée au Service Règlement',
        );

        return ['envoye' => true, 'deja_envoyee' => false];
    }

    public function lister(
        int $page = 1,
        int $limite = 10,
        ?string $date = null,
        ?string $recherche = null,
        ?string $etat = null,
        ?string $dateDebut = null,
        ?string $dateFin = null,
    ): array {
        $limite = max(1, min(500, $limite));
        $page = max(1, $page);

        $jour = $this->parserDateOptionnelle($date, 'date');
        $debut = $this->parserDateOptionnelle($dateDebut, 'date_debut');
        $fin = $this->parserDateOptionnelle($dateFin, 'date_fin');

        $etatEnum = null;
        if ($etat !== null && $etat !== '') {
            $etatEnum = EtatJournee::tryFrom(mb_strtolower(trim($etat)));
            if ($etatEnum === null) {
                throw new DonneesInvalidesException(
                    'Le paramètre "etat" doit être brouillon, en_cours ou cloture.',
                );
            }
        }

        $terme = $recherche !== null ? trim($recherche) : null;
        if ($terme === '') {
            $terme = null;
        }

        $resultat = $this->repository->filtrer(
            $page,
            $limite,
            $terme,
            $etatEnum,
            $jour,
            $debut,
            $fin,
        );

        $total = $resultat['total'];
        $pages = $resultat['pages'];
        $page = $resultat['page'];

        $idsFichesBleues = [];
        foreach ($resultat['journees'] as $journee) {
            $id = $journee->getFicheBleue()?->getId();
            if ($id !== null) {
                $idsFichesBleues[] = $id;
            }
        }
        $compteurs = $this->ficheDepotRepository->compterParFicheBleueIds($idsFichesBleues);

        $payload = [
            'journees' => array_map(
                function (JourneeTresorerie $j) use ($compteurs): array {
                    $ficheBleueId = $j->getFicheBleue()?->getId();

                    return $this->serialiser(
                        $j,
                        $ficheBleueId !== null ? ($compteurs[$ficheBleueId] ?? 0) : 0,
                        false,
                    );
                },
                $resultat['journees'],
            ),
            'total' => $total,
            'page' => $page,
            'pages' => $pages,
            'limite' => $limite,
        ];

        if ($jour !== null) {
            $payload['date'] = $jour->format('Y-m-d');
        }

        return $payload;
    }

    /** Journée ouverte ou réouverte : une journée clôturée est en lecture seule. */
    private function trouverModifiable(string $reference): JourneeTresorerie
    {
        $journee = $this->trouver($reference);
        if ($journee->estCloturee()) {
            throw new DonneesInvalidesException('Cette journée est clôturée : elle ne peut plus être modifiée.');
        }

        return $journee;
    }

    public function supprimer(string $reference): void
    {
        $this->ficheExecutionConsoService->supprimerValeursJournee($reference);
        $journee = $this->trouver($reference);
        $ficheBleue = $journee->getFicheBleue();
        $ficheExecution = $journee->getFicheExecution();

        if ($ficheBleue?->getId() !== null) {
            foreach ($this->ficheDepotRepository->referencesParFicheBleue($ficheBleue->getId()) as $refDepot) {
                $this->ficheDepotService->supprimerPourArchives($refDepot);
            }
        }

        if ($ficheBleue !== null) {
            $ficheBleue->setJourneeTresorerie(null);
        }
        if ($ficheExecution !== null) {
            $ficheExecution->setJourneeTresorerie(null);
        }
        $journee->setFicheBleue(null);
        $journee->setFicheExecution(null);
        $this->repository->flush();

        if ($ficheExecution !== null) {
            $this->ficheExecutionRepository->remove($ficheExecution);
        }
        if ($ficheBleue !== null) {
            $this->ficheBleueRepository->remove($ficheBleue);
        }
        $this->repository->remove($journee, true);
    }

    private function trouver(string $reference): JourneeTresorerie
    {
        return $this->repository->find($reference)
            ?? throw new JourneeTresorerieIntrouvableException('Journée de trésorerie introuvable.');
    }

    private function notifierEnvoiAuSr(JourneeTresorerie $journee, FicheBleue $fiche): void
    {
        $date = $this->dateIsoJournee($journee);
        $dateLibelle = \DateTimeImmutable::createFromFormat('Y-m-d', $date)?->format('d/m/Y') ?? $date;

        $this->notificationService->creer(
            Portail::SR->value,
            'fiche_recue',
            'Dépenses reçues du Service Prévision',
            sprintf(
                'Les dépenses de la fiche %s ont été transmises pour le %s.',
                $fiche->getReference(),
                $dateLibelle,
            ),
            'fiche_bleue',
            $fiche->getReference(),
            sprintf('/sr/generer?date=%s', $date),
            [
                'fiche_bleue_id' => $fiche->getId(),
                'fiche_bleue_reference' => $fiche->getReference(),
                'date' => $date,
                'journee_reference' => $journee->getReference(),
            ],
        );
    }

    private function dateIsoJournee(JourneeTresorerie $journee): string
    {
        if (preg_match('/^JT-(\d{2})-(\d{2})-(\d{4})-/', $journee->getReference(), $m) === 1) {
            return sprintf('%s-%s-%s', $m[3], $m[2], $m[1]);
        }

        return $journee->getDateCreation()->format('Y-m-d');
    }

    private function parserDateOptionnelle(?string $valeur, string $nomParametre): ?\DateTimeImmutable
    {
        if ($valeur === null || $valeur === '') {
            return null;
        }

        $date = \DateTimeImmutable::createFromFormat('Y-m-d', $valeur);
        if ($date === false || $date->format('Y-m-d') !== $valeur) {
            throw new DonneesInvalidesException(
                sprintf('Le paramètre "%s" doit être au format YYYY-MM-DD.', $nomParametre),
            );
        }

        return $date;
    }

    private function nombreFichesDepot(JourneeTresorerie $journee): int
    {
        $id = $journee->getFicheBleue()?->getId();
        if ($id === null) {
            return 0;
        }
        $compteurs = $this->ficheDepotRepository->compterParFicheBleueIds([$id]);

        return $compteurs[$id] ?? 0;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(
        JourneeTresorerie $journee,
        ?int $nombreFichesDepot = null,
        bool $inclureOperations = true,
    ): array {
        $ficheBleue = $journee->getFicheBleue();
        $ficheExecution = $journee->getFicheExecution();
        $payload = [
            'reference' => $journee->getReference(),
            'date_creation' => $journee->getDateCreation()->format(\DateTimeInterface::ATOM),
            'date_derniere_mise_a_jour' => $journee->getDateDerniereMiseAJour()?->format(\DateTimeInterface::ATOM),
            'etat' => $journee->getEtat()->value,
            'etat_libelle' => $journee->getEtat()->libelle(),
            // Réouverte et pas re-clôturée : seule une journée ouverte est interrogée.
            'reouverte' => !$journee->estCloturee() && $this->journal->aEteReouverte($journee),
            'solde_ouverture' => $journee->getSoldeOuverture(),
            'total_recettes' => $journee->getTotalRecettes(),
            'total_depenses' => $journee->getTotalDepenses(),
            'solde_cloture' => $journee->getSoldeCloture(),
            'fiche_bleue_id' => $ficheBleue?->getId(),
            'fiche_bleue_reference' => $ficheBleue?->getReference(),
            'fiche_execution_id' => $ficheExecution?->getId(),
            'fiche_execution_reference' => $ficheExecution?->getReference(),
            'nombre_fiches_depot' => $nombreFichesDepot ?? $this->nombreFichesDepot($journee),
        ];

        if ($inclureOperations) {
            $payload['operations_jour'] = $journee->getOperationsJour();
        }

        return $payload;
    }
}
