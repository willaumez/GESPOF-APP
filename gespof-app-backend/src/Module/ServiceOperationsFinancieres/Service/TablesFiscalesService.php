<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\TableFiscaleCompte;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\TableFiscaleLigne;
use App\Module\ServiceOperationsFinancieres\Repository\TableFiscaleCompteRepository;
use App\Module\ServiceOperationsFinancieres\Repository\TableFiscaleLigneRepository;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

class TablesFiscalesService
{
    public function __construct(
        private readonly TableFiscaleCompteRepository $compteRepository,
        private readonly TableFiscaleLigneRepository $ligneRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return array{comptes: list<array<string, string>>, tables: list<array<string, mixed>>}
     */
    public function lister(): array
    {
        $comptes = $this->compteRepository->lister();
        $lignes = $this->ligneRepository->lister();

        return [
            'comptes' => array_map(
                static fn (TableFiscaleCompte $c): array => [
                    'compte' => $c->getCompte(),
                    'table' => $c->getTableCode(),
                ],
                $comptes,
            ),
            'tables' => array_map(
                static fn (TableFiscaleLigne $l): array => [
                    'id' => $l->getId(),
                    'table' => $l->getTableCode(),
                    'nature' => $l->getNature(),
                    'code_rf' => $l->getCodeRf(),
                ],
                $lignes,
            ),
            'orphelins' => $this->codesRfOrphelins($comptes, $lignes),
        ];
    }

    /**
     * Couple table/nature sans code RF, ou compte rattaché à une table inexistante.
     *
     * @param list<TableFiscaleCompte> $comptes
     * @param list<TableFiscaleLigne>  $lignes
     *
     * @return list<array{type: string, detail: string}>
     */
    public function codesRfOrphelins(array $comptes = [], array $lignes = []): array
    {
        if ($comptes === []) {
            $comptes = $this->compteRepository->lister();
        }
        if ($lignes === []) {
            $lignes = $this->ligneRepository->lister();
        }

        $tablesConnues = [];
        $orphelins = [];
        foreach ($lignes as $l) {
            $tablesConnues[$l->getTableCode()] = true;
            if (trim($l->getCodeRf()) === '') {
                $orphelins[] = [
                    'type' => 'ligne_sans_rf',
                    'detail' => sprintf('Table %s / nature %s sans code RF', $l->getTableCode(), $l->getNature()),
                ];
            }
        }
        foreach ($comptes as $c) {
            if (!isset($tablesConnues[$c->getTableCode()])) {
                $orphelins[] = [
                    'type' => 'compte_table_absente',
                    'detail' => sprintf('Compte %s → table %s inexistante', $c->getCompte(), $c->getTableCode()),
                ];
            }
        }

        return $orphelins;
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, string>
     */
    public function creerCompte(array $donnees): array
    {
        $compte = trim((string) ($donnees['compte'] ?? ''));
        $table = trim((string) ($donnees['table'] ?? $donnees['table_code'] ?? ''));
        if ($compte === '' || $table === '') {
            throw new DonneesInvalidesException('Compte et table sont obligatoires.');
        }
        if ($this->compteRepository->trouverParCompte($compte) instanceof TableFiscaleCompte) {
            throw new DonneesInvalidesException(sprintf('Le compte « %s » existe déjà.', $compte));
        }

        $entite = new TableFiscaleCompte($compte, $table);
        $this->em->persist($entite);
        $this->em->flush();

        return ['compte' => $entite->getCompte(), 'table' => $entite->getTableCode()];
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function creerLigne(array $donnees): array
    {
        $table = trim((string) ($donnees['table'] ?? $donnees['table_code'] ?? ''));
        $nature = trim((string) ($donnees['nature'] ?? ''));
        $codeRf = trim((string) ($donnees['code_rf'] ?? ''));
        if ($table === '' || $nature === '' || $codeRf === '') {
            throw new DonneesInvalidesException('Table, nature et code_rf sont obligatoires.');
        }

        $entite = new TableFiscaleLigne($table, $nature, $codeRf);
        $this->em->persist($entite);
        $this->em->flush();

        return [
            'id' => $entite->getId(),
            'table' => $entite->getTableCode(),
            'nature' => $entite->getNature(),
            'code_rf' => $entite->getCodeRf(),
        ];
    }
}
