<?php

declare(strict_types=1);

namespace App\Shared\Service;

/**
 * Indique si un utilisateur a une activité métier qui empêche sa suppression
 * définitive (auquel cas on le désactive à la place). La gestion des
 * utilisateurs est transverse (Shared), mais "avoir de l'activité" dépend de
 * données propres à chaque module métier — d'où cette interface : Shared
 * dépend du contrat, jamais d'un module concret. Aujourd'hui, seul
 * Module\ServiceReglement fournit une implémentation (voir services.yaml).
 */
interface UtilisateurActiviteVerifierInterface
{
    public function aDeLActivite(int $utilisateurId): bool;
}
