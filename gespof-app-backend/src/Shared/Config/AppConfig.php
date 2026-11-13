<?php

declare(strict_types=1);

namespace App\Shared\Config;

/**
 * Point d'accès unique aux paramètres/variables d'environnement de l'application.
 * Aucun module ne doit lire %env(...)%, $_ENV ou getenv() directement : il passe
 * par ce service (les valeurs sont résolues et injectées par le container).
 */
final class AppConfig
{
    public function __construct(
        private readonly string $kernelProjectDir,
        private readonly string $appEnv,
        private readonly string $defaultUri,
        private readonly string $corsAllowOriginPattern,
    ) {
    }

    public function projectDir(): string
    {
        return $this->kernelProjectDir;
    }

    public function environnement(): string
    {
        return $this->appEnv;
    }

    public function defaultUri(): string
    {
        return $this->defaultUri;
    }

    public function corsAllowOriginPattern(): string
    {
        return $this->corsAllowOriginPattern;
    }

    public function ficheDepensesDir(): string
    {
        return $this->kernelProjectDir.'/public/fiche_depences';
    }

    public function modelFichierDir(): string
    {
        return $this->kernelProjectDir.'/src/Shared/ModelFichier';
    }

    /** Modèles Excel/PDF publics (exports listes, historiques, etc.). */
    public function modelFichiersPublicDir(): string
    {
        return $this->kernelProjectDir.'/public/model_fichiers';
    }

    public function modeleListeFichesDepotXlsxPath(): string
    {
        return $this->modelFichiersPublicDir().\DIRECTORY_SEPARATOR.'Model-Liste-fiches-depot.xlsx';
    }

    public function modeleListeFichesDepotPdfPath(): string
    {
        return $this->modelFichiersPublicDir().\DIRECTORY_SEPARATOR.'Model-Liste-fiches-depot.pdf';
    }

    public function modeleHistoriqueXlsxPath(): string
    {
        return $this->modelFichiersPublicDir().\DIRECTORY_SEPARATOR.'Model-Historique.xlsx';
    }

    public function modeleHistoriquePdfPath(): string
    {
        return $this->modelFichiersPublicDir().\DIRECTORY_SEPARATOR.'Model-Historique.pdf';
    }

    public function modeleFicheDepotPath(): string
    {
        return $this->modelFichierDir().\DIRECTORY_SEPARATOR.'FICHE_DE_DEPOT_MODELE_CORRIGE.xlsx';
    }

    /** Dossier des maquettes Excel du Service de Prévision. */
    public function maquettesSpDir(): string
    {
        return $this->kernelProjectDir.'/src/Module/ServicePrevision/Maquettes';
    }

    public function modeleFicheBleuePath(): string
    {
        return $this->maquettesSpDir().\DIRECTORY_SEPARATOR.'Maquette-Fiche-Bleue.xlsx';
    }

    public function modeleFicheExecutionPath(): string
    {
        return $this->maquettesSpDir().\DIRECTORY_SEPARATOR.'Maquette-Fiche-Execution.xlsx';
    }

    /** Copie SP du modèle fiche de dépôt (alignée sur le modèle SR). */
    public function modeleFicheDepotSpPath(): string
    {
        return $this->maquettesSpDir().\DIRECTORY_SEPARATOR.'Maquette-Fiche-Depot.xlsx';
    }
}
