<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service;

use App\Module\ServiceReglement\Entite\FicheDepot;
use App\Module\ServiceReglement\Entite\MouvementNumeraire;
use App\Module\ServiceReglement\Entite\MouvementSygma;
use App\Module\ServiceReglement\Entite\MouvementSystac;
use App\Module\ServiceReglement\Service\FicheDepotExcelGeneratorInterface;
use App\Shared\Config\AppConfig;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\Filesystem\Filesystem;

class FicheDepotExcelGenerator implements FicheDepotExcelGeneratorInterface
{
    private const COLONNES = ['Date du Virement', 'Bénéficiaires', 'N° O.V.', 'Banques', 'Dépenses', 'Montant groupé', 'Observations'];

    private const COULEUR_ENTETE_COLONNES = 'DCE9F9';
    private const COULEUR_TOTAL_GENERAL = 'C6DBF0';

    private const COULEURS_SECTION = [
        'NUMÉRAIRE' => ['bandeau' => 'E5DEF5', 'sousTotal' => 'D5C6EC'],
        'SIGMA' => ['bandeau' => 'FBE0E0', 'sousTotal' => 'F5C6C6'],
        'SYSTAC' => ['bandeau' => 'FDF1D9', 'sousTotal' => 'FBE6B5'],
    ];

    public function __construct(
        private readonly AppConfig $appConfig,
        private readonly Filesystem $filesystem = new Filesystem(),
    ) {
    }

    public function genererFichier(FicheDepot $fiche): array
    {
        ini_set('memory_limit', '512M');

        $spreadsheet = new Spreadsheet();

        $feuilleJour = $spreadsheet->getActiveSheet();
        $feuilleJour->setTitle('Reglement du jour');

        $ligne = $this->ecrireEntete($feuilleJour, $fiche);
        $ligne = $this->ecrireEnteteColonnes($feuilleJour, $ligne);

        $ligne = $this->ecrireSection($feuilleJour, $ligne, 'NUMÉRAIRE', $fiche->getMouvementsNumeraire()->toArray(), $fiche->getTotalNumeraire());
        $ligne = $this->ecrireSection($feuilleJour, $ligne, 'SIGMA', $fiche->getMouvementsSygma()->toArray(), $fiche->getTotalSigma());
        $ligne = $this->ecrireSection($feuilleJour, $ligne, 'SYSTAC', $fiche->getMouvementsSystac()->toArray(), $fiche->getTotalSystac(), $fiche->getTotalGroupe());

        $ligne = $this->ecrireTotalGeneral($feuilleJour, $ligne, $fiche->getTotal());
        $this->ecrireSignatures($feuilleJour, $ligne + 2);
        $this->ajusterLargeursColonnes($feuilleJour);

        $this->ecrireFeuilleFamille(
            $spreadsheet->createSheet(),
            'Mouvement Systac',
            $fiche,
            'SYSTAC',
            $fiche->getMouvementsSystac()->toArray(),
            $fiche->getTotalSystac(),
            $fiche->getTotalGroupe(),
        );
        $this->ecrireFeuilleFamille(
            $spreadsheet->createSheet(),
            'Mouvement sygma',
            $fiche,
            'SIGMA',
            $fiche->getMouvementsSygma()->toArray(),
            $fiche->getTotalSigma(),
        );
        $this->ecrireFeuilleFamille(
            $spreadsheet->createSheet(),
            'Mouvement Numeraire',
            $fiche,
            'NUMÉRAIRE',
            $fiche->getMouvementsNumeraire()->toArray(),
            $fiche->getTotalNumeraire(),
        );

        $spreadsheet->setActiveSheetIndex(0);

        $this->filesystem->mkdir($this->appConfig->ficheDepensesDir());

        $nomFichier = $fiche->getReference() . '.xlsx';
        $chemin = $this->appConfig->ficheDepensesDir() . \DIRECTORY_SEPARATOR . $nomFichier;

        (new Xlsx($spreadsheet))->save($chemin);
        $spreadsheet->disconnectWorksheets();

        return [
            'chemin' => $nomFichier,
            'hash' => hash_file('sha256', $chemin),
        ];
    }

    private function ecrireEntete(Worksheet $feuille, FicheDepot $fiche): int
    {
        $feuille->setCellValue('A1', 'Direction des Règlements');
        $feuille->getStyle('A1')->getFont()->setBold(true)->setSize(12);

        $feuille->setCellValue('A2', 'Service des Règlements');
        $feuille->getStyle('A2')->getFont()->setBold(true)->getColor()->setRGB('2E5395');

        $feuille->mergeCells('A4:G4');
        $feuille->setCellValue('A4', 'REGLEMENTS DU ' . $fiche->getDatePresentation()->format('d/m/Y'));
        $feuille->getStyle('A4')->getFont()->setBold(true)->setItalic(true)->setUnderline(true)->getColor()->setRGB('C00000');
        $feuille->getStyle('A4')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $feuille->setCellValue('F5', $fiche->getDateCreation()->format('d/m/Y'));
        $feuille->getStyle('F5')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

        return 6;
    }

    private function ecrireEnteteColonnes(Worksheet $feuille, int $ligne): int
    {
        foreach (self::COLONNES as $index => $libelle) {
            $colonne = chr(ord('A') + $index);
            $feuille->setCellValue($colonne . $ligne, $libelle);
        }

        $plage = 'A' . $ligne . ':G' . $ligne;
        $feuille->getStyle($plage)->getFont()->setBold(true)->setItalic(true);
        $this->remplir($feuille, $plage, self::COULEUR_ENTETE_COLONNES);

        return $ligne + 1;
    }

    private function ecrireSection(Worksheet $feuille, int $ligne, string $libelle, array $mouvements, float $total, ?float $totalGroupe = null): int
    {
        $couleurs = self::COULEURS_SECTION[$libelle];

        $ligne = $this->ecrireBandeau($feuille, $ligne, $libelle, null, null, $couleurs['bandeau']);

        foreach ($mouvements as $mouvement) {
            $feuille->setCellValue('A' . $ligne, $mouvement->getDateVirement()?->format('d/m/Y'));
            $feuille->setCellValue('B' . $ligne, $mouvement->getBeneficiaire());
            $feuille->setCellValue('C' . $ligne, $mouvement->getNumeroOV());
            $feuille->setCellValue('D' . $ligne, $mouvement->getBanque());
            $feuille->setCellValue('E' . $ligne, $mouvement->getDepenses());
            if ($mouvement instanceof MouvementSystac) {
                $feuille->setCellValue('F' . $ligne, $mouvement->getMontantGroupe());
            }
            $feuille->setCellValue('G' . $ligne, implode(' — ', array_map(
                static fn ($o) => $o->getContenu(),
                $mouvement->getObservations()->toArray(),
            )));
            ++$ligne;
        }

        return $this->ecrireBandeau($feuille, $ligne, 'TOTAL REGLEMENTS ' . $libelle, $total, $totalGroupe, $couleurs['sousTotal']);
    }

    private function ecrireFeuilleFamille(
        Worksheet $feuille,
        string $titreOnglet,
        FicheDepot $fiche,
        string $libelleSection,
        array $mouvements,
        float $total,
        ?float $totalGroupe = null,
    ): void {
        $feuille->setTitle($titreOnglet);

        $ligne = $this->ecrireEntete($feuille, $fiche);
        $ligne = $this->ecrireEnteteColonnes($feuille, $ligne);
        $this->ecrireSection($feuille, $ligne, $libelleSection, $mouvements, $total, $totalGroupe);

        $this->ajusterLargeursColonnes($feuille);
    }

    private function ajusterLargeursColonnes(Worksheet $feuille): void
    {
        foreach (range('A', 'G') as $colonne) {
            $feuille->getColumnDimension($colonne)->setAutoSize(true);
        }
    }

    private function ecrireTotalGeneral(Worksheet $feuille, int $ligne, float $total): int
    {
        return $this->ecrireBandeau($feuille, $ligne, 'TOTAL GENERAL', $total, null, self::COULEUR_TOTAL_GENERAL);
    }

    private function ecrireBandeau(Worksheet $feuille, int $ligne, string $libelle, ?float $montant, ?float $montantGroupe, string $couleur): int
    {
        $feuille->mergeCells('A' . $ligne . ':D' . $ligne);
        $feuille->setCellValue('A' . $ligne, $libelle);
        if ($montant !== null) {
            $feuille->setCellValue('E' . $ligne, $montant);
        }
        if ($montantGroupe !== null) {
            $feuille->setCellValue('F' . $ligne, $montantGroupe);
        }

        $plage = 'A' . $ligne . ':G' . $ligne;
        $feuille->getStyle($plage)->getFont()->setBold(true);
        $feuille->getStyle('A' . $ligne)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $this->remplir($feuille, $plage, $couleur);

        return $ligne + 1;
    }

    private function ecrireSignatures(Worksheet $feuille, int $ligne): void
    {
        $feuille->setCellValue('A' . $ligne, 'DIRECTEUR DES REGLEMENTS');
        $feuille->setCellValue('C' . $ligne, 'VISA DU DIRECTEUR DE LA DEPENSE');
        $feuille->setCellValue('E' . $ligne, 'VISA DU DIRECTEUR DES OPERATIONS MONETAIRES ET FINANCIERES');
        $feuille->getStyle('A' . $ligne . ':G' . $ligne)->getFont()->setBold(true)->setItalic(true);
    }

    private function remplir(Worksheet $feuille, string $plage, string $couleurRGB): void
    {
        $feuille->getStyle($plage)->getFill()
            ->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setRGB($couleurRGB);
    }
}
