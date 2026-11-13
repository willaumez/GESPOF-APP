<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Enum\DomaineFlechage;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\AvancesBudget;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\CorrespondantsD;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\CorrespondantsR;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\CreditsDelegues;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\DepensesManuelles;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\Reglements;

/**
 * Moteur de fléchage déterministe (Lot 2 — SPEC §5.5 / §6).
 * Paramètre sof.compat_excel : true = reproduire les bogues macros (défaut).
 */
class FlechageDeterministeService
{
    private bool $compatExcel;

    public function __construct()
    {
        $env = $_ENV['SOF_COMPAT_EXCEL'] ?? $_SERVER['SOF_COMPAT_EXCEL'] ?? 'true';
        $this->compatExcel = filter_var($env, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true;
    }

    public function compatExcel(): bool
    {
        return $this->compatExcel;
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array{code: string, motif: ?string, titre: ?int, meta: array<string, mixed>}
     */
    public function flecher(DomaineFlechage $domaine, array $ligne): array
    {
        return match ($domaine) {
            DomaineFlechage::REGLEMENT => $this->flecherReglement($ligne),
            DomaineFlechage::AVANCE => $this->flecherAvance($ligne),
            DomaineFlechage::CREDIT_DELEGUE => $this->flecherCreditDelegue($ligne),
            DomaineFlechage::CORRESP_DEPENSE => $this->flecherCorrespondantD($ligne),
            DomaineFlechage::CORRESP_RECETTE => $this->flecherCorrespondantR($ligne),
        };
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array{code: string, motif: ?string, titre: ?int, meta: array<string, mixed>}
     */
    private function flecherReglement(array $ligne): array
    {
        $categ = (string) ($ligne['categorie'] ?? '');
        $type = (string) ($ligne['type_exercice'] ?? $ligne['type'] ?? '');
        if (isset($ligne['detail']) && is_array($ligne['detail']) && isset($ligne['detail']['type'])) {
            $type = (string) $ligne['detail']['type'];
        }
        if (str_contains(strtoupper($type), 'ANT')) {
            $type = 'ANT';
        }
        $titre = $ligne['titre'] ?? 0;
        $nat = $ligne['nature'] ?? 0;
        $mdr = $ligne['mdr'] ?? 0;

        $r = Reglements::code($categ, $type, $titre, $nat, $mdr, $this->compatExcel);
        $code = $r['code'] === '' ? 'NONE' : $r['code'];

        return [
            'code' => $code,
            'motif' => $r['motif'],
            'titre' => (int) $titre,
            'meta' => ['fonction' => 'Reglements'],
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array{code: string, motif: ?string, titre: ?int, meta: array<string, mixed>}
     */
    private function flecherAvance(array $ligne): array
    {
        $annee = (int) ($ligne['annee'] ?? $ligne['exercice_annee'] ?? date('Y'));
        $cNop = isset($ligne['c_nop']) ? (string) $ligne['c_nop'] : (isset($ligne['mdr']) ? (string) $ligne['mdr'] : null);
        $r = AvancesBudget::classer(
            isset($ligne['compte']) ? (string) $ligne['compte'] : null,
            $cNop,
            $ligne['nature'] ?? null,
            $annee,
            $this->compatExcel,
        );
        $code = $r['code'] === '' ? 'NONE' : $r['code'];

        return [
            'code' => $code,
            'motif' => $r['code'] === '' ? 'SANS_CODE' : null,
            'titre' => $r['titre_bud'],
            'meta' => [
                'fonction' => 'AvancesBudget',
                'titre_ab' => $r['titre'],
                'titre_bud' => $r['titre_bud'],
                'exercice' => $r['exercice'],
            ],
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array{code: string, motif: ?string, titre: ?int, meta: array<string, mixed>}
     */
    private function flecherCreditDelegue(array $ligne): array
    {
        $prefixe = (int) ($ligne['prefixe_ad'] ?? 0);
        $detail = isset($ligne['detail']) && is_array($ligne['detail']) ? $ligne['detail'] : [];
        $cRef1 = isset($detail['exercice']) ? (string) $detail['exercice'] : (isset($ligne['c_ref1']) ? (string) $ligne['c_ref1'] : null);
        $cRef2 = isset($detail['titre']) ? (string) $detail['titre'] : (isset($ligne['c_ref2']) ? (string) $ligne['c_ref2'] : (isset($ligne['titre']) ? (string) $ligne['titre'] : null));
        $cNop = isset($detail['mode']) ? (string) $detail['mode'] : (isset($ligne['c_nop']) ? (string) $ligne['c_nop'] : (isset($ligne['mdr']) ? (string) $ligne['mdr'] : null));

        $r = CreditsDelegues::classer($cRef1, $cRef2, $cNop, $prefixe);
        $code = $r['code'] === '' ? 'NONE' : $r['code'];

        return [
            'code' => $code,
            'motif' => $r['motif'],
            'titre' => $r['titre'],
            'meta' => [
                'fonction' => 'CreditsDelegues',
                'type_exercice' => $r['type_exercice'],
                'nature' => $r['nature'],
                'anomalie' => $r['anomalie'],
            ],
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array{code: string, motif: ?string, titre: ?int, meta: array<string, mixed>}
     */
    private function flecherCorrespondantD(array $ligne): array
    {
        $code = CorrespondantsD::code(
            isset($ligne['categorie']) ? (string) $ligne['categorie'] : null,
            isset($ligne['compte']) ? (string) $ligne['compte'] : null,
        );

        return [
            'code' => $code,
            'motif' => $code === 'NONE' ? 'CATEGORIE_SANS_REGLE' : null,
            'titre' => null,
            'meta' => ['fonction' => 'CorrespondantsD'],
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array{code: string, motif: ?string, titre: ?int, meta: array<string, mixed>}
     */
    private function flecherCorrespondantR(array $ligne): array
    {
        $code = CorrespondantsR::code(
            isset($ligne['categorie']) ? (string) $ligne['categorie'] : null,
        );

        return [
            'code' => $code,
            'motif' => $code === 'NONE' ? 'CATEGORIE_SANS_REGLE' : null,
            'titre' => null,
            'meta' => ['fonction' => 'CorrespondantsR'],
        ];
    }

    /**
     * @return array<string, list<array<string, mixed>>>
     */
    public function tablesDecision(): array
    {
        return [
            'correspondants_r' => [
                ['categorie' => 'Agences Comptables, ANGT', 'code' => 'AZ'],
                ['categorie' => 'Autres / CNSS / Sport / CNAMGS', 'code' => 'AAA'],
                ['categorie' => 'Cautions', 'code' => 'AAB'],
                ['categorie' => 'Collectivités Locales', 'code' => 'AAG'],
                ['categorie' => 'Consignations', 'code' => 'AAC'],
                ['categorie' => 'Excédents', 'code' => 'AAD'],
                ['categorie' => 'Fonds Communs', 'code' => 'AAE'],
                ['categorie' => 'sinon', 'code' => 'NONE'],
            ],
            'correspondants_d' => [
                ['categorie' => 'Agences Comptables, ANGT', 'code' => 'AJ'],
                ['categorie' => 'Dettes Croisées', 'code' => 'W'],
                ['categorie' => 'CNAMGS', 'code' => 'AL'],
                ['categorie' => 'Autres Correspondants', 'code' => 'AO'],
                ['categorie' => 'CNSS', 'code' => 'AN'],
                ['categorie' => 'Fonds Dev. Sport', 'code' => 'AM'],
                ['categorie' => 'Fonds de sécurité', 'code' => 'AY'],
                ['categorie' => 'Cautions', 'code' => 'AP'],
                ['categorie' => 'Collectivités Locales', 'code' => 'AX'],
                ['categorie' => 'Consignations', 'code' => 'AQ'],
                ['categorie' => 'Excédents', 'code' => 'AR'],
                ['categorie' => 'Bonus…', 'code' => 'AS'],
                ['categorie' => 'Fonds Divers', 'code' => 'AV'],
                ['categorie' => 'Primes d\'incitation', 'code' => 'AT'],
                ['categorie' => 'Fonds Communs (selon C_IT)', 'code' => 'AS|AT|AU'],
                ['categorie' => 'F.E.R.', 'code' => 'AW'],
                ['categorie' => 'sinon', 'code' => 'NONE'],
            ],
            'credits_delegues' => [
                ['regle' => 'C_NOP ∈ {N,B} + courant', 'code' => 'AI'],
                ['regle' => 'C_NOP ∈ {N,B} + arriéré', 'code' => 'D1'],
                ['regle' => 'C_NOP = R', 'code' => '(exclu)'],
            ],
            'depenses_manuelles' => DepensesManuelles::tableDecision(),
            'compat_excel' => [['valeur' => $this->compatExcel ? 'true' : 'false']],
        ];
    }
}
