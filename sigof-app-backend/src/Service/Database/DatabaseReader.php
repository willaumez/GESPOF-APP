<?php

declare(strict_types=1);

namespace App\Service\Database;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Exception as DbalException;
use Psr\Log\LoggerInterface;

class DatabaseReader
{
    public function __construct(
        private readonly LoadBalancer $loadBalancer,
        private readonly ?LoggerInterface $logger = null,
    ) {
    }

    public function executeQuery(string $sql, array $params = []): array
    {
        $this->assertReadOnly($sql);

        $connection = $this->pickConnection();

        try {
            return $connection->executeQuery($sql, $params)->fetchAllAssociative();
        } catch (DbalException $e) {
            $this->logger?->error('Échec de la lecture sur un esclave', ['error' => $e->getMessage()]);

            throw new \RuntimeException('Erreur de lecture sur l\'esclave: '.$e->getMessage(), previous: $e);
        }
    }

    public function executeSingleRow(string $sql, array $params = []): ?array
    {
        $rows = $this->executeQuery($sql, $params);

        return $rows[0] ?? null;
    }

    public function executeSingleColumn(string $sql, array $params = []): mixed
    {
        $row = $this->executeSingleRow($sql, $params);

        return $row === null ? null : reset($row);
    }

    private function pickConnection(): Connection
    {
        $slave = $this->loadBalancer->selectSlave();

        if ($slave === null) {
            throw new \RuntimeException(
                'Aucune base esclave disponible pour la lecture (vérifiez la config des connexions "slave*").',
            );
        }

        return $slave;
    }

    private function assertReadOnly(string $sql): void
    {
        $forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE', 'REPLACE'];
        $first = strtoupper(strtok(ltrim($sql), " \t\n\r(") ?: '');

        if (\in_array($first, $forbidden, true)) {
            throw new \InvalidArgumentException("Requête non autorisée via DatabaseReader (lecture seule) : $first");
        }
    }
}
