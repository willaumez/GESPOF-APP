<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\IgOperation;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Import\MontantSaisiCompte;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\CompteDouane;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\QualificationTransfert;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\Rapprochement;
use App\Module\ServiceOperationsFinancieres\Enum\DomaineRapprochement;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\SensMontantCompte;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Enum\TypeCompteDouane;
use App\Module\ServiceOperationsFinancieres\Enum\TypeRecetteTransfert;
use App\Module\ServiceOperationsFinancieres\Repository\CompteDouaneRepository;
use App\Module\ServiceOperationsFinancieres\Repository\IgOperationRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\MontantSaisiCompteRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\QualificationTransfertRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RapprochementRepository;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Rapprochement DOMF / DRPHP (Recettes › Pétrolières / Douanières).
 */
class RapprochementService
{
    /** Types affichés côté pétrole (maquette pet-rapprochement). */
    private const TYPES_PETROLE = [
        TypeRecetteTransfert::IS,
        TypeRecetteTransfert::DIVIDENDES,
        TypeRecetteTransfert::RMP,
        TypeRecetteTransfert::REDEVANCE_SUP,
        TypeRecetteTransfert::PROFIT_OIL,
        TypeRecetteTransfert::DISCOUNT_BONI,
    ];

    private const SOURCE_DOUANE = 'ig-douanes';
    private const COMPTE_RUSID = '4663-218';

    /** Libellés de groupe maquette dou-mois. */
    private const GROUPES_LIBELLES = [
        'DOUANE_A_CREDIT' => 'À crédit',
        'DOUANE_AU_COMPTANT' => 'Au comptant',
        'DOUANE_MANUELLE' => 'Manuelle',
        'RUSID' => 'RUSID',
        'COMPTE_DE_TRANSFERT' => 'Compte de transfert',
    ];

    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly IgOperationRepository $igOperationRepository,
        private readonly QualificationTransfertRepository $qualificationRepository,
        private readonly MontantSaisiCompteRepository $montantSaisiCompteRepository,
        private readonly RapprochementRepository $rapprochementRepository,
        private readonly CompteDouaneRepository $compteDouaneRepository,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function listerPetrole(?int $periodeId = null): array
    {
        return $this->lister(DomaineRapprochement::PETROLE, $periodeId);
    }

    /**
     * @return array<string, mixed>
     */
    public function listerDouane(?int $periodeId = null): array
    {
        $base = $this->lister(DomaineRapprochement::DOUANE, $periodeId);
        /** @var array<string, array<string, mixed>> $parCle */
        $parCle = [];
        foreach ($base['lignes'] as $ligne) {
            if (\is_array($ligne) && isset($ligne['cle'])) {
                $parCle[(string) $ligne['cle']] = $ligne;
            }
        }
        $groupes = [];
        foreach ($this->groupesDouaneReferentiel() as $groupeLibelle => $comptes) {
            $lignes = [];
            foreach (array_keys($comptes) as $cle) {
                if (isset($parCle[$cle])) {
                    $lignes[] = $parCle[$cle];
                }
            }
            if ($lignes === []) {
                continue;
            }
            $groupes[] = [
                'libelle' => $groupeLibelle,
                'lignes' => $lignes,
            ];
        }
        $base['groupes'] = $groupes;

        return $base;
    }

    /**
     * @return array<string, mixed>
     */
    public function lister(DomaineRapprochement $domaine, ?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'periode' => null,
                'domaine' => $domaine->value,
                'lignes' => [],
                'ecart_total' => '0.00',
                'ecarts_commentes' => true,
                'valide' => false,
                'message' => 'Aucune période SROT.',
            ];
        }

        $cles = $this->clesDomaine($domaine);
        $domfParCle = $this->montantsDomf($domaine, $periode->getId());

        /** @var array<string, Rapprochement> $existants */
        $existants = [];
        foreach ($this->rapprochementRepository->listerParPeriodeDomaine($periode->getId(), $domaine) as $r) {
            $existants[$r->getCle()] = $r;
        }

        $lignes = [];
        $ecartTotal = '0.00';
        $ecartsCommentes = true;
        $valide = true;

        foreach ($cles as $cle => $libelle) {
            $domf = $domfParCle[$cle] ?? '0.00';
            $row = $existants[$cle] ?? null;
            if (!$row instanceof Rapprochement) {
                $row = new Rapprochement($periode, $domaine, $cle, $domf, '0.00');
                $this->em->persist($row);
                $existants[$cle] = $row;
            } else {
                $row->setMontantDomf($domf);
            }

            $ecart = $row->ecart();
            $ecartTotal = bcadd($ecartTotal, $ecart, 2);
            if (bccomp($ecart, '0.00', 2) !== 0 && ($row->getCommentaire() === null || $row->getCommentaire() === '')) {
                $ecartsCommentes = false;
            }
            if (!$row->estValide()) {
                $valide = false;
            }

            $lignes[] = $this->serialiserLigne($row, $libelle);
        }

        $this->em->flush();

        return [
            'periode' => $this->serialiserPeriode($periode),
            'domaine' => $domaine->value,
            'lignes' => $lignes,
            'ecart_total' => $ecartTotal,
            'ecarts_commentes' => $ecartsCommentes,
            'valide' => $valide && $ecartsCommentes,
            'message' => null,
        ];
    }

    /**
     * @param array{cle?: string, montant_externe?: string|float|int, commentaire?: string|null} $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrerLigne(
        DomaineRapprochement $domaine,
        int $periodeId,
        array $donnees,
    ): array {
        $periode = $this->periodeRepository->find($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException('Période introuvable.');
        }

        $cle = trim((string) ($donnees['cle'] ?? ''));
        $cles = $this->clesDomaine($domaine);
        if ($cle === '' || !isset($cles[$cle])) {
            throw new DonneesInvalidesException('Clé de rapprochement invalide.');
        }

        $domfParCle = $this->montantsDomf($domaine, $periodeId);
        $domf = $domfParCle[$cle] ?? '0.00';

        $row = $this->rapprochementRepository->trouver($periodeId, $domaine, $cle);
        if (!$row instanceof Rapprochement) {
            $row = new Rapprochement($periode, $domaine, $cle, $domf, '0.00');
            $this->em->persist($row);
        }
        $row->setMontantDomf($domf);

        if (array_key_exists('montant_externe', $donnees)) {
            $row->setMontantExterne($this->normaliserMontant($donnees['montant_externe']));
            $row->invalider();
        }
        if (array_key_exists('commentaire', $donnees)) {
            $c = $donnees['commentaire'];
            $row->setCommentaire($c === null ? null : (string) $c);
            $row->invalider();
        }

        $this->em->flush();

        return $this->serialiserLigne($row, $cles[$cle]);
    }

    /**
     * @return array<string, mixed>
     */
    public function valider(DomaineRapprochement $domaine, ?int $periodeId = null): array
    {
        $etat = $this->lister($domaine, $periodeId);
        if (($etat['periode']['id'] ?? null) === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }
        if (!($etat['ecarts_commentes'] ?? false)) {
            throw new DonneesInvalidesException(
                'Commentez d\'abord tous les écarts non nuls avant de valider.',
            );
        }

        $periode = $this->periodeRepository->find((int) $etat['periode']['id']);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException('Période introuvable.');
        }

        $user = $this->security->getUser();
        $par = $user instanceof Utilisateur
            ? ($user->getUserIdentifier() ?: 'chef')
            : 'chef';

        foreach ($this->rapprochementRepository->listerParPeriodeDomaine($periode->getId(), $domaine) as $row) {
            $row->valider($par);
        }
        $this->em->flush();

        return $this->lister($domaine, $periode->getId());
    }

    /**
     * @return array<string, string> cle => libelle
     */
    private function clesDomaine(DomaineRapprochement $domaine): array
    {
        if ($domaine === DomaineRapprochement::PETROLE) {
            $out = [];
            foreach (self::TYPES_PETROLE as $t) {
                $out[$t->value] = $t->libelle();
            }

            return $out;
        }

        $out = [];
        foreach ($this->groupesDouaneReferentiel() as $comptes) {
            foreach ($comptes as $cle => $libelle) {
                $out[$cle] = $libelle;
            }
        }

        return $out;
    }

    /**
     * Tous les comptes douanes actifs du référentiel, groupés (ordre TypeCompteDouane).
     *
     * @return array<string, array<string, string>> groupeLibelle => [compte => libellé]
     */
    private function groupesDouaneReferentiel(): array
    {
        /** @var array<string, list<CompteDouane>> $parType */
        $parType = [];
        foreach ($this->compteDouaneRepository->listerTous() as $c) {
            if (!$c->isActif()) {
                continue;
            }
            $parType[$c->getType()->value][] = $c;
        }

        $out = [];
        foreach (TypeCompteDouane::cases() as $type) {
            $liste = $parType[$type->value] ?? [];
            if ($liste === []) {
                continue;
            }
            usort(
                $liste,
                static fn (CompteDouane $a, CompteDouane $b): int => strcmp($a->getCompte(), $b->getCompte()),
            );
            $groupe = self::GROUPES_LIBELLES[$type->value] ?? $type->libelle();
            $comptes = [];
            foreach ($liste as $c) {
                $comptes[$c->getCompte()] = $c->getLibelleCompte();
            }
            $out[$groupe] = $comptes;
        }

        return $out;
    }

    /**
     * @return array<string, string>
     */
    private function montantsDomf(DomaineRapprochement $domaine, int $periodeId): array
    {
        if ($domaine === DomaineRapprochement::PETROLE) {
            $out = [];
            foreach (self::TYPES_PETROLE as $type) {
                $out[$type->value] = $this->sommeLignesType($periodeId, $type);
            }

            return $out;
        }

        $out = [];
        foreach (array_keys($this->clesDomaine(DomaineRapprochement::DOUANE)) as $compte) {
            if ($compte === self::COMPTE_RUSID) {
                $row = $this->montantSaisiCompteRepository->trouver(
                    $periodeId,
                    self::COMPTE_RUSID,
                    SensMontantCompte::RECETTE,
                );
                $out[$compte] = $row instanceof MontantSaisiCompte
                    ? $row->getMontant()
                    : '0.00';
                continue;
            }
            $lot = $this->trouverLotDouaneCompte($periodeId, $compte);
            $out[$compte] = $lot instanceof LotImport
                ? ($lot->getMontantTotal() ?? '0.00')
                : '0.00';
        }

        return $out;
    }

    private function trouverLotDouaneCompte(int $periodeId, string $compte): ?LotImport
    {
        /** @var list<LotImport> $candidats */
        $candidats = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('l.periode = :pid')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('pid', $periodeId)
            ->setParameter('format', FormatImport::F1)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        foreach ($candidats as $lot) {
            $p = $lot->getParametres();
            if (($p['source'] ?? null) === self::SOURCE_DOUANE
                && ($p['etape'] ?? null) === 'ig_operation'
                && ($p['compte'] ?? null) === $compte
            ) {
                return $lot;
            }
        }

        return null;
    }

    private function sommeLignesType(int $periodeId, TypeRecetteTransfert $type): string
    {
        $lot = $this->trouverLot1812201($periodeId);
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return '0.00';
        }
        $ops = $this->igOperationRepository->listerParLot($lot->getId());
        $ids = array_values(array_filter(array_map(
            static fn (IgOperation $o): ?int => $o->getId(),
            $ops,
        )));
        $qualifs = $this->qualificationRepository->indexerParOperations($ids);
        $total = '0.00';
        foreach ($ops as $op) {
            $id = $op->getId();
            if ($id === null) {
                continue;
            }
            $q = $qualifs[$id] ?? null;
            if (!$q instanceof QualificationTransfert || $q->isExclu()) {
                continue;
            }
            if ($q->getTypeRecette() !== $type) {
                continue;
            }
            $total = bcadd($total, $op->getMRegl() ?? '0.00', 2);
        }

        return $total;
    }

    private function trouverLot1812201(int $periodeId): ?LotImport
    {
        /** @var list<LotImport> $candidats */
        $candidats = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('l.periode = :pid')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('pid', $periodeId)
            ->setParameter('format', FormatImport::F1)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        foreach ($candidats as $lot) {
            $p = $lot->getParametres();
            if (($p['compte'] ?? null) === '1812-201'
                && ($p['etape'] ?? null) === 'ig_operation'
            ) {
                return $lot;
            }
        }

        return null;
    }

    private function resoudrePeriode(?int $periodeId): ?Periode
    {
        if ($periodeId !== null) {
            $p = $this->periodeRepository->find($periodeId);
            if ($p instanceof Periode) {
                return $p;
            }
        }

        /** @var list<Periode> $periodes */
        $periodes = $this->periodeRepository->createQueryBuilder('p')
            ->orderBy('p.exercice', 'DESC')
            ->addOrderBy('p.mois', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getResult();

        return ($periodes[0] ?? null) instanceof Periode ? $periodes[0] : null;
    }

    private function normaliserMontant(mixed $v): string
    {
        if (\is_int($v) || \is_float($v)) {
            return number_format((float) $v, 2, '.', '');
        }
        $s = preg_replace('/[\s\x{00A0}\x{202F}\']+/u', '', (string) $v) ?? '';
        $s = str_replace(',', '.', $s);
        if ($s === '' || !is_numeric($s)) {
            throw new DonneesInvalidesException('Montant DRPHP invalide.');
        }

        return number_format((float) $s, 2, '.', '');
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserLigne(Rapprochement $r, string $libelle): array
    {
        $ecart = $r->ecart();

        return [
            'id' => $r->getId(),
            'cle' => $r->getCle(),
            'libelle' => $libelle,
            'montant_domf' => $r->getMontantDomf(),
            'montant_externe' => $r->getMontantExterne(),
            'ecart' => $ecart,
            'commentaire' => $r->getCommentaire(),
            'valide' => $r->estValide(),
            'valide_par' => $r->getValidePar(),
            'valide_le' => $r->getValideLe()?->format(\DateTimeInterface::ATOM),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserPeriode(Periode $p): array
    {
        $mois = $p->getMois();

        return [
            'id' => $p->getId(),
            'mois' => $mois,
            'exercice_annee' => $p->getExercice()->getAnnee(),
            'mois_libelle' => match ($mois) {
                1 => 'janvier', 2 => 'février', 3 => 'mars', 4 => 'avril',
                5 => 'mai', 6 => 'juin', 7 => 'juillet', 8 => 'août',
                9 => 'septembre', 10 => 'octobre', 11 => 'novembre', 12 => 'décembre',
                default => null,
            },
        ];
    }
}
