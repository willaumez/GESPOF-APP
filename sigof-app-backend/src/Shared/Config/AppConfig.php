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

    public function ficheDepensesDir(): string
    {
        return $this->kernelProjectDir.'/public/fiche_depences';
    }

    public function modelFichierDir(): string
    {
        return $this->kernelProjectDir.'/public/model_fichiers';
    }
}
