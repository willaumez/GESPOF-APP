<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support;

/**
 * Règle Power Query crédits délégués :
 * exercice courant si floor(C_REF1 / 100_000_000) = préfixe (0–99),
 * sinon arriéré. Un C_REF1 hors 10 chiffres reste arriéré + anomalie.
 */
final class ClassementCreditDelegue
{
    public const TYPE_COURANT = 'courant';
    public const TYPE_ARRIERE = 'arriéré';
    public const ANOMALIE_FORMAT = 'AD_FORMAT_ANORMAL';

    /**
     * @return array{type_exercice: string, anomalie: ?string, prefixe_extrait: ?int}
     */
    public static function classer(?string $cRef1, int $prefixeAd): array
    {
        $brut = trim((string) $cRef1);
        $chiffres = preg_replace('/\D+/', '', $brut) ?? '';

        if (strlen($chiffres) !== 10) {
            return [
                'type_exercice' => self::TYPE_ARRIERE,
                'anomalie' => self::ANOMALIE_FORMAT,
                'prefixe_extrait' => null,
            ];
        }

        $valeur = (int) $chiffres;
        $prefixeExtrait = intdiv($valeur, 100_000_000);
        $type = $prefixeExtrait === $prefixeAd ? self::TYPE_COURANT : self::TYPE_ARRIERE;

        return [
            'type_exercice' => $type,
            'anomalie' => null,
            'prefixe_extrait' => $prefixeExtrait,
        ];
    }

    /**
     * Une échéance est un arriéré si échéance + délai ≤ date de valeur (égalité incluse).
     */
    public static function estArriereRap(
        \DateTimeInterface $echeance,
        \DateTimeInterface $dateValeur,
        int $delaiJours,
    ): bool {
        $limite = \DateTimeImmutable::createFromInterface($echeance)
            ->setTime(0, 0, 0)
            ->modify(sprintf('+%d days', $delaiJours));
        $valeur = \DateTimeImmutable::createFromInterface($dateValeur)->setTime(0, 0, 0);

        return $limite <= $valeur;
    }
}
