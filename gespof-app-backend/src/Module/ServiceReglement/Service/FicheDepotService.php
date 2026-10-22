<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service;

use App\Module\ServicePrevision\Entite\JourneeTresorerie\EvenementJournee;
use App\Module\ServicePrevision\Service\JournalJourneeServiceInterface;
use App\Module\ServicePrevision\Entite\FicheBleu\FicheBleue;
use App\Module\ServicePrevision\Entite\FicheBleu\Section;
use App\Module\ServicePrevision\Enum\TypeSection;
use App\Module\ServicePrevision\Repository\FicheBleueRepository;
use App\Module\ServicePrevision\Repository\JourneeTresorerieRepository;
use App\Module\ServicePrevision\Service\Exception\JourneeTresorerieIntrouvableException;
use App\Module\ServicePrevision\Service\FicheBleueServiceInterface;
use App\Module\ServiceReglement\Entite\FicheDepot;
use App\Module\ServiceReglement\Entite\HistoriqueFiche;
use App\Module\ServiceReglement\Entite\LigneSygma;
use App\Module\ServiceReglement\Entite\LigneSystac;
use App\Module\ServiceReglement\Entite\MouvementNumeraire;
use App\Module\ServiceReglement\Entite\MouvementSygma;
use App\Module\ServiceReglement\Entite\MouvementSystac;
use App\Module\ServiceReglement\Entite\Observation;
use App\Shared\Entite\Utilisateur;
use App\Shared\Enum\Portail;
use App\Shared\Service\NotificationServiceInterface;
use App\Module\ServiceReglement\Enum\StatutFiche;
use App\Module\ServiceReglement\Repository\FicheDepotRepository;
use App\Module\ServiceReglement\Repository\HistoriqueFicheRepository;
use App\Module\ServiceReglement\Repository\LigneSygmaRepository;
use App\Module\ServiceReglement\Repository\LigneSystacRepository;
use App\Module\ServiceReglement\Repository\MouvementNumeraireRepository;
use App\Module\ServiceReglement\Repository\MouvementSygmaRepository;
use App\Module\ServiceReglement\Repository\MouvementSystacRepository;
use App\Module\ServiceReglement\Repository\ObservationRepository;
use App\Module\ServiceReglement\Repository\ScriptPoolDr;
use App\Module\ServiceReglement\Service\Exception\ActionInterditeException;
use App\Module\ServiceReglement\Service\Exception\AucuneLigneTrouveeException;
use App\Module\ServiceReglement\Service\Exception\DateInvalideException;
use App\Module\ServiceReglement\Service\Exception\DonneesInvalidesException;
use App\Module\ServiceReglement\Service\Exception\FicheIntrouvableException;
use App\Module\ServiceReglement\Service\Exception\FichierIntrouvableException;
use App\Module\ServiceReglement\Service\Exception\MouvementIntrouvableException;
use App\Module\ServiceReglement\Service\Exception\StatutInvalideException;
use App\Module\ServiceReglement\Service\FicheDepotExcelGeneratorInterface;
use App\Module\ServiceReglement\Service\FicheDepotServiceInterface;
use App\Shared\Config\AppConfig;
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
        private readonly MouvementSystacRepository $mouvementSystacRepository,
        private readonly ObservationRepository $observationRepository,
        private readonly ScriptPoolDr $scriptPoolDr,
        private readonly FicheDepotExcelGeneratorInterface $excelGenerator,
        private readonly AppConfig $appConfig,
        private readonly NotificationServiceInterface $notificationService,
        private readonly JourneeTresorerieRepository $journeeTresorerieRepository,
        private readonly FicheBleueRepository $ficheBleueRepository,
        private readonly FicheBleueServiceInterface $ficheBleueService,
        private readonly JournalJourneeServiceInterface $journal,
    ) {
    }


    public function genererFicheAvecProgress(?string $dateStr, Utilisateur $user, callable $progressCallback, ?int $ficheBleueId = null): array
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

        // Les écarts Systac / montant groupé n'empêchent plus la génération :
        // ils sont contrôlés à l'envoi vers le Service Prévision.
        $progressCallback(80, 'ENREGISTREMENT DE LA FICHE DE DEPOT');

        $progressCallback(85, 'RÉCUPÉRATION DES MOUVEMENTS SIGMA');

        $mouvementsSigmaBruts = $this->scriptPoolDr->findSigmaByDate($datePresentation);
        $this->logStep('6bis', 'SIGMA — mouvements récupérés (' . count($mouvementsSigmaBruts) . ')', $mouvementsSigmaBruts);

        $mouvementsSigma = $this->construireMouvementsSigma($mouvementsSigmaBruts);

        $fiche = $this->persisterFiche($ficheDepense, $mouvementsSigma, $user, $datePresentation, StatutFiche::CREE->value, $ficheBleueId);

        $progressCallback(95, 'VISUALISATION DE LA FICHE DE DEPOT');

        return [
            'valide' => true,
            'statut' => $fiche->getStatut(),
            'date' => $datePresentation->format('Y-m-d'),
            'reference' => $fiche->getReference(),
        ];
    }


    public function genererFiche(?string $dateStr, Utilisateur $user, ?int $ficheBleueId = null): array
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

        // Génération toujours autorisée (écarts Systac contrôlés à l'envoi SP).
        $mouvementsSigma = $this->construireMouvementsSigma($this->scriptPoolDr->findSigmaByDate($datePresentation));

        $fiche = $this->persisterFiche($ficheDepense, $mouvementsSigma, $user, $datePresentation, StatutFiche::CREE->value, $ficheBleueId);

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
            ->addSelect('u')
            ->leftJoin('f.ficheBleue', 'fb')
            ->addSelect('fb');

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

    public function fichesPaginees(
        int $page,
        string $limitRaw,
        string $search,
        string $statut,
        ?string $dateDebut = null,
        ?string $dateFin = null,
    ): array {
        $page = max(1, $page);
        $limitRaw = trim($limitRaw);
        $isAll = $limitRaw === 'all';
        $limit = $isAll ? 0 : max(1, (int) $limitRaw);
        $search = trim($search);
        $statut = trim($statut);

        $debut = $this->parseDateFiltre($dateDebut, 'date_debut');
        $fin = $this->parseDateFiltre($dateFin, 'date_fin');
        if ($debut !== null && $fin !== null && $debut > $fin) {
            throw new DateInvalideException('La date de début ne peut pas être postérieure à la date de fin.');
        }

        $qb = $this->ficheRepository->createQueryBuilder('f')
            ->leftJoin('f.utilisateur', 'u')
            ->addSelect('u')
            ->leftJoin('f.ficheBleue', 'fb')
            ->addSelect('fb');

        $this->appliquerFiltresListe($qb, $search, $debut, $fin);

        if ($statut !== '') {
            $qb->andWhere('f.statut = :statut')->setParameter('statut', $statut);
        }

        $total = (int) (clone $qb)->select('COUNT(f.reference)')->getQuery()->getSingleScalarResult();

        $qb->orderBy('f.dateCreation', 'DESC');

        if (!$isAll) {
            $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit);
        }

        $fiches = $qb->getQuery()->getResult();

        $stats = [
            'cree' => $this->compterParStatutFiltre(StatutFiche::CREE->value, $search, $debut, $fin),
            'envoyee' => $this->compterParStatutFiltre(StatutFiche::ENVOYEE->value, $search, $debut, $fin),
            'recue' => $this->compterParStatutFiltre(StatutFiche::RECUE->value, $search, $debut, $fin),
            'en_attente' => $this->compterParStatutFiltre(StatutFiche::ENVOYEE->value, $search, $debut, $fin),
        ];

        $totalPages = $isAll ? 1 : max(1, (int) ceil($total / max(1, $limit)));
        $page = $isAll ? 1 : min($page, $totalPages);

        return [
            'stats' => $stats,
            'fiches' => array_map(fn(FicheDepot $f) => $this->serialiserFicheListe($f), $fiches),
            'pagination' => [
                'page' => $page,
                'limit' => $isAll ? $total : $limit,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ];
    }

    public function fichesPagineesPourSp(
        int $page,
        string $limitRaw,
        string $search,
        string $statut,
        ?string $dateDebut = null,
        ?string $dateFin = null,
    ): array {
        $page = max(1, $page);
        $limitRaw = trim($limitRaw);
        $isAll = strtolower($limitRaw) === 'all';
        $limit = $isAll ? 0 : max(1, min(500, (int) $limitRaw));
        $search = trim($search);
        $statut = mb_strtolower(trim($statut));

        $statutsVisibles = [
            StatutFiche::ENVOYEE->value,
            StatutFiche::RECUE->value,
        ];

        if ($statut !== '' && !in_array($statut, $statutsVisibles, true)) {
            throw new StatutInvalideException(
                'Le paramètre "statut" doit être envoyee ou recue.',
            );
        }

        $debut = $this->parseDateFiltre($dateDebut, 'date_debut');
        $fin = $this->parseDateFiltre($dateFin, 'date_fin');
        if ($debut !== null && $fin !== null && $debut > $fin) {
            throw new DateInvalideException('La date de début ne peut pas être postérieure à la date de fin.');
        }

        $qb = $this->ficheRepository->createQueryBuilder('f')
            ->leftJoin('f.utilisateur', 'u')
            ->addSelect('u')
            ->leftJoin('f.ficheBleue', 'fb')
            ->addSelect('fb')
            ->leftJoin('fb.journeeTresorerie', 'jt')
            ->addSelect('jt');

        if ($statut !== '') {
            $qb->andWhere('f.statut = :statut')->setParameter('statut', $statut);
        } else {
            $qb->andWhere('f.statut IN (:statuts)')->setParameter('statuts', $statutsVisibles);
        }

        if ($search !== '') {
            $qb->andWhere(
                'LOWER(f.reference) LIKE :search
                 OR LOWER(u.nom) LIKE :search
                 OR LOWER(u.prenom) LIKE :search
                 OR LOWER(jt.reference) LIKE :search',
            )->setParameter('search', '%' . mb_strtolower($search) . '%');
        }

        if ($debut !== null) {
            $qb->andWhere('f.datePresentation >= :dateDebut')
                ->setParameter('dateDebut', $debut->setTime(0, 0, 0));
        }

        if ($fin !== null) {
            $qb->andWhere('f.datePresentation <= :dateFin')
                ->setParameter('dateFin', $fin->setTime(23, 59, 59));
        }

        $total = (int) (clone $qb)->select('COUNT(f.reference)')->getQuery()->getSingleScalarResult();

        $qb->orderBy('f.dateCreation', 'DESC')->addOrderBy('f.reference', 'DESC');

        if (!$isAll) {
            $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit);
        }

        /** @var list<FicheDepot> $fiches */
        $fiches = $qb->getQuery()->getResult();

        $totalPages = $isAll ? 1 : max(1, (int) ceil($total / max(1, $limit)));
        $page = $isAll ? 1 : min($page, $totalPages);

        return [
            'fiches' => array_map(fn (FicheDepot $f): array => $this->serialiserFicheListe($f), $fiches),
            'total' => $total,
            'page' => $page,
            'pages' => $totalPages,
            'limite' => $isAll ? 'all' : $limit,
        ];
    }

    public function detail(string $reference, bool $inclureLignesSystac = true): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }

        $utilisateur = $fiche->getUtilisateur();

        $payload = [
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
            'fiche_recue' => $this->serialiserFicheRecue($fiche->getFicheBleue()),
            'journee_tresorerie_reference' => $this->referenceJournee($fiche),
            'mouvements_numeraire' => $this->trierManuelsEnTete(array_map(
                fn(MouvementNumeraire $m) => $this->serialiserMouvement($m),
                array_values($fiche->getMouvementsNumeraire()->toArray()),
            )),
            'mouvements_sygma' => $this->trierManuelsEnTete(array_map(
                fn(MouvementSygma $m) => $this->serialiserMouvement($m),
                array_values($fiche->getMouvementsSygma()->toArray()),
            )),
            // array_values : après suppressions, Doctrine laisse des trous d'index
            // qui seraient encodés en objet JSON ({"0":…,"2":…}) côté client.
            'mouvements_systac' => array_values(array_map(
                fn(MouvementSystac $m) => $this->serialiserMouvementSystac($m),
                array_values($fiche->getMouvementsSystac()->toArray()),
            )),
        ];

        if ($inclureLignesSystac) {
            $payload['lignes_systac'] = $this->trierManuelsEnTete($this->serialiserLignesSystac(
                array_values($fiche->getMouvementsSystac()->toArray()),
            ));
        }

        return $payload;
    }

    public function listerParDatePresentation(string $date, ?array $statuts = null): array
    {
        $jour = $this->parseDate($date);
        if ($jour === null) {
            throw new DateInvalideException('Le champ "date" est invalide (format YYYY-MM-DD).');
        }

        $debut = $jour->setTime(0, 0, 0);
        $fin = $jour->setTime(23, 59, 59);

        $qb = $this->ficheRepository->createQueryBuilder('f')
            ->leftJoin('f.utilisateur', 'u')
            ->addSelect('u')
            ->leftJoin('f.ficheBleue', 'fb')
            ->addSelect('fb')
            ->andWhere(
                'f.dateCreation BETWEEN :debut AND :fin
                 OR f.datePresentation BETWEEN :debut AND :fin',
            )
            ->setParameter('debut', $debut)
            ->setParameter('fin', $fin)
            ->orderBy('f.dateCreation', 'DESC')
            ->addOrderBy('f.reference', 'DESC');

        if ($statuts !== null && $statuts !== []) {
            $qb->andWhere('f.statut IN (:statuts)')->setParameter('statuts', $statuts);
        }

        /** @var list<FicheDepot> $fiches */
        $fiches = $qb->getQuery()->getResult();

        return [
            'date' => $jour->format('Y-m-d'),
            'fiches' => array_map(fn (FicheDepot $f): array => $this->serialiserFicheListe($f), $fiches),
        ];
    }

    public function listerParJourneeTresorerie(string $reference, ?array $statuts = null): array
    {
        $journee = $this->journeeTresorerieRepository->find($reference);
        if ($journee === null) {
            throw new JourneeTresorerieIntrouvableException('Journée de trésorerie introuvable.');
        }

        $qb = $this->ficheRepository->createQueryBuilder('f')
            ->leftJoin('f.utilisateur', 'u')
            ->addSelect('u')
            ->innerJoin('f.ficheBleue', 'fb')
            ->addSelect('fb')
            ->innerJoin('fb.journeeTresorerie', 'jt')
            ->andWhere('jt.reference = :journee')
            ->setParameter('journee', $reference)
            ->orderBy('f.dateCreation', 'DESC')
            ->addOrderBy('f.reference', 'DESC');

        if ($statuts !== null && $statuts !== []) {
            $qb->andWhere('f.statut IN (:statuts)')->setParameter('statuts', $statuts);
        }

        /** @var list<FicheDepot> $fiches */
        $fiches = $qb->getQuery()->getResult();

        return [
            'journee' => $reference,
            'fiches' => array_map(fn (FicheDepot $f): array => $this->serialiserFicheListe($f), $fiches),
        ];
    }

    private function serialiserMouvement(MouvementNumeraire|MouvementSygma|MouvementSystac $mouvement): array
    {
        $payload = [
            'id' => $mouvement->getId(),
            'date_virement' => $mouvement->getDateVirement()?->format('d/m/Y'),
            'beneficiaire' => $mouvement->getBeneficiaire(),
            'numero_ov' => $mouvement->getNumeroOV(),
            'banque' => $mouvement->getBanque(),
            'depenses' => $mouvement->getDepenses(),
            'observations' => array_values(array_map(
                static fn(Observation $o) => ['id' => $o->getId(), 'contenu' => $o->getContenu()],
                $mouvement->getObservations()->toArray(),
            )),
        ];

        if ($mouvement instanceof MouvementNumeraire || $mouvement instanceof MouvementSygma) {
            $payload['modifie_manuellement'] = $mouvement->isModifieManuellement();
        }

        return $payload;
    }

    /**
     * @param list<array<string, mixed>> $items
     *
     * @return list<array<string, mixed>>
     */
    private function trierManuelsEnTete(array $items): array
    {
        $manuels = [];
        $autres = [];
        foreach ($items as $item) {
            if (!empty($item['modifie_manuellement'])) {
                $manuels[] = $item;
            } else {
                $autres[] = $item;
            }
        }
        usort(
            $manuels,
            static fn(array $a, array $b): int => ((int) ($b['id'] ?? 0)) <=> ((int) ($a['id'] ?? 0)),
        );

        return array_values([...$manuels, ...$autres]);
    }

    private function serialiserMouvementSystac(MouvementSystac $mouvement): array
    {
        return [
            ...$this->serialiserMouvement($mouvement),
            'designation' => $mouvement->getDesignation(),
            'montant_systac' => $mouvement->getMontantSystac(),
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
                    'd_generation' => $ligne->getDGeneration()?->format('d/m/Y'),
                    'modifie_manuellement' => $ligne->isModifieManuellement(),
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
        if ($this->vientDEtreEnvoyeeAuSp($ancienStatut, $nouveauStatut)) {
            $this->assertPretPourEnvoiAuSp($fiche);
        }

        $fiche->setStatut($nouveauStatut);

        $historique = new HistoriqueFiche();
        $historique->setFicheDepot($fiche);
        $historique->setUtilisateur($user);
        $historique->setAction('CHANGEMENT_STATUT');
        $historique->setAncienStatut($ancienStatut);
        $historique->setNouveauStatut($nouveauStatut);
        $historique->setCommentaire($commentaire);

        $this->historiqueRepository->save($historique);
        if ($this->vientDEtreEnvoyeeAuSp($ancienStatut, $nouveauStatut)) {
            $this->notifierEnvoiAuSp($fiche);
        }
        $this->ficheRepository->flush();

        return $fiche->getStatut();
    }

    public function marquerRecueParSp(string $reference, Utilisateur $user): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }

        $statut = $fiche->getStatut();
        if ($statut === StatutFiche::CREE->value) {
            throw new ActionInterditeException("Cette fiche n'a pas encore été envoyée par le Service Règlement.");
        }
        if ($statut !== StatutFiche::RECUE->value && $fiche->getFicheBleue()?->getJourneeTresorerie()?->estCloturee()) {
            throw new ActionInterditeException('La journée de trésorerie de cette fiche est clôturée : elle ne peut plus être modifiée.');
        }

        if ($statut !== StatutFiche::RECUE->value) {
            $fiche->setStatut(StatutFiche::RECUE->value);

            $historique = new HistoriqueFiche();
            $historique->setFicheDepot($fiche);
            $historique->setUtilisateur($user);
            $historique->setAction('CHANGEMENT_STATUT');
            $historique->setAncienStatut($statut);
            $historique->setNouveauStatut(StatutFiche::RECUE->value);
            $historique->setCommentaire('Réception par le Service Prévision');
            $this->historiqueRepository->save($historique);
            $this->ficheRepository->flush();
            $this->journaliserPourJournee(
                $fiche,
                JournalJourneeServiceInterface::FICHE_DEPOT_RECUE,
                sprintf('Fiche de dépôt %s reçue par le Service Prévision', $fiche->getReference()),
            );
        }

        return [
            'reference' => $fiche->getReference(),
            'statut' => $fiche->getStatut(),
            ...$this->destinationReceptionSp($fiche),
        ];
    }

    public function cheminFichier(string $reference): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }

        // Toujours régénérer à partir du modèle courant (couleurs + feuilles Mouvement).
        $resultat = $this->excelGenerator->genererFichier($fiche);
        $fiche->setCheminFichier($resultat['chemin'])->setHashFichier($resultat['hash']);
        $this->ficheRepository->flush();

        $chemin = $this->appConfig->ficheDepensesDir() . \DIRECTORY_SEPARATOR . $resultat['chemin'];
        if (!is_file($chemin)) {
            throw new FichierIntrouvableException('Le fichier n\'a pas pu être généré sur le serveur.');
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
        if (\in_array($fiche->getStatut(), ['envoyee', 'recue'], true)) {
            throw new ActionInterditeException('Une fiche déjà envoyée ne peut pas être supprimée.');
        }
        $this->verifierModificationAutorisee($fiche, $user);
        $this->effacerFicheEtFichier($fiche);
    }

    public function supprimerPourArchives(string $reference): void
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->effacerFicheEtFichier($fiche);
    }

    private function effacerFicheEtFichier(FicheDepot $fiche): void
    {
        $reference = $fiche->getReference();
        $cheminFichier = $fiche->getCheminFichier() !== null
            ? $this->appConfig->ficheDepensesDir() . \DIRECTORY_SEPARATOR . $fiche->getCheminFichier()
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

        $this->ficheRepository->getEntityManager()->detach($fiche);

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
        if ($depenses < 0) {
            throw new DonneesInvalidesException('Le champ "depenses" ne peut pas être négatif.');
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

        $mouvement->setModifieManuellement(true);

        if ($famille === 'sygma') {
            $fiche->addMouvementSygma($mouvement);
        } else {
            $fiche->addMouvementNumeraire($mouvement);
        }

        $this->appliquerObservations($mouvement, $donnees, $famille, $fiche, estCreation: true);
        $this->ficheRepository->save($fiche);
        $this->ficheRepository->flush();

        // Pas de régénération Excel ici : cheminFichier() la refait à la demande (apercu/téléchargement).
        return $this->detail($reference);
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
        $mouvement->setModifieManuellement(true);
        $this->ficheRepository->flush();

        return $this->detail($reference);
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
    }

    public function supprimerMouvements(string $reference, string $famille, array $idsLignes, Utilisateur $user): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);
        $this->validerFamille($famille);

        $ids = array_values(array_unique(array_filter(
            array_map('intval', $idsLignes),
            static fn(int $id) => $id > 0,
        )));
        if ($ids === []) {
            throw new DonneesInvalidesException('Sélectionnez au moins une ligne à supprimer.');
        }

        $repo = $famille === 'sygma' ? $this->mouvementSygmaRepository : $this->mouvementNumeraireRepository;
        $observationIds = [];

        foreach ($ids as $id) {
            $mouvement = $this->trouverMouvementDeLaFiche($famille, $id, $fiche);
            foreach ($mouvement->getObservations()->toArray() as $observation) {
                $observationIds[] = $observation->getId();
            }
            $repo->remove($mouvement);
        }

        $repo->flush();

        foreach (array_unique(array_filter($observationIds)) as $observationId) {
            $observation = $this->observationRepository->find($observationId);
            if ($observation !== null) {
                $this->supprimerObservationSiOrpheline($observation);
            }
        }
        $this->observationRepository->flush();

        return $this->detail($reference);
    }

    public function rattacherMouvement(string $reference, string $famille, int $idSource, int $idCible, Utilisateur $user): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);
        $this->validerFamille($famille);

        $source = $this->trouverMouvementDeLaFiche($famille, $idSource, $fiche);
        $cible = $this->trouverMouvementDeLaFiche($famille, $idCible, $fiche);
        if ($source->getId() === $cible->getId()) {
            return $this->detail($reference);
        }

        $observationCible = $cible->getObservations()->first() ?: null;
        $observationSource = $source->getObservations()->first() ?: null;
        if (!$observationCible instanceof Observation) {
            $observationCible = null;
        }
        if (!$observationSource instanceof Observation) {
            $observationSource = null;
        }

        if ($observationCible === null && $observationSource === null) {
            throw new DonneesInvalidesException(
                'Ajoutez d\'abord une observation pour regrouper ces lignes.',
            );
        }

        $observation = $observationCible ?? $observationSource;
        if (!$observation instanceof Observation) {
            throw new DonneesInvalidesException(
                'Ajoutez d\'abord une observation pour regrouper ces lignes.',
            );
        }
        if ($observationCible === null && $observationSource !== null) {
            $cible->addObservation($observationSource);
            $observation = $observationSource;
        }

        foreach ($source->getObservations()->toArray() as $obs) {
            if ($obs !== $observation) {
                $source->removeObservation($obs);
                $this->supprimerObservationSiOrpheline($obs);
            }
        }
        if (!$source->getObservations()->contains($observation)) {
            $source->addObservation($observation);
        }

        $this->ficheRepository->flush();

        return $this->detail($reference);
    }

    public function deplacerLigneSystac(string $reference, int $idLigne, int $idGroupeCible, Utilisateur $user): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);

        $ligne = $this->ligneSystacRepository->find($idLigne);
        $source = $ligne?->getMouvementSystac();
        if (
            $ligne === null
            || $source === null
            || $source->getFicheDepot()?->getReference() !== $fiche->getReference()
        ) {
            throw new MouvementIntrouvableException('Ligne Systac introuvable pour cette fiche.');
        }

        $cible = $this->mouvementSystacRepository->find($idGroupeCible);
        if ($cible === null || $cible->getFicheDepot()?->getReference() !== $fiche->getReference()) {
            throw new MouvementIntrouvableException('Groupe Systac introuvable pour cette fiche.');
        }

        if ($source->getId() === $cible->getId()) {
            return $this->detail($reference);
        }

        $this->deplacerLigneVersGroupe($ligne, $cible, $cible->getDesignation());
        $this->ligneSystacRepository->flush();
        $this->recalculerMontantsGroupeSystac($cible);
        $this->recalculerMontantsGroupeSystac($source);
        $this->supprimerGroupeSystacSiVide($fiche, $source);

        $this->ficheRepository->flush();

        return $this->detail($reference);
    }

    public function regrouperLignesSystac(string $reference, array $idsLignes, Utilisateur $user): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);

        $ids = array_values(array_unique(array_filter(
            array_map('intval', $idsLignes),
            static fn(int $id) => $id > 0,
        )));
        if (\count($ids) < 2) {
            throw new DonneesInvalidesException('Sélectionnez au moins deux lignes à regrouper.');
        }

        $lignes = [];
        foreach ($ids as $id) {
            $ligne = $this->ligneSystacRepository->find($id);
            if ($ligne === null || $ligne->getMouvementSystac()?->getFicheDepot()?->getReference() !== $fiche->getReference()) {
                throw new MouvementIntrouvableException('Ligne Systac introuvable pour cette fiche.');
            }
            $lignes[] = $ligne;
        }

        $cible = $lignes[0]->getMouvementSystac();
        if ($cible === null) {
            throw new MouvementIntrouvableException('Groupe Systac introuvable pour cette fiche.');
        }

        // Désignation = premier sélectionné ; MONTANTS GROUPÉS = somme des parts après synchro.
        // D_GENERATION_IP reste propre à chaque ligne (jamais modifié ici).
        $designationPremiere = (string) ($cible->getDesignation() ?: $lignes[0]->getDesignation());

        // Aligne les montants_groupe ligne ↔ total affiché pour les groupes mono-ligne sélectionnés.
        foreach ($lignes as $ligne) {
            $groupe = $ligne->getMouvementSystac();
            if ($groupe !== null && $this->ligneSystacRepository->count(['mouvementSystac' => $groupe]) === 1) {
                $ligne->setMontantGroupe($groupe->getMontantGroupe());
            }
            $ligne->setModifieManuellement(true);
        }

        $sources = [];
        foreach (\array_slice($lignes, 1) as $ligne) {
            $source = $this->deplacerLigneVersGroupe($ligne, $cible, $designationPremiere);
            if ($source !== null && $source->getId() !== null) {
                $sources[$source->getId()] = $source;
            }
        }

        $cible->setDesignation($designationPremiere);
        $cible->setBeneficiaire($designationPremiere);
        foreach ($this->ligneSystacRepository->findBy(['mouvementSystac' => $cible]) as $ligneCible) {
            $ligneCible->setDesignation($designationPremiere);
        }
        foreach ($lignes as $ligne) {
            $ligne->setDesignation($designationPremiere);
        }

        $this->ligneSystacRepository->flush();
        $this->recalculerMontantsGroupeSystac($cible);
        foreach ($sources as $source) {
            $this->recalculerMontantsGroupeSystac($source);
            $this->supprimerGroupeSystacSiVide($fiche, $source);
        }

        $this->ficheRepository->flush();

        return $this->detail($reference);
    }

    private function deplacerLigneVersGroupe(
        LigneSystac $ligne,
        MouvementSystac $cible,
        ?string $designationCible = null,
    ): ?MouvementSystac {
        $source = $ligne->getMouvementSystac();
        if ($source === null || $source->getId() === $cible->getId()) {
            return null;
        }

        // Initialiser les collections avant mutation pour éviter les états Doctrine incohérents.
        $source->getLignesSystac()->toArray();
        $cible->getLignesSystac()->toArray();

        $source->detachLigneSystac($ligne);
        $ligne->setMouvementSystac($cible);
        if (!$cible->getLignesSystac()->contains($ligne)) {
            $cible->getLignesSystac()->add($ligne);
        }
        $ligne->setDesignation($designationCible ?? $cible->getDesignation() ?? '');
        // d_generation (D_GENERATION_IP) n'est jamais modifié : date propre à la ligne.

        return $source;
    }

    private function supprimerGroupeSystacSiVide(FicheDepot $fiche, MouvementSystac $groupe): void
    {
        if ($this->ligneSystacRepository->count(['mouvementSystac' => $groupe]) > 0) {
            return;
        }

        $groupe->getLignesSystac()->clear();
        $fiche->removeMouvementSystac($groupe);
        $this->mouvementSystacRepository->remove($groupe);
    }

    public function renommerGroupeSystac(string $reference, int $idGroupe, string $designation, Utilisateur $user): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);

        $designation = $this->normaliserDesignation($designation);
        if ($designation === '') {
            throw new DonneesInvalidesException('La désignation est requise.');
        }
        $designation = self::DESIGNATIONS_EQUIVALENTES[$designation] ?? $designation;

        $groupe = $this->mouvementSystacRepository->find($idGroupe);
        if ($groupe === null || $groupe->getFicheDepot()?->getReference() !== $fiche->getReference()) {
            throw new MouvementIntrouvableException('Groupe Systac introuvable pour cette fiche.');
        }

        $existant = null;
        foreach ($fiche->getMouvementsSystac() as $mouvement) {
            if (
                $mouvement->getId() !== $groupe->getId()
                && $this->normaliserDesignation((string) $mouvement->getDesignation()) === $designation
            ) {
                $existant = $mouvement;
                break;
            }
        }

        if ($existant !== null) {
            $groupe->getLignesSystac()->toArray();
            $existant->getLignesSystac()->toArray();
            foreach ($this->ligneSystacRepository->findBy(['mouvementSystac' => $groupe]) as $ligne) {
                $existant->addLigneSystac($ligne);
                $ligne->setDesignation($existant->getDesignation() ?? $designation);
                $groupe->detachLigneSystac($ligne);
            }
            $this->ligneSystacRepository->flush();
            $this->recalculerMontantsGroupeSystac($existant);
            $fiche->removeMouvementSystac($groupe);
        } else {
            $groupe->setDesignation($designation);
            $groupe->setBeneficiaire($designation);
            foreach ($this->ligneSystacRepository->findBy(['mouvementSystac' => $groupe]) as $ligne) {
                $ligne->setDesignation($designation);
            }
        }

        $this->ficheRepository->flush();

        return $this->detail($reference);
    }

    public function supprimerLignesSystac(string $reference, array $idsLignes, Utilisateur $user): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);

        $ids = array_values(array_unique(array_filter(
            array_map('intval', $idsLignes),
            static fn(int $id) => $id > 0,
        )));
        if ($ids === []) {
            throw new DonneesInvalidesException('Sélectionnez au moins une ligne à supprimer.');
        }

        /** @var array<int, MouvementSystac> $groupesAffectes */
        $groupesAffectes = [];
        foreach ($ids as $id) {
            $ligne = $this->ligneSystacRepository->find($id);
            $groupe = $ligne?->getMouvementSystac();
            if (
                $ligne === null
                || $groupe === null
                || $groupe->getFicheDepot()?->getReference() !== $fiche->getReference()
            ) {
                throw new MouvementIntrouvableException('Ligne Systac introuvable pour cette fiche.');
            }
            $groupesAffectes[$groupe->getId() ?? 0] = $groupe;
            $groupe->detachLigneSystac($ligne);
            $ligne->setMouvementSystac(null);
            $this->ligneSystacRepository->remove($ligne);
        }

        $this->ligneSystacRepository->flush();

        foreach ($groupesAffectes as $groupe) {
            $this->recalculerMontantsGroupeSystac($groupe);
            $this->supprimerGroupeSystacSiVide($fiche, $groupe);
        }

        $this->ficheRepository->flush();

        return $this->detail($reference);
    }

    public function creerLigneSystac(string $reference, array $donnees, Utilisateur $user): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);

        $designation = $this->normaliserDesignation(
            \is_string($donnees['designation'] ?? null) ? $donnees['designation'] : 'Nouvelle ligne',
        );
        if ($designation === '') {
            $designation = 'Nouvelle ligne';
        }
        $nBv = \is_string($donnees['n_bv'] ?? null) && trim($donnees['n_bv']) !== ''
            ? trim($donnees['n_bv'])
            : 'NOUVEAU';
        $montantSystac = \is_numeric($donnees['montant_systac'] ?? null) ? (float) $donnees['montant_systac'] : 0.0;
        $montantGroupe = \is_numeric($donnees['montant_groupe'] ?? null) ? (float) $donnees['montant_groupe'] : $montantSystac;

        $mouvement = new MouvementSystac($designation, $montantSystac);
        $mouvement->setDesignation($designation);
        $mouvement->setMontantSystac($montantSystac);
        $mouvement->setMontantGroupe($montantGroupe);
        $mouvement->setDepenses($montantSystac);
        $fiche->addMouvementSystac($mouvement);

        $ligne = new LigneSystac($nBv, $designation);
        $ligne->setCOrig(\is_string($donnees['c_orig'] ?? null) ? trim($donnees['c_orig']) ?: null : null);
        $ligne->setLOrig(\is_string($donnees['l_orig'] ?? null) ? trim($donnees['l_orig']) ?: null : null);
        $ligne->setNbRegl(\is_numeric($donnees['nb_regl'] ?? null) ? (float) $donnees['nb_regl'] : 1.0);
        $ligne->setMontantSystac($montantSystac);
        $ligne->setMontantGroupe($montantGroupe);
        $ligne->setModifieManuellement(true);
        if (\is_string($donnees['d_generation'] ?? null) && trim($donnees['d_generation']) !== '') {
            $date = $this->parseDate(trim($donnees['d_generation']));
            if ($date === null) {
                throw new DonneesInvalidesException('Le champ "d_generation" est dans un format non reconnu.');
            }
            $ligne->setDGeneration($date);
        }
        $mouvement->addLigneSystac($ligne);
        $this->ligneSystacRepository->save($ligne);

        $this->ficheRepository->save($fiche);
        $this->ficheRepository->flush();

        return $this->detail($reference);
    }

    public function modifierLigneSystac(string $reference, int $idLigne, array $donnees, Utilisateur $user): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);

        $ligne = $this->ligneSystacRepository->find($idLigne);
        $groupe = $ligne?->getMouvementSystac();
        if (
            $ligne === null
            || $groupe === null
            || $groupe->getFicheDepot()?->getReference() !== $fiche->getReference()
        ) {
            throw new MouvementIntrouvableException('Ligne Systac introuvable pour cette fiche.');
        }

        if (\array_key_exists('c_orig', $donnees)) {
            $ligne->setCOrig(\is_string($donnees['c_orig']) ? trim($donnees['c_orig']) ?: null : null);
        }
        if (\array_key_exists('l_orig', $donnees)) {
            $ligne->setLOrig(\is_string($donnees['l_orig']) ? trim($donnees['l_orig']) ?: null : null);
        }
        if (\array_key_exists('n_bv', $donnees)) {
            $nBv = \is_string($donnees['n_bv']) ? trim($donnees['n_bv']) : '';
            if ($nBv === '') {
                throw new DonneesInvalidesException('Le champ "n_bv" est requis.');
            }
            $ligne->setNBv($nBv);
        }
        if (\array_key_exists('nb_regl', $donnees)) {
            if (!\is_numeric($donnees['nb_regl'])) {
                throw new DonneesInvalidesException('Le champ "nb_regl" doit être un nombre.');
            }
            $ligne->setNbRegl((float) $donnees['nb_regl']);
        }
        if (\array_key_exists('montant_systac', $donnees)) {
            if (!\is_numeric($donnees['montant_systac'])) {
                throw new DonneesInvalidesException('Le champ "montant_systac" doit être un nombre.');
            }
            $ligne->setMontantSystac((float) $donnees['montant_systac']);
        }
        if (\array_key_exists('d_generation', $donnees)) {
            $brut = \is_string($donnees['d_generation']) ? trim($donnees['d_generation']) : '';
            if ($brut === '') {
                $ligne->setDGeneration(null);
            } else {
                $date = $this->parseDate($brut);
                if ($date === null) {
                    throw new DonneesInvalidesException('Le champ "d_generation" est dans un format non reconnu.');
                }
                $ligne->setDGeneration($date);
            }
        }

        if (\array_key_exists('montant_groupe', $donnees)) {
            if (!\is_numeric($donnees['montant_groupe'])) {
                throw new DonneesInvalidesException('Le champ "montant_groupe" doit être un nombre.');
            }
            $nouveauTotal = (float) $donnees['montant_groupe'];
            $lignesGroupe = $this->ligneSystacRepository->findBy(['mouvementSystac' => $groupe]);
            $sommeAutres = 0.0;
            foreach ($lignesGroupe as $autre) {
                if ($autre->getId() !== $ligne->getId()) {
                    $sommeAutres += $autre->getMontantGroupe();
                }
            }
            $ligne->setMontantGroupe(round($nouveauTotal - $sommeAutres, 2));
        }

        if (\array_key_exists('designation', $donnees)) {
            $designation = $this->normaliserDesignation(
                \is_string($donnees['designation']) ? $donnees['designation'] : '',
            );
            if ($designation === '') {
                throw new DonneesInvalidesException('La désignation est requise.');
            }
            $designation = self::DESIGNATIONS_EQUIVALENTES[$designation] ?? $designation;
            $groupe->setDesignation($designation);
            $groupe->setBeneficiaire($designation);
            foreach ($this->ligneSystacRepository->findBy(['mouvementSystac' => $groupe]) as $l) {
                $l->setDesignation($designation);
                $l->setModifieManuellement(true);
            }
        }

        $ligne->setModifieManuellement(true);
        $this->recalculerMontantsGroupeSystac($groupe);
        $this->ligneSystacRepository->flush();
        $this->ficheRepository->flush();

        return $this->detail($reference);
    }

    public function regrouperMouvements(string $reference, string $famille, array $idsLignes, Utilisateur $user): array
    {
        $fiche = $this->ficheRepository->findOneBy(['reference' => $reference]);
        if ($fiche === null) {
            throw new FicheIntrouvableException('Fiche introuvable.');
        }
        $this->verifierModificationAutorisee($fiche, $user);
        $this->validerFamille($famille);

        $ids = array_values(array_unique(array_filter(
            array_map('intval', $idsLignes),
            static fn(int $id) => $id > 0,
        )));
        if (\count($ids) < 2) {
            throw new DonneesInvalidesException('Sélectionnez au moins deux lignes à regrouper.');
        }

        $mouvements = [];
        foreach ($ids as $id) {
            $mouvements[] = $this->trouverMouvementDeLaFiche($famille, $id, $fiche);
        }

        $cible = $mouvements[0];

        // Observation = contenu du premier sélectionné (créée si absente).
        $observationCible = $cible->getObservations()->first() ?: null;
        if (!$observationCible instanceof Observation) {
            $observationCible = new Observation('Regroupement');
            $cible->addObservation($observationCible);
        }
        $contenuPremier = trim($observationCible->getContenu());
        if ($contenuPremier === '') {
            $contenuPremier = 'Regroupement';
            $observationCible->setContenu($contenuPremier);
        }

        // Dépenses = somme des dépenses sélectionnées, portée par la première ligne.
        $sommeDepenses = 0.0;
        foreach ($mouvements as $mouvement) {
            $sommeDepenses += $mouvement->getDepenses();
        }
        $cible->setDepenses(round($sommeDepenses, 2));
        $cible->setModifieManuellement(true);

        foreach (\array_slice($mouvements, 1) as $source) {
            foreach ($source->getObservations()->toArray() as $obs) {
                if ($obs !== $observationCible) {
                    $source->removeObservation($obs);
                    $this->supprimerObservationSiOrpheline($obs);
                }
            }
            if (!$source->getObservations()->contains($observationCible)) {
                $source->addObservation($observationCible);
            }
            $source->setDepenses(0.0);
            $source->setModifieManuellement(true);
        }

        $this->ficheRepository->flush();

        return $this->detail($reference);
    }

    private function recalculerMontantsGroupeSystac(MouvementSystac $groupe): void
    {
        $lignes = $this->ligneSystacRepository->findBy(['mouvementSystac' => $groupe]);
        $systac = 0.0;
        $montantGroupe = 0.0;
        $designation = $groupe->getDesignation() ?? '';
        foreach ($lignes as $ligne) {
            $systac += $ligne->getMontantSystac();
            $montantGroupe += $ligne->getMontantGroupe();
            if ($ligne->getDesignation() !== $designation) {
                $ligne->setDesignation($designation);
            }
        }
        $groupe->setMontantSystac(round($systac, 2));
        $groupe->setMontantGroupe(round($montantGroupe, 2));
        $groupe->setDepenses(round($systac, 2));
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

    /**
     * Conditions d'envoi au Service Prévision.
     * Aujourd'hui : cohérence Systac / montant groupé.
     * D'autres contrôles (ex. SYGMA) pourront être ajoutés ici plus tard.
     */
    private function assertPretPourEnvoiAuSp(FicheDepot $fiche): void
    {
        $systac = $fiche->getTotalSystac();
        $groupe = $fiche->getTotalGroupe();
        if (abs($systac - $groupe) >= 0.01) {
            throw new DonneesInvalidesException(sprintf(
                'Envoi impossible : le montant Systac (%s) ne correspond pas au montant groupé (%s). Corrigez les regroupements Systac avant d\'envoyer au Service Prévision.',
                number_format($systac, 2, '.', ''),
                number_format($groupe, 2, '.', ''),
            ));
        }
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

    public function ficheRecuePourDate(string $date): array
    {
        $jour = $this->parseDate($date);
        if ($jour === null) {
            throw new DateInvalideException('Le champ "date" est invalide (format YYYY-MM-DD).');
        }

        $fiche = $this->ficheBleueDuJour($jour);
        if ($fiche === null) {
            $this->assurerRappelAttenteFicheBleue($jour->format('Y-m-d'));
        }

        return [
            'date' => $jour->format('Y-m-d'),
            'fiche' => $this->serialiserFicheRecue($fiche),
        ];
    }

    public function fichesRecuesRecentes(int $limite = 30): array
    {
        $journees = $this->journeeTresorerieRepository->createQueryBuilder('j')
            ->innerJoin('j.ficheBleue', 'fb')
            ->addSelect('fb')
            ->orderBy('j.dateCreation', 'DESC')
            ->setMaxResults(max(1, min(100, $limite)))
            ->getQuery()
            ->getResult();

        $fiches = [];
        foreach ($journees as $journee) {
            $fiches[] = [
                ...($this->serialiserFicheRecue($journee->getFicheBleue()) ?? []),
                'journee_date' => $journee->getDateCreation()->format('Y-m-d'),
            ];
        }

        return ['fiches' => $fiches];
    }

    public function assurerRappelAttenteFicheBleue(?string $date = null): void
    {
        $jour = $date !== null && $date !== ''
            ? $this->parseDate($date)
            : new \DateTimeImmutable('today');
        if ($jour === null) {
            return;
        }

        $dateIso = $jour->format('Y-m-d');
        $aujourdHui = (new \DateTimeImmutable('today'))->format('Y-m-d');
        if ($dateIso !== $aujourdHui) {
            return;
        }

        if ($this->ficheBleueDuJour($jour) !== null) {
            return;
        }

        if ($this->notificationService->existePourCible(
            Portail::SR->value,
            'attente_fiche_bleue',
            'journee',
            $dateIso,
        )) {
            return;
        }

        $this->notificationService->creer(
            Portail::SR->value,
            'attente_fiche_bleue',
            'Fiche Bleue en attente',
            'Service reglement, attends la fiche bleu de la journée...',
            'journee',
            $dateIso,
            sprintf('/sr/generer?date=%s', $dateIso),
            ['date' => $dateIso],
            true,
        );
    }

    public function detailFicheRecue(int $id): array
    {
        $fiche = $this->ficheBleueRepository->find($id);
        if ($fiche === null || $fiche->getJourneeTresorerie() === null) {
            throw new FicheIntrouvableException(
                'Cette fiche n\'a pas été transmise au Service Règlement.',
            );
        }

        return $this->restreindreAuxDepenses($this->ficheBleueService->detail($id));
    }

    /**
     * Le SR ne reçoit que les sections Dépenses (pas le solde ni les recettes).
     *
     * @param array{fiche: array<string, mixed>} $detail
     * @return array{fiche: array<string, mixed>}
     */
    private function restreindreAuxDepenses(array $detail): array
    {
        $fiche = $detail['fiche'];
        $sections = is_array($fiche['sections'] ?? null) ? $fiche['sections'] : [];
        $depenses = array_values(array_filter(
            $sections,
            static fn (mixed $section): bool => is_array($section)
                && ($section['type'] ?? '') === TypeSection::DEPENSE->value,
        ));

        $total = '0.00';
        foreach ($depenses as $section) {
            $total = bcadd($total, (string) ($section['montant_programme'] ?? '0'), 2);
        }

        $fiche['sections'] = $depenses;
        $fiche['montant_total_programme'] = $total;
        $fiche['montant_total_realise'] = '0.00';
        $fiche['montant_total_ecart'] = '0.00';
        $fiche['section_solde'] = null;
        $fiche['partie'] = 'depense';

        return ['fiche' => $fiche];
    }

    private function persisterFiche(
        array $ficheDepense,
        array $mouvementsSigma,
        Utilisateur $user,
        \DateTimeImmutable $datePresentation,
        string $statut,
        ?int $ficheBleueId = null,
    ): FicheDepot {
        $fiche = new FicheDepot($datePresentation);
        $fiche->setUtilisateur($user);
        $fiche->setDateCreation(new \DateTimeImmutable());
        $fiche->setDatePresentation($this->toMutableDate($datePresentation));
        $fiche->setStatut($statut);
        $fiche->setFicheBleue($this->resoudreFicheBleue($datePresentation, $ficheBleueId));

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
        if ($statut === StatutFiche::ENVOYEE->value) {
            $this->notifierEnvoiAuSp($fiche);
        }
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

    private function vientDEtreEnvoyeeAuSp(?string $ancienStatut, string $nouveauStatut): bool
    {
        $dejaChezSp = \in_array($ancienStatut, [
            StatutFiche::ENVOYEE->value,
            StatutFiche::RECUE->value,
        ], true);

        return $nouveauStatut === StatutFiche::ENVOYEE->value && !$dejaChezSp;
    }

    /** Audit journalier de la journée liée (via la Fiche Bleue), s'il y en a une. */
    private function journaliserPourJournee(FicheDepot $fiche, string $type, string $libelle): void
    {
        $journee = $fiche->getFicheBleue()?->getJourneeTresorerie();
        if ($journee !== null) {
            $this->journal->enregistrer($journee, $type, $libelle, [
                'fiche_depot' => $fiche->getReference(),
                'montant_total' => number_format($fiche->getTotal(), 2, '.', ''),
            ]);
        }
    }

    private function notifierEnvoiAuSp(FicheDepot $fiche): void
    {
        $this->journaliserPourJournee(
            $fiche,
            JournalJourneeServiceInterface::FICHE_DEPOT_ENVOYEE,
            sprintf(
                'Fiche de dépôt %s envoyée par le Service Règlement (%s)',
                $fiche->getReference(),
                EvenementJournee::formaterMontant($fiche->getTotal()),
            ),
        );

        $date = $fiche->getDatePresentation()->format('Y-m-d');
        $destination = $this->destinationReceptionSp($fiche);
        $journeeRef = $destination['journee_tresorerie_reference'];

        $this->notificationService->creer(
            Portail::SP->value,
            'fiche_depot_envoyee',
            'Fiche de dépôt envoyée',
            $journeeRef !== null
                ? sprintf(
                    'La fiche %s a été envoyée par le Service Règlement pour la journée %s.',
                    $fiche->getReference(),
                    $journeeRef,
                )
                : sprintf(
                    'La fiche %s a été envoyée par le Service Règlement.',
                    $fiche->getReference(),
                ),
            'fiche_depot',
            $fiche->getReference(),
            $destination['lien'],
            [
                'fiche_reference' => $fiche->getReference(),
                'date_presentation' => $date,
                'journee_tresorerie_reference' => $journeeRef,
            ],
        );
    }

    /**
     * @return array{journee_tresorerie_reference: ?string, lien: string}
     */
    private function destinationReceptionSp(FicheDepot $fiche): array
    {
        $date = $fiche->getDatePresentation()->format('Y-m-d');
        $journeeRef = $this->referenceJournee($fiche)
            ?? $this->journeeTresorerieRepository->trouverDuJour($fiche->getDatePresentation())?->getReference();

        return [
            'journee_tresorerie_reference' => $journeeRef,
            'lien' => $journeeRef !== null
                ? sprintf(
                    '/sp/fiche-matinale/journee/%s?onglet=fiche-depot',
                    rawurlencode($journeeRef),
                )
                : sprintf('/sp/fiche-matinale?date=%s&onglet=fiche-depot', $date),
        ];
    }

    private function compterParStatut(string $statut): int
    {
        return $this->compterParStatutFiltre($statut, '', null, null);
    }

    private function compterParStatutFiltre(
        string $statut,
        string $search,
        ?\DateTimeImmutable $debut,
        ?\DateTimeImmutable $fin,
    ): int {
        $qb = $this->ficheRepository->createQueryBuilder('f')
            ->select('COUNT(f.reference)')
            ->leftJoin('f.utilisateur', 'u')
            ->andWhere('f.statut = :statut')
            ->setParameter('statut', $statut);

        $this->appliquerFiltresListe($qb, $search, $debut, $fin);

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    /**
     * @param \Doctrine\ORM\QueryBuilder $qb
     */
    private function appliquerFiltresListe(
        $qb,
        string $search,
        ?\DateTimeImmutable $debut,
        ?\DateTimeImmutable $fin,
    ): void {
        if ($search !== '') {
            $qb->andWhere('LOWER(f.reference) LIKE :search OR LOWER(u.nom) LIKE :search OR LOWER(u.prenom) LIKE :search')
                ->setParameter('search', '%' . mb_strtolower($search) . '%');
        }

        if ($debut !== null) {
            $qb->andWhere('f.datePresentation >= :dateDebut')
                ->setParameter('dateDebut', $debut->setTime(0, 0, 0));
        }

        if ($fin !== null) {
            $qb->andWhere('f.datePresentation <= :dateFin')
                ->setParameter('dateFin', $fin->setTime(23, 59, 59));
        }
    }

    private function parseDateFiltre(?string $dateStr, string $champ): ?\DateTimeImmutable
    {
        if ($dateStr === null || trim($dateStr) === '') {
            return null;
        }

        $date = \DateTimeImmutable::createFromFormat('Y-m-d', trim($dateStr));
        if ($date === false || $date->format('Y-m-d') !== trim($dateStr)) {
            throw new DateInvalideException(sprintf('Le champ "%s" doit être au format YYYY-MM-DD.', $champ));
        }

        return $date->setTime(0, 0, 0);
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
            'chemin_fichier' => $this->urlFichier($f, 'telecharger'),
            'fiche_recue' => $this->serialiserFicheRecue($f->getFicheBleue()),
            'journee_tresorerie_reference' => $this->referenceJournee($f),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserFicheListe(FicheDepot $f): array
    {
        $presentationFr = $f->getDatePresentation()->format('d/m/Y');

        return [
            ...$this->serialiserFiche($f),
            'datePresentation' => $presentationFr,
            'date_presentation' => $presentationFr,
            'date_presentation_libelle' => $presentationFr,
            'date_presentation_iso' => $f->getDatePresentation()->format('Y-m-d'),
        ];
    }

    private function referenceJournee(FicheDepot $fiche): ?string
    {
        return $fiche->getFicheBleue()?->getJourneeTresorerie()?->getReference();
    }

    private function resoudreFicheBleue(\DateTimeImmutable $datePresentation, ?int $ficheBleueId): ?FicheBleue
    {
        if ($ficheBleueId !== null && $ficheBleueId > 0) {
            $fiche = $this->ficheBleueRepository->find($ficheBleueId);
            if ($fiche === null) {
                throw new DonneesInvalidesException('La fiche reçue du Service Prévision est introuvable.');
            }

            return $fiche;
        }

        return $this->ficheBleueDuJour($datePresentation);
    }

    private function ficheBleueDuJour(\DateTimeInterface $date): ?FicheBleue
    {
        return $this->journeeTresorerieRepository->trouverDuJour($date)?->getFicheBleue();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function serialiserFicheRecue(?FicheBleue $fiche): ?array
    {
        if ($fiche === null) {
            return null;
        }

        return [
            'id' => $fiche->getId(),
            'reference' => $fiche->getReference(),
            'createur' => $fiche->getCreateur(),
            'montant_total_programme' => $this->totalDepensesProgramme($fiche),
            'journee_tresorerie_reference' => $fiche->getJourneeTresorerie()?->getReference(),
            'partie' => 'depense',
        ];
    }

    private function totalDepensesProgramme(FicheBleue $fiche): string
    {
        $total = '0.00';
        foreach ($fiche->getSections() as $section) {
            if (!$section instanceof Section || $section->estSousSection()) {
                continue;
            }
            if ($section->getType() === TypeSection::DEPENSE) {
                $total = bcadd($total, $section->getMontantProgramme(), 2);
            }
        }

        return $total;
    }

    private function urlFichier(FicheDepot $f, string $action): ?string
    {
        // URL toujours exposée : le téléchargement régénère le fichier à la volée.
        return sprintf(
            '/api/v1/sr/service-reglement/fiches/%s/%s',
            rawurlencode($f->getReference()),
            $action,
        );
    }
}
