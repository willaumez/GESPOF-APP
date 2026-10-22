<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service;

use App\Module\ServiceReglement\Entite\FicheDepot;
use App\Module\ServiceReglement\Entite\LigneSystac;
use App\Module\ServiceReglement\Entite\MouvementNumeraire;
use App\Module\ServiceReglement\Entite\MouvementSygma;
use App\Module\ServiceReglement\Entite\MouvementSystac;
use App\Shared\Config\AppConfig;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\HttpKernel\Exception\RuntimeException;

/**
 * Génère la fiche de dépôt Excel à partir du modèle
 * {@see AppConfig::modeleFicheDepotPath()} (FICHE_DE_DEPOT_MODELE_CORRIGE.xlsx).
 */
class FicheDepotExcelGenerator implements FicheDepotExcelGeneratorInterface
{
    private const FEUILLE_JOUR = 'Reglements du jour';
    private const FEUILLE_NUMERAIRE = 'Mouvement Numeraire';
    private const FEUILLE_SIGMA = 'Mouvement SIGMA';
    private const FEUILLE_SYSTAC = 'Mouvement SYSTAC';

    /** En-tête de colonnes (ligne 7). */
    private const COULEUR_ENTETE = 'BDD7EE';
    /** Bandeaux TOTAL NUMERAIRE / SYGMA / SYSTAC (libellé). */
    private const COULEUR_TOTAL_LIBELLE = 'D5C6EC';
    /** Cellule montant des totaux de section. */
    private const COULEUR_TOTAL_MONTANT = 'F8CBAD';
    /** Total général. */
    private const COULEUR_TOTAL_GENERAL = '9BC2E6';
    /** Titre « REGLEMENTS SYGMA ». */
    private const COULEUR_TITRE_ROUGE = 'C00000';
    /** Section OPERATIONS EN NUMERAIRE. */
    private const COULEUR_SECTION = 'E2D4F0';

    public function __construct(
        private readonly AppConfig $appConfig,
        private readonly Filesystem $filesystem = new Filesystem(),
    ) {
    }

    public function genererFichier(FicheDepot $fiche): array
    {
        ini_set('memory_limit', '512M');
        set_time_limit(300);

        // Préférer la maquette SP (ServicePrevision/Maquettes), sinon le modèle Shared.
        $cheminModele = $this->appConfig->modeleFicheDepotSpPath();
        if (!$this->filesystem->exists($cheminModele)) {
            $cheminModele = $this->appConfig->modeleFicheDepotPath();
        }
        if (!$this->filesystem->exists($cheminModele)) {
            throw new RuntimeException(sprintf(
                'Modèle Excel introuvable : %s',
                $cheminModele,
            ));
        }

        $spreadsheet = IOFactory::load($cheminModele);

        $this->remplirFeuilleJour(
            $this->feuille($spreadsheet, self::FEUILLE_JOUR),
            $fiche,
        );
        $this->remplirFeuilleNumeraireOuSigma(
            $this->feuille($spreadsheet, self::FEUILLE_NUMERAIRE),
            $fiche->getMouvementsNumeraire()->toArray(),
        );
        $this->remplirFeuilleNumeraireOuSigma(
            $this->feuille($spreadsheet, self::FEUILLE_SIGMA),
            $fiche->getMouvementsSygma()->toArray(),
        );
        $this->remplirFeuilleSystac(
            $this->feuille($spreadsheet, self::FEUILLE_SYSTAC),
            $fiche,
        );

        $spreadsheet->setActiveSheetIndexByName(self::FEUILLE_JOUR);

        $this->filesystem->mkdir($this->appConfig->ficheDepensesDir());

        $nomFichier = $fiche->getReference().'.xlsx';
        $chemin = $this->appConfig->ficheDepensesDir().\DIRECTORY_SEPARATOR.$nomFichier;

        (new Xlsx($spreadsheet))->save($chemin);
        $spreadsheet->disconnectWorksheets();

        return [
            'chemin' => $nomFichier,
            'hash' => hash_file('sha256', $chemin),
        ];
    }

    private function feuille(Spreadsheet $spreadsheet, string $titre): Worksheet
    {
        $feuille = $spreadsheet->getSheetByName($titre);
        if ($feuille === null) {
            throw new RuntimeException(sprintf('Feuille « %s » absente du modèle Excel.', $titre));
        }

        return $feuille;
    }

    private function remplirFeuilleJour(Worksheet $feuille, FicheDepot $fiche): void
    {
        $datePresentation = $fiche->getDatePresentation();
        $dateCreation = \DateTime::createFromImmutable($fiche->getDateCreation());

        $feuille->setCellValue('A1', 'Direction des Règlements');
        $feuille->getStyle('A1')->getFont()->setBold(true)->setSize(12);

        $feuille->setCellValue('A2', 'Service des Règlements');
        $feuille->getStyle('A2')->getFont()->setBold(true)->getColor()->setRGB('2E5395');

        $feuille->setCellValue('E3', 'REGLEMENTS DU');
        $feuille->getStyle('E3')->getFont()->setBold(true)->setItalic(true)->setUnderline(true)
            ->getColor()->setRGB(self::COULEUR_TITRE_ROUGE);
        $feuille->setCellValue('F3', ExcelDate::PHPToExcel($datePresentation));
        $feuille->getStyle('F3')->getNumberFormat()->setFormatCode('dd/mm/yyyy');
        $feuille->getStyle('F3')->getFont()->setBold(true)->setItalic(true)->setUnderline(true)
            ->getColor()->setRGB(self::COULEUR_TITRE_ROUGE);

        $feuille->setCellValue('A5', 'REGLEMENTS SYGMA');
        $feuille->mergeCells('A5:J5');
        $feuille->getStyle('A5')->getFont()->setBold(true)->getColor()->setRGB(self::COULEUR_TITRE_ROUGE);

        $feuille->setCellValue('I6', ExcelDate::PHPToExcel($dateCreation));
        $feuille->getStyle('I6')->getNumberFormat()->setFormatCode('dd/mm/yyyy');

        // En-tête colonnes (ligne 7)
        $entetes = [
            'A' => 'Date du Virement',
            'B' => 'Bénéficiaires',
            'F' => 'N° O.V.',
            'G' => 'Banques',
            'H' => 'Dépenses',
            'I' => 'Observations',
        ];
        foreach ($entetes as $col => $libelle) {
            $feuille->setCellValue($col.'7', $libelle);
        }
        $feuille->mergeCells('B7:E7');
        $feuille->mergeCells('I7:J7');
        $feuille->getStyle('A7:J7')->applyFromArray([
            'font' => ['bold' => true, 'italic' => true],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => self::COULEUR_ENTETE],
            ],
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN],
            ],
        ]);

        // Colonne E un peu moins large ; Observations (I:J) un peu plus large.
        $feuille->getColumnDimension('E')->setWidth(48);
        $feuille->getColumnDimension('I')->setWidth(38);
        $feuille->getColumnDimension('J')->setWidth(45);

        $this->effacerSousLigne($feuille, 8);

        $ligne = 8;
        $numeraires = $fiche->getMouvementsNumeraire()->toArray();
        $sygmas = $fiche->getMouvementsSygma()->toArray();
        $systacs = $fiche->getMouvementsSystac()->toArray();

        $ligne = $this->ecrireBandeauSection($feuille, $ligne, 'OPERATIONS EN NUMERAIRE');
        foreach ($numeraires as $m) {
            $ligne = $this->ecrireLigneMouvement($feuille, $ligne, $m);
        }
        $ligne = $this->ecrireLigneTotal($feuille, $ligne, 'TOTAL NUMERAIRE', $fiche->getTotalNumeraire());

        foreach ($sygmas as $m) {
            $ligne = $this->ecrireLigneMouvement($feuille, $ligne, $m, true);
        }
        $ligne = $this->ecrireLigneTotal($feuille, $ligne, 'TOTAL REGLEMENTS SYGMA', $fiche->getTotalSigma());

        foreach ($systacs as $m) {
            $ligne = $this->ecrireLigneMouvementSystac($feuille, $ligne, $m);
        }
        $ligne = $this->ecrireLigneTotal($feuille, $ligne, 'TOTAL REGLEMENTS SYSTAC', $fiche->getTotalGroupe());

        // Total général
        $feuille->mergeCells('A'.$ligne.':G'.$ligne);
        $feuille->setCellValue('H'.$ligne, $fiche->getTotal());
        $this->formatMontant($feuille, 'H'.$ligne);
        $feuille->mergeCells('I'.$ligne.':J'.$ligne);
        $feuille->getStyle('A'.$ligne.':J'.$ligne)->applyFromArray([
            'font' => ['bold' => true],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => self::COULEUR_TOTAL_GENERAL],
            ],
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN],
            ],
        ]);
        ++$ligne;

        ++$ligne;
        $this->ecrireSignatures($feuille, $ligne, $dateCreation);
    }

    private function effacerSousLigne(Worksheet $feuille, int $depuis): void
    {
        foreach (array_reverse($feuille->getMergeCells()) as $plage) {
            if ((int) preg_replace('/^[^0-9]+/', '', explode(':', $plage)[0]) >= $depuis) {
                $feuille->unmergeCells($plage);
            }
        }

        $derniere = max($depuis, (int) $feuille->getHighestRow());
        if ($derniere >= $depuis) {
            $feuille->removeRow($depuis, $derniere - $depuis + 1);
        }
    }

    private function ecrireBandeauSection(Worksheet $feuille, int $ligne, string $libelle): int
    {
        $feuille->mergeCells('A'.$ligne.':J'.$ligne);
        $feuille->setCellValue('A'.$ligne, $libelle);
        $feuille->getStyle('A'.$ligne.':J'.$ligne)->applyFromArray([
            'font' => ['bold' => true],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => self::COULEUR_SECTION],
            ],
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN],
            ],
        ]);

        return $ligne + 1;
    }

    private function ecrireLigneTotal(Worksheet $feuille, int $ligne, string $libelle, float $montant): int
    {
        $feuille->mergeCells('A'.$ligne.':G'.$ligne);
        $feuille->setCellValue('A'.$ligne, $libelle);
        $feuille->setCellValue('H'.$ligne, $montant);
        $feuille->mergeCells('I'.$ligne.':J'.$ligne);
        $this->formatMontant($feuille, 'H'.$ligne);

        $feuille->getStyle('A'.$ligne.':G'.$ligne)->applyFromArray([
            'font' => ['bold' => true],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => self::COULEUR_TOTAL_LIBELLE],
            ],
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN],
            ],
        ]);
        $feuille->getStyle('H'.$ligne.':J'.$ligne)->applyFromArray([
            'font' => ['bold' => true],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => self::COULEUR_TOTAL_MONTANT],
            ],
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN],
            ],
        ]);

        return $ligne + 1;
    }

    private function ecrireLigneMouvement(
        Worksheet $feuille,
        int $ligne,
        MouvementNumeraire|MouvementSygma $m,
        bool $enRouge = false,
    ): int {
        $date = $m->getDateVirement();
        if ($date !== null) {
            $feuille->setCellValue('A'.$ligne, ExcelDate::PHPToExcel($date));
            $feuille->getStyle('A'.$ligne)->getNumberFormat()->setFormatCode('dd/mm/yyyy');
        }

        $feuille->mergeCells('B'.$ligne.':E'.$ligne);
        $feuille->setCellValue('B'.$ligne, $m->getBeneficiaire());
        $feuille->setCellValue('F'.$ligne, $m->getNumeroOV());
        $feuille->setCellValue('G'.$ligne, $m->getBanque());
        $feuille->setCellValue('H'.$ligne, $m->getDepenses());
        $this->formatMontant($feuille, 'H'.$ligne);

        $obs = implode(' — ', array_map(
            static fn ($o) => $o->getContenu(),
            $m->getObservations()->toArray(),
        ));
        $feuille->mergeCells('I'.$ligne.':J'.$ligne);
        $feuille->setCellValue('I'.$ligne, $obs !== '' ? $obs : null);

        $feuille->getStyle('A'.$ligne.':J'.$ligne)->applyFromArray([
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN],
            ],
        ]);
        if ($enRouge) {
            $feuille->getStyle('B'.$ligne.':G'.$ligne)->getFont()->getColor()->setRGB(self::COULEUR_TITRE_ROUGE);
        }

        return $ligne + 1;
    }

    private function ecrireLigneMouvementSystac(Worksheet $feuille, int $ligne, MouvementSystac $m): int
    {
        $date = $m->getDateVirement();
        if ($date !== null) {
            $feuille->setCellValue('A'.$ligne, ExcelDate::PHPToExcel($date));
            $feuille->getStyle('A'.$ligne)->getNumberFormat()->setFormatCode('dd/mm/yyyy');
        }

        $feuille->mergeCells('B'.$ligne.':E'.$ligne);
        $feuille->setCellValue('B'.$ligne, $m->getDesignation() ?: $m->getBeneficiaire());
        $feuille->setCellValue('H'.$ligne, $m->getMontantGroupe());
        $this->formatMontant($feuille, 'H'.$ligne);
        $feuille->mergeCells('I'.$ligne.':J'.$ligne);
        $feuille->getStyle('A'.$ligne.':J'.$ligne)->applyFromArray([
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN],
            ],
        ]);

        return $ligne + 1;
    }

    private function ecrireSignatures(Worksheet $feuille, int $ligne, \DateTimeInterface $date): void
    {
        $feuille->mergeCells('A'.$ligne.':C'.$ligne);
        $feuille->setCellValue('A'.$ligne, 'DIRECTEUR DES REGLEMENTS');
        $feuille->mergeCells('E'.$ligne.':G'.$ligne);
        $feuille->setCellValue('E'.$ligne, 'VISA DU DIRECTEUR DE LA DEPENSE');
        $feuille->mergeCells('H'.$ligne.':J'.$ligne);
        $feuille->setCellValue('H'.$ligne, 'VISA DU DIRECTEUR DES OPERATIONS MONETAIRES ET FINANCIERES');
        $feuille->getStyle('A'.$ligne.':J'.$ligne)->getFont()->setBold(true)->setItalic(true);

        $ligneBas = $ligne + 6;
        foreach ([['A', 'C'], ['E', 'G'], ['H', 'J']] as [$debut, $fin]) {
            $plage = $debut.$ligne.':'.$fin.$ligneBas;
            $feuille->getStyle($plage)->applyFromArray([
                'borders' => [
                    'outline' => ['borderStyle' => Border::BORDER_MEDIUM],
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical' => Alignment::VERTICAL_TOP,
                ],
            ]);
        }

        $feuille->setCellValue('A'.$ligneBas, 'Le');
        $feuille->setCellValue('B'.$ligneBas, ExcelDate::PHPToExcel($date));
        $feuille->getStyle('B'.$ligneBas)->getNumberFormat()->setFormatCode('dd/mm/yyyy');

        $feuille->setCellValue('E'.$ligneBas, 'Le');
        $feuille->setCellValue('F'.$ligneBas, ExcelDate::PHPToExcel($date));
        $feuille->getStyle('F'.$ligneBas)->getNumberFormat()->setFormatCode('dd/mm/yyyy');

        $feuille->setCellValue('H'.$ligneBas, 'Le');
        $feuille->setCellValue('I'.$ligneBas, ExcelDate::PHPToExcel($date));
        $feuille->getStyle('I'.$ligneBas)->getNumberFormat()->setFormatCode('dd/mm/yyyy');
    }

    /**
     * @param list<MouvementNumeraire|MouvementSygma> $mouvements
     */
    private function remplirFeuilleNumeraireOuSigma(Worksheet $feuille, array $mouvements): void
    {
        $this->preparerEnteteMouvements($feuille);

        $ligne = 2;
        foreach ($mouvements as $m) {
            $feuille->setCellValue('C'.$ligne, $m->getBeneficiaire());
            $feuille->setCellValue('D'.$ligne, $m->getNumeroOV());
            $feuille->setCellValue('E'.$ligne, 1);
            $feuille->setCellValue('F'.$ligne, $m->getDepenses());
            $this->formatMontant($feuille, 'F'.$ligne);
            $feuille->setCellValue('H'.$ligne, $m->getBanque());
            $date = $m->getDateVirement();
            if ($date !== null) {
                $feuille->setCellValue('I'.$ligne, ExcelDate::PHPToExcel($date));
                $feuille->getStyle('I'.$ligne)->getNumberFormat()->setFormatCode('dd/mm/yyyy');
            }
            ++$ligne;
        }

        if ($ligne > 2) {
            $total = array_sum(array_map(static fn ($m) => $m->getDepenses(), $mouvements));
            $feuille->setCellValue('F'.$ligne, $total);
            $this->formatMontant($feuille, 'F'.$ligne);
            $feuille->getStyle('F'.$ligne)->getFont()->setBold(true);
            $feuille->getStyle('F'.$ligne)->applyFromArray([
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => 'C6EFCE'],
                ],
            ]);
        }
    }

    private function remplirFeuilleSystac(Worksheet $feuille, FicheDepot $fiche): void
    {
        $this->preparerEnteteMouvements($feuille);

        $ligne = 2;
        /** @var list<array{debut: int, fin: int}> $fusions */
        $fusions = [];

        foreach ($fiche->getMouvementsSystac() as $groupe) {
            $lignes = $groupe->getLignesSystac()->toArray();
            if ($lignes === []) {
                // Groupe sans détail : une ligne synthétique
                $feuille->setCellValue('C'.$ligne, $groupe->getBeneficiaire());
                $feuille->setCellValue('F'.$ligne, $groupe->getMontantSystac());
                $feuille->setCellValue('G'.$ligne, $groupe->getMontantGroupe());
                $feuille->setCellValue('H'.$ligne, $groupe->getDesignation());
                $this->formatMontant($feuille, 'F'.$ligne);
                $this->formatMontant($feuille, 'G'.$ligne);
                ++$ligne;
                continue;
            }

            $debutGroupe = $ligne;
            foreach ($lignes as $index => $l) {
                /** @var LigneSystac $l */
                $feuille->setCellValue('B'.$ligne, $l->getCOrig());
                $feuille->setCellValue('C'.$ligne, $l->getLOrig());
                $feuille->setCellValue('D'.$ligne, $l->getNBv());
                $feuille->setCellValue('E'.$ligne, $l->getNbRegl());
                $feuille->setCellValue('F'.$ligne, $l->getMontantSystac());
                $this->formatMontant($feuille, 'F'.$ligne);

                if ($index === 0) {
                    $feuille->setCellValue('G'.$ligne, $groupe->getMontantGroupe());
                    $this->formatMontant($feuille, 'G'.$ligne);
                    $feuille->setCellValue('H'.$ligne, $groupe->getDesignation() ?: $l->getDesignation());
                }

                $gen = $l->getDGeneration() ?? $l->getDCreationIp();
                if ($gen !== null) {
                    $feuille->setCellValue('I'.$ligne, ExcelDate::PHPToExcel($gen));
                    $feuille->getStyle('I'.$ligne)->getNumberFormat()->setFormatCode('dd/mm/yyyy');
                }

                ++$ligne;
            }

            $finGroupe = $ligne - 1;
            if ($finGroupe > $debutGroupe) {
                $fusions[] = ['debut' => $debutGroupe, 'fin' => $finGroupe];
            }
        }

        foreach ($fusions as $f) {
            $feuille->mergeCells('G'.$f['debut'].':G'.$f['fin']);
            $feuille->mergeCells('H'.$f['debut'].':H'.$f['fin']);
            $feuille->getStyle('G'.$f['debut'])->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
            $feuille->getStyle('H'.$f['debut'])->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
        }

        if ($ligne > 2) {
            $feuille->setCellValue('F'.$ligne, $fiche->getTotalSystac());
            $feuille->setCellValue('G'.$ligne, $fiche->getTotalGroupe());
            $this->formatMontant($feuille, 'F'.$ligne);
            $this->formatMontant($feuille, 'G'.$ligne);
            $feuille->getStyle('F'.$ligne.':G'.$ligne)->applyFromArray([
                'font' => ['bold' => true],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => 'C6EFCE'],
                ],
            ]);
        }
    }

    private function preparerEnteteMouvements(Worksheet $feuille): void
    {
        foreach (array_reverse($feuille->getMergeCells()) as $plage) {
            $feuille->unmergeCells($plage);
        }

        $derniere = max(1, (int) $feuille->getHighestRow());
        if ($derniere >= 1) {
            $feuille->removeRow(1, $derniere);
        }

        $feuille->fromArray(
            ['C_PCA', 'C_ORIG', 'L_ORIG', 'N_BV', 'NB_REGL', ' MONTANT ', 'MONTANTS GROUPES ', 'DESIGNATIONS ', 'D_GENERATION_IP'],
            null,
            'A1',
        );
        $feuille->getStyle('A1:I1')->applyFromArray([
            'font' => ['bold' => true],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => self::COULEUR_ENTETE],
            ],
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN],
            ],
        ]);
    }

    private function formatMontant(Worksheet $feuille, string $cellule): void
    {
        $feuille->getStyle($cellule)->getNumberFormat()->setFormatCode('#,##0');
        $feuille->getStyle($cellule)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
    }
}
