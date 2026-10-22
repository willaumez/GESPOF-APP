<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Repository;

use App\Shared\ExternalSource\DatabaseReader;

/**
 * Lecture Oracle (SGP) des scripts SQL du Service Prévision.
 */
class ScriptPoolSp
{
    public function __construct(private readonly DatabaseReader $databaseReader)
    {
    }

    /** @return list<array<string, mixed>> */
    public function listerDatesOuverture(): array
    {
        return $this->databaseReader->executeQuery($this->chargerSql('recuperer-date.sql'));
    }

    /**
     * @param string $dateOuverture Date au format DD/MM/YYYY (colonne DATE_OUVERTURE)
     *
     * @return list<array<string, mixed>>
     */
    public function listerRecettes(string $dateOuverture): array
    {
        return $this->databaseReader->executeQuery($this->chargerSql('operations-recettes.sql'), [
            'w_date' => $dateOuverture,
        ]);
    }

    private function chargerSql(string $fichier): string
    {
        $chemin = dirname(__DIR__).DIRECTORY_SEPARATOR.'Sql'.DIRECTORY_SEPARATOR.$fichier;
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
