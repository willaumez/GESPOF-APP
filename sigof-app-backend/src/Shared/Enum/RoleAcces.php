<?php

declare(strict_types=1);

namespace App\Shared\Enum;

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

    /**
     * Portail que ce métier implique automatiquement. `null` pour les métiers
     * transverses (DIRECTEUR_DOMF, DIRECTION_DG, SUPERVISEUR) qui n'ont pas de
     * portail dédié — comportement déjà en vigueur côté frontend (menu.json),
     * juste rendu explicite ici pour piloter l'attribution automatique.
     */
    public function portail(): ?Portail
    {
        return match ($this) {
            self::ADMINISTRATEUR => Portail::ADMIN,
            self::AGENT_SOF, self::CHEF_SOF => Portail::SOF,
            self::AGENT_SP, self::CHEF_SP => Portail::SP,
            self::AGENT_SR, self::CHEF_SR => Portail::SR,
            self::DIRECTEUR_DOMF, self::DIRECTION_DG, self::SUPERVISEUR => null,
        };
    }

    /**
     * Actions que ce métier autorise automatiquement. Les métiers "chef" et
     * l'administrateur ont les 4 actions (dont la gestion des utilisateurs de
     * leur portail) ; les agents ont tout sauf la suppression ; les métiers
     * transverses (direction/supervision) sont en lecture seule.
     *
     * @return ActionAutorisee[]
     */
    public function actions(): array
    {
        return match ($this) {
            self::ADMINISTRATEUR, self::CHEF_SOF, self::CHEF_SP, self::CHEF_SR => [
                ActionAutorisee::CONSULTER,
                ActionAutorisee::AJOUTER,
                ActionAutorisee::MODIFIER,
                ActionAutorisee::SUPPRIMER,
            ],
            self::AGENT_SOF, self::AGENT_SP, self::AGENT_SR => [
                ActionAutorisee::CONSULTER,
                ActionAutorisee::AJOUTER,
                ActionAutorisee::MODIFIER,
            ],
            self::DIRECTEUR_DOMF, self::DIRECTION_DG, self::SUPERVISEUR => [
                ActionAutorisee::CONSULTER,
            ],
        };
    }
}
