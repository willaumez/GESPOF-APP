<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support;

/**
 * Calculs ligne RAP / exécution — SPEC §10.1–§10.2.
 */
final class ExecutionRapCalcul
{
    /**
     * TYPE = INV si TIT = 5, sinon FCT.
     */
    public static function typeTitre(?string $titre): string
    {
        $t = trim((string) $titre);

        return $t === '5' || $t === '05' ? 'INV' : 'FCT';
    }

    /**
     * EXERCICE = CRN si EX = année(date_valeur), sinon ANT.
     */
    public static function exerciceCrnAnt(int $exerciceLigne, int $anneeValeur): string
    {
        return $exerciceLigne === $anneeValeur ? 'CRN' : 'ANT';
    }

    /**
     * Invest = Investissement si floor(NAT / 100000) = 2.
     */
    public static function estInvestissement(?string $nat): bool
    {
        $n = (int) preg_replace('/\D+/', '', (string) $nat);

        return $n > 0 && intdiv($n, 100000) === 2;
    }

    /**
     * Grande nature = floor(NAT / 10000).
     */
    public static function grandeNature(?string $nat): ?int
    {
        $n = (int) preg_replace('/\D+/', '', (string) $nat);
        if ($n <= 0) {
            return null;
        }

        return intdiv($n, 10000);
    }

    /**
     * @return array{
     *   arrieres: string,
     *   instances: string,
     *   statut: string,
     *   time_to_rap: ?int
     * }
     */
    public static function decouperRap(
        string $rap,
        ?\DateTimeInterface $echeance,
        \DateTimeInterface $dateValeur,
        int $delaiJours,
    ): array {
        $rap = bccomp($rap, '0', 2) < 0 ? '0.00' : $rap;
        if ($echeance === null) {
            return [
                'arrieres' => '0.00',
                'instances' => $rap,
                'statut' => 'INSTANCE',
                'time_to_rap' => null,
            ];
        }
        $arriere = ClassementCreditDelegue::estArriereRap($echeance, $dateValeur, $delaiJours);
        if ($arriere) {
            return [
                'arrieres' => $rap,
                'instances' => '0.00',
                'statut' => 'ARRIERE',
                'time_to_rap' => 0,
            ];
        }
        $limite = \DateTimeImmutable::createFromInterface($echeance)
            ->setTime(0, 0, 0)
            ->modify(sprintf('+%d days', $delaiJours));
        $valeur = \DateTimeImmutable::createFromInterface($dateValeur)->setTime(0, 0, 0);
        $diff = (int) $valeur->diff($limite)->format('%r%a');

        return [
            'arrieres' => '0.00',
            'instances' => $rap,
            'statut' => 'INSTANCE',
            'time_to_rap' => max(0, $diff),
        ];
    }

    public static function cleVue(string $exerciceCrnAnt, string $cCateg): string
    {
        return strtoupper($exerciceCrnAnt).'-'.strtoupper($cCateg);
    }
}
