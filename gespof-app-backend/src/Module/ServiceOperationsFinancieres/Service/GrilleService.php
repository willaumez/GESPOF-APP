<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\Grille;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\GrilleLigne;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\GrilleValeur;
use App\Module\ServiceOperationsFinancieres\Enum\TypeGrille;
use App\Module\ServiceOperationsFinancieres\Repository\GrilleRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Grilles mensuelles de paramétrage (plans trésorerie, dette, titres).
 */
class GrilleService
{
    public function __construct(
        private readonly GrilleRepository $grilleRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenir(int $exerciceAnnee, string $type): array
    {
        $typeEnum = $this->parserType($type);
        $grille = $this->grilleRepository->trouver($exerciceAnnee, $typeEnum);
        if (!$grille instanceof Grille) {
            return $this->serialiserVide($exerciceAnnee, $typeEnum);
        }

        return $this->serialiser($grille);
    }

    /**
     * Remplace lignes + valeurs (JSON structuré). Import Excel réel ultérieur.
     *
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrer(int $exerciceAnnee, string $type, array $donnees): array
    {
        $typeEnum = $this->parserType($type);
        $grille = $this->grilleRepository->trouver($exerciceAnnee, $typeEnum);
        if (!$grille instanceof Grille) {
            $grille = new Grille(
                $exerciceAnnee,
                $typeEnum,
                isset($donnees['unite_saisie']) ? (string) $donnees['unite_saisie'] : null,
            );
            $this->em->persist($grille);
        } elseif (isset($donnees['unite_saisie'])) {
            $grille->setUniteSaisie((string) $donnees['unite_saisie']);
        }

        $lignes = $donnees['lignes'] ?? null;
        if (!is_array($lignes)) {
            throw new DonneesInvalidesException('Le tableau « lignes » est obligatoire.');
        }

        $grille->getLignes()->clear();
        $ordre = 0;
        foreach ($lignes as $raw) {
            if (!is_array($raw)) {
                continue;
            }
            $libelle = trim((string) ($raw['libelle'] ?? ''));
            if ($libelle === '') {
                throw new DonneesInvalidesException('Chaque ligne doit avoir un libellé.');
            }
            $ligne = new GrilleLigne(
                $libelle,
                isset($raw['ordre']) ? (int) $raw['ordre'] : $ordre,
                isset($raw['code']) ? (string) $raw['code'] : null,
            );
            $ligne->setNiveau((int) ($raw['niveau'] ?? 0));
            $ligne->setCalculable((bool) ($raw['calculable'] ?? false));
            if (isset($raw['rubrique_code'])) {
                $ligne->setRubriqueCode((string) $raw['rubrique_code']);
            }
            $mois = $raw['mois'] ?? [];
            if (!is_array($mois)) {
                $mois = [];
            }
            for ($m = 1; $m <= 12; ++$m) {
                $idx = $m - 1;
                $valeur = isset($mois[$idx]) ? (string) $mois[$idx] : (isset($mois[$m]) ? (string) $mois[$m] : '0');
                $ligne->ajouterValeur(new GrilleValeur($m, Montant::normaliser($valeur)));
            }
            $grille->ajouterLigne($ligne);
            ++$ordre;
        }

        $this->em->flush();

        return $this->serialiser($grille);
    }

    private function parserType(string $type): TypeGrille
    {
        $t = TypeGrille::tryFrom(strtoupper(trim($type)));
        if (!$t instanceof TypeGrille) {
            throw new DonneesInvalidesException(
                'Type de grille invalide (PLAN_DGI, PLAN_DGH, PLAN_DGDDI, PLAN_DETTE, PLAN_TITRES).',
            );
        }

        return $t;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserVide(int $exerciceAnnee, TypeGrille $type): array
    {
        return [
            'id' => null,
            'exercice_annee' => $exerciceAnnee,
            'type' => $type->value,
            'type_libelle' => $type->libelle(),
            'unite_saisie' => $type->uniteImportDefaut(),
            'lignes' => [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(Grille $g): array
    {
        $lignes = [];
        foreach ($g->getLignes() as $ligne) {
            $mois = array_fill(0, 12, '0.00');
            foreach ($ligne->getValeurs() as $v) {
                $mois[$v->getMois() - 1] = $v->getMontant();
            }
            $lignes[] = [
                'id' => $ligne->getId(),
                'code' => $ligne->getCode(),
                'libelle' => $ligne->getLibelle(),
                'ordre' => $ligne->getOrdre(),
                'rubrique_code' => $ligne->getRubriqueCode(),
                'niveau' => $ligne->getNiveau(),
                'calculable' => $ligne->isCalculable(),
                'mois' => $mois,
            ];
        }

        return [
            'id' => $g->getId(),
            'exercice_annee' => $g->getExerciceAnnee(),
            'type' => $g->getType()->value,
            'type_libelle' => $g->getType()->libelle(),
            'unite_saisie' => $g->getUniteSaisie(),
            'lignes' => $lignes,
        ];
    }
}
