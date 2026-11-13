<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\RecetteFiscaleMode;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\RubriqueRecette;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\ModeRecouvrement;
use App\Module\ServiceOperationsFinancieres\Enum\SectionRecette;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RecetteFiscaleModeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueRecetteRepository;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Recettes › Fiscales (DGI) › Par mode de recouvrement (e-Tax / SWIFT / numéraire / bancaire).
 * Grille annuelle (12 mois) alignée maquette X.mon · hier.
 */
class RecettesFiscalesModeService
{
    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly RecetteFiscaleModeRepository $recetteFiscaleModeRepository,
        private readonly RubriqueRecetteRepository $rubriqueRecetteRepository,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
        private readonly JournalAuditService $journalAuditService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenir(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        $modesMeta = array_map(
            static fn (ModeRecouvrement $m): array => ['code' => $m->value, 'libelle' => $m->libelle()],
            ModeRecouvrement::cases(),
        );
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'periode' => null,
                'modes' => $modesMeta,
                'modes_lignes' => [],
                'lignes' => [],
                'message' => 'Aucune période SROT.',
            ];
        }

        $annee = $periode->getExercice()->getAnnee();
        $periodesAnnee = $this->periodeRepository->listerParExercice($annee);
        /** @var array<int, int> $pidParMois mois 1..12 → periode_id */
        $pidParMois = [];
        $ids = [];
        foreach ($periodesAnnee as $p) {
            if ($p->getId() === null) {
                continue;
            }
            $pidParMois[$p->getMois()] = $p->getId();
            $ids[] = $p->getId();
        }

        /** @var array<string, array<string, array<int, string>>> $cube [rubrique][mode][mois] */
        $cube = [];
        foreach ($this->recetteFiscaleModeRepository->listerParPeriodes($ids) as $r) {
            $mois = $r->getPeriode()->getMois();
            $code = $r->getRubriqueCode();
            $mode = $r->getMode()->value;
            $cube[$code][$mode][$mois] = $r->getMontant();
        }

        $rubriques = $this->rubriquesFiscales();
        $codesFeuilles = $this->codesFeuilles($rubriques);

        // Modes : total des feuilles par mode × mois
        $modesLignes = [];
        foreach (ModeRecouvrement::cases() as $m) {
            $serie = array_fill(1, 12, '0.00');
            foreach ($codesFeuilles as $code) {
                for ($mois = 1; $mois <= 12; ++$mois) {
                    $serie[$mois] = bcadd($serie[$mois], $cube[$code][$m->value][$mois] ?? '0.00', 2);
                }
            }
            $modesLignes[] = [
                'code' => $m->value,
                'libelle' => $m->libelle(),
                'mois' => array_values($serie),
            ];
        }

        // Lignes DGI : total tous modes par rubrique × mois (+ détail par mode pour saisie)
        $lignes = [];
        $codesVus = [];
        foreach ($rubriques as $rub) {
            $codesVus[$rub->getCode()] = true;
            $lignes[] = $this->construireLigneAnnuelle($rub->getCode(), $rub->getLibelle(), $rub->getNiveau(), $cube[$rub->getCode()] ?? []);
        }
        foreach ($cube as $code => $parMode) {
            if (isset($codesVus[$code])) {
                continue;
            }
            $r = $this->rubriqueRecetteRepository->findByCode($code);
            $lignes[] = $this->construireLigneAnnuelle($code, $r?->getLibelle() ?? $code, $r?->getNiveau() ?? 1, $parMode);
        }

        return [
            'periode' => $this->serialiserPeriode($periode),
            'periodes_mois' => $pidParMois,
            'modes' => $modesMeta,
            'modes_lignes' => $modesLignes,
            'lignes' => $lignes,
            'message' => $lignes === [] ? 'Aucune rubrique de recettes fiscales.' : null,
        ];
    }

    /**
     * @param list<array<string, mixed>> $lignes [{rubrique_code, mode, montant, mois?}]
     *
     * @return array<string, mixed>
     */
    public function enregistrer(?int $periodeId, array $lignes): array
    {
        $periodeRef = $this->resoudrePeriode($periodeId);
        if (!$periodeRef instanceof Periode || $periodeRef->getId() === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }
        if ($lignes === []) {
            throw new DonneesInvalidesException('Aucune ligne fournie.');
        }

        $annee = $periodeRef->getExercice()->getAnnee();
        $nb = 0;
        foreach ($lignes as $i => $l) {
            $n = $i + 1;
            $code = trim((string) ($l['rubrique_code'] ?? ''));
            if ($code === '' || mb_strlen($code) > 16) {
                throw new DonneesInvalidesException(sprintf('Ligne %d : rubrique_code invalide.', $n));
            }
            if (!$this->rubriqueRecetteRepository->findByCode($code) instanceof RubriqueRecette) {
                throw new DonneesInvalidesException(sprintf('Ligne %d : rubrique « %s » inconnue.', $n, $code));
            }
            $mode = ModeRecouvrement::tryFrom(strtoupper(trim((string) ($l['mode'] ?? ''))));
            if (!$mode instanceof ModeRecouvrement) {
                throw new DonneesInvalidesException(sprintf('Ligne %d : mode invalide (ETAX, SWIFT, NUMERAIRE, BANCAIRE).', $n));
            }
            $brut = $l['montant'] ?? null;
            $brut = is_string($brut) ? str_replace([' ', "\u{00A0}", ','], ['', '', '.'], $brut) : $brut;
            if ($brut === null || $brut === '' || !is_numeric($brut)) {
                throw new DonneesInvalidesException(sprintf('Ligne %d : montant invalide.', $n));
            }
            $montant = number_format((float) $brut, 2, '.', '');

            $moisCible = isset($l['mois']) ? (int) $l['mois'] : $periodeRef->getMois();
            if ($moisCible < 1 || $moisCible > 12) {
                throw new DonneesInvalidesException(sprintf('Ligne %d : mois invalide.', $n));
            }
            $periode = $this->periodeRepository->trouver($annee, $moisCible);
            if (!$periode instanceof Periode || $periode->getId() === null) {
                throw new DonneesInvalidesException(sprintf('Ligne %d : aucune période pour le mois %d.', $n, $moisCible));
            }

            $row = $this->recetteFiscaleModeRepository->trouver($periode->getId(), $code, $mode);
            if ($row instanceof RecetteFiscaleMode) {
                $row->setMontant($montant);
            } else {
                $this->em->persist(new RecetteFiscaleMode($periode, $code, $mode, $montant));
            }
            $this->em->flush();
            ++$nb;
        }

        $this->journalAuditService->enregistrer(
            'MODIFIER',
            'recette_fiscale_mode',
            (string) $periodeRef->getId(),
            $this->acteur(),
            null,
            ['nb_lignes' => $nb],
        );

        return $this->obtenir($periodeRef->getId());
    }

    /**
     * @param array<string, array<int, string>> $parMode [mode][mois]
     *
     * @return array<string, mixed>
     */
    private function construireLigneAnnuelle(string $code, string $libelle, int $niveau, array $parMode): array
    {
        $serie = array_fill(1, 12, '0.00');
        $parModeSerie = [];
        foreach (ModeRecouvrement::cases() as $m) {
            $ms = array_fill(1, 12, '0.00');
            for ($mois = 1; $mois <= 12; ++$mois) {
                $v = $parMode[$m->value][$mois] ?? '0.00';
                $ms[$mois] = $v;
                $serie[$mois] = bcadd($serie[$mois], $v, 2);
            }
            $parModeSerie[$m->value] = array_values($ms);
        }

        return [
            'rubrique_code' => $code,
            'libelle' => $libelle,
            'niveau' => $niveau,
            'mois' => array_values($serie),
            'par_mode' => $parModeSerie,
        ];
    }

    /**
     * @param list<RubriqueRecette> $rubriques
     *
     * @return list<string>
     */
    private function codesFeuilles(array $rubriques): array
    {
        $out = [];
        $n = count($rubriques);
        for ($i = 0; $i < $n; ++$i) {
            $suivante = $rubriques[$i + 1] ?? null;
            if ($suivante === null || $suivante->getNiveau() <= $rubriques[$i]->getNiveau()) {
                $out[] = $rubriques[$i]->getCode();
            }
        }

        return $out;
    }

    /**
     * @return list<RubriqueRecette>
     */
    private function rubriquesFiscales(): array
    {
        return array_values(array_filter(
            $this->rubriqueRecetteRepository->listerAPlat(),
            static fn (RubriqueRecette $r): bool => $r->getSection() === SectionRecette::RECETTES_FISCALES && $r->isActif(),
        ));
    }

    private function resoudrePeriode(?int $periodeId): ?Periode
    {
        if ($periodeId !== null) {
            $p = $this->periodeRepository->find($periodeId);

            return $p instanceof Periode ? $p : null;
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
            'mois_libelle' => Mois::tryFrom($mois)?->libelle(),
        ];
    }

    private function acteur(): ?Utilisateur
    {
        $u = $this->security->getUser();

        return $u instanceof Utilisateur ? $u : null;
    }
}
