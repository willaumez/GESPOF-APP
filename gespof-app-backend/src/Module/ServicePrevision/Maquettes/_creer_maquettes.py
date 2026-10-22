"""Génère les maquettes Excel SP (Fiche Bleue, Exécution, Dépôt).

Dimensions, en-têtes administratifs, couleurs de sections et mise en page
impression (A4). Les lignes exemples (à partir de la ligne 10) sont remplacées
par le générateur PhpSpreadsheet au téléchargement.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.page import PageMargins

OUT = Path(__file__).resolve().parent
SR_DEPOT = (
    Path(__file__).resolve().parents[3]
    / "Shared"
    / "ModelFichier"
    / "FICHE_DE_DEPOT_MODELE_CORRIGE.xlsx"
)

# Palette alignée sur FicheBleueExcelGenerator / FicheExecutionExcelGenerator
GOLD = "C9960A"
GOLD_HDR = "FCE4A8"
SOLDE_BG = "FDF6E3"
SOLDE_FG = "C9960A"
RECETTE_BG = "C6EFCE"
RECETTE_FG = "006100"
RECETTE_LIGHT = "E8F5E9"
DEPENSE_BG = "F8CBAD"
DEPENSE_FG = "C65911"
DEPENSE_LIGHT = "FBE9E7"
NON_PROG_BG = "FFF2CC"
NON_PROG_FG = "7F6000"
TOTAL_BG = "9BC2E6"
TOTAL_FG = "1F4E79"

THIN = Border(
    left=Side(style="thin", color="B0B0B0"),
    right=Side(style="thin", color="B0B0B0"),
    top=Side(style="thin", color="B0B0B0"),
    bottom=Side(style="thin", color="B0B0B0"),
)

ENTETES = [
    "Ministère de l'Economie, des Finances, de la Dette et des Participations, Chargé de la Lutte Contre la Vie Chère",
    "Secrétariat Général",
    "Direction Générale de la Comptabilité Publique et du Trésor",
    "Direction des Opérations Monétaires et Financières",
]


def set_widths(ws, widths: list[float]) -> None:
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


def mise_en_page(ws, orientation: str = "portrait", ncols: int = 3) -> None:
    ws.page_setup.orientation = orientation
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.print_title_rows = "1:9"
    ws.page_margins = PageMargins(
        left=0.5, right=0.5, top=0.6, bottom=0.6, header=0.2, footer=0.2
    )
    ws.freeze_panes = "A10"
    ws.print_area = f"A1:{get_column_letter(ncols)}25"


def ecrire_entetes_admin(ws, ncols: int) -> None:
    for i, texte in enumerate(ENTETES, 1):
        ws.merge_cells(start_row=i, start_column=1, end_row=i, end_column=ncols)
        cell = ws.cell(i, 1, texte)
        cell.font = Font(name="Arial", size=9, italic=True, color="555555")
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        ws.row_dimensions[i].height = 16


def style_ligne(
    ws,
    row: int,
    ncols: int,
    *,
    bg: str,
    fg: str,
    bold: bool = False,
    size: int = 10,
) -> None:
    fill = PatternFill("solid", fgColor=bg)
    font = Font(name="Arial", size=size, bold=bold, color=fg)
    for col in range(1, ncols + 1):
        cell = ws.cell(row, col)
        cell.fill = fill
        cell.font = font
        cell.border = THIN
        cell.alignment = Alignment(vertical="center")
    ws.cell(row, 1).alignment = Alignment(horizontal="center", vertical="center")
    for col in range(3, ncols + 1):
        ws.cell(row, col).alignment = Alignment(
            horizontal="right", vertical="center"
        )
        ws.cell(row, col).number_format = "#,##0.00"
    ws.row_dimensions[row].height = 18


def creer_fiche_bleue() -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Fiche Bleue"
    set_widths(ws, [8, 55, 22])
    mise_en_page(ws, "portrait", 3)
    ecrire_entetes_admin(ws, 3)

    ws.merge_cells("A6:C6")
    ws["A6"] = "SITUATION DE TRESORERIE"
    ws["A6"].font = Font(name="Arial", size=16, bold=True, color=GOLD)
    ws["A6"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[6].height = 28

    ws.merge_cells("A7:C7")
    ws["A7"] = "Fiche Bleue — {{REFERENCE}}"
    ws["A7"].font = Font(name="Arial", size=11, bold=True, color="1F4E79")
    ws["A7"].alignment = Alignment(horizontal="center")

    ws.merge_cells("A8:C8")
    ws["A8"] = "Date : {{DATE}}  ·  Créée par : {{CREATEUR}}"
    ws["A8"].font = Font(name="Arial", size=9, color="666666")
    ws["A8"].alignment = Alignment(horizontal="center")

    for col, label in enumerate(["N°", "BANCAIRE", "PROGRAMMATION (FCFA)"], 1):
        cell = ws.cell(9, col, label)
        cell.font = Font(name="Arial", size=10, bold=True, color="1F4E79")
        cell.fill = PatternFill("solid", fgColor=GOLD_HDR)
        cell.alignment = Alignment(
            horizontal="center", vertical="center", wrap_text=True
        )
        cell.border = THIN
    ws.row_dimensions[9].height = 24

    # Exemples de couleurs (remplacés à l'export à partir de la ligne 10).
    exemples = [
        (10, "1", "SOLDE D'OUVERTURE", 1_250_000.00, SOLDE_BG, SOLDE_FG, True, 10),
        (11, "", "RECETTES", None, RECETTE_BG, RECETTE_FG, True, 10),
        (12, "2", "Recettes fiscales", 850_000.00, RECETTE_BG, RECETTE_FG, True, 10),
        (13, "2.1", "  Impôts directs", 500_000.00, RECETTE_LIGHT, RECETTE_FG, False, 9),
        (14, "2.2", "  Impôts indirects", 350_000.00, RECETTE_LIGHT, RECETTE_FG, False, 9),
        (15, "", "DÉPENSES", None, DEPENSE_BG, DEPENSE_FG, True, 10),
        (16, "3", "Dépenses de fonctionnement", 620_000.00, DEPENSE_BG, DEPENSE_FG, True, 10),
        (17, "3.1", "  Salaires", 400_000.00, DEPENSE_LIGHT, DEPENSE_FG, False, 9),
        (18, "3.2", "  Autres charges", 220_000.00, DEPENSE_LIGHT, DEPENSE_FG, False, 9),
    ]
    for row, num, lib, montant, bg, fg, bold, size in exemples:
        if lib in ("RECETTES", "DÉPENSES"):
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=3)
            ws.cell(row, 1, lib)
        else:
            ws.cell(row, 1, num)
            ws.cell(row, 2, lib)
            if montant is not None:
                ws.cell(row, 3, montant)
        style_ligne(ws, row, 3, bg=bg, fg=fg, bold=bold, size=size)

    ws.merge_cells("A19:B19")
    ws["A19"] = "TOTAL PROGRAMMÉ"
    ws["C19"] = 2_100_000.00
    style_ligne(ws, 19, 3, bg=TOTAL_BG, fg=TOTAL_FG, bold=True, size=10)
    ws.row_dimensions[19].height = 22

    wb.save(OUT / "Maquette-Fiche-Bleue.xlsx")
    print("Écrit:", OUT / "Maquette-Fiche-Bleue.xlsx")


def creer_fiche_execution() -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Fiche d'execution"
    set_widths(ws, [8, 48, 18, 18, 16])
    mise_en_page(ws, "landscape", 5)
    ecrire_entetes_admin(ws, 5)

    ws.merge_cells("A6:E6")
    ws["A6"] = "FICHE D'EXECUTION"
    ws["A6"].font = Font(name="Arial", size=16, bold=True, color=GOLD)
    ws["A6"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[6].height = 28

    ws.merge_cells("A7:E7")
    ws["A7"] = "Référence — {{REFERENCE}}"
    ws["A7"].font = Font(name="Arial", size=11, bold=True, color="1F4E79")
    ws["A7"].alignment = Alignment(horizontal="center")

    ws.merge_cells("A8:E8")
    ws["A8"] = "Date : {{DATE}}  ·  Créée par : {{CREATEUR}}"
    ws["A8"].font = Font(name="Arial", size=9, color="666666")
    ws["A8"].alignment = Alignment(horizontal="center")

    for col, label in enumerate(
        ["N°", "BANCAIRE", "PROGRAMMÉ (FCFA)", "RÉALISÉ (FCFA)", "ÉCART (FCFA)"],
        1,
    ):
        cell = ws.cell(9, col, label)
        cell.font = Font(name="Arial", size=10, bold=True, color="1F4E79")
        cell.fill = PatternFill("solid", fgColor=GOLD_HDR)
        cell.alignment = Alignment(
            horizontal="center", vertical="center", wrap_text=True
        )
        cell.border = THIN
    ws.row_dimensions[9].height = 28

    exemples = [
        # row, num, lib, prog, real, ecart, bg, fg, bold, size, merge_groupe
        (10, "1", "SOLDE D'OUVERTURE", 1_250_000, 1_250_000, 0, SOLDE_BG, SOLDE_FG, True, 10, False),
        (11, "", "RECETTES", None, None, None, RECETTE_BG, RECETTE_FG, True, 10, True),
        (12, "2", "Recettes fiscales", 850_000, 820_000, -30_000, RECETTE_BG, RECETTE_FG, True, 10, False),
        (13, "2.1", "  Impôts directs", 500_000, 480_000, -20_000, RECETTE_LIGHT, RECETTE_FG, False, 9, False),
        (14, "2.2", "  Impôts indirects", 350_000, 340_000, -10_000, RECETTE_LIGHT, RECETTE_FG, False, 9, False),
        (15, "", "DÉPENSES", None, None, None, DEPENSE_BG, DEPENSE_FG, True, 10, True),
        (16, "3", "Dépenses de fonctionnement", 620_000, 610_000, -10_000, DEPENSE_BG, DEPENSE_FG, True, 10, False),
        (17, "3.1", "  Salaires", 400_000, 400_000, 0, DEPENSE_LIGHT, DEPENSE_FG, False, 9, False),
        (18, "3.2", "  Autres charges", 220_000, 210_000, -10_000, DEPENSE_LIGHT, DEPENSE_FG, False, 9, False),
        (19, "4", "Section non programmée (exemple)", 0, 15_000, 15_000, NON_PROG_BG, NON_PROG_FG, True, 10, False),
    ]
    for row, num, lib, prog, real, ecart, bg, fg, bold, size, merge in exemples:
        if merge:
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
            ws.cell(row, 1, lib)
        else:
            ws.cell(row, 1, num)
            ws.cell(row, 2, lib)
            ws.cell(row, 3, prog)
            ws.cell(row, 4, real)
            ws.cell(row, 5, ecart)
        style_ligne(ws, row, 5, bg=bg, fg=fg, bold=bold, size=size)

    ws.merge_cells("A20:B20")
    ws["A20"] = "TOTAL"
    ws["C20"] = 2_100_000.00
    ws["D20"] = 2_085_000.00
    ws["E20"] = -15_000.00
    style_ligne(ws, 20, 5, bg=TOTAL_BG, fg=TOTAL_FG, bold=True, size=10)
    ws.row_dimensions[20].height = 22

    wb.save(OUT / "Maquette-Fiche-Execution.xlsx")
    print("Écrit:", OUT / "Maquette-Fiche-Execution.xlsx")


def creer_fiche_depot() -> None:
    dst = OUT / "Maquette-Fiche-Depot.xlsx"
    if not SR_DEPOT.exists():
        raise FileNotFoundError(f"Modèle SR introuvable : {SR_DEPOT}")
    shutil.copy2(SR_DEPOT, dst)
    print("Écrit:", dst, "(copie du modèle SR coloré)")


if __name__ == "__main__":
    creer_fiche_bleue()
    creer_fiche_execution()
    creer_fiche_depot()
