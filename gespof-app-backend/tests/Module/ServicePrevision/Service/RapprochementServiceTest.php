<?php

declare(strict_types=1);

namespace App\Tests\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;
use App\Module\ServicePrevision\Repository\JourneeTresorerieRepository;
use App\Module\ServicePrevision\Service\FicheExecutionServiceInterface;
use App\Module\ServicePrevision\Service\JournalJourneeServiceInterface;
use App\Module\ServicePrevision\Service\OperationsBeacServiceInterface;
use App\Module\ServicePrevision\Service\RapprochementService;
use App\Module\ServiceReglement\Service\FicheDepotServiceInterface;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;

/**
 * Fiches de dépôt complémentaires : une seconde fiche reprend les éléments de
 * la première (avec de nouveaux id en base) et en ajoute d'autres.
 */
final class RapprochementServiceTest extends TestCase
{
    private const JOURNEE = 'JT-05-10-2026-001';

    private JourneeTresorerie $journee;
    /** @var array<string, array<string, mixed>> détail par référence, ordre d'envoi */
    private array $fiches = [];
    private RapprochementService $service;

    protected function setUp(): void
    {
        $this->journee = new JourneeTresorerie(self::JOURNEE);

        $repository = $this->createStub(JourneeTresorerieRepository::class);
        $repository->method('find')->willReturn($this->journee);

        $ficheDepot = $this->createStub(FicheDepotServiceInterface::class);
        // Le service SR renvoie la plus récente en premier.
        $ficheDepot->method('listerParJourneeTresorerie')->willReturnCallback(fn (): array => [
            'journee' => self::JOURNEE,
            'fiches' => array_reverse(array_map(
                static fn (string $ref): array => ['reference' => $ref],
                array_keys($this->fiches),
            )),
        ]);
        $ficheDepot->method('detail')->willReturnCallback(fn (string $ref): array => $this->fiches[$ref]);

        $this->service = new RapprochementService(
            $repository,
            $this->createStub(OperationsBeacServiceInterface::class),
            $ficheDepot,
            $this->createStub(FicheExecutionServiceInterface::class),
            $this->createStub(EntityManagerInterface::class),
            $this->createStub(JournalJourneeServiceInterface::class),
        );
    }

    public function testFicheComplementaireNAjouteQueLesNouveauxElements(): void
    {
        $this->recevoirFiche('FD-1', $this->lignes(1, 20));
        $premiere = $this->service->validerDepenses(self::JOURNEE, 'Agent SP');
        self::assertSame(20, $premiere['depenses_jour']['nombre']);

        // 100 éléments dont les 20 de la première fiche (id différents en base).
        $this->recevoirFiche('FD-2', $this->lignes(1, 100, idDepart: 1000));
        $etat = $this->service->depenses(self::JOURNEE);
        self::assertSame(['FD-2'], $etat['fiches_non_integrees']);
        self::assertSame(80, $etat['nouvelles']);
        $apports = array_column($etat['fiches_disponibles'], 'nouveaux_elements', 'reference');
        self::assertSame(['FD-1' => 20, 'FD-2' => 80], $apports);

        $seconde = $this->service->validerDepenses(self::JOURNEE, 'Agent SP');
        $liste = $seconde['depenses_jour'];
        self::assertSame(100, $liste['nombre']);
        self::assertSame(80, $seconde['nouvelles']);
        self::assertSame(['FD-1', 'FD-2'], $liste['fiches']);

        $parFiche = array_count_values(array_column($liste['depenses'], 'fiche_reference'));
        self::assertSame(['FD-1' => 20, 'FD-2' => 80], $parFiche);
        self::assertCount(80, array_filter($liste['depenses'], static fn (array $d): bool => $d['nouvelle']));
        // Total = 1 + 2 + … + 100 (pas de double comptage des 20 premiers).
        self::assertSame('5050.00', $liste['total']);
    }

    public function testRapprochementConserveApresRevalidation(): void
    {
        $this->recevoirFiche('FD-1', $this->lignes(1, 3));
        $this->service->validerDepenses(self::JOURNEE, 'Agent SP');

        $liste = $this->journee->getDepensesJour();
        $liste['depenses'][0]['rapprochement'] = ['section_id' => 7, 'section_nom' => 'Salaires', 'groupe' => 'g1'];
        $this->journee->setDepensesJour($liste);
        $cleRapprochee = $liste['depenses'][0]['cle'];

        $this->recevoirFiche('FD-2', $this->lignes(1, 5, idDepart: 50));
        $this->service->validerDepenses(self::JOURNEE, 'Agent SP');

        $apres = array_column($this->journee->getDepensesJour()['depenses'], null, 'cle');
        self::assertCount(5, $apres);
        self::assertSame('g1', $apres[$cleRapprochee]['rapprochement']['groupe']);
    }

    public function testElementRapprocheConserveMemeSiAbsentDesFiches(): void
    {
        $this->recevoirFiche('FD-1', $this->lignes(1, 2));
        $this->service->validerDepenses(self::JOURNEE, 'Agent SP');
        $liste = $this->journee->getDepensesJour();
        $liste['depenses'][1]['rapprochement'] = ['section_id' => 7, 'section_nom' => 'Salaires', 'groupe' => 'g1'];
        $this->journee->setDepensesJour($liste);

        // La fiche est remplacée par une version qui ne contient plus l'élément 2.
        $this->fiches = [];
        $this->recevoirFiche('FD-1bis', $this->lignes(1, 1));
        $this->service->validerDepenses(self::JOURNEE, 'Agent SP');

        $apres = $this->journee->getDepensesJour();
        self::assertSame(2, $apres['nombre']);
    }

    public function testDoublonsLegitimesDansUneMemeFiche(): void
    {
        $identiques = [$this->ligne(1, 'SOCIETE X', 500.0), $this->ligne(2, 'SOCIETE X', 500.0)];
        $this->recevoirFiche('FD-1', $identiques);
        self::assertSame(2, $this->service->validerDepenses(self::JOURNEE, 'Agent SP')['depenses_jour']['nombre']);

        // La fiche complémentaire reprend les deux mêmes lignes : toujours 2, pas 4.
        $this->recevoirFiche('FD-2', [$this->ligne(10, 'SOCIETE X', 500.0), $this->ligne(11, 'SOCIETE X', 500.0)]);
        $resultat = $this->service->validerDepenses(self::JOURNEE, 'Agent SP');
        self::assertSame(2, $resultat['depenses_jour']['nombre']);
        self::assertSame(0, $resultat['nouvelles']);
    }

    /** @param list<array<string, mixed>> $sygma */
    private function recevoirFiche(string $reference, array $sygma): void
    {
        $this->fiches[$reference] = [
            'reference' => $reference,
            'date_creation' => '05/10/2026 10:00:00',
            'montant_total' => '0.00',
            'mouvements_numeraire' => [],
            'mouvements_sygma' => $sygma,
            'mouvements_systac' => [],
        ];
    }

    /** @return list<array<string, mixed>> lignes n° $de à $a, montant = n° */
    private function lignes(int $de, int $a, int $idDepart = 0): array
    {
        $out = [];
        for ($n = $de; $n <= $a; ++$n) {
            $out[] = $this->ligne($idDepart + $n, 'BENEFICIAIRE '.$n, (float) $n, 'OV '.$n);
        }

        return $out;
    }

    /** @return array<string, mixed> */
    private function ligne(int $id, string $beneficiaire, float $montant, ?string $ov = null): array
    {
        return [
            'id' => $id,
            'date_virement' => '05/10/2026',
            'beneficiaire' => $beneficiaire,
            'numero_ov' => $ov,
            'banque' => 'BGFI',
            'depenses' => $montant,
            'observations' => [],
        ];
    }
}
