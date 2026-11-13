<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\StatutPeriode;
use App\Module\ServiceOperationsFinancieres\Repository\ExerciceRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Service\Exception\ExerciceIntrouvableException;
use App\Module\ServiceOperationsFinancieres\Service\Exception\PeriodeIntrouvableException;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Mois de production SROT (table periode — plan phase 0).
 */
class PeriodeService
{
    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly ExerciceRepository $exerciceRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function lister(?int $exerciceAnnee = null): array
    {
        $annee = $exerciceAnnee;
        if ($annee === null) {
            $courant = $this->exerciceRepository->trouverCourant();
            if (!$courant instanceof Exercice) {
                return [];
            }
            $annee = $courant->getAnnee();
        }

        return array_map(
            fn (Periode $p): array => $this->serialiser($p),
            $this->periodeRepository->listerParExercice($annee),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenir(int $id): array
    {
        return $this->serialiser($this->exiger($id));
    }

    /**
     * Crée (ou renvoie) la période pour un couple exercice / mois.
     *
     * @return array<string, mixed>
     */
    public function ouvrir(int $exerciceAnnee, int $mois): array
    {
        $exercice = $this->exerciceRepository->findByAnnee($exerciceAnnee);
        if (!$exercice instanceof Exercice) {
            throw new ExerciceIntrouvableException(sprintf('Exercice %d introuvable.', $exerciceAnnee));
        }

        if ($mois < 1 || $mois > 12) {
            throw new DonneesInvalidesException(sprintf('Mois invalide : %d.', $mois));
        }

        $existante = $this->periodeRepository->trouver($exerciceAnnee, $mois);
        if ($existante instanceof Periode) {
            return $this->serialiser($existante);
        }

        $periode = new Periode($exercice, $mois, StatutPeriode::OUVERTE);
        $this->em->persist($periode);
        $this->em->flush();

        return $this->serialiser($periode);
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrer(int $id, array $donnees): array
    {
        $periode = $this->exiger($id);

        if (array_key_exists('statut', $donnees)) {
            $periode->setStatut($this->parserStatut((string) $donnees['statut']));
        }

        if (array_key_exists('date_situation', $donnees)) {
            $brut = $donnees['date_situation'];
            if ($brut === null || $brut === '') {
                $periode->setDateSituation(null);
            } else {
                try {
                    $periode->setDateSituation(new \DateTimeImmutable((string) $brut));
                } catch (\Exception $e) {
                    throw new DonneesInvalidesException('Date de situation invalide (AAAA-MM-JJ).', 0, $e);
                }
            }
        }

        $this->em->flush();

        return $this->serialiser($periode);
    }

    private function exiger(int $id): Periode
    {
        $periode = $this->periodeRepository->find($id);
        if (!$periode instanceof Periode) {
            throw new PeriodeIntrouvableException(sprintf('Période #%d introuvable.', $id));
        }

        return $periode;
    }

    private function parserStatut(string $valeur): StatutPeriode
    {
        $normalise = strtolower(str_replace([' ', '-'], '_', trim($valeur)));
        $statut = StatutPeriode::tryFrom($normalise);
        if ($statut instanceof StatutPeriode) {
            return $statut;
        }

        throw new DonneesInvalidesException(
            'Statut de période invalide (ouverte, en_controle, validee, publiee).',
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function serialiser(Periode $p): array
    {
        $mois = Mois::tryFrom($p->getMois());

        return [
            'id' => $p->getId(),
            'exercice_annee' => $p->getExercice()->getAnnee(),
            'mois' => $p->getMois(),
            'mois_libelle' => $mois?->libelle(),
            'date_situation' => $p->getDateSituation()?->format('Y-m-d'),
            'statut' => $p->getStatut()->value,
            'statut_libelle' => $p->getStatut()->libelle(),
        ];
    }
}
