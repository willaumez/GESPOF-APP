<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support;

/**
 * Correspondance DGBFiP articles → codes RD Model recettes (SPEC §11).
 * Sous-ensemble opérationnel ; CSV complet = référence documentaire.
 *
 * @return array<string, array{libelle: string, codes: list<string>}>
 */
final class DgbfipRecettesMapping
{
    /**
     * @return array<string, array{libelle: string, codes: list<string>}>
     */
    public static function articles(): array
    {
        return [
            '7111-1' => ['libelle' => 'Sociétés pétrolières (IS pétrole)', 'codes' => ['103']],
            '7111-2' => ['libelle' => 'Sociétés minières', 'codes' => ['104']],
            '7111-3' => ['libelle' => 'Autres sociétés (IS normal)', 'codes' => ['119']],
            '7111-4' => ['libelle' => 'Retenues à la source', 'codes' => ['105']],
            '7121-1' => ['libelle' => 'IRPP', 'codes' => ['121']],
            '7121-2' => ['libelle' => 'IRPP prélèvement employeur', 'codes' => ['124']],
            '7121-3' => ['libelle' => 'Taxe complémentaire', 'codes' => ['127']],
            '7121-5' => ['libelle' => 'I.F.R.', 'codes' => ['128']],
            '7121-8' => ['libelle' => 'Autres impôts sur les personnes', 'codes' => ['139']],
            '7142-3' => ['libelle' => 'IRVM', 'codes' => ['140']],
            '7143' => ['libelle' => 'Droits de mutations / enregistrement', 'codes' => ['147']],
            '7141-1' => ['libelle' => 'TVA (recettes brutes)', 'codes' => ['184', '185']],
            '7142-1' => ['libelle' => 'Droits d\'accises', 'codes' => ['186']],
            '7211-8' => ['libelle' => 'Taxes sur les jeux', 'codes' => ['188']],
            '7144-1' => ['libelle' => 'Taxe sur les transferts', 'codes' => ['189']],
            '715' => ['libelle' => 'Droits et taxes de douanes', 'codes' => ['300']],
            '7111-8' => ['libelle' => 'Pénalités', 'codes' => ['138']],
            '7251-P' => ['libelle' => 'Cotisations retraites / pensions', 'codes' => ['410']],
            '7251-C' => ['libelle' => 'Cotisations CNAMGS', 'codes' => ['420', '190']],
            '7741-1' => ['libelle' => 'Participations sociétés pétrolières', 'codes' => ['211']],
            '7741-9' => ['libelle' => 'Participations autres sociétés', 'codes' => ['213']],
            '7212-1' => ['libelle' => 'Redevance pétrolière', 'codes' => ['261']],
            '7311-1' => ['libelle' => 'Profit oil / partage', 'codes' => ['262']],
            '7212-2' => ['libelle' => 'Redevance superficiaire', 'codes' => ['263']],
            '7311-B' => ['libelle' => 'Discount et boni', 'codes' => ['264']],
            '7213' => ['libelle' => 'Domaine minier', 'codes' => ['270']],
            '7214' => ['libelle' => 'Domaine forestier', 'codes' => ['290']],
            '7281-1' => ['libelle' => 'Domaine foncier', 'codes' => ['250']],
            'PET' => ['libelle' => 'Recettes pétrolières (agrégat)', 'codes' => SrotAgregats::codesPetrole()],
        ];
    }
}
