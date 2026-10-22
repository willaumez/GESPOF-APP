<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\FicheBleu\Section;
use App\Module\ServicePrevision\Entite\FicheExecution\FicheExecution;
use App\Module\ServicePrevision\Enum\TypeSection;
use App\Module\ServicePrevision\Maquettes\MaquetteFicheBleue;
use App\Shared\Config\AppConfig;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\HttpKernel\Exception\RuntimeException;

/**
 * Export Excel Fiche d'exécution à partir de {@see AppConfig::modeleFicheExecutionPath()}.
 */
final class FicheExecutionExcelGenerator
{
    private const COULEUR_SOLDE = 'FDF6E3';
    private const COULEUR_RECETTE = 'C6EFCE';
    private const COULEUR_DEPENSE = 'F8CBAD';
    private const COULEUR_NON_PROG = 'FFF2CC';
    private const COULEUR_TOTAL = '9BC2E6';
    private const COULEUR_TEXTE_OR = 'C9960A';
    private const COULEUR_TEXTE_RECETTE = '006100';
    private const COULEUR_TEXTE_DEPENSE = 'C65911';
    private const LIGNE_DEBUT = 10;

    public function __construct(
        private readonly AppConfig $appConfig,
        private readonly Filesystem $filesystem = new Filesystem(),
    ) {
    }

    /**
     * @return array{chemin: string, nom: string}
     */
    public function generer(FicheExecution $fiche): array
    {
        ini_set('memory_limit', '512M');
        set_time_limit(180);

        $cheminModele = $this->appConfig->modeleFicheExecutionPath();
        if (!$this->filesystem->exists($cheminModele)) {
            throw new RuntimeException(sprintf('Modèle Excel introuvable : %s', $cheminModele));
        }

        $spreadsheet = IOFactory::load($cheminModele);
        $feuille = $spreadsheet->getActiveSheet();

        $this->remplirEnTete($feuille, $fiche);
        $derniere = $this->remplirLignes($feuille, $fiche);
        $this->remplirTotal($feuille, $fiche, $derniere + 1);

        $dir = $this->appConfig->projectDir().'/var/exports/sp';
        $this->filesystem->mkdir($dir);
        $nom = $fiche->getReference().'.xlsx';
        $chemin = $dir.\DIRECTORY_SEPARATOR.$nom;

        (new Xlsx($spreadsheet))->save($chemin);
        $spreadsheet->disconnectWorksheets();

        return ['chemin' => $chemin, 'nom' => $nom];
    }

    private function remplirEnTete(Worksheet $feuille, FicheExecution $fiche): void
    {
        $date = $fiche->getDateCreation()->format('d/m/Y H:i');
        $feuille->setCellValue('A7', 'Référence — '.$fiche->getReference());
        $feuille->setCellValue(
            'A8',
            sprintf('Date : %s  ·  Créée par : %s', $date, $fiche->getCreateur()),
        );
    }

    private function remplirLignes(Worksheet $feuille, FicheExecution $fiche): int
    {
        $racines = array_values(array_filter(
            $fiche->getSections()->toArray(),
            static fn (Section $s): bool => !$s->estSousSection(),
        ));
        usort(
            $racines,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId()] <=> [$b->getOrdre(), $b->getId()],
        );

        $haute = max(self::LIGNE_DEBUT, (int) $feuille->getHighestRow());
        if ($haute >= self::LIGNE_DEBUT) {
            $feuille->removeRow(self::LIGNE_DEBUT, $haute - self::LIGNE_DEBUT + 1);
        }

        $ligne = self::LIGNE_DEBUT;
        $ordreRacine = 0;
        $premiereRecetteEcrite = false;
        $premiereDepenseEcrite = false;

        foreach ($racines as $section) {
            $type = $section->getType();
            if (
                ($type === TypeSection::RECETTE && !$premiereRecetteEcrite)
                || ($type === TypeSection::DEPENSE && !$premiereDepenseEcrite)
            ) {
                if (!MaquetteFicheBleue::estConteneurType($section->getNom(), $type, true)) {
                    $libelleGroupe = $type === TypeSection::RECETTE ? 'RECETTES' : 'DÉPENSES';
                    $ligne = $this->ecrireGroupe($feuille, $ligne, $libelleGroupe, $type);
                    if ($type === TypeSection::RECETTE) {
                        $premiereRecetteEcrite = true;
                    } else {
                        $premiereDepenseEcrite = true;
                    }
                }
            }

            ++$ordreRacine;
            $ligne = $this->ecrireSection($feuille, $ligne, $section, 0, (string) $ordreRacine);
        }

        return $ligne - 1;
    }

    private function ecrireGroupe(Worksheet $feuille, int $ligne, string $libelle, TypeSection $type): int
    {
        $feuille->mergeCells(sprintf('A%d:E%d', $ligne, $ligne));
        $feuille->setCellValue('A'.$ligne, $libelle);
        $bg = $type === TypeSection::RECETTE ? self::COULEUR_RECETTE : self::COULEUR_DEPENSE;
        $fg = $type === TypeSection::RECETTE ? self::COULEUR_TEXTE_RECETTE : self::COULEUR_TEXTE_DEPENSE;
        $feuille->getStyle('A'.$ligne.':E'.$ligne)->applyFromArray([
            'font' => ['bold' => true, 'name' => 'Arial', 'size' => 10, 'color' => ['rgb' => $fg]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bg]],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);
        $feuille->getRowDimension($ligne)->setRowHeight(20);

        return $ligne + 1;
    }

    private function ecrireSection(
        Worksheet $feuille,
        int $ligne,
        Section $section,
        int $niveau,
        string $numero,
    ): int {
        $indent = str_repeat('  ', $niveau);
        $type = $section->getType();
        $estRacine = $niveau === 0;
        $nonProg = $section->estNonProgramme();

        $feuille->setCellValue('A'.$ligne, $numero);
        $feuille->setCellValue('B'.$ligne, $indent.$section->getNom());
        $feuille->setCellValue('C'.$ligne, (float) $section->getMontantProgramme());
        $feuille->setCellValue('D'.$ligne, (float) $section->getMontantRealise());
        $feuille->setCellValue('E'.$ligne, (float) $section->getMontantEcart());
        foreach (['C', 'D', 'E'] as $col) {
            $feuille->getStyle($col.$ligne)->getNumberFormat()->setFormatCode('#,##0.00');
            $feuille->getStyle($col.$ligne)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }

        if ($nonProg) {
            $bg = self::COULEUR_NON_PROG;
            $fg = '7F6000';
        } else {
            [$bg, $fg] = match ($type) {
                TypeSection::SOLDE => [self::COULEUR_SOLDE, self::COULEUR_TEXTE_OR],
                TypeSection::RECETTE => [$estRacine ? self::COULEUR_RECETTE : 'E8F5E9', self::COULEUR_TEXTE_RECETTE],
                TypeSection::DEPENSE => [$estRacine ? self::COULEUR_DEPENSE : 'FBE9E7', self::COULEUR_TEXTE_DEPENSE],
            };
        }

        $feuille->getStyle('A'.$ligne.':E'.$ligne)->applyFromArray([
            'font' => [
                'bold' => $estRacine,
                'name' => 'Arial',
                'size' => $estRacine ? 10 : 9,
                'color' => ['rgb' => $fg],
            ],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bg]],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'B0B0B0']]],
            'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $feuille->getStyle('A'.$ligne)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $ligneSuivante = $ligne + 1;
        $sous = $section->getSousSections()->toArray();
        usort(
            $sous,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId()] <=> [$b->getOrdre(), $b->getId()],
        );
        $i = 0;
        foreach ($sous as $enfant) {
            ++$i;
            $ligneSuivante = $this->ecrireSection(
                $feuille,
                $ligneSuivante,
                $enfant,
                $niveau + 1,
                $numero.'.'.$i,
            );
        }

        return $ligneSuivante;
    }

    private function remplirTotal(Worksheet $feuille, FicheExecution $fiche, int $ligne): void
    {
        $feuille->mergeCells(sprintf('A%d:B%d', $ligne, $ligne));
        $feuille->setCellValue('A'.$ligne, 'TOTAL');
        $feuille->setCellValue('C'.$ligne, (float) $fiche->getMontantTotalProgramme());
        $feuille->setCellValue('D'.$ligne, (float) $fiche->getMontantTotalRealisation());
        $feuille->setCellValue('E'.$ligne, (float) $fiche->getEcartTotal());
        foreach (['C', 'D', 'E'] as $col) {
            $feuille->getStyle($col.$ligne)->getNumberFormat()->setFormatCode('#,##0.00');
        }
        $feuille->getStyle('A'.$ligne.':E'.$ligne)->applyFromArray([
            'font' => ['bold' => true, 'name' => 'Arial', 'size' => 10, 'color' => ['rgb' => '1F4E79']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => self::COULEUR_TOTAL]],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
            'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
        ]);
        foreach (['C', 'D', 'E'] as $col) {
            $feuille->getStyle($col.$ligne)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }
        $feuille->getRowDimension($ligne)->setRowHeight(22);
    }
}
