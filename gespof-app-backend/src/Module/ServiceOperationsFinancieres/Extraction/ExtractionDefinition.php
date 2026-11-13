<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Extraction;

/**
 * Preset d'extraction DC / IG (registre déclaratif).
 */
final class ExtractionDefinition
{
    /**
     * @param list<string>              $comptes
     * @param list<string|int>          $natures
     * @param list<string>              $typesOperation
     * @param list<string>              $disponibilites
     * @param list<array{compte: string, nature: string|int, libelle?: string}> $couplesCompteNature
     * @param array<string, mixed>      $parametres
     */
    public function __construct(
        public readonly string $code,
        public readonly string $libelle,
        public readonly SourceExtraction $source,
        public readonly string $famille,
        public readonly DomaineExtraction $domaine,
        public readonly string $ecran,
        public readonly string $format,
        public readonly ?string $sqlFile,
        public readonly PeriodeParDefaut $periode,
        public readonly array $parametres = [],
        public readonly ?string $refManuel = null,
        public readonly bool $disponible = true,
        public readonly bool $depotExcelUniquement = false,
        public readonly string $motifIndisponible = '',
        public readonly array $comptes = [],
        public readonly array $natures = [],
        public readonly array $typesOperation = ['D'],
        public readonly array $disponibilites = ['N', 'B'],
        public readonly array $couplesCompteNature = [],
        /** Code source LotImport (parametres.source) pour rattacher le dernier lot. */
        public readonly ?string $sourceLot = null,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function serialiser(): array
    {
        return [
            'code' => $this->code,
            'libelle' => $this->libelle,
            'source' => $this->source->value,
            'famille' => $this->famille,
            'domaine' => $this->domaine->value,
            'domaine_libelle' => $this->domaine->libelle(),
            'ecran' => $this->ecran,
            'format' => $this->format,
            'sql_file' => $this->sqlFile,
            'periode_par_defaut' => $this->periode->value,
            'parametres' => $this->parametres,
            'ref_manuel' => $this->refManuel,
            'disponible' => $this->disponible,
            'depot_excel_uniquement' => $this->depotExcelUniquement,
            'motif_indisponible' => $this->motifIndisponible,
            'comptes' => $this->comptes,
            'natures' => $this->natures,
            'types_operation' => $this->typesOperation,
            'disponibilites' => $this->disponibilites,
            'couples_compte_nature' => $this->couplesCompteNature,
            'source_lot' => $this->sourceLot ?? $this->code,
        ];
    }
}
