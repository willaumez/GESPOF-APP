<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Extraction;

enum PeriodeParDefaut: string
{
    case EXERCICE_A_DATE = 'EXERCICE_A_DATE';
    case MOIS = 'MOIS';
    case DEPUIS_2014 = 'DEPUIS_2014';
    case AUCUNE = 'AUCUNE';

    /**
     * @return array{debut: string|null, fin: string|null}
     */
    public function calculer(int $exercice, \DateTimeImmutable $situation): array
    {
        $fin = $situation->format('Y-m-d');

        return match ($this) {
            self::EXERCICE_A_DATE => [
                'debut' => sprintf('%d-01-01', $exercice),
                'fin' => $fin,
            ],
            self::MOIS => [
                'debut' => $situation->modify('first day of this month')->format('Y-m-d'),
                'fin' => $fin,
            ],
            self::DEPUIS_2014 => [
                'debut' => '2014-01-01',
                'fin' => $fin,
            ],
            self::AUCUNE => [
                'debut' => null,
                'fin' => null,
            ],
        };
    }
}
