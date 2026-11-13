<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RapAnterieurLigne;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RapAnterieurLot;
use App\Module\ServiceOperationsFinancieres\Enum\StatutRapAnterieur;
use App\Module\ServiceOperationsFinancieres\Repository\RapAnterieurLotRepository;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Situation RAP au 31/12/N-1 (import JSON structuré — parseur CSV ultérieur).
 */
class RapAnterieurService
{
    public function __construct(
        private readonly RapAnterieurLotRepository $lotRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenir(int $exerciceAnnee): array
    {
        $lot = $this->lotRepository->trouverDernier($exerciceAnnee);
        if (!$lot instanceof RapAnterieurLot) {
            return [
                'lot' => null,
                'lignes' => [],
            ];
        }

        return $this->serialiserLot($lot, true);
    }

    /**
     * Remplace le lot de l'exercice (filtre EX ≤ N-1 appliqué).
     *
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function importer(int $exerciceAnnee, array $donnees): array
    {
        $lignes = $donnees['lignes'] ?? null;
        if (!is_array($lignes)) {
            throw new DonneesInvalidesException('Le tableau « lignes » est obligatoire.');
        }

        $seuil = $exerciceAnnee - 1;
        $lot = new RapAnterieurLot(
            $exerciceAnnee,
            isset($donnees['fichier']) ? (string) $donnees['fichier'] : null,
        );

        $ignorees = 0;
        foreach ($lignes as $raw) {
            if (!is_array($raw)) {
                continue;
            }
            $ex = (int) ($raw['exercice'] ?? $raw['ex'] ?? 0);
            if ($ex < 1 || $ex > $seuil) {
                ++$ignorees;
                continue;
            }
            $statut = $this->parserStatut((string) ($raw['statut'] ?? 'INSTANCE'));
            $ordonnance = trim((string) ($raw['ordonnance'] ?? ''));
            if ($ordonnance === '') {
                throw new DonneesInvalidesException('Ordonnance obligatoire sur chaque ligne RAP.');
            }
            $ligne = new RapAnterieurLigne(
                $statut,
                $ex,
                $ordonnance,
                (string) ($raw['brut'] ?? '0'),
                (string) ($raw['rap'] ?? '0'),
            );
            if (!empty($raw['echeance'])) {
                $ligne->setEcheance(new \DateTimeImmutable((string) $raw['echeance']));
            }
            $ligne->setNLig(isset($raw['n_lig']) ? (string) $raw['n_lig'] : null);
            $ligne->setMinistere(isset($raw['ministere']) ? (string) $raw['ministere'] : null);
            $ligne->setTitre(isset($raw['titre']) ? (string) $raw['titre'] : null);
            $ligne->setNature(isset($raw['nature']) ? (string) $raw['nature'] : null);
            $ligne->setBeneficiaire(isset($raw['beneficiaire']) ? (string) $raw['beneficiaire'] : null);
            $ligne->setCCateg(isset($raw['c_categ']) ? (string) $raw['c_categ'] : null);
            $ligne->setPoste(isset($raw['poste']) ? (string) $raw['poste'] : null);
            if (isset($raw['payload']) && is_array($raw['payload'])) {
                $ligne->setPayload($raw['payload']);
            }
            $lot->ajouterLigne($ligne);
        }

        $lot->recalculerTotaux();
        $this->em->persist($lot);
        $this->em->flush();

        $out = $this->serialiserLot($lot, false);
        $out['lignes_ignorees_ex'] = $ignorees;

        return $out;
    }

    private function parserStatut(string $valeur): StatutRapAnterieur
    {
        $normalise = strtoupper(trim($valeur));
        $alias = match ($normalise) {
            'ARRIÉRÉ', 'ARRIERE', 'ARR' => 'ARRIERE',
            'INSTANCE', 'INST' => 'INSTANCE',
            default => $normalise,
        };
        $s = StatutRapAnterieur::tryFrom($alias);
        if (!$s instanceof StatutRapAnterieur) {
            throw new DonneesInvalidesException('Statut RAP invalide (ARRIERE, INSTANCE).');
        }

        return $s;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserLot(RapAnterieurLot $lot, bool $avecLignes): array
    {
        $out = [
            'lot' => [
                'id' => $lot->getId(),
                'exercice_annee' => $lot->getExerciceAnnee(),
                'importe_le' => $lot->getImporteLe()->format(\DateTimeInterface::ATOM),
                'nb_lignes' => $lot->getNbLignes(),
                'total_brut' => $lot->getTotalBrut(),
                'total_rap' => $lot->getTotalRap(),
                'fichier' => $lot->getFichier(),
            ],
            'lignes' => [],
        ];

        if (!$avecLignes) {
            return $out;
        }

        foreach ($lot->getLignes() as $l) {
            $out['lignes'][] = [
                'id' => $l->getId(),
                'statut' => $l->getStatut()->value,
                'statut_libelle' => $l->getStatut()->libelle(),
                'echeance' => $l->getEcheance()?->format('Y-m-d'),
                'exercice' => $l->getExercice(),
                'ordonnance' => $l->getOrdonnance(),
                'n_lig' => $l->getNLig(),
                'ministere' => $l->getMinistere(),
                'titre' => $l->getTitre(),
                'nature' => $l->getNature(),
                'beneficiaire' => $l->getBeneficiaire(),
                'brut' => $l->getBrut(),
                'rap' => $l->getRap(),
                'c_categ' => $l->getCCateg(),
                'poste' => $l->getPoste(),
            ];
        }

        return $out;
    }
}
