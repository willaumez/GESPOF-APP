<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\FicheBleu\FicheBleue;
use App\Module\ServicePrevision\Entite\FicheBleu\Section;
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
 * Export Excel Fiche Bleue à partir de {@see AppConfig::modeleFicheBleuePath()}.
 */
final class FicheBleueExcelGenerator
{
    private const COULEUR_SOLDE = 'FDF6E3';
    private const COULEUR_RECETTE = 'C6EFCE';
    private const COULEUR_DEPENSE = 'F8CBAD';
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
    public function generer(FicheBleue $fiche): array
    {
        ini_set('memory_limit', '512M');
        set_time_limit(180);

        $cheminModele = $this->appConfig->modeleFicheBleuePath();
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

    private function remplirEnTete(Worksheet $feuille, FicheBleue $fiche): void
    {
        $date = $fiche->getDateCreation()->format('d/m/Y H:i');
        $feuille->setCellValue('A7', 'Fiche Bleue — '.$fiche->getReference());
        $feuille->setCellValue(
            'A8',
            sprintf('Date : %s  ·  Créée par : %s', $date, $fiche->getCreateur()),
        );
    }

    private function remplirLignes(Worksheet $feuille, FicheBleue $fiche): int
    {
        $racines = array_values(array_filter(
            $fiche->getSections()->toArray(),
            static fn (Section $s): bool => !$s->estSousSection(),
        ));
        usort(
            $racines,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId()] <=> [$b->getOrdre(), $b->getId()],
        );

        // Effacer la sentinelle et les anciennes lignes éventuelles.
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
        $feuille->mergeCells(sprintf('A%d:C%d', $ligne, $ligne));
        $feuille->setCellValue('A'.$ligne, $libelle);
        $bg = $type === TypeSection::RECETTE ? self::COULEUR_RECETTE : self::COULEUR_DEPENSE;
        $fg = $type === TypeSection::RECETTE ? self::COULEUR_TEXTE_RECETTE : self::COULEUR_TEXTE_DEPENSE;
        $feuille->getStyle('A'.$ligne.':C'.$ligne)->applyFromArray([
            'font' => ['bold' => true, 'name' => 'Arial', 'size' => 10, 'color' => ['rgb' => $fg]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bg]],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
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
        $feuille->setCellValue('A'.$ligne, $numero);
        $feuille->setCellValue('B'.$ligne, $indent.$section->getNom());
        $feuille->setCellValue('C'.$ligne, (float) $section->getMontantProgramme());
        $feuille->getStyle('C'.$ligne)->getNumberFormat()
            ->setFormatCode('#,##0.00');

        $estRacine = $niveau === 0;
        [$bg, $fg, $bold] = match ($type) {
            TypeSection::SOLDE => [self::COULEUR_SOLDE, self::COULEUR_TEXTE_OR, $estRacine],
            TypeSection::RECETTE => [$estRacine ? self::COULEUR_RECETTE : 'E8F5E9', self::COULEUR_TEXTE_RECETTE, $estRacine],
            TypeSection::DEPENSE => [$estRacine ? self::COULEUR_DEPENSE : 'FBE9E7', self::COULEUR_TEXTE_DEPENSE, $estRacine],
        };

        $feuille->getStyle('A'.$ligne.':C'.$ligne)->applyFromArray([
            'font' => [
                'bold' => $bold,
                'name' => 'Arial',
                'size' => $estRacine ? 10 : 9,
                'color' => ['rgb' => $fg],
            ],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bg]],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'B0B0B0']]],
            'alignment' => [
                'vertical' => Alignment::VERTICAL_CENTER,
                'horizontal' => Alignment::HORIZONTAL_LEFT,
            ],
        ]);
        $feuille->getStyle('A'.$ligne)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $feuille->getStyle('C'.$ligne)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

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

    private function remplirTotal(Worksheet $feuille, FicheBleue $fiche, int $ligne): void
    {
        $feuille->mergeCells(sprintf('A%d:B%d', $ligne, $ligne));
        $feuille->setCellValue('A'.$ligne, 'TOTAL PROGRAMMÉ');
        $feuille->setCellValue('C'.$ligne, (float) $fiche->getMontantTotalProgramme());
        $feuille->getStyle('C'.$ligne)->getNumberFormat()->setFormatCode('#,##0.00');
        $feuille->getStyle('A'.$ligne.':C'.$ligne)->applyFromArray([
            'font' => ['bold' => true, 'name' => 'Arial', 'size' => 10, 'color' => ['rgb' => '1F4E79']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => self::COULEUR_TOTAL]],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
            'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $feuille->getStyle('C'.$ligne)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $feuille->getRowDimension($ligne)->setRowHeight(22);
    }
}
