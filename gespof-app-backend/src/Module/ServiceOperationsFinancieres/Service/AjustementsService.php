<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\MontantMensuel;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\OperationAjustement;
use App\Module\ServiceOperationsFinancieres\Enum\NatureAjustement;
use App\Module\ServiceOperationsFinancieres\Enum\OrigineMontantMensuel;
use App\Module\ServiceOperationsFinancieres\Enum\StatutPeriode;
use App\Module\ServiceOperationsFinancieres\Repository\MontantMensuelRepository;
use App\Module\ServiceOperationsFinancieres\Repository\OperationAjustementRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Support\AjustementsNomenclature;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Ajustements manuels — SPEC §7 / Lot 5.
 */
class AjustementsService
{
    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly OperationAjustementRepository $operationAjustementRepository,
        private readonly MontantMensuelRepository $montantMensuelRepository,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
        private readonly JournalAuditService $journalAuditService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function nomenclature(?string $nature = null): array
    {
        $out = [];
        foreach ([NatureAjustement::RECETTE, NatureAjustement::DEPENSE] as $n) {
            if ($nature !== null && strtoupper($nature) !== $n->value && !str_starts_with(strtoupper((string) $nature), substr($n->value, 0, 3))) {
                continue;
            }
            $out[$n->value] = array_map(
                static fn (array $l): array => [
                    'code' => $l['code'],
                    'libelle' => $l['libelle'],
                    'niveau' => $l['niveau'],
                    'code_srot' => AjustementsNomenclature::codeSrot($n, $l['code']),
                ],
                AjustementsNomenclature::nomenclature($n),
            );
        }

        return ['nomenclature' => $out];
    }

    /**
     * @return array<string, mixed>
     */
    public function lister(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'periode' => null,
                'operations' => [],
                'message' => 'Aucune période SROT.',
            ];
        }

        $ops = $this->operationAjustementRepository->listerParPeriode($periode->getId());

        return [
            'periode' => $this->serialiserPeriode($periode),
            'verrouillee' => $this->periodeVerrouillee($periode),
            'operations' => array_map(fn (OperationAjustement $o): array => $this->serialiser($o), $ops),
            'message' => null,
        ];
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function creer(array $donnees): array
    {
        $periode = $this->resoudrePeriode(
            isset($donnees['periode_id']) && is_numeric($donnees['periode_id'])
                ? (int) $donnees['periode_id']
                : null,
        );
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException('Période SROT requise.');
        }
        $this->exigerPeriodeModifiable($periode);

        $nature = $this->parserNature((string) ($donnees['nature'] ?? ''));
        $codeAj = trim((string) ($donnees['code_ajustement'] ?? $donnees['rubrique'] ?? ''));
        if ($codeAj === '') {
            throw new DonneesInvalidesException('Code ajustement obligatoire (nomenclature).');
        }
        $libelle = AjustementsNomenclature::libelle($nature, $codeAj);
        if ($libelle === null) {
            throw new DonneesInvalidesException(sprintf('Code ajustement « %s » hors nomenclature.', $codeAj));
        }
        $codeSrot = AjustementsNomenclature::codeSrot($nature, $codeAj);
        $motif = trim((string) ($donnees['motif'] ?? ''));
        if ($motif === '') {
            throw new DonneesInvalidesException('Motif obligatoire.');
        }
        $montant = $this->normaliserMontant($donnees['montant'] ?? null);
        if (0 === bccomp($montant, '0.00', 2)) {
            throw new DonneesInvalidesException('Montant non nul requis.');
        }

        $date = $this->parserDate($donnees['date'] ?? $donnees['date_operation'] ?? null)
            ?? new \DateTimeImmutable('today');

        $op = new OperationAjustement(
            $periode,
            $date,
            $nature,
            $codeAj,
            $montant,
            $motif,
            $codeSrot,
            $libelle,
            $this->acteur(),
        );
        $this->em->persist($op);
        $this->em->flush();

        $this->recalculerMontantsAjustement($periode->getExercice()->getAnnee());

        $this->journalAuditService->enregistrer(
            'CREER',
            'operation_ajustement',
            (string) $op->getId(),
            $this->acteur(),
            null,
            ['code' => $codeAj, 'code_srot' => $codeSrot, 'montant' => $montant],
        );

        return ['operation' => $this->serialiser($op)];
    }

    /**
     * @return array<string, mixed>
     */
    public function contrePasser(int $id, ?string $motif = null): array
    {
        $origine = $this->operationAjustementRepository->find($id);
        if (!$origine instanceof OperationAjustement) {
            throw new DonneesInvalidesException('Ajustement introuvable.');
        }
        $periode = $origine->getPeriode();
        $this->exigerPeriodeModifiable($periode);

        // Déjà contre-passé ?
        foreach ($this->operationAjustementRepository->listerParPeriode($periode->getId() ?? 0) as $a) {
            if ($a->getContrePassationDe()?->getId() === $origine->getId()) {
                throw new DonneesInvalidesException('Cet ajustement a déjà une contre-passation.');
            }
        }

        $motifCp = trim((string) $motif);
        if ($motifCp === '') {
            $motifCp = 'Contre-passation de '.$origine->reference();
        }

        $cp = new OperationAjustement(
            $periode,
            new \DateTimeImmutable('today'),
            $origine->getNature(),
            $origine->getCodeAjustement(),
            bcmul($origine->getMontant(), '-1', 2),
            $motifCp,
            $origine->getCodeSrot(),
            $origine->getLibelle(),
            $this->acteur(),
        );
        $cp->setContrePassationDe($origine);
        $this->em->persist($cp);
        $this->em->flush();

        $this->recalculerMontantsAjustement($periode->getExercice()->getAnnee());

        $this->journalAuditService->enregistrer(
            'CONTRE_PASSER',
            'operation_ajustement',
            (string) $cp->getId(),
            $this->acteur(),
            null,
            ['origine_id' => $origine->getId()],
        );

        return ['operation' => $this->serialiser($cp)];
    }

    /**
     * Reconstruit montant_mensuel origine AJUSTEMENT pour l'exercice.
     *
     * @return array{exercice: int, nb_cellules: int}
     */
    public function recalculerMontantsAjustement(int $exerciceAnnee): array
    {
        $this->montantMensuelRepository->supprimerParExerciceEtOrigine(
            $exerciceAnnee,
            OrigineMontantMensuel::AJUSTEMENT,
        );
        $this->em->flush();

        /** @var array<string, array<int, string>> $totaux */
        $totaux = [];
        foreach ($this->operationAjustementRepository->listerParExercice($exerciceAnnee) as $op) {
            $code = $op->getCodeSrot();
            if ($code === null || $code === '') {
                continue;
            }
            $mois = $op->getPeriode()->getMois();
            $totaux[$code][$mois] = bcadd($totaux[$code][$mois] ?? '0.00', $op->getMontant(), 2);
        }

        $n = 0;
        foreach ($totaux as $code => $parMois) {
            foreach ($parMois as $mois => $montant) {
                if (0 === bccomp($montant, '0.00', 2)) {
                    continue;
                }
                $this->em->persist(new MontantMensuel(
                    $exerciceAnnee,
                    $code,
                    $mois,
                    OrigineMontantMensuel::AJUSTEMENT,
                    $montant,
                ));
                ++$n;
            }
        }
        $this->em->flush();

        return ['exercice' => $exerciceAnnee, 'nb_cellules' => $n];
    }

    private function periodeVerrouillee(Periode $periode): bool
    {
        return in_array($periode->getStatut(), [StatutPeriode::VALIDEE, StatutPeriode::PUBLIEE], true);
    }

    private function exigerPeriodeModifiable(Periode $periode): void
    {
        if ($this->periodeVerrouillee($periode)) {
            throw new DonneesInvalidesException(
                'Période validée ou publiée : ajustement refusé (contre-passation uniquement sur période ouverte).',
            );
        }
    }

    private function parserNature(string $brut): NatureAjustement
    {
        $u = strtoupper(trim($brut));
        if (str_starts_with($u, 'REC')) {
            return NatureAjustement::RECETTE;
        }
        if (str_starts_with($u, 'DEP')) {
            return NatureAjustement::DEPENSE;
        }
        $n = NatureAjustement::tryFrom($u);
        if ($n instanceof NatureAjustement) {
            return $n;
        }

        throw new DonneesInvalidesException('Nature invalide (RECETTE ou DEPENSE).');
    }

    private function normaliserMontant(mixed $v): string
    {
        if ($v === null || $v === '') {
            throw new DonneesInvalidesException('Montant requis.');
        }
        $s = str_replace([' ', ','], ['', '.'], (string) $v);
        if (!is_numeric($s)) {
            throw new DonneesInvalidesException('Montant invalide.');
        }

        return number_format((float) $s, 2, '.', '');
    }

    private function parserDate(mixed $v): ?\DateTimeImmutable
    {
        if ($v === null || $v === '') {
            return null;
        }
        $s = trim((string) $v);
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $s, $m) === 1) {
            return new \DateTimeImmutable(sprintf('%s-%s-%s', $m[3], $m[2], $m[1]));
        }
        try {
            return new \DateTimeImmutable($s);
        } catch (\Exception) {
            throw new DonneesInvalidesException('Date invalide.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(OperationAjustement $o): array
    {
        return [
            'id' => $o->getId(),
            'reference' => $o->reference(),
            'date' => $o->getDateOperation()->format('Y-m-d'),
            'nature' => $o->getNature()->value,
            'nature_libelle' => $o->getNature()->libelle(),
            'code_ajustement' => $o->getCodeAjustement(),
            'code_srot' => $o->getCodeSrot(),
            'libelle' => $o->getLibelle(),
            'montant' => $o->getMontant(),
            'motif' => $o->getMotif(),
            'contre_passation_de_id' => $o->getContrePassationDe()?->getId(),
            'cree_le' => $o->getCreeLe()->format('c'),
        ];
    }

    private function resoudrePeriode(?int $periodeId): ?Periode
    {
        if ($periodeId !== null && $periodeId > 0) {
            return $this->periodeRepository->find($periodeId);
        }
        /** @var list<Periode> $periodes */
        $periodes = $this->periodeRepository->createQueryBuilder('p')
            ->leftJoin('p.exercice', 'e')->addSelect('e')
            ->orderBy('e.annee', 'DESC')->addOrderBy('p.mois', 'DESC')
            ->setMaxResults(1)->getQuery()->getResult();

        return $periodes[0] ?? null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserPeriode(Periode $p): array
    {
        return [
            'id' => $p->getId(),
            'exercice_annee' => $p->getExercice()->getAnnee(),
            'mois' => $p->getMois(),
            'statut' => $p->getStatut()->value,
        ];
    }

    private function acteur(): ?Utilisateur
    {
        $u = $this->security->getUser();

        return $u instanceof Utilisateur ? $u : null;
    }
}
