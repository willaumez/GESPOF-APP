<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\MontantMensuel;
use App\Module\ServiceOperationsFinancieres\Enum\OrigineMontantMensuel;
use App\Module\ServiceOperationsFinancieres\Repository\MontantMensuelRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Exécution N-1 (montants mensuels manuels, exercice N-1).
 */
class ExecutionN1Service
{
    public function __construct(
        private readonly MontantMensuelRepository $montantMensuelRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenir(int $exerciceCourant): array
    {
        $anneeN1 = $exerciceCourant - 1;
        $rows = $this->montantMensuelRepository->listerParExercice(
            $anneeN1,
            OrigineMontantMensuel::MANUEL,
        );

        /** @var array<string, array{rubrique_code: string, mois: list<string>}> $parRubrique */
        $parRubrique = [];
        foreach ($rows as $m) {
            $code = $m->getRubriqueCode();
            if (!isset($parRubrique[$code])) {
                $parRubrique[$code] = [
                    'rubrique_code' => $code,
                    'mois' => array_fill(0, 12, '0.00'),
                ];
            }
            $parRubrique[$code]['mois'][$m->getMois() - 1] = $m->getMontant();
        }

        return [
            'exercice_courant' => $exerciceCourant,
            'exercice_n1' => $anneeN1,
            'origine' => OrigineMontantMensuel::MANUEL->value,
            'lignes' => array_values($parRubrique),
        ];
    }

    /**
     * Remplace les montants MANUEL de N-1. Montants attendus en FCFA
     * (conversion millions → FCFA à faire côté import ultérieur).
     *
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrer(int $exerciceCourant, array $donnees): array
    {
        $anneeN1 = $exerciceCourant - 1;
        $lignes = $donnees['lignes'] ?? null;
        if (!is_array($lignes)) {
            throw new DonneesInvalidesException('Le tableau « lignes » est obligatoire.');
        }

        $existants = $this->montantMensuelRepository->listerParExercice(
            $anneeN1,
            OrigineMontantMensuel::MANUEL,
        );
        foreach ($existants as $e) {
            $this->em->remove($e);
        }
        $this->em->flush();

        foreach ($lignes as $raw) {
            if (!is_array($raw)) {
                continue;
            }
            $code = trim((string) ($raw['rubrique_code'] ?? ''));
            if ($code === '') {
                throw new DonneesInvalidesException('rubrique_code obligatoire.');
            }
            $mois = $raw['mois'] ?? [];
            if (!is_array($mois)) {
                $mois = [];
            }
            for ($m = 1; $m <= 12; ++$m) {
                $idx = $m - 1;
                $valeur = isset($mois[$idx]) ? (string) $mois[$idx] : (isset($mois[$m]) ? (string) $mois[$m] : '0');
                $montant = Montant::normaliser($valeur);
                if (bccomp($montant, '0', 2) === 0) {
                    continue;
                }
                $this->em->persist(new MontantMensuel(
                    $anneeN1,
                    $code,
                    $m,
                    OrigineMontantMensuel::MANUEL,
                    $montant,
                ));
            }
        }

        $this->em->flush();

        return $this->obtenir($exerciceCourant);
    }
}
