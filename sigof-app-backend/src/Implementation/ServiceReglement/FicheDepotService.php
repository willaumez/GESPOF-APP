<?php

declare(strict_types=1);

namespace App\Implementation\ServiceReglement;

use App\Entity\ServiceReglement\FicheDepot;
use App\Entity\ServiceReglement\HistoriqueFiche;
use App\Entity\ServiceReglement\LigneSygma;
use App\Entity\ServiceReglement\LigneSystac;
use App\Entity\ServiceReglement\MouvementNumeraire;
use App\Entity\ServiceReglement\MouvementSygma;
use App\Entity\ServiceReglement\MouvementSystac;
use App\Entity\ServiceReglement\Observation;
use App\Entity\Utilisateur;
use App\Enum\ServiceReglement\StatutFiche;
use App\Repository\ServiceReglement\FicheDepotRepository;
use App\Repository\ServiceReglement\HistoriqueFicheRepository;
use App\Repository\ServiceReglement\LigneSygmaRepository;
use App\Repository\ServiceReglement\LigneSystacRepository;
use App\Repository\ServiceReglement\MouvementNumeraireRepository;
use App\Repository\ServiceReglement\MouvementSygmaRepository;
use App\Repository\ServiceReglement\ObservationRepository;
use App\Repository\ServiceReglement\ScriptPoolDr;
use App\Service\ServiceReglement\Exception\ActionInterditeException;
use App\Service\ServiceReglement\Exception\AucuneLigneTrouveeException;
use App\Service\ServiceReglement\Exception\DateInvalideException;
use App\Service\ServiceReglement\Exception\DonneesInvalidesException;
use App\Service\ServiceReglement\Exception\FicheIntrouvableException;
use App\Service\ServiceReglement\Exception\FichierIntrouvableException;
use App\Service\ServiceReglement\Exception\MouvementIntrouvableException;
use App\Service\ServiceReglement\Exception\StatutInvalideException;
use App\Service\ServiceReglement\FicheDepotExcelGeneratorInterface;
use App\Service\ServiceReglement\FicheDepotServiceInterface;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;

class FicheDepotService implements FicheDepotServiceInterface
{
    private const FAMILLES_VALIDES = ['numeraire', 'sygma'];

    public function __construct(
        private readonly FicheDepotRepository $ficheRepository,
        private readonly HistoriqueFicheRepository $historiqueRepository,
        private readonly LigneSystacRepository $ligneSystacRepository,
        private readonly LigneSygmaRepository $ligneSygmaRepository,
        private readonly MouvementSygmaRepository $mouvementSygmaRepository,
        private readonly MouvementNumeraireRepository $mouvementNumeraireRepository,
        private readonly ObservationRepository $observationRepository,
        private readonly ScriptPoolDr $scriptPoolDr,
        private readonly FicheDepotExcelGeneratorInterface $excelGenerator,
        private readonly string $dossierFiches,
    ) {
    }


    public function genererFicheAvecProgress(?string $dateStr, Utilisateur $user, callable $progressCallback): array
    {
        $datePresentation = $this->parseDate($dateStr);
        if ($datePresentation === null) {
            throw new DateInvalideException('Le champ "date" est requis (format YYYY-MM-DD).');
        }

        $progressCallback(0, 'RÉCUPÉRATION DES LOTS DE DÉPENSES');

        $lignesFiche = $this->scriptPoolDr->findByDate($datePresentation);

        if (empty($lignesFiche)) {
            throw new AucuneLigneTrouveeException('Aucune ligne trouvée pour cette date.');
        }

        $this->logStep(1, 'Lots de dépenses récupérés (' . count($lignesFiche) . ')', $lignesFiche);

        $progressCallback(15, 'RECHERCHE DES RÈGLEMENTS MANQUANTS');

        $listeNBv = array_column($lignesFiche, 'N_BV');
        $listeNBv = array_filter($listeNBv, fn($value) => $value !== null && $value !== '' && $value !== '0');
        $listeNBv = array_values(array_unique(array_map('intval', $listeNBv)));

        $reglements = [];
        if (!empty($listeNBv)) {
            $reglements = $this->scriptPoolDr->findReglementsByBvList($listeNBv);
        }

        $progressCallback(30, 'RECHERCHE DES DESIGNATIONS');

        $intitules = $this->getIntitulesForReglements($reglements);

        $progressCallback(45, 'AGRÉGATION DES RÈGLEMENTS');

        $reglementsParBv = $this->groupReglementsByBv($reglements);
        $reglementsEnrichis = $this->enrichirReglementsAvecIntitules($reglementsParBv, $intitules);

        $progressCallback(60, 'CRÉATION DE LA FICHE DE DEPOT');

        $ficheDepense = $this->construireFicheDepense($lignesFiche, $reglementsEnrichis);

        $this->logStep(5, 'SYSTAC — lignes agrégées (' . count($ficheDepense['LigneFiches']) . ')', $ficheDepense['LigneFiches']);
        error_log(sprintf(
            '[pool-sr][fiche_generer] 5) SYSTAC — agrégation : total_montant_systac=%s total_montant_groupe=%s',
            $ficheDepense['TOTAL_MONTANT_SYSTAC'],
            $ficheDepense['TOTAL_MONTANT_GROUPE'],
        ));

        $progressCallback(80, 'VALIDATION DE LA FICHE DE DEPOT');

        if (!$this->montantsCorrespondent($ficheDepense)) {
            return $this->resultatNonValide($ficheDepense, $datePresentation);
        }

        $progressCallback(85, 'RÉCUPÉRATION DES MOUVEMENTS SIGMA');

        $mouvementsSigmaBruts = $this->scriptPoolDr->findSigmaByDate($datePresentation);
        $this->logStep('6bis', 'SIGMA — mouvements récupérés (' . count($mouvementsSigmaBruts) . ')', $mouvementsSigmaBruts);

        $mouvementsSigma = $this->construireMouvementsSigma($mouvementsSigmaBruts);

        $fiche = $this->persisterFiche($ficheDepense, $mouvementsSigma, $user, $datePresentation, StatutFiche::CREE->value);

        $progressCallback(95, 'VISUALISATION DE LA FICHE DE DEPOT');

        return [
            'valide' => true,
            'statut' => $fiche->getStatut(),
            'date' => $datePresentation->format('Y-m-d'),
            'reference' => $fiche->getReference(),
        ];
    }


    public function genererFiche(?string $dateStr, Utilisateur $user): array
    {
        $datePresentation = $this->parseDate($dateStr);
        if ($datePresentation === null) {
            throw new DateInvalideException('Le champ "date" est requis (format YYYY-MM-DD).');
        }

        $lignesFiche = $this->scriptPoolDr->findByDate($datePresentation);

        if (empty($lignesFiche)) {
            throw new AucuneLigneTrouveeException('Aucune ligne trouvée pour cette date.');
        }
        $listeNBv = array_column($lignesFiche, 'N_BV');
        $listeNBv = array_filter($listeNBv, fn($value) => $value !== null && $value !== '' && $value !== '0');
        $listeNBv = array_values(array_unique(array_map('intval', $listeNBv)));

        $reglements = [];
        if (!empty($listeNBv)) {
            $reglements = $this->scriptPoolDr->findReglementsByBvList($listeNBv);
        }

        $reglementsParBv = $this->groupReglementsByBv($reglements);

        error_log('[DEBUG] Règlements bruts: ' . json_encode($reglements));
        error_log('[DEBUG] Nombre de règlements: ' . count($reglements));
        $intitules = $this->getIntitulesForReglements($reglements);

        $reglementsEnrichis = $this->enrichirReglementsAvecIntitules($reglementsParBv, $intitules);

        $this->logStep(4, 'reglementsEnrichis', $reglementsEnrichis);

        $ficheDepense = $this->construireFicheDepense($lignesFiche, $reglementsEnrichis);

        if (!$this->montantsCorrespondent($ficheDepense)) {
            return $this->resultatNonValide($ficheDepense, $datePresentation);
        }

        $mouvementsSigma = $this->construireMouvementsSigma($this->scriptPoolDr->findSigmaByDate($datePresentation));

        $fiche = $this->persisterFiche($ficheDepense, $mouvementsSigma, $user, $datePresentation, StatutFiche::ENVOYEE->value);

        return [
            'valide' => true,
            'statut' => $fiche->getStatut(),
            'date' => $datePresentation->format('Y-m-d'),
            'reference' => $fiche->getReference(),
        ];
    }

    public function lister(?string $statut, string $tri, string $ordre): array
    {
        $qb = $this->ficheRepository->createQueryBuilder('f')
            ->leftJoin('f.utilisateur', 'u')
            ->addSelect('u');

        if ($statut) {
            $qb->andWhere('f.statut = :statut')->setParameter('statut', $statut);
        }

        $ordre = strtoupper($ordre);
        $ordre = in_array($ordre, ['ASC', 'DESC'], true) ? $ordre : 'DESC';

        if ($tri !== 'montant') {
            match ($tri) {
                'statut' => $qb->orderBy('f.statut', $ordre),
                default => $qb->orderBy('f.dateCreation', $ordre),
            };
        } else {
            $qb->orderBy('f.dateCreation', 'DESC');
        }

        $fiches = $qb->getQuery()->getResult();

        if ($tri === 'montant') {
            usort(
                $fiches,
                fn(FicheDepot $a, FicheDepot $b): int => $ordre === 'ASC'
                    ? $a->getTotal() <=> $b->getTotal()
                    : $b->getTotal() <=> $a->getTotal(),
            );
        }

        return array_map(fn(FicheDepot $f) => $this->serialiserFiche($f), $fiches);
    }

    public function fichesPaginees(int $page, string $limitRaw, string $search, string $statut): array
    {
        $page = max(1, $page);
        $limitRaw = trim($limitRaw);
        $isAll = $limitRaw === 'all';
        $limit = $isAll ? 0 : max(1, (int) $limitRaw);
        $search = trim($search);
        $statut = trim($statut);

        $qb = $this->ficheRepository->createQueryBuilder('f')
            ->leftJoin('f.utilisateur', 'u')
            ->addSelect('u');

        if ($statut !== '') {
            $qb->andWhere('f.statut = :statut')->setParameter('statut', $statut);
        }

        if ($search !== '') {
            $qb->andWhere('LOWER(f.reference) LIKE :search OR LOWER(u.nom) LIKE :search OR LOWER(u.prenom) LIKE :search')
                ->setParameter('search', '%' . mb_strtolower($search) . '%');
        }

        $total = (int) (clone $qb)->select('COUNT(f.reference)')->getQuery()->getSingleScalarResult();

        $qb->orderBy('f.dateCreation', 'DESC');

        if (!$isAll) {
            $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit);
        }

        $fiches = $qb->getQuery()->getResult();

        $stats = [
            'cree' => $this->compterParStatut(StatutFiche::CREE->value),
            'envoyee' => $this->compterParStatut(StatutFiche::ENVOYEE->value),
            'recue' => $this->compterParStatut(StatutFiche::RECUE->value),
            'en_attente' => $this->compterParStatut(StatutFiche::ENVOYEE->value),
        ];

        $totalPages = $isAll ? 1 : max(1, (int) ceil($total / $limit));
        $page = $isAll ? 1 : min($page, $totalPages);

        return [
            'stats' => $stats,
            'fiches' => array_map(fn(FicheDepot $f) => $this->serialiserFiche($f), $fiches),
            'pagination' => [
                'page' => $page,
                'limit' => $isAll ? $total : $limit,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ];
    }

    public function detail(string $reference): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }

        $utilisateur = $fiche->getUtilisateur();

        return [
            'reference' => $fiche->getReference(),
            'statut' => $fiche->getStatut(),
            'date_creation' => $fiche->getDateCreation()->format('d/m/Y H:i:s'),
            'date_presentation' => $fiche->getDatePresentation()->format('d/m/Y'),
            'montant_total' => number_format($fiche->getTotal(), 2, '.', ''),
            'total_numeraire' => number_format($fiche->getTotalNumeraire(), 2, '.', ''),
            'total_sigma' => number_format($fiche->getTotalSigma(), 2, '.', ''),
            'total_systac' => number_format($fiche->getTotalSystac(), 2, '.', ''),
            'total_groupe' => number_format($fiche->getTotalGroupe(), 2, '.', ''),
            'hash_fichier' => $fiche->getHashFichier(),
            'url_apercu' => $this->urlFichier($fiche, 'apercu'),
            'url_telecharger' => $this->urlFichier($fiche, 'telecharger'),
            'genere_par' => [
                'id' => $utilisateur->getId(),
                'nom_complet' => $utilisateur->getPrenom() . ' ' . $utilisateur->getNom(),
                'matricule' => $utilisateur->getMatricule(),
            ],
            'mouvements_numeraire' => array_map(
                fn(MouvementNumeraire $m) => $this->serialiserMouvement($m),
                $fiche->getMouvementsNumeraire()->toArray(),
            ),
            'mouvements_sygma' => array_map(
                fn(MouvementSygma $m) => $this->serialiserMouvement($m),
                $fiche->getMouvementsSygma()->toArray(),
            ),
            'mouvements_systac' => array_map(
                fn(MouvementSystac $m) => $this->serialiserMouvementSystac($m),
                $fiche->getMouvementsSystac()->toArray(),
            ),
            'lignes_systac' => $this->serialiserLignesSystac($fiche->getMouvementsSystac()->toArray()),
        ];
    }

    private function serialiserMouvement(MouvementNumeraire|MouvementSygma|MouvementSystac $mouvement): array
    {
        return [
            'id' => $mouvement->getId(),
            'date_virement' => $mouvement->getDateVirement()?->format('d/m/Y H:i:s'),
            'beneficiaire' => $mouvement->getBeneficiaire(),
            'numero_ov' => $mouvement->getNumeroOV(),
            'banque' => $mouvement->getBanque(),
            'depenses' => $mouvement->getDepenses(),
            'observations' => array_map(
                static fn(Observation $o) => ['id' => $o->getId(), 'contenu' => $o->getContenu()],
                $mouvement->getObservations()->toArray(),
            ),
        ];
    }

    private function serialiserMouvementSystac(MouvementSystac $mouvement): array
    {
        return [
            ...$this->serialiserMouvement($mouvement),
            'montant_groupe' => $mouvement->getMontantGroupe(),
        ];
    }

    private function serialiserLignesSystac(array $mouvements): array
    {
        $lignes = [];
        foreach ($mouvements as $mouvement) {
            foreach ($mouvement->getLignesSystac() as $ligne) {
                $lignes[] = [
                    'id' => $ligne->getId(),
                    'id_groupe' => $mouvement->getId(),
                    'c_orig' => $ligne->getCOrig(),
                    'd_presentation' => $ligne->getDPresentation()?->format('d/m/Y'),
                    'l_orig' => $ligne->getLOrig(),
                    'n_bv' => $ligne->getNBv(),
                    'nb_regl' => $ligne->getNbRegl(),
                    'montant_systac' => $ligne->getMontantSystac(),
                    'montant_groupe' => $mouvement->getMontantGroupe(),
                    'designation' => $mouvement->getDesignation(),
                    'd_creation_ip' => $ligne->getDCreationIp()?->format('d/m/Y H:i:s'),
                    'd_generation' => $ligne->getDGeneration()?->format('d/m/Y H:i:s'),
                ];
            }
        }

        return $lignes;
    }

    public function changerStatut(string $reference, ?string $nouveauStatut, ?string $commentaire, Utilisateur $user): string
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }

        if ($nouveauStatut === null || $nouveauStatut === '') {
            throw new StatutInvalideException('Le champ "statut" est requis.');
        }

        if (StatutFiche::tryFrom($nouveauStatut) === null) {
            throw new StatutInvalideException(sprintf('Statut "%s" invalide.', $nouveauStatut));
        }

        $ancienStatut = $fiche->getStatut();
        $fiche->setStatut($nouveauStatut);

        $historique = new HistoriqueFiche();
        $historique->setFicheDepot($fiche);
        $historique->setUtilisateur($user);
        $historique->setAction('CHANGEMENT_STATUT');
        $historique->setAncienStatut($ancienStatut);
        $historique->setNouveauStatut($nouveauStatut);
        $historique->setCommentaire($commentaire);

        $this->historiqueRepository->save($historique);
        $this->ficheRepository->flush();

        return $fiche->getStatut();
    }

    public function cheminFichier(string $reference): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }

        if ($fiche->getCheminFichier() === null) {
            throw new FichierIntrouvableException('Aucun fichier généré pour cette fiche.');
        }

        $chemin = $this->dossierFiches . \DIRECTORY_SEPARATOR . $fiche->getCheminFichier();
        if (!is_file($chemin)) {
            throw new FichierIntrouvableException('Le fichier est introuvable sur le serveur.');
        }

        return [
            'chemin' => $chemin,
            'nom' => 'REGLEMENTS DU ' . $fiche->getDatePresentation()->format('d-m-Y') . '.xlsx',
        ];
    }

    public function supprimer(string $reference, Utilisateur $user): void
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);

        $cheminFichier = $fiche->getCheminFichier() !== null
            ? $this->dossierFiches . \DIRECTORY_SEPARATOR . $fiche->getCheminFichier()
            : null;

        $this->ficheRepository->connection()->transactional(function (Connection $conn) use ($reference): void {
            $idsNumeraire = $conn->executeQuery(
                'SELECT id FROM mouvement_numeraire WHERE fiche_reference = :ref',
                ['ref' => $reference],
            )->fetchFirstColumn();
            $idsSygma = $conn->executeQuery(
                'SELECT id FROM mouvement_sygma WHERE fiche_reference = :ref',
                ['ref' => $reference],
            )->fetchFirstColumn();
            $idsSystac = $conn->executeQuery(
                'SELECT id FROM mouvement_systac WHERE fiche_reference = :ref',
                ['ref' => $reference],
            )->fetchFirstColumn();

            $observationIds = [];
            foreach ([
                ['mouvement_numeraire_observation', 'mouvement_numeraire_id', $idsNumeraire],
                ['mouvement_sygma_observation', 'mouvement_sygma_id', $idsSygma],
                ['mouvement_systac_observation', 'mouvement_systac_id', $idsSystac],
            ] as [$table, $colonne, $ids]) {
                if ($ids === []) {
                    continue;
                }
                $observationIds = [
                    ...$observationIds,
                    ...$conn->executeQuery(
                        "DELETE FROM {$table} WHERE {$colonne} IN (:ids) RETURNING observation_id",
                        ['ids' => $ids],
                        ['ids' => ArrayParameterType::INTEGER],
                    )->fetchFirstColumn(),
                ];
            }

            if ($idsSygma !== []) {
                $conn->executeStatement(
                    'DELETE FROM ligne_sygma WHERE mouvement_sygma_id IN (:ids)',
                    ['ids' => $idsSygma],
                    ['ids' => ArrayParameterType::INTEGER],
                );
            }
            if ($idsSystac !== []) {
                $conn->executeStatement(
                    'DELETE FROM ligne_systac WHERE mouvement_systac_id IN (:ids)',
                    ['ids' => $idsSystac],
                    ['ids' => ArrayParameterType::INTEGER],
                );
            }

            $conn->executeStatement('DELETE FROM mouvement_numeraire WHERE fiche_reference = :ref', ['ref' => $reference]);
            $conn->executeStatement('DELETE FROM mouvement_sygma WHERE fiche_reference = :ref', ['ref' => $reference]);
            $conn->executeStatement('DELETE FROM mouvement_systac WHERE fiche_reference = :ref', ['ref' => $reference]);

            $observationIds = array_values(array_unique($observationIds));
            if ($observationIds !== []) {
                $conn->executeStatement(
                    'DELETE FROM observation WHERE id IN (:ids)
                       AND NOT EXISTS (SELECT 1 FROM mouvement_numeraire_observation WHERE observation_id = observation.id)
                       AND NOT EXISTS (SELECT 1 FROM mouvement_sygma_observation WHERE observation_id = observation.id)
                       AND NOT EXISTS (SELECT 1 FROM mouvement_systac_observation WHERE observation_id = observation.id)',
                    ['ids' => $observationIds],
                    ['ids' => ArrayParameterType::INTEGER],
                );
            }

            $conn->executeStatement('DELETE FROM historique_fiche WHERE fiche_reference = :ref', ['ref' => $reference]);
            $conn->executeStatement('DELETE FROM fiche_depenses WHERE reference = :ref', ['ref' => $reference]);
        });

        if ($cheminFichier !== null && is_file($cheminFichier)) {
            unlink($cheminFichier);
        }
    }

    private function validerFamille(string $famille): void
    {
        if (!\in_array($famille, self::FAMILLES_VALIDES, true)) {
            throw new DonneesInvalidesException(\sprintf(
                'Famille invalide : "%s" (attendu : %s).',
                $famille,
                implode(' ou ', self::FAMILLES_VALIDES),
            ));
        }
    }

    private function verifierModificationAutorisee(FicheDepot $fiche, Utilisateur $user): void
    {
        $dejaEnvoyee = \in_array($fiche->getStatut(), ['envoyee', 'recue'], true);
        if ($dejaEnvoyee && !\in_array('ROLE_ADMINISTRATEUR', $user->getRoles(), true)) {
            throw new ActionInterditeException(
                'Cette fiche a déjà été envoyée : seul un administrateur peut encore la modifier ou la supprimer.',
            );
        }
    }

    private function validerChampsBase(array $donnees): array
    {
        $beneficiaire = \is_string($donnees['beneficiaire'] ?? null) ? trim($donnees['beneficiaire']) : '';
        if ($beneficiaire === '') {
            throw new DonneesInvalidesException('Le champ "beneficiaire" est requis.');
        }

        $depensesBrut = $donnees['depenses'] ?? null;
        if (!\is_numeric($depensesBrut)) {
            throw new DonneesInvalidesException('Le champ "depenses" doit être un nombre.');
        }
        $depenses = (float) $depensesBrut;
        if ($depenses <= 0) {
            throw new DonneesInvalidesException('Le champ "depenses" doit être strictement positif.');
        }

        return [$beneficiaire, $depenses];
    }

    private function appliquerChampsOptionnels(MouvementNumeraire|MouvementSygma $mouvement, array $donnees): void
    {
        $mouvement->setNumeroOV(\is_string($donnees['numero_ov'] ?? null) && trim($donnees['numero_ov']) !== '' ? trim($donnees['numero_ov']) : null);
        $mouvement->setBanque(\is_string($donnees['banque'] ?? null) && trim($donnees['banque']) !== '' ? trim($donnees['banque']) : null);

        $dateVirementBrut = \is_string($donnees['date_virement'] ?? null) ? trim($donnees['date_virement']) : '';
        if ($dateVirementBrut === '') {
            $mouvement->setDateVirement(null);
            return;
        }

        $date = $this->parseDate($dateVirementBrut);
        if ($date === null) {
            throw new DonneesInvalidesException('Le champ "date_virement" est dans un format non reconnu.');
        }
        $mouvement->setDateVirement($this->toMutableDate($date));
    }

    private function appliquerObservations(
        MouvementNumeraire|MouvementSygma $mouvement,
        array $donnees,
        string $famille,
        FicheDepot $fiche,
        bool $estCreation,
    ): void {
        $contenu = \is_string($donnees['observation_contenu'] ?? null) ? trim($donnees['observation_contenu']) : '';

        if ($contenu === '') {
            foreach ($mouvement->getObservations()->toArray() as $observation) {
                $mouvement->removeObservation($observation);
                $this->supprimerObservationSiOrpheline($observation);
            }
            return;
        }

        $existantes = $mouvement->getObservations()->toArray();
        if (\count($existantes) >= 1) {
            $observation = $existantes[0];
            $observation->setContenu($contenu);
        } else {
            $observation = new Observation($contenu);
            $mouvement->addObservation($observation);
        }

        $idsSouhaites = array_values(array_unique(array_map(
            'intval',
            \is_array($donnees['observation_lignes_associees'] ?? null) ? $donnees['observation_lignes_associees'] : [],
        )));
        $repo = $famille === 'sygma' ? $this->mouvementSygmaRepository : $this->mouvementNumeraireRepository;

        if (!$estCreation) {
            $siblings = $famille === 'sygma' ? $observation->getMouvementsSygma() : $observation->getMouvementsNumeraire();
            $siblingsActuels = $siblings->filter(
                fn($m) => $m !== $mouvement && $m->getFicheDepot()?->getReference() === $fiche->getReference(),
            )->toArray();
            $idsActuels = array_map(fn($m) => $m->getId(), $siblingsActuels);

            foreach (array_diff($idsActuels, $idsSouhaites) as $idADetacher) {
                $autre = $repo->find($idADetacher);
                $autre?->removeObservation($observation);
            }
            $idsAAttacher = array_diff($idsSouhaites, $idsActuels);
        } else {
            $idsAAttacher = $idsSouhaites;
        }

        foreach ($idsAAttacher as $id) {
            $autre = $repo->find($id);
            if ($autre !== null && $autre->getFicheDepot()?->getReference() === $fiche->getReference()) {
                $autre->addObservation($observation);
            }
        }
    }

    private function supprimerObservationSiOrpheline(Observation $observation): void
    {
        if (
            $observation->getMouvementsNumeraire()->isEmpty()
            && $observation->getMouvementsSygma()->isEmpty()
            && $observation->getMouvementsSystac()->isEmpty()
        ) {
            $this->observationRepository->remove($observation);
        }
    }

    private function trouverMouvementDeLaFiche(string $famille, int $id, FicheDepot $fiche): MouvementNumeraire|MouvementSygma
    {
        $repo = $famille === 'sygma' ? $this->mouvementSygmaRepository : $this->mouvementNumeraireRepository;
        $mouvement = $repo->find($id);
        if ($mouvement === null || $mouvement->getFicheDepot()?->getReference() !== $fiche->getReference()) {
            throw new MouvementIntrouvableException('Ligne introuvable pour cette fiche.');
        }

        return $mouvement;
    }

    public function creerMouvement(string $reference, string $famille, array $donnees, Utilisateur $user): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);
        $this->validerFamille($famille);
        [$beneficiaire, $depenses] = $this->validerChampsBase($donnees);

        $mouvement = $famille === 'sygma'
            ? new MouvementSygma($beneficiaire, $depenses)
            : new MouvementNumeraire($beneficiaire, $depenses);
        $this->appliquerChampsOptionnels($mouvement, $donnees);

        if ($famille === 'sygma') {
            $fiche->addMouvementSygma($mouvement);
        } else {
            $fiche->addMouvementNumeraire($mouvement);
        }

        $this->appliquerObservations($mouvement, $donnees, $famille, $fiche, estCreation: true);
        $this->ficheRepository->save($fiche);
        $this->ficheRepository->flush();
        $this->regenererFichierSiExistant($fiche);

        return $this->serialiserMouvement($mouvement);
    }

    public function modifierMouvement(string $reference, string $famille, int $id, array $donnees, Utilisateur $user): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);
        $this->validerFamille($famille);
        $mouvement = $this->trouverMouvementDeLaFiche($famille, $id, $fiche);

        [$beneficiaire, $depenses] = $this->validerChampsBase($donnees);
        $mouvement->setBeneficiaire($beneficiaire)->setDepenses($depenses);
        $this->appliquerChampsOptionnels($mouvement, $donnees);
        $this->appliquerObservations($mouvement, $donnees, $famille, $fiche, estCreation: false);
        $this->ficheRepository->flush();
        $this->regenererFichierSiExistant($fiche);

        return $this->serialiserMouvement($mouvement);
    }

    public function supprimerMouvement(string $reference, string $famille, int $id, Utilisateur $user): void
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);
        $this->validerFamille($famille);
        $mouvement = $this->trouverMouvementDeLaFiche($famille, $id, $fiche);

        $observationIds = array_map(fn($o) => $o->getId(), $mouvement->getObservations()->toArray());
        $repo = $famille === 'sygma' ? $this->mouvementSygmaRepository : $this->mouvementNumeraireRepository;
        $repo->remove($mouvement, true);

        foreach ($observationIds as $observationId) {
            $observation = $this->observationRepository->find($observationId);
            if ($observation !== null) {
                $this->supprimerObservationSiOrpheline($observation);
            }
        }
        $this->observationRepository->flush();
        $this->regenererFichierSiExistant($fiche);
    }

    private function regenererFichierSiExistant(FicheDepot $fiche): void
    {
        if ($fiche->getCheminFichier() === null) {
            return;
        }

        $resultat = $this->excelGenerator->genererFichier($fiche);
        $fiche->setCheminFichier($resultat['chemin'])->setHashFichier($resultat['hash']);
        $this->ficheRepository->flush();
    }

    private function groupReglementsByBv(array $reglements): array
    {
        $result = [];
        foreach ($reglements as $regl) {
            $nBV = $regl['N_BV'] ?? null;
            if ($nBV === null) {
                continue;
            }

            $nBV = (string) $nBV;
            if (!isset($result[$nBV])) {
                $result[$nBV] = [];
            }

            $result[$nBV][] = [
                'Numero_emission' => $regl['Numero_emission'] ?? null,
                'N_Regl' => $regl['N_Regl'] ?? null,
                'Net_a_Payer' => $regl['Net_a_Payer'] ?? 0,
                'Intitule' => $regl['Intitule'] ?? null,
            ];
        }

        return $result;
    }

    private function getIntitulesForReglements(array $reglements): array
    {
        if (empty($reglements)) {
            return [];
        }

        $paires = [];
        foreach ($reglements as $regl) {
            $nEmis = $regl['Numero_emission'] ?? null;
            $nRegl = $regl['N_Regl'] ?? null;

            if ($nEmis !== null && $nRegl !== null) {
                $key = $nEmis . '|' . $nRegl;
                $paires[$key] = [(int) $nEmis, (int) $nRegl];
            }
        }

        if (empty($paires)) {
            return [];
        }

        return $this->scriptPoolDr->findIntitulesByEmisReglPairs(array_values($paires));
    }

    private function enrichirReglementsAvecIntitules(array $reglementsParBv, array $intitules): array
    {
        $indexIntitules = [];
        foreach ($intitules as $intitule) {
            $nEmis = $intitule['Numero_emission'] ?? $intitule['n_emis'] ?? null;
            $nRegl = $intitule['N_Regl'] ?? $intitule['n_regl'] ?? null;

            if ($nEmis !== null && $nRegl !== null) {
                $key = $nEmis . '|' . $nRegl;
                $indexIntitules[$key] = $intitule['Intitule'] ?? $intitule['l_intcpt'] ?? 'AUTRES OPÉRATIONS';
            }
        }

        $result = [];
        foreach ($reglementsParBv as $nBV => $reglements) {
            $result[$nBV] = [];
            foreach ($reglements as $regl) {
                $nEmis = $regl['Numero_emission'] ?? null;
                $nRegl = $regl['N_Regl'] ?? null;
                $key = ($nEmis ?? '') . '|' . ($nRegl ?? '');
                $intitule = $indexIntitules[$key] ?? 'AUTRES OPÉRATIONS';

                $result[$nBV][] = [
                    'Numero_emission' => $nEmis,
                    'N_Regl' => $nRegl,
                    'Net_a_Payer' => $regl['Net_a_Payer'] ?? 0,
                    'Intitule' => $intitule,
                ];
            }
        }

        return $result;
    }

    private function construireFicheDepense(array $lignesFiche, array $reglementsEnrichis): array
    {
        $lignes = [];
        $totalSystac = 0;
        $totalGroupe = 0;

        foreach ($lignesFiche as $fiche) {
            $nBV = (string) $fiche['N_BV'];
            $reglements = $reglementsEnrichis[$nBV] ?? [];
            $montantSystacOriginal = (float) ($fiche['MONTANT_SYSTAC'] ?? 0);

            if (empty($reglements)) {
                $lignes[] = $this->creerLigneFiche(
                    $fiche,
                    $montantSystacOriginal,
                    0,
                    'AUCUN RÈGLEMENT'
                );
                $totalSystac += $montantSystacOriginal;
                continue;
            }

            if (count($reglements) === 1) {
                $regl = $reglements[0];
                $montantGroupe = (float) ($regl['Net_a_Payer'] ?? 0);

                $lignes[] = $this->creerLigneFiche(
                    $fiche,
                    $montantSystacOriginal,
                    $montantGroupe,
                    $regl['Intitule'] ?? 'SANS INTITULÉ'
                );
                $totalSystac += $montantSystacOriginal;
                $totalGroupe += $montantGroupe;
                continue;
            }

            $groupement = [];
            $totalReglements = 0;
            foreach ($reglements as $regl) {
                $intitule = $regl['Intitule'] ?? 'AUTRES OPÉRATIONS';
                $netPayer = (float) ($regl['Net_a_Payer'] ?? 0);

                if (!isset($groupement[$intitule])) {
                    $groupement[$intitule] = 0;
                }
                $groupement[$intitule] += $netPayer;
                $totalReglements += $netPayer;
            }

            if ($totalReglements == 0) {
                foreach ($groupement as $intitule => $montantTotal) {
                    $lignes[] = $this->creerLigneFiche(
                        $fiche,
                        $montantSystacOriginal / count($groupement),
                        0,
                        $intitule . ' (MONTANT NON DISPONIBLE)'
                    );
                    $totalSystac += $montantSystacOriginal / count($groupement);
                }
                continue;
            }

            foreach ($groupement as $intitule => $montantTotal) {
                $proportion = $totalReglements > 0 ? ($montantTotal / $totalReglements) : 0;
                $montantSystacPartiel = round($montantSystacOriginal * $proportion, 2);

                $lignes[] = $this->creerLigneFiche(
                    $fiche,
                    $montantSystacPartiel,
                    $montantTotal,
                    $intitule
                );
                $totalSystac += $montantSystacPartiel;
                $totalGroupe += $montantTotal;
            }
        }

        $totalSystac = round($totalSystac, 2);
        $totalGroupe = round($totalGroupe, 2);

        return [
            'LigneFiches' => $lignes,
            'TOTAL_MONTANT_SYSTAC' => $totalSystac,
            'TOTAL_MONTANT_GROUPE' => $totalGroupe,
        ];
    }

    private function creerLigneFiche(array $fiche, float $montantSystac, float $montantGroupe, string $designation): array
    {
        return [
            'C_ORIG' => $fiche['C_ORIG'] ?? '',
            'D_PRESENTATION' => $fiche['D_PRESENTATION'] ?? '',
            'L_ORIG' => $fiche['L_ORIG'] ?? '',
            'N_BV' => $fiche['N_BV'],
            'NB_REGL' => $fiche['NB_REGL'] ?? 0,
            'MONTANT_SYSTAC' => round($montantSystac, 2),
            'MONTANT_GROUPE' => round($montantGroupe, 2),
            'DESIGNATION' => $designation,
            'D_CREATION_IP' => $fiche['D_CREATION_IP'] ?? '',
            'D_GENERATION' => $fiche['D_GENERATION'] ?? '',
        ];
    }

    private function montantsCorrespondent(array $ficheDepense): bool
    {
        $systac = round((float) $ficheDepense['TOTAL_MONTANT_SYSTAC'], 2);
        $groupe = round((float) $ficheDepense['TOTAL_MONTANT_GROUPE'], 2);

        return abs($systac - $groupe) < 0.01;
    }

    private function resultatNonValide(array $ficheDepense, \DateTimeImmutable $datePresentation): array
    {
        return [
            'valide' => false,
            'statut' => 'non_validee',
            'message' => 'Le montant Systac ne correspond pas au montant groupé : la fiche n\'a pas été créée.',
            'date' => $datePresentation->format('Y-m-d'),
            'total_montant_systac' => round((float) $ficheDepense['TOTAL_MONTANT_SYSTAC'], 2),
            'total_montant_groupe' => round((float) $ficheDepense['TOTAL_MONTANT_GROUPE'], 2),
            'lignes' => array_map(static fn (array $l): array => [
                'c_orig' => $l['C_ORIG'] ?: null,
                'l_orig' => $l['L_ORIG'] ?: null,
                'd_presentation' => $l['D_PRESENTATION'] ?: null,
                'n_bv' => $l['N_BV'],
                'nb_regl' => $l['NB_REGL'],
                'montant_systac' => $l['MONTANT_SYSTAC'],
                'montant_groupe' => $l['MONTANT_GROUPE'],
                'designation' => $l['DESIGNATION'],
            ], $ficheDepense['LigneFiches']),
        ];
    }

    private function construireMouvementsSigma(array $mouvementsSigmaBruts): array
    {
        $paires = [];

        foreach ($mouvementsSigmaBruts as $brut) {
            $beneficiaire = (string) ($brut['BENEFICIAIRE'] ?? '');
            $depenses = (float) ($brut['MONTANT_SIGMA'] ?? 0);
            $dPresentation = $this->toMutableDate($this->parseDate($brut['D_PRESENTATION'] ?? null));

            $mouvement = new MouvementSygma($beneficiaire, $depenses);
            $mouvement->setNumeroOV($brut['N_OV'] ?? null);
            $mouvement->setBanque($brut['BANQUE'] ?? null);
            $mouvement->setDateVirement($dPresentation);
            $mouvement->setOrigine($brut['ORIG'] ?? null);
            $mouvement->setTypeOperation($brut['C_TYP'] ?? null);
            $mouvement->setObjet($brut['OBJET'] ?? null);
            $mouvement->setCom($brut['L_COM'] ?? null);
            $mouvement->setExp($brut['L_EXP'] ?? null);
            $mouvement->setFisc($brut['C_FISC'] ?? null);
            $mouvement->setQuittance($brut['C_QUIT'] ?? null);

            $objet = trim((string) ($brut['OBJET'] ?? ''));
            $commentaire = trim((string) ($brut['L_COM'] ?? ''));
            $contenuObservation = trim($objet . ($commentaire !== '' ? ' — ' . $commentaire : ''));
            if ($contenuObservation !== '') {
                $mouvement->addObservation(new Observation($contenuObservation));
            }

            $ligne = new LigneSygma();
            $ligne->setOrig($brut['ORIG'] ?? null);
            $ligne->setNDoc($brut['N_DOC'] ?? null);
            $ligne->setDPresentation($dPresentation);
            $ligne->setCTyp($brut['C_TYP'] ?? null);
            $ligne->setMontantSygma($depenses);
            $ligne->setCRef($brut['N_OV'] ?? null);
            $ligne->setLTiers($brut['BENEFICIAIRE'] ?? null);
            $ligne->setLObj($brut['OBJET'] ?? null);
            $ligne->setLCom($brut['L_COM'] ?? null);
            $ligne->setLExp($brut['L_EXP'] ?? null);
            $ligne->setLDest($brut['BANQUE'] ?? null);
            $ligne->setCFisc($brut['C_FISC'] ?? null);
            $ligne->setCQuit($brut['C_QUIT'] ?? null);
            $ligne->setMouvementSygma($mouvement);

            $paires[] = ['ligne' => $ligne, 'mouvement' => $mouvement];
        }

        return $paires;
    }

    private function toMutableDate(?\DateTimeImmutable $date): ?\DateTime
    {
        return $date === null ? null : \DateTime::createFromImmutable($date);
    }

    private const DESIGNATIONS_EQUIVALENTES = [
        'MIN. REFORME DES INSTITUTIONS' => 'MIN REFORME DES INSTITUTIONS',
        'MIN DE LA REFORME INSTITUTION' => 'MIN REFORME DES INSTITUTIONS',
        'MIN REFORME DES INSTITUIONS' => 'MIN REFORME DES INSTITUTIONS',
        'MIN DE REFORME DES INSTITUTIONS' => 'MIN REFORME DES INSTITUTIONS',
        'MIN REFORME DES INSTUTIONS' => 'MIN REFORME DES INSTITUTIONS',
        'MIN REFORME INSTITUTION' => 'MIN REFORME DES INSTITUTIONS',
    ];

    private function consoliderParDesignation(array $lignes): array
    {
        $groupes = [];

        foreach ($lignes as $ligne) {
            $designationBrute = $this->normaliserDesignation((string) ($ligne['DESIGNATION'] ?? ''));
            $designation = self::DESIGNATIONS_EQUIVALENTES[$designationBrute] ?? $designationBrute;

            if (!isset($groupes[$designation])) {
                $groupes[$designation] = [
                    'lignes' => [],
                    'MONTANT_SYSTAC' => 0.0,
                    'MONTANT_GROUPE' => 0.0,
                ];
            }

            $groupes[$designation]['lignes'][] = $ligne;
            $groupes[$designation]['MONTANT_SYSTAC'] += (float) ($ligne['MONTANT_SYSTAC'] ?? 0);
            $groupes[$designation]['MONTANT_GROUPE'] += (float) ($ligne['MONTANT_GROUPE'] ?? 0);
        }

        return $groupes;
    }

    private function normaliserDesignation(string $designation): string
    {
        $normalisee = preg_replace('/[\s\x{00A0}\x{202F}\x{2007}]+/u', ' ', $designation) ?? $designation;

        return mb_strtoupper(trim($normalisee), 'UTF-8');
    }

    private function persisterFiche(array $ficheDepense, array $mouvementsSigma, Utilisateur $user, \DateTimeImmutable $datePresentation, string $statut): FicheDepot
    {
        $fiche = new FicheDepot($datePresentation);
        $fiche->setUtilisateur($user);
        $fiche->setDateCreation(new \DateTimeImmutable());
        $fiche->setDatePresentation($this->toMutableDate($datePresentation));
        $fiche->setStatut($statut);

        foreach ($this->consoliderParDesignation($ficheDepense['LigneFiches']) as $designation => $groupe) {
            $montantSystac = round($groupe['MONTANT_SYSTAC'], 2);

            $premiereLigne = $groupe['lignes'][0];
            $dCreationIp = $this->parseDate($premiereLigne['D_CREATION_IP'] ?? null);
            $dGeneration = $this->parseDate($premiereLigne['D_GENERATION'] ?? null);
            $dPresentation = $this->parseDate($premiereLigne['D_PRESENTATION'] ?? null);

            $mouvementSystac = new MouvementSystac($designation, $montantSystac);
            $mouvementSystac->setMontantSystac($montantSystac);
            $mouvementSystac->setMontantGroupe(round($groupe['MONTANT_GROUPE'], 2));
            $mouvementSystac->setDesignation($designation);
            $mouvementSystac->setDateCreationIp($dCreationIp);
            $mouvementSystac->setDateGeneration($dGeneration);
            $mouvementSystac->setDateVirement($this->toMutableDate($dPresentation));

            $fiche->addMouvementSystac($mouvementSystac);

            foreach ($groupe['lignes'] as $ligneData) {
                $dPresentationLigne = $this->toMutableDate($this->parseDate($ligneData['D_PRESENTATION'] ?? null));

                $ligneSystac = new LigneSystac((string) ($ligneData['N_BV'] ?? ''), $designation);
                $ligneSystac->setCOrig($ligneData['C_ORIG'] ?? null);
                $ligneSystac->setDPresentation($dPresentationLigne);
                $ligneSystac->setLOrig($ligneData['L_ORIG'] ?? null);
                $ligneSystac->setNbRegl((float) ($ligneData['NB_REGL'] ?? 0));
                $ligneSystac->setMontantSystac((float) ($ligneData['MONTANT_SYSTAC'] ?? 0));
                $ligneSystac->setMontantGroupe((float) ($ligneData['MONTANT_GROUPE'] ?? 0));
                $ligneSystac->setDCreationIp($this->parseDate($ligneData['D_CREATION_IP'] ?? null));
                $ligneSystac->setDGeneration($this->parseDate($ligneData['D_GENERATION'] ?? null));
                $ligneSystac->setMouvementSystac($mouvementSystac);

                $this->ligneSystacRepository->save($ligneSystac);
            }
        }

        foreach ($mouvementsSigma as $paire) {
            $fiche->addMouvementSygma($paire['mouvement']);
            $this->ligneSygmaRepository->save($paire['ligne']);
        }

        $fichier = $this->excelGenerator->genererFichier($fiche);
        $fiche->setCheminFichier($fichier['chemin']);
        $fiche->setHashFichier($fichier['hash']);

        $historique = new HistoriqueFiche();
        $historique->setFicheDepot($fiche);
        $historique->setUtilisateur($user);
        $historique->setAction('CREATION');
        $historique->setNouveauStatut($fiche->getStatut());
        $historique->setDateAction(new \DateTimeImmutable());

        $this->ficheRepository->save($fiche);
        $this->historiqueRepository->save($historique);
        $this->ficheRepository->flush();

        return $fiche;
    }

    private function logStep(string|int $step, string $description, array $data): void
    {
        error_log(sprintf(
            '[pool-sr][fiche_generer] %s) %s => %s',
            $step,
            $description,
            json_encode($data, JSON_UNESCAPED_UNICODE)
        ));
    }

    private function parseDate(?string $dateStr): ?\DateTimeImmutable
    {
        if ($dateStr === null || $dateStr === '') {
            return null;
        }

        $dateStr = trim($dateStr);
        $formats = [
            'Y-m-d H:i:s',
            'Y-m-d',
            'd/m/Y H:i:s',
            'd/m/Y',
            'm/d/Y H:i:s',
            'm/d/Y',
            'd-m-Y H:i:s',
            'd-m-Y',
        ];

        foreach ($formats as $format) {
            $date = \DateTimeImmutable::createFromFormat($format, $dateStr);
            if ($date !== false) {
                return $date;
            }
        }

        return null;
    }

    private function compterParStatut(string $statut): int
    {
        return (int) $this->ficheRepository->createQueryBuilder('f')
            ->select('COUNT(f.reference)')
            ->andWhere('f.statut = :statut')
            ->setParameter('statut', $statut)
            ->getQuery()
            ->getSingleScalarResult();
    }

    private function serialiserFiche(FicheDepot $f): array
    {
        return [
            'reference' => $f->getReference(),
            'date_creation' => $f->getDateCreation()->format('d/m/Y H:i:s'),
            'montant_total' => number_format($f->getTotal(), 2, '.', ''),
            'genere_par' => $f->getUtilisateur()->getPrenom() . ' ' . $f->getUtilisateur()->getNom(),
            'statut' => $f->getStatut(),
            'hash_fichier' => $f->getHashFichier(),
            'url_apercu' => $this->urlFichier($f, 'apercu'),
            'url_telecharger' => $this->urlFichier($f, 'telecharger'),
        ];
    }

    private function urlFichier(FicheDepot $f, string $action): ?string
    {
        if ($f->getCheminFichier() === null) {
            return null;
        }

        return sprintf('/api/pool-sr/fiches/%s/%s', $f->getReference(), $action);
    }
}
