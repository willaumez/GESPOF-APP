<?php

declare(strict_types=1);

namespace App\Shared\ExternalSource;

use Doctrine\DBAL\Connection;
use Doctrine\Persistence\ManagerRegistry;

class ConnectionManager
{
    private const MASTER_CONNECTION = 'default';
    private const SLAVE_PREFIX = 'slave';
    private const EXTRA_READONLY_CONNECTIONS = ['sgp'];

    public function __construct(private readonly ManagerRegistry $doctrine)
    {
    }

    public function getMasterConnection(): Connection
    {
        return $this->doctrine->getConnection(self::MASTER_CONNECTION);
    }

    public function getSlaveConnectionNames(): array
    {
        return array_values(array_filter(
            array_keys($this->doctrine->getConnectionNames()),
            static fn (string $name): bool => str_starts_with($name, self::SLAVE_PREFIX)
                || \in_array($name, self::EXTRA_READONLY_CONNECTIONS, true),
        ));
    }

    public function getSlaveConnection(string $name): ?Connection
    {
        if (!\in_array($name, $this->getSlaveConnectionNames(), true)) {
            return null;
        }

        return $this->doctrine->getConnection($name);
    }

    public function getAllSlaveConnections(): array
    {
        $connections = [];
        foreach ($this->getSlaveConnectionNames() as $name) {
            $connections[$name] = $this->doctrine->getConnection($name);
        }

        return $connections;
    }

    public function getSlaveCount(): int
    {
        return \count($this->getSlaveConnectionNames());
    }

    public function isConnectionActive(Connection $connection): bool
    {
        try {
            $connection->executeQuery('SELECT 1');

            return true;
        } catch (\Throwable) {
            return false;
        }
    }
}
