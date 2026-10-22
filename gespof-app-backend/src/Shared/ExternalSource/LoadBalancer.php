<?php

declare(strict_types=1);

namespace App\Shared\ExternalSource;

use Doctrine\DBAL\Connection;

class LoadBalancer
{
    public const STRATEGY_ROUND_ROBIN = 'round_robin';
    public const STRATEGY_RANDOM = 'random';
    public const STRATEGY_WEIGHTED = 'weighted';

    private int $currentIndex = 0;

    private array $weights = [];

    public function __construct(
        private readonly ConnectionManager $connectionManager,
        private string $strategy = self::STRATEGY_ROUND_ROBIN,
    ) {
    }

    public function setStrategy(string $strategy): void
    {
        $this->strategy = $strategy;
    }

    public function setWeights(array $weights): void
    {
        $this->weights = $weights;
    }

    public function selectSlave(): ?Connection
    {
        $slaves = $this->connectionManager->getAllSlaveConnections();

        if ($slaves === []) {
            return null;
        }

        return match ($this->strategy) {
            self::STRATEGY_RANDOM => $this->selectRandom($slaves),
            self::STRATEGY_WEIGHTED => $this->selectWeighted($slaves),
            default => $this->selectRoundRobin($slaves),
        };
    }

    private function selectRoundRobin(array $slaves): Connection
    {
        $values = array_values($slaves);
        $selected = $values[$this->currentIndex % \count($values)];
        $this->currentIndex++;

        return $selected;
    }

    private function selectRandom(array $slaves): Connection
    {
        $values = array_values($slaves);

        return $values[array_rand($values)];
    }

    private function selectWeighted(array $slaves): Connection
    {
        $weighted = [];
        foreach ($slaves as $name => $connection) {
            $weight = $this->weights[$name] ?? 1;
            for ($i = 0; $i < $weight; $i++) {
                $weighted[] = $connection;
            }
        }

        return $weighted[array_rand($weighted)];
    }

    public function getSlaveStatistics(): array
    {
        $stats = [];
        foreach ($this->connectionManager->getAllSlaveConnections() as $name => $connection) {
            $stats[$name] = ['active' => $this->connectionManager->isConnectionActive($connection)];
        }

        return $stats;
    }
}
