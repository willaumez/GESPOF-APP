<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\RubriqueRecette;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RegleFlechage;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RubriqueDepense;
use App\Module\ServiceOperationsFinancieres\Enum\DomaineFlechage;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\SensMontantCompte;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Repository\CorrespondantMouvementRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RegleFlechageRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueDepenseRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueRecetteRepository;
use App\Module\ServiceOperationsFinancieres\Service\Exception\RubriqueIntrouvableException;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Règles de fléchage (Chef SOF).
 */
class RegleFlechageService
{
    public function __construct(
        private readonly RegleFlechageRepository $regleFlechageRepository,
        private readonly RubriqueRecetteRepository $rubriqueRecetteRepository,
        private readonly RubriqueDepenseRepository $rubriqueDepenseRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly CorrespondantMouvementRepository $correspondantMouvementRepository,
        private readonly FlechageDeterministeService $flechageDeterministe,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function lister(?string $onglet = null): array
    {
        $domaines = $this->domainesPourOnglet($onglet);
        $regles = $domaines === null
            ? $this->regleFlechageRepository->listerTout()
            : $this->regleFlechageRepository->listerParDomaines($domaines);

        return array_map(fn (RegleFlechage $r): array => $this->serialiser($r), $regles);
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function creer(array $donnees): array
    {
        $domaine = $this->parserDomaine((string) ($donnees['domaine'] ?? ''));
        $rubrique = trim((string) ($donnees['rubrique_code'] ?? ''));
        if ($rubrique === '') {
            throw new DonneesInvalidesException('Le code de fléchage (rubrique) est obligatoire.');
        }
        $this->exigerRubriqueExistante($rubrique);

        $priorite = isset($donnees['priorite']) ? (int) $donnees['priorite'] : 1;
        if ($priorite < 1) {
            throw new DonneesInvalidesException('La priorité doit être ≥ 1.');
        }

        $regle = new RegleFlechage($domaine, $rubrique, $priorite);
        $this->appliquerChamps($regle, $donnees);
        $this->em->persist($regle);
        $this->em->flush();

        return $this->serialiser($regle);
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrer(int $id, array $donnees): array
    {
        $regle = $this->exiger($id);
        if (array_key_exists('domaine', $donnees)) {
            $regle->setDomaine($this->parserDomaine((string) $donnees['domaine']));
        }
        if (array_key_exists('rubrique_code', $donnees)) {
            $rubrique = trim((string) $donnees['rubrique_code']);
            if ($rubrique === '') {
                throw new DonneesInvalidesException('Le code de fléchage (rubrique) est obligatoire.');
            }
            $this->exigerRubriqueExistante($rubrique);
            $regle->setRubriqueCode($rubrique);
        }
        if (array_key_exists('priorite', $donnees)) {
            $priorite = (int) $donnees['priorite'];
            if ($priorite < 1) {
                throw new DonneesInvalidesException('La priorité doit être ≥ 1.');
            }
            $regle->setPriorite($priorite);
        }
        $this->appliquerChamps($regle, $donnees);
        $this->em->flush();

        return $this->serialiser($regle);
    }

    public function supprimer(int $id): void
    {
        $regle = $this->exiger($id);
        $this->em->remove($regle);
        $this->em->flush();
    }

    /**
     * Teste une opération (maquette — Correspondants).
     *
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function tester(array $donnees): array
    {
        $domaineBrut = strtolower(trim((string) ($donnees['domaine'] ?? '')));
        $sens = strtolower(trim((string) ($donnees['sens'] ?? 'depense')));

        $domaine = match (true) {
            $domaineBrut !== '' => $this->parserDomaine($domaineBrut),
            str_starts_with($sens, 'rec') => DomaineFlechage::CORRESP_RECETTE,
            default => DomaineFlechage::CORRESP_DEPENSE,
        };

        $res = $this->flechageDeterministe->flecher($domaine, $donnees);
        $code = $res['code'];
        $trouve = $code !== '' && $code !== 'NONE';

        return [
            'trouve' => $trouve,
            'code' => $trouve ? $code : null,
            'motif' => $res['motif'],
            'titre' => $res['titre'],
            'meta' => $res['meta'],
            'domaine' => $domaine->value,
            'compat_excel' => $this->flechageDeterministe->compatExcel(),
            'message' => $trouve
                ? sprintf('Code obtenu : %s (%s).', $code, $res['meta']['fonction'] ?? 'déterministe')
                : sprintf('Aucune règle déterministe (%s).', $res['motif'] ?? 'NONE'),
        ];
    }

    /**
     * @return array<string, list<array<string, mixed>>>
     */
    public function tablesDecision(): array
    {
        return $this->flechageDeterministe->tablesDecision();
    }

    private function critereOk(?string $attendu, string $valeur): bool
    {
        if ($attendu === null || $attendu === '') {
            return true;
        }

        return strcasecmp($attendu, $valeur) === 0;
    }

    private function estValideAujourdhui(RegleFlechage $regle): bool
    {
        $auj = new \DateTimeImmutable('today');
        $du = $regle->getValideDu();
        $au = $regle->getValideAu();
        if ($du instanceof \DateTimeImmutable && $auj < $du) {
            return false;
        }
        if ($au instanceof \DateTimeImmutable && $auj > $au) {
            return false;
        }

        return true;
    }

    /**
     * @param array<string, mixed> $donnees
     */
    private function appliquerChamps(RegleFlechage $regle, array $donnees): void
    {
        if (array_key_exists('categorie', $donnees)) {
            $regle->setCategorie($donnees['categorie'] !== null ? (string) $donnees['categorie'] : null);
        }
        if (array_key_exists('compte', $donnees)) {
            $regle->setCompte($donnees['compte'] !== null ? (string) $donnees['compte'] : null);
        }
        if (array_key_exists('nature', $donnees)) {
            $regle->setNature($donnees['nature'] !== null ? (string) $donnees['nature'] : null);
        }
        if (array_key_exists('type_exercice', $donnees)) {
            $regle->setTypeExercice($donnees['type_exercice'] !== null ? (string) $donnees['type_exercice'] : null);
        }
        if (array_key_exists('titre', $donnees)) {
            $regle->setTitre($donnees['titre'] !== null ? (string) $donnees['titre'] : null);
        }
        if (array_key_exists('mdr', $donnees)) {
            $regle->setMdr($donnees['mdr'] !== null ? (string) $donnees['mdr'] : null);
        }
        if (array_key_exists('titre_resultat', $donnees)) {
            $regle->setTitreResultat(
                $donnees['titre_resultat'] !== null ? (string) $donnees['titre_resultat'] : null,
            );
        }
        if (array_key_exists('valide_du', $donnees)) {
            $regle->setValideDu($this->parserDate($donnees['valide_du']));
        }
        if (array_key_exists('valide_au', $donnees)) {
            $regle->setValideAu($this->parserDate($donnees['valide_au']));
        }
    }

    private function parserDate(mixed $valeur): ?\DateTimeImmutable
    {
        if ($valeur === null || $valeur === '') {
            return null;
        }
        try {
            return new \DateTimeImmutable((string) $valeur);
        } catch (\Exception $e) {
            throw new DonneesInvalidesException('Date invalide (AAAA-MM-JJ).', 0, $e);
        }
    }

    private function parserDomaine(string $valeur): DomaineFlechage
    {
        $normalise = strtolower(str_replace([' ', '-'], '_', trim($valeur)));
        $domaine = DomaineFlechage::tryFrom($normalise);
        if ($domaine instanceof DomaineFlechage) {
            return $domaine;
        }

        throw new DonneesInvalidesException(
            'Domaine invalide (corresp_recette, corresp_depense, avance, reglement, credit_delegue).',
        );
    }

    /**
     * @return list<DomaineFlechage>|null
     */
    private function domainesPourOnglet(?string $onglet): ?array
    {
        if ($onglet === null || $onglet === '' || $onglet === 'tous') {
            return null;
        }

        return match ($onglet) {
            'corr' => [DomaineFlechage::CORRESP_RECETTE, DomaineFlechage::CORRESP_DEPENSE],
            'av' => [DomaineFlechage::AVANCE],
            'ord' => [DomaineFlechage::REGLEMENT],
            'cd' => [DomaineFlechage::CREDIT_DELEGUE],
            default => throw new DonneesInvalidesException('Onglet invalide (corr, av, ord, cd).'),
        };
    }

    private function exiger(int $id): RegleFlechage
    {
        $regle = $this->regleFlechageRepository->find($id);
        if (!$regle instanceof RegleFlechage) {
            throw new RubriqueIntrouvableException(sprintf('Règle #%d introuvable.', $id));
        }

        return $regle;
    }

    private function exigerRubriqueExistante(string $code): void
    {
        if (
            $this->rubriqueRecetteRepository->findByCode($code) instanceof RubriqueRecette
            || $this->rubriqueDepenseRepository->findByCode($code) instanceof RubriqueDepense
        ) {
            return;
        }

        throw new DonneesInvalidesException(
            sprintf('Le code de fléchage « %s » est absent de la nomenclature SROT.', $code),
        );
    }

    /**
     * Catégories du dernier lot Correspondants (F10) sans règle de fléchage.
     *
     * @return array{
     *   lot_id: int|null,
     *   lot_importe_le: ?string,
     *   recettes: list<array{categorie: string, trouve: bool}>,
     *   depenses: list<array{categorie: string, trouve: bool}>,
     *   sans_regle: list<array{sens: string, categorie: string}>
     * }
     */
    public function couvertureCorrespondants(): array
    {
        $lot = $this->dernierLotCorrespondants();
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return [
                'lot_id' => null,
                'lot_importe_le' => null,
                'recettes' => [],
                'depenses' => [],
                'sans_regle' => [],
                'message' => 'Aucun lot Correspondants (DSI) actif trouvé.',
            ];
        }

        $mouvements = $this->correspondantMouvementRepository->listerParLot($lot->getId());
        $catsRec = [];
        $catsDep = [];
        foreach ($mouvements as $m) {
            $cat = trim((string) $m->getCategorie());
            if ($cat === '') {
                continue;
            }
            if ($m->getSens() === SensMontantCompte::RECETTE) {
                $catsRec[$cat] = true;
            } else {
                $catsDep[$cat] = true;
            }
        }

        $recettes = $this->evaluerCategories(array_keys($catsRec), 'recette');
        $depenses = $this->evaluerCategories(array_keys($catsDep), 'depense');
        $sans = [];
        foreach ($recettes as $r) {
            if (!$r['trouve']) {
                $sans[] = ['sens' => 'RECETTE', 'categorie' => $r['categorie']];
            }
        }
        foreach ($depenses as $d) {
            if (!$d['trouve']) {
                $sans[] = ['sens' => 'DEPENSE', 'categorie' => $d['categorie']];
            }
        }

        return [
            'lot_id' => $lot->getId(),
            'lot_importe_le' => $lot->getImporteLe()->format('c'),
            'recettes' => $recettes,
            'depenses' => $depenses,
            'sans_regle' => $sans,
            'message' => null,
        ];
    }

    /**
     * @param list<string> $categories
     *
     * @return list<array{categorie: string, trouve: bool, code: ?string}>
     */
    private function evaluerCategories(array $categories, string $sens): array
    {
        sort($categories);
        $out = [];
        foreach ($categories as $cat) {
            $res = $this->tester(['sens' => $sens, 'categorie' => $cat, 'compte' => '', 'nature' => '']);
            $out[] = [
                'categorie' => $cat,
                'trouve' => (bool) ($res['trouve'] ?? false),
                'code' => isset($res['code']) ? (string) $res['code'] : null,
            ];
        }

        return $out;
    }

    private function dernierLotCorrespondants(): ?LotImport
    {
        /** @var list<LotImport> $candidats */
        $candidats = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('format', FormatImport::F10)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->setMaxResults(40)
            ->getQuery()
            ->getResult();

        foreach ($candidats as $lot) {
            $p = $lot->getParametres();
            if (($p['source'] ?? null) === 'srv-correspondants') {
                return $lot;
            }
        }

        return null;
    }

    /**
     * Règles dont rubrique_code n'existe plus dans la nomenclature.
     *
     * @return list<array{id: int|null, rubrique_code: string, domaine: string}>
     */
    public function listerOrphelines(): array
    {
        $orphelines = [];
        foreach ($this->regleFlechageRepository->listerTout() as $regle) {
            $code = $regle->getRubriqueCode();
            if (
                $this->rubriqueRecetteRepository->findByCode($code) instanceof RubriqueRecette
                || $this->rubriqueDepenseRepository->findByCode($code) instanceof RubriqueDepense
            ) {
                continue;
            }
            $orphelines[] = [
                'id' => $regle->getId(),
                'rubrique_code' => $code,
                'domaine' => $regle->getDomaine()->value,
            ];
        }

        return $orphelines;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(RegleFlechage $r): array
    {
        $domaine = $r->getDomaine();

        return [
            'id' => $r->getId(),
            'domaine' => $domaine->value,
            'domaine_libelle' => $domaine->libelle(),
            'onglet' => $domaine->onglet(),
            'categorie' => $r->getCategorie(),
            'compte' => $r->getCompte(),
            'nature' => $r->getNature(),
            'type_exercice' => $r->getTypeExercice(),
            'titre' => $r->getTitre(),
            'mdr' => $r->getMdr(),
            'rubrique_code' => $r->getRubriqueCode(),
            'titre_resultat' => $r->getTitreResultat(),
            'priorite' => $r->getPriorite(),
            'valide_du' => $r->getValideDu()?->format('Y-m-d'),
            'valide_au' => $r->getValideAu()?->format('Y-m-d'),
            'sens' => match ($domaine) {
                DomaineFlechage::CORRESP_RECETTE => 'Recette',
                DomaineFlechage::CORRESP_DEPENSE => 'Dépense',
                default => null,
            },
        ];
    }
}
