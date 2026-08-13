<?php

declare(strict_types=1);

namespace App\Enum;

enum RoleAcces: string
{
    case ADMINISTRATEUR = 'ADMINISTRATEUR';
    case AGENT_SOF = 'AGENT_SOF';
    case CHEF_SOF = 'CHEF_SOF';
    case AGENT_SR = 'AGENT_SR';
    case CHEF_SR = 'CHEF_SR';
    case AGENT_SP = 'AGENT_SP';
    case CHEF_SP = 'CHEF_SP';
    case DIRECTEUR_DOMF = 'DIRECTEUR_DOMF';
    case DIRECTION_DG = 'DIRECTION_DG';
    case SUPERVISEUR = 'SUPERVISEUR';

    public function libelle(): string
    {
        return match($this) {
            self::ADMINISTRATEUR => 'Administrateur',
            self::AGENT_SOF => 'Agent du Service des Opérations Financières',
            self::CHEF_SOF => 'Chef du Service des Opérations Financières',
            self::AGENT_SR => 'Agent du Service Règlement',
            self::CHEF_SR => 'Chef du Service Règlement',
            self::AGENT_SP => 'Agent du Service de Prévision',
            self::CHEF_SP => 'Chef du Service de Prévision',
            self::DIRECTEUR_DOMF => 'Directeur de la Direction des Opérations Monétaires et Financières',
            self::DIRECTION_DG => 'Direction Générale',
            self::SUPERVISEUR => 'Superviseur',
        };
    }
}
