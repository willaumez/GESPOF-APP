<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\LfDepense;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\LfFinancement;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\LfRecette;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\LfTauxAffectation;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\LoiFinances;
use App\Module\ServiceOperationsFinancieres\Enum\TypeLoiFinances;
use App\Module\ServiceOperationsFinancieres\Repository\LoiFinancesRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

class LoiFinancesService
{
    public function __construct(
        private readonly LoiFinancesRepository $loiFinancesRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function lister(int $exerciceAnnee): array
    {
        return array_map(
            fn (LoiFinances $l): array => $this->serialiser($l),
            $this->loiFinancesRepository->listerParExercice($exerciceAnnee),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenir(int $exerciceAnnee, string $type): array
    {
        $typeEnum = $this->parserType($type);
        $loi = $this->loiFinancesRepository->trouver($exerciceAnnee, $typeEnum);
        if (!$loi instanceof LoiFinances) {
            return [
                'id' => null,
                'exercice_annee' => $exerciceAnnee,
                'type' => $typeEnum->value,
                'libelle' => $typeEnum->libelle($exerciceAnnee),
                'date_loi' => null,
                'recettes' => [],
                'depenses' => [],
                'financements' => [],
                'taux_affectations' => [],
            ];
        }

        return $this->serialiser($loi);
    }

    /**
     * Remplace le contenu d'une loi (JSON structuré — import Excel ultérieur).
     *
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrer(int $exerciceAnnee, string $type, array $donnees): array
    {
        $typeEnum = $this->parserType($type);
        $loi = $this->loiFinancesRepository->trouver($exerciceAnnee, $typeEnum);
        if (!$loi instanceof LoiFinances) {
            $loi = new LoiFinances(
                $exerciceAnnee,
                $typeEnum,
                isset($donnees['libelle']) ? (string) $donnees['libelle'] : null,
            );
            $this->em->persist($loi);
        } elseif (isset($donnees['libelle'])) {
            $loi->setLibelle((string) $donnees['libelle']);
        }
        if (!empty($donnees['date_loi'])) {
            $loi->setDateLoi(new \DateTimeImmutable((string) $donnees['date_loi']));
        }

        $loi->viderLignes();

        foreach (($donnees['recettes'] ?? []) as $raw) {
            if (!is_array($raw)) {
                continue;
            }
            $code = trim((string) ($raw['rubrique_code'] ?? ''));
            $libelle = trim((string) ($raw['libelle'] ?? ''));
            if ($code === '' || $libelle === '') {
                throw new DonneesInvalidesException('Recette LF : rubrique_code et libelle obligatoires.');
            }
            $loi->ajouterRecette(new LfRecette(
                $code,
                $libelle,
                (string) ($raw['montant'] ?? '0'),
            ));
        }

        foreach (($donnees['depenses'] ?? []) as $raw) {
            if (!is_array($raw)) {
                continue;
            }
            $d = new LfDepense((string) ($raw['montant'] ?? '0'));
            $d->setMission(isset($raw['mission']) ? (string) $raw['mission'] : null);
            $d->setLMis(isset($raw['l_mis']) ? (string) $raw['l_mis'] : null);
            $d->setProg(isset($raw['prog']) ? (string) $raw['prog'] : null);
            $d->setTitre(isset($raw['titre']) ? (string) $raw['titre'] : null);
            $d->setLTitre(isset($raw['l_titre']) ? (string) $raw['l_titre'] : null);
            $d->setBop(isset($raw['bop']) ? (string) $raw['bop'] : null);
            $d->setLBop(isset($raw['l_bop']) ? (string) $raw['l_bop'] : null);
            $d->setLProg(isset($raw['l_prog']) ? (string) $raw['l_prog'] : null);
            $d->setBudget(isset($raw['budget']) ? (string) $raw['budget'] : null);
            $d->setNat(isset($raw['nat']) ? (string) $raw['nat'] : null);
            $loi->ajouterDepense($d);
        }

        $ordre = 0;
        foreach (($donnees['financements'] ?? []) as $raw) {
            if (!is_array($raw)) {
                continue;
            }
            $code = trim((string) ($raw['code'] ?? ''));
            $libelle = trim((string) ($raw['libelle'] ?? ''));
            if ($code === '' || $libelle === '') {
                throw new DonneesInvalidesException('Financement LF : code et libelle obligatoires.');
            }
            $loi->ajouterFinancement(new LfFinancement(
                $code,
                $libelle,
                (string) ($raw['montant'] ?? '0'),
                isset($raw['ordre']) ? (int) $raw['ordre'] : $ordre,
            ));
            ++$ordre;
        }

        foreach (($donnees['taux_affectations'] ?? []) as $raw) {
            if (!is_array($raw)) {
                continue;
            }
            $code = trim((string) ($raw['rubrique_code'] ?? ''));
            $benef = trim((string) ($raw['beneficiaire'] ?? ''));
            $nature = trim((string) ($raw['nature'] ?? ''));
            if ($code === '' || $benef === '' || $nature === '') {
                throw new DonneesInvalidesException(
                    'Taux d\'affectation : rubrique_code, beneficiaire et nature obligatoires.',
                );
            }
            $loi->ajouterTauxAffectation(new LfTauxAffectation(
                $code,
                $benef,
                $nature,
                (string) ($raw['taux'] ?? '0'),
            ));
        }

        $this->em->flush();

        return $this->serialiser($loi);
    }

    private function parserType(string $type): TypeLoiFinances
    {
        $t = TypeLoiFinances::tryFrom(strtoupper(trim($type)));
        if (!$t instanceof TypeLoiFinances) {
            throw new DonneesInvalidesException('Type de loi invalide (LFI, LFR).');
        }

        return $t;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(LoiFinances $loi): array
    {
        $totalDep = '0.00';
        $depenses = [];
        foreach ($loi->getDepenses() as $d) {
            $totalDep = Montant::additionner($totalDep, $d->getMontant());
            $depenses[] = [
                'id' => $d->getId(),
                'mission' => $d->getMission(),
                'l_mis' => $d->getLMis(),
                'prog' => $d->getProg(),
                'titre' => $d->getTitre(),
                'l_titre' => $d->getLTitre(),
                'bop' => $d->getBop(),
                'l_bop' => $d->getLBop(),
                'l_prog' => $d->getLProg(),
                'budget' => $d->getBudget(),
                'nat' => $d->getNat(),
                'montant' => $d->getMontant(),
            ];
        }

        return [
            'id' => $loi->getId(),
            'exercice_annee' => $loi->getExerciceAnnee(),
            'type' => $loi->getType()->value,
            'libelle' => $loi->getLibelle(),
            'date_loi' => $loi->getDateLoi()?->format('Y-m-d'),
            'total_depenses' => $totalDep,
            'recettes' => array_map(static fn (LfRecette $r): array => [
                'id' => $r->getId(),
                'rubrique_code' => $r->getRubriqueCode(),
                'libelle' => $r->getLibelle(),
                'montant' => $r->getMontant(),
            ], $loi->getRecettes()->toArray()),
            'depenses' => $depenses,
            'financements' => array_map(static fn (LfFinancement $f): array => [
                'id' => $f->getId(),
                'code' => $f->getCode(),
                'libelle' => $f->getLibelle(),
                'montant' => $f->getMontant(),
                'ordre' => $f->getOrdre(),
            ], $loi->getFinancements()->toArray()),
            'taux_affectations' => array_map(static fn (LfTauxAffectation $t): array => [
                'id' => $t->getId(),
                'rubrique_code' => $t->getRubriqueCode(),
                'beneficiaire' => $t->getBeneficiaire(),
                'nature' => $t->getNature(),
                'taux' => $t->getTaux(),
            ], $loi->getTauxAffectations()->toArray()),
        ];
    }
}
