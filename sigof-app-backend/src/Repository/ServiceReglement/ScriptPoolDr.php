<?php

declare(strict_types=1);

namespace App\Repository\ServiceReglement;

use App\Service\Database\DatabaseReader;

class ScriptPoolDr
{
    public function __construct(private readonly DatabaseReader $databaseReader)
    {}

    public function findByDate(\DateTimeInterface $datePresentation): array
    {
        $sql = <<<'SQL'
            SELECT
                C_ORIG              AS "C_ORIG",
                D_PRESENTATION      AS "D_PRESENTATION",
                L_ORIG              AS "L_ORIG",
                N_BV                AS "N_BV",
                NB_REGL             AS "NB_REGL",
                MONTANT_SYSTAC      AS "MONTANT_SYSTAC",
                NB_REGL_SYGMA       AS "NB_REGL_SYGMA",
                MONTANT_SYGMA       AS "MONTANT_SYGMA",
                D_CREATION_IP       AS "D_CREATION_IP",
                D_ARRET_IP          AS "D_GENERATION"
            FROM v_recap_dsgp
            WHERE d_valeur IS NOT NULL
              AND d_presentation >= TO_DATE(:d_presentation, 'DD/MM/YYYY')
              AND d_presentation <= TO_DATE(:d_presentation, 'DD/MM/YYYY')
              AND montant_systac > 0
              AND d_creation_ip IS NOT NULL
              AND d_arret_ip IS NOT NULL
            ORDER BY n_ordre, n_bv
            SQL;

        return $this->databaseReader->executeQuery($sql, [
            'd_presentation' => $datePresentation->format('d/m/Y'),
        ]);
    }

    public function findReglementsByBvList(array $nBvList): array
    {
        if ($nBvList === []) {
            error_log('[DEBUG] ScriptPoolDr::findReglementsByBvList - LISTE VIDE');
            return [];
        }

        $nBvList = array_map('intval', $nBvList);
        $nBvList = array_filter($nBvList, function ($value) {
            return $value !== 0 && $value !== null;
        });
        $nBvList = array_unique($nBvList);
        $nBvList = array_values($nBvList);

        if (empty($nBvList)) {
            error_log('[DEBUG] ScriptPoolDr::findReglementsByBvList - LISTE VIDE APRÈS NETTOYAGE');
            return [];
        }

        $params = [];
        $placeholders = [];
        foreach ($nBvList as $i => $nBv) {
            $placeholders[] = ":n_bv_{$i}";
            $params["n_bv_{$i}"] = $nBv;
        }

        $sql = str_replace('{{n_bv_list}}', implode(', ', $placeholders), <<<'SQL'
        SELECT
            n_bv            AS "N_BV",
            n_emis          AS "Numero_emission",
            n_regl          AS "N_Regl",
            (m_regl - m_prec_tva)          AS "Net_a_Payer" -- (montant brut du règlement) - (précompte/TVA retenue à la source)
        FROM dmc.regt
        WHERE n_bv IN ({{n_bv_list}})
        ORDER BY n_bv, n_emis
        SQL);

        $result = $this->databaseReader->executeQuery($sql, $params);

        return $result;
    }

    public function groupReglementsByBv(array $reglements): array
    {
        $resultat = [];
        foreach ($reglements as $item) {
            $nBv = (string) $item['N_BV'];
            $resultat[$nBv] ??= [];
            $resultat[$nBv][] = [
                'Numero_emission' => $item['Numero_emission'],
                'N_Regl' => $item['N_Regl'],
                'Net_a_Payer' => $item['Net_a_Payer'],
            ];
        }

        return $resultat;
    }

    public function findSigmaByDate(\DateTimeInterface $datePresentation): array
    {
        $sql = <<<'SQL'
            SELECT
                ORIG        AS "ORIG",
                N_DOC       AS "N_DOC",
                D_OPER      AS "D_PRESENTATION",
                C_TYP       AS "C_TYP",
                M_OPER      AS "MONTANT_SIGMA",
                C_REF       AS "N_OV",
                L_TIERS     AS "BENEFICIAIRE",
                L_OBJ       AS "OBJET",
                L_COM       AS "L_COM",
                L_EXP       AS "L_EXP",
                L_DEST      AS "BANQUE",
                C_FISC      AS "C_FISC",
                C_QUIT      AS "C_QUIT"
            FROM OP_BEAC
            WHERE ORIG = 'GM'
              AND C_TYP = 'D'
              AND D_OPER = TO_DATE(:d_presentation, 'DD/MM/YYYY')
            SQL;

        return $this->databaseReader->executeQuery($sql, [
            'd_presentation' => $datePresentation->format('d/m/Y'),
        ]);
    }

    public function findIntitulesByEmisReglPairs(array $emisReglPairs): array
    {
        if ($emisReglPairs === []) {
            return [];
        }

        $params = [];
        $selects = [];
        foreach (array_values($emisReglPairs) as $i => [$nEmis, $nRegl]) {
            $selects[] = <<<SQL
                SELECT n_emis AS "Numero_emission", n_regl AS "N_Regl", l_intcpt AS "Intitule"
                FROM dmc.regt
                WHERE n_emis = :n_emis_{$i} AND n_regl = :n_regl_{$i}
                SQL;
            $params["n_emis_{$i}"] = $nEmis;
            $params["n_regl_{$i}"] = $nRegl;
        }

        return $this->databaseReader->executeQuery(implode("\nUNION ALL\n", $selects), $params);
    }
    
}