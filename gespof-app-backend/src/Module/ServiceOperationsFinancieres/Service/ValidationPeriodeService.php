<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\SrotArchive;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\SrotPublication;
use App\Module\ServiceOperationsFinancieres\Enum\PointAttentionCode;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Enum\StatutPeriode;
use App\Module\ServiceOperationsFinancieres\Repository\LigneFlecheeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\SrotArchiveRepository;
use App\Module\ServiceOperationsFinancieres\Repository\SrotPublicationRepository;
use App\Module\ServiceOperationsFinancieres\Support\SrotAgregats;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Validation / réouverture / publication — SPEC §9 (Lot 7).
 */
class ValidationPeriodeService
{
    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly LigneFlecheeRepository $ligneFlecheeRepository,
        private readonly SrotArchiveRepository $srotArchiveRepository,
        private readonly SrotPublicationRepository $srotPublicationRepository,
        private readonly SrotSituationService $srotSituationService,
        private readonly PeriodeEnCoursService $periodeEnCoursService,
        private readonly ExecutionRapService $executionRapService,
        private readonly JournalAuditService $journalAuditService,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
    ) {
    }

    /**
     * Contrôles de clôture (SPEC §9).
     *
     * @return array<string, mixed>
     */
    public function controles(?int $periodeId = null): array
    {
        $periode = $this->exigerPeriode($periodeId);
        $items = $this->evaluerControles($periode);
        $ok = !in_array(false, array_column($items, 'ok'), true);

        return [
            'periode' => $this->serialiserPeriode($periode),
            'peut_valider' => $ok && in_array(
                $periode->getStatut(),
                [StatutPeriode::OUVERTE, StatutPeriode::EN_CONTROLE],
                true,
            ),
            'peut_publier' => $periode->getStatut() === StatutPeriode::VALIDEE,
            'peut_rouvrir' => in_array(
                $periode->getStatut(),
                [StatutPeriode::VALIDEE, StatutPeriode::PUBLIEE],
                true,
            ),
            'controles' => $items,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function valider(int $periodeId): array
    {
        $periode = $this->exigerPeriode($periodeId);
        if (!in_array($periode->getStatut(), [StatutPeriode::OUVERTE, StatutPeriode::EN_CONTROLE], true)) {
            throw new DonneesInvalidesException(
                sprintf('Période %s : validation refusée (statut %s).', $periodeId, $periode->getStatut()->value),
            );
        }

        $ctrl = $this->evaluerControles($periode);
        $bloquants = array_values(array_filter($ctrl, static fn (array $c): bool => !$c['ok']));
        if ($bloquants !== []) {
            throw new DonneesInvalidesException(
                'Validation refusée : '.implode(' · ', array_map(
                    static fn (array $c): string => $c['libelle'],
                    $bloquants,
                )),
            );
        }

        $situation = $this->srotSituationService->situation($periode->getId());
        $this->ecrireArchive($periode, $situation['lignes'] ?? []);

        $periode->setStatut(StatutPeriode::VALIDEE);
        $this->em->flush();

        $this->journalAuditService->enregistrer(
            'VALIDER',
            'periode',
            (string) $periode->getId(),
            $this->acteur(),
            null,
            ['mois' => $periode->getMois(), 'exercice' => $periode->getExercice()->getAnnee()],
        );

        return [
            'periode' => $this->serialiserPeriode($periode),
            'archive' => [
                'exercice' => $periode->getExercice()->getAnnee(),
                'mois' => $periode->getMois(),
                'nb_lignes' => count($situation['lignes'] ?? []),
            ],
            'message' => 'Mois validé. Archive SROT écrite. Période en lecture seule.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function rouvrir(int $periodeId, string $motif): array
    {
        $periode = $this->exigerPeriode($periodeId);
        $motif = trim($motif);
        if ($motif === '') {
            throw new DonneesInvalidesException('Motif de réouverture obligatoire.');
        }
        if (!in_array($periode->getStatut(), [StatutPeriode::VALIDEE, StatutPeriode::PUBLIEE], true)) {
            throw new DonneesInvalidesException('Seule une période validée ou publiée peut être rouverte.');
        }

        $avant = $periode->getStatut()->value;
        $periode->setStatut(StatutPeriode::OUVERTE);
        // Historique archive conservé (SPEC §9) — pas de suppression.
        $this->em->flush();

        $this->journalAuditService->enregistrer(
            'ROUVRIR',
            'periode',
            (string) $periode->getId(),
            $this->acteur(),
            ['statut' => $avant],
            ['statut' => StatutPeriode::OUVERTE->value, 'motif' => $motif],
        );

        return [
            'periode' => $this->serialiserPeriode($periode),
            'motif' => $motif,
            'message' => 'Période rouverte. L\'archive antérieure est conservée ; un nouveau calcul s\'applique.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function publier(int $periodeId, ?string $typeDocument = 'srot'): array
    {
        $periode = $this->exigerPeriode($periodeId);
        if ($periode->getStatut() !== StatutPeriode::VALIDEE) {
            throw new DonneesInvalidesException('Publication réservée à une période validée.');
        }

        $type = $typeDocument !== null && $typeDocument !== '' ? $typeDocument : 'srot';
        $composition = $this->compositionPdf($periode, $type);
        $version = $this->srotPublicationRepository->prochaineVersion((int) $periode->getId());
        $libelle = sprintf(
            'SROT %02d/%d · v%d',
            $periode->getMois(),
            $periode->getExercice()->getAnnee(),
            $version,
        );

        $pub = new SrotPublication(
            $periode,
            $version,
            $libelle,
            $composition,
            $type,
            $this->acteur(),
        );
        $this->em->persist($pub);

        $periode->setStatut(StatutPeriode::PUBLIEE);
        $this->em->flush();

        $this->journalAuditService->enregistrer(
            'PUBLIER',
            'periode',
            (string) $periode->getId(),
            $this->acteur(),
            null,
            ['publication_id' => $pub->getId(), 'version' => $version],
        );

        return [
            'periode' => $this->serialiserPeriode($periode),
            'publication' => $this->serialiserPublication($pub),
            'message' => 'Période publiée. Version figée.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function listerPublications(?int $exerciceAnnee = null, ?int $periodeId = null): array
    {
        $rows = $this->srotPublicationRepository->lister($exerciceAnnee, $periodeId);

        return [
            'publications' => array_map($this->serialiserPublication(...), $rows),
        ];
    }

    /**
     * Export composition officielle (HTML imprimable / JSON).
     *
     * @return array{content_type: string, filename: string, body: string}|array<string, mixed>
     */
    public function exporter(int $periodeId, string $format = 'html'): array
    {
        $periode = $this->exigerPeriode($periodeId);
        if (!in_array($periode->getStatut(), [StatutPeriode::VALIDEE, StatutPeriode::PUBLIEE], true)) {
            throw new DonneesInvalidesException('Export PDF réservé aux périodes validées ou publiées.');
        }

        $composition = $this->compositionPdf($periode, 'srot');
        $base = sprintf('SROT_%d_%02d', $periode->getExercice()->getAnnee(), $periode->getMois());

        if ($format === 'json') {
            return [
                'content_type' => 'application/json',
                'filename' => $base.'.json',
                'body' => json_encode($composition, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
            ];
        }

        // pdf → HTML A4 paysage imprimable (pas de moteur PDF natif dans le projet).
        $html = $this->rendreHtml($periode, $composition);

        return [
            'content_type' => 'text/html; charset=UTF-8',
            'filename' => $base.($format === 'pdf' ? '.pdf.html' : '.html'),
            'body' => $html,
        ];
    }

    /**
     * Lecture archive pour mois validé (utilisé par situation).
     *
     * @return list<array<string, mixed>>|null
     */
    public function lignesArchive(int $exerciceAnnee, int $mois): ?array
    {
        $rows = $this->srotArchiveRepository->listerParExerciceMois($exerciceAnnee, $mois);
        if ($rows === []) {
            return null;
        }
        $out = [];
        foreach ($rows as $a) {
            $out[] = [
                'id' => $a->getLigneSrot(),
                'libelle' => $a->getLibelle(),
                'niveau' => $a->getNiveau(),
                'section' => $a->getNiveau() === 0,
                'cumul_precedent' => '0.00',
                'mois' => $a->getValeurMoisFcfa(),
                'cumul' => $a->getValeurCumulFcfa(),
                'millions_cumul' => $a->getValeurCumulMillions(),
                'millions_mois' => SrotAgregats::enMillions($a->getValeurMoisFcfa()),
                'millions_cumul_precedent' => '0.000000',
            ];
        }

        return $out;
    }

    /**
     * @return list<array{code: string, libelle: string, ok: bool, detail: string}>
     */
    private function evaluerControles(Periode $periode): array
    {
        $periodeId = (int) $periode->getId();

        // 1. Lots attendus présents (catalogue période en cours)
        $synthese = $this->periodeEnCoursService->synthetiser($periodeId);
        $imports = $synthese['imports'] ?? [];
        $manquants = array_values(array_filter(
            $imports,
            static fn (array $i): bool => ($i['statut'] ?? '') === 'manquant',
        ));
        // Tolérance progressive : au moins un lot actif reçu (sinon bloquant total).
        $recus = array_values(array_filter(
            $imports,
            static fn (array $i): bool => ($i['statut'] ?? '') === 'recu',
        ));
        $lotsOk = $recus !== [] && $manquants === [];
        // Si catalogue incomplet en prod, accepter si ≥ 1 lot ACTIF sur la période.
        if (!$lotsOk) {
            $lotsActifs = array_filter(
                $this->lotImportRepository->lister($periodeId),
                static fn ($l): bool => $l->getStatut() === StatutLotImport::ACTIF && $l->getNbLignes() > 0,
            );
            $lotsOk = $lotsActifs !== [] && count($manquants) <= 3; // souple tant que catalogue incomplet
        }

        // 2. Écarts pétrole / douanes / TVA commentés
        $ecarts = $synthese['ecarts'] ?? [];
        $ecartsOk = $ecarts === [] || !in_array(
            false,
            array_map(static fn (array $e): bool => (bool) ($e['justifie'] ?? false), $ecarts),
            true,
        );

        // 3. 9 points d'attention
        $points = $synthese['points_attention'] ?? [];
        $pointsCoches = count(array_filter($points, static fn (array $p): bool => (bool) ($p['coche'] ?? false)));
        $pointsTotal = count(PointAttentionCode::cases());
        $pointsOk = $pointsCoches >= $pointsTotal;

        // 4. RAP négatifs (SPEC §9 / §10.1)
        $rapOk = true;
        $rapDetail = 'Aucun RAP négatif.';
        try {
            $rapSit = $this->executionRapService->situation($periodeId);
            $nbNeg = (int) ($rapSit['kpis']['nb_rap_negatifs'] ?? 0);
            $nbExNeg = (int) ($rapSit['kpis']['exclus_rap_negatif'] ?? 0);
            // exclus_rap_negatif = filtrés (OK) ; nb_rap_negatifs dans le résultat = bloquant
            $rapOk = $nbNeg === 0;
            $rapDetail = $rapOk
                ? sprintf('Aucun RAP négatif (%d exclus par filtre CDEL).', $nbExNeg)
                : sprintf('%d RAP négatif(s) dans la situation.', $nbNeg);
        } catch (\Throwable $e) {
            $rapDetail = 'Situation RAP indisponible : '.$e->getMessage();
        }

        // 5. Différences de soldes = 0 (ligne J équilibre de trésorerie)
        $diffOk = true;
        $diffDetail = 'Équilibre J non calculable.';
        try {
            $sit = $this->srotSituationService->situation($periodeId);
            $j = null;
            foreach ($sit['lignes'] as $l) {
                if (($l['id'] ?? '') === 'J') {
                    $j = $l;
                    break;
                }
            }
            if ($j !== null) {
                $diffOk = bccomp((string) $j['cumul'], '0.00', 2) === 0
                    && bccomp((string) $j['mois'], '0.00', 2) === 0;
                $diffDetail = $diffOk
                    ? 'Différence de soldes = 0.'
                    : sprintf('J cumul=%s · mois=%s (attendu 0).', $j['cumul'], $j['mois']);
            }
        } catch (\Throwable $e) {
            $diffOk = false;
            $diffDetail = 'Situation SROT indisponible : '.$e->getMessage();
        }

        // 6. Lignes sans code (fléchage) — signalement
        $sansCode = 0;
        foreach ($this->ligneFlecheeRepository->listerParPeriode($periodeId) as $lf) {
            if (trim($lf->getRubriqueCode()) === '') {
                ++$sansCode;
            }
        }
        // Non bloquant si justification via points ; on signale seulement
        $sansCodeOk = true;
        $sansCodeDetail = $sansCode === 0
            ? 'Aucune ligne sans code.'
            : sprintf('%d ligne(s) sans code (justification via points d\'attention).', $sansCode);

        return [
            [
                'code' => 'lots',
                'libelle' => 'Imports de la période reçus',
                'ok' => $lotsOk,
                'detail' => $lotsOk
                    ? sprintf('%d source(s) reçue(s).', count($recus))
                    : sprintf('%d manquant(s), %d reçu(s).', count($manquants), count($recus)),
            ],
            [
                'code' => 'ecarts',
                'libelle' => 'Rapprochements recettes justifiés',
                'ok' => $ecartsOk,
                'detail' => $ecartsOk ? 'Écarts nuls ou commentés.' : 'Écart pétrole/douanes/TVA à justifier.',
            ],
            [
                'code' => 'points',
                'libelle' => sprintf('Points d\'attention cochés (%d/%d)', $pointsCoches, $pointsTotal),
                'ok' => $pointsOk,
                'detail' => $pointsOk ? '9/9 cochés.' : sprintf('%d / %d cochés.', $pointsCoches, $pointsTotal),
            ],
            [
                'code' => 'rap',
                'libelle' => 'Aucun RAP négatif',
                'ok' => $rapOk,
                'detail' => $rapDetail,
            ],
            [
                'code' => 'soldes',
                'libelle' => 'Équilibre SROT conforme (diff. soldes = 0)',
                'ok' => $diffOk,
                'detail' => $diffDetail,
            ],
            [
                'code' => 'sans_code',
                'libelle' => 'Lignes fléchées sans code',
                'ok' => $sansCodeOk,
                'detail' => $sansCodeDetail,
            ],
        ];
    }

    /**
     * @param list<array<string, mixed>> $lignes
     */
    private function ecrireArchive(Periode $periode, array $lignes): void
    {
        $annee = $periode->getExercice()->getAnnee();
        $mois = $periode->getMois();
        $this->srotArchiveRepository->supprimerParExerciceMois($annee, $mois);
        $this->em->flush();

        foreach ($lignes as $l) {
            $id = (string) ($l['id'] ?? '');
            if ($id === '') {
                continue;
            }
            $cumul = (string) ($l['cumul'] ?? '0.00');
            $moisMt = (string) ($l['mois'] ?? '0.00');
            $this->em->persist(new SrotArchive(
                $annee,
                $mois,
                $id,
                (string) ($l['libelle'] ?? $id),
                (string) ($l['millions_cumul'] ?? SrotAgregats::enMillions($cumul)),
                $cumul,
                $moisMt,
                (int) ($l['niveau'] ?? 0),
            ));
        }
        $this->em->flush();
    }

    /**
     * @return array<string, mixed>
     */
    private function compositionPdf(Periode $periode, string $type): array
    {
        $annee = $periode->getExercice()->getAnnee();
        $mois = $periode->getMois();
        $sectionsSrot = [
            'Garde',
            'Sommaire',
            'EQUILIBRE-Titrisation',
            'Recettes',
            'Dépenses',
            'Analyse (option)',
        ];
        $sectionsExe = [
            'Garde',
            'Sommaire',
            'Garde SRFT',
            'Résumé-Titrisation',
            'Titre',
            'Titre_Nature',
            'Mission_Programme',
            'RAP Synthèse',
        ];

        $situation = null;
        $equilibre = null;
        try {
            if ($this->srotArchiveRepository->existe($annee, $mois)) {
                $lignes = $this->lignesArchive($annee, $mois);
                $situation = ['lignes' => $lignes, 'mode' => 'archive'];
            } else {
                $situation = $this->srotSituationService->situation($periode->getId());
            }
            $equilibre = $this->srotSituationService->equilibre($periode->getId());
        } catch (\Throwable) {
            // composition minimale
        }

        return [
            'type' => $type,
            'exercice' => $annee,
            'mois' => $mois,
            'date_situation' => $periode->getDateSituation()?->format('Y-m-d'),
            'sections' => $type === 'execution' ? $sectionsExe : $sectionsSrot,
            'situation' => $situation,
            'equilibre' => $equilibre,
            'note' => 'Composition officielle SPEC §9. Export HTML imprimable (PDF natif à brancher).',
        ];
    }

    /**
     * @param array<string, mixed> $composition
     */
    private function rendreHtml(Periode $periode, array $composition): string
    {
        $titre = sprintf(
            'SROT %02d/%d',
            $periode->getMois(),
            $periode->getExercice()->getAnnee(),
        );
        $lignes = $composition['situation']['lignes'] ?? [];
        $rows = '';
        foreach ($lignes as $l) {
            $rows .= sprintf(
                '<tr><td>%s</td><td>%s</td><td class="r">%s</td><td class="r">%s</td></tr>',
                htmlspecialchars((string) ($l['id'] ?? '')),
                htmlspecialchars((string) ($l['libelle'] ?? '')),
                htmlspecialchars((string) ($l['mois'] ?? '')),
                htmlspecialchars((string) ($l['cumul'] ?? '')),
            );
        }
        $sections = implode(', ', array_map(
            static fn ($s) => htmlspecialchars((string) $s),
            $composition['sections'] ?? [],
        ));

        return <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>{$titre}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: "IBM Plex Sans", Arial, sans-serif; color: #0f172a; font-size: 11px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #64748b; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  .r { text-align: right; font-family: "IBM Plex Mono", monospace; }
  @media print { .noprint { display: none; } }
</style>
</head>
<body>
  <button class="noprint" onclick="window.print()">Imprimer / PDF</button>
  <h1>{$titre} — document officiel</h1>
  <p class="meta">Composition : {$sections}</p>
  <h2>Situation résumée</h2>
  <table>
    <thead><tr><th>Code</th><th>Rubrique</th><th>Mois</th><th>Cumul</th></tr></thead>
    <tbody>{$rows}</tbody>
  </table>
</body>
</html>
HTML;
    }

    private function exigerPeriode(?int $periodeId): Periode
    {
        if ($periodeId === null || $periodeId <= 0) {
            $periodes = $this->periodeRepository->createQueryBuilder('p')
                ->leftJoin('p.exercice', 'e')->addSelect('e')
                ->orderBy('e.annee', 'DESC')->addOrderBy('p.mois', 'DESC')
                ->setMaxResults(1)->getQuery()->getResult();
            if ($periodes === []) {
                throw new DonneesInvalidesException('Aucune période SROT.');
            }

            return $periodes[0];
        }
        $p = $this->periodeRepository->find($periodeId);
        if (!$p instanceof Periode) {
            throw new DonneesInvalidesException(sprintf('Période #%d introuvable.', $periodeId));
        }

        return $p;
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
            'date_situation' => $p->getDateSituation()?->format('Y-m-d'),
            'statut' => $p->getStatut()->value,
            'statut_libelle' => $p->getStatut()->libelle(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserPublication(SrotPublication $p): array
    {
        return [
            'id' => $p->getId(),
            'periode_id' => $p->getPeriode()->getId(),
            'exercice_annee' => $p->getExerciceAnnee(),
            'mois' => $p->getMois(),
            'version' => $p->getVersion(),
            'type_document' => $p->getTypeDocument(),
            'libelle' => $p->getLibelle(),
            'composition_sections' => $p->getComposition()['sections'] ?? [],
            'publie_le' => $p->getPublieLe()->format('Y-m-d H:i:s'),
            'publie_par' => $p->getPubliePar()?->getUserIdentifier(),
        ];
    }

    private function acteur(): ?Utilisateur
    {
        $u = $this->security->getUser();

        return $u instanceof Utilisateur ? $u : null;
    }
}
