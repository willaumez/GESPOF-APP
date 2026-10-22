<?php

namespace App\Module\ServiceReglement\Service;

use Symfony\Component\HttpFoundation\StreamedResponse;

class ProgressionService
{
    public function streamProgression(callable $callback): StreamedResponse
    {
        return new StreamedResponse(function () use ($callback) {
            header('Content-Type: text/event-stream');
            header('Cache-Control: no-cache');
            header('X-Accel-Buffering: no');

            $flush = function (): void {
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            };

            echo "event: progress\ndata: " . json_encode([
                'percentage' => 0,
                'step' => 'Début du traitement'
            ]) . "\n\n";
            $flush();

            $callback(function($percentage, $step) use ($flush) {
                echo "event: progress\ndata: " . json_encode([
                    'percentage' => $percentage,
                    'step' => $step
                ]) . "\n\n";
                $flush();

            });

            echo "event: complete\ndata: " . json_encode([
                'percentage' => 100,
                'step' => 'Terminé'
            ]) . "\n\n";
            $flush();
        });
    }
}