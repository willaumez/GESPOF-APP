<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Repository;

use App\Shared\ExternalSource\DatabaseReader;

class ScriptPoolDr
{
    public function __construct(private readonly DatabaseReader $databaseReader)
    {}

    public function findByDate(\DateTimeInterface $datePresentation): array
    {
        return $this->databaseReader->executeQuery($this->chargerSql('fiche-depot.sql'), [
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

        $sql = str_replace('{{n_bv_list}}', implode(', ', $placeholders), $this->chargerSql('reglements-bv.sql'));

        return $this->databaseReader->executeQuery($sql, $params);
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
        return $this->databaseReader->executeQuery($this->chargerSql('mouvements-sigma.sql'), [
            'd_presentation' => $datePresentation->format('d/m/Y'),
        ]);
    }

    public function findIntitulesByEmisReglPairs(array $emisReglPairs): array
    {
        if ($emisReglPairs === []) {
            return [];
        }

        $modele = $this->chargerSql('intitules-reglements.sql');
        $params = [];
        $selects = [];
        foreach (array_values($emisReglPairs) as $i => [$nEmis, $nRegl]) {
            $selects[] = str_replace('{{i}}', (string) $i, $modele);
            $params["n_emis_{$i}"] = $nEmis;
            $params["n_regl_{$i}"] = $nRegl;
        }

        return $this->databaseReader->executeQuery(implode("\nUNION ALL\n", $selects), $params);
    }

    private function chargerSql(string $fichier): string
    {
        $chemin = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'Sql' . DIRECTORY_SEPARATOR . $fichier;
        $contenu = file_get_contents($chemin);
        if ($contenu === false) {
            throw new \RuntimeException(sprintf('Fichier SQL introuvable : %s', $fichier));
        }

        $lignes = preg_split('/\R/', $contenu) ?: [];
        $gardees = [];
        foreach ($lignes as $ligne) {
            $trim = ltrim($ligne);
            if ($trim === '' || str_starts_with($trim, '--')) {
                continue;
            }
            $gardees[] = $ligne;
        }

        return rtrim(implode("\n", $gardees), " \t\n\r;");
    }
}
