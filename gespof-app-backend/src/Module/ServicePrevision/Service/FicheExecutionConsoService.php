<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\FicheBleu\Section;
use App\Module\ServicePrevision\Entite\FicheExecution\FicheExecution;
use App\Module\ServicePrevision\Entite\FicheExecutionConso\ConsoRubrique;
use App\Module\ServicePrevision\Entite\FicheExecutionConso\ConsoValeurJour;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;
use App\Module\ServicePrevision\Enum\TypeSection;
use App\Module\ServicePrevision\Maquettes\MaquetteFicheBleue;
use App\Module\ServicePrevision\Maquettes\MaquetteFicheExecutionConso;
use App\Module\ServicePrevision\Repository\ConsoRubriqueRepository;
use App\Module\ServicePrevision\Repository\ConsoValeurJourRepository;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;

class FicheExecutionConsoService implements FicheExecutionConsoServiceInterface
{
    /** @var array<string, true> */
    private array $clesUtilisees = [];

    public function __construct(
        private readonly ConsoRubriqueRepository $rubriqueRepository,
        private readonly ConsoValeurJourRepository $valeurRepository,
    ) {
    }

    public function assurerMaquette(): void
    {
        if ($this->rubriqueRepository->compterRacines() === 0) {
            $ordre = 1;
            foreach (MaquetteFicheExecutionConso::arbre() as $definition) {
                $this->creerDepuisDefinition($definition, null, $definition['type'], $ordre++);
            }
            $this->rubriqueRepository->flush();

            return;
        }

        if ($this->extraireHorsConteneursType() > 0) {
            $this->rubriqueRepository->viderCache();
        }
    }

    /**
     * Fusionne l'arbre de la fiche d'exécution : type → section → sous-section.
     * Les rubriques absentes de la nomenclature consolidée sont créées.
     */
    public function fusionnerDepuisJournee(JourneeTresorerie $journee, FicheExecution $fiche): void
    {
        $this->assurerMaquette();

        $date = $this->dateIsoJournee($journee);
        $consommees = [];
        foreach ($this->racinesFiche($fiche) as $section) {
            foreach ($this->noeudsEffectifsCommeRacines($section, true) as $effectif) {
                $rubrique = $this->apparierOuCreer($effectif, null, $consommees);
                $this->fusionnerNoeud($effectif, $rubrique, $date, $journee->getReference());
            }
        }

        $this->rubriqueRepository->flush();
        $this->valeurRepository->flush();
    }

    public function supprimerValeursJournee(string $referenceJournee): void
    {
        $this->valeurRepository->supprimerPourJournee($referenceJournee);
    }

    public function matrice(?string $vue = 'semaine', ?string $dateIso = null): array
    {
        $this->assurerMaquette();

        $vueNorm = mb_strtolower(trim((string) ($vue ?? 'semaine')));
        if (!in_array($vueNorm, ['semaine', 'mois', 'annee'], true)) {
            throw new DonneesInvalidesException(
                'Le paramètre "vue" doit valoir semaine, mois ou annee.',
            );
        }

        $pivot = $this->parserDateIso($dateIso);
        $aujourdHui = new \DateTimeImmutable('today');

        return match ($vueNorm) {
            'mois' => $this->matriceMois($pivot, $aujourdHui),
            'annee' => $this->matriceAnnee($pivot, $aujourdHui),
            default => $this->matriceSemaine($pivot, $aujourdHui),
        };
    }

    /**
     * Semaines qui ont au moins une clôture consolidée, plus la semaine en cours.
     *
     * @return list<array{lundi: string, vendredi: string, libelle: string, actuelle: bool}>
     */
    private function semainesDisponibles(\DateTimeImmutable $lundiActuel): array
    {
        $parLundi = [];
        foreach ($this->valeurRepository->listerDatesDistinctes() as $date) {
            $lundi = $this->lundiDe($date);
            if ($lundi > $lundiActuel) {
                continue;
            }
            $parLundi[$lundi->format('Y-m-d')] = $lundi;
        }
        $parLundi[$lundiActuel->format('Y-m-d')] = $lundiActuel;
        krsort($parLundi);

        $semaines = [];
        foreach ($parLundi as $lundi) {
            $vendredi = $lundi->modify('+4 days');
            $semaines[] = [
                'lundi' => $lundi->format('Y-m-d'),
                'vendredi' => $vendredi->format('Y-m-d'),
                'libelle' => $this->libelleSemaine($lundi, $vendredi),
                'actuelle' => $lundi->format('Y-m-d') === $lundiActuel->format('Y-m-d'),
            ];
        }

        return $semaines;
    }

    /**
     * @return array<string, mixed>
     */
    private function matriceSemaine(\DateTimeImmutable $pivot, \DateTimeImmutable $aujourdHui): array
    {
        $lundi = $this->lundiDe($pivot);
        $lundiActuel = $this->lundiDe($aujourdHui);
        $semaines = $this->semainesDisponibles($lundiActuel);
        $lundisConnus = array_column($semaines, 'lundi');
        if (
            $lundi > $lundiActuel
            || !in_array($lundi->format('Y-m-d'), $lundisConnus, true)
        ) {
            $lundi = $lundiActuel;
        }
        $vendredi = $lundi->modify('+4 days');
        $colonnes = $this->colonnesSemaine($lundi);
        $periodes = array_map(
            static fn (array $s): array => [
                'cle' => $s['lundi'],
                'libelle' => $s['libelle'],
                'actuelle' => $s['actuelle'],
            ],
            $semaines,
        );

        return $this->reponseMatrice(
            'semaine',
            $lundi,
            $this->libelleSemaine($lundi, $vendredi),
            $colonnes,
            $periodes,
            [
                'lundi' => $lundi->format('Y-m-d'),
                'vendredi' => $vendredi->format('Y-m-d'),
                'libelle_semaine' => $this->libelleSemaine($lundi, $vendredi),
                'semaines' => $semaines,
            ],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function matriceMois(\DateTimeImmutable $pivot, \DateTimeImmutable $aujourdHui): array
    {
        $cleActuelle = $aujourdHui->format('Y-m');
        $cle = $pivot->format('Y-m');
        $periodes = $this->moisDisponibles($aujourdHui);
        $clesConnues = array_column($periodes, 'cle');
        if ($cle > $cleActuelle || !in_array($cle, $clesConnues, true)) {
            $cle = $cleActuelle;
        }
        [$annee, $mois] = array_map('intval', explode('-', $cle));
        $debut = new \DateTimeImmutable(sprintf('%04d-%02d-01', $annee, $mois));
        $fin = $debut->modify('last day of this month');
        $colonnes = $this->colonnesMois($debut, $fin, $aujourdHui);

        return $this->reponseMatrice(
            'mois',
            $debut,
            $this->libelleMois($debut),
            $colonnes,
            $periodes,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function matriceAnnee(\DateTimeImmutable $pivot, \DateTimeImmutable $aujourdHui): array
    {
        $anneeActuelle = (int) $aujourdHui->format('Y');
        $annee = (int) $pivot->format('Y');
        $periodes = $this->anneesDisponibles($aujourdHui);
        $anneesConnues = array_map('intval', array_column($periodes, 'cle'));
        if ($annee > $anneeActuelle || !in_array($annee, $anneesConnues, true)) {
            $annee = $anneeActuelle;
        }
        $debut = new \DateTimeImmutable(sprintf('%04d-01-01', $annee));
        $colonnes = $this->colonnesAnnee($annee);

        return $this->reponseMatrice(
            'annee',
            $debut,
            (string) $annee,
            $colonnes,
            $periodes,
        );
    }

    /**
     * @param list<array<string, mixed>> $colonnes
     * @param list<array<string, mixed>> $periodes
     * @param array<string, mixed> $extra
     *
     * @return array<string, mixed>
     */
    private function reponseMatrice(
        string $vue,
        \DateTimeImmutable $date,
        string $libelle,
        array $colonnes,
        array $periodes,
        array $extra = [],
    ): array {
        $bornes = $this->bornesColonnes($colonnes);
        $index = $this->indexerValeurs($bornes['debut'], $bornes['fin']);
        $lignes = [];
        foreach ($this->rubriqueRepository->listerRacines() as $racine) {
            $this->aplatirRubrique($racine, 0, $colonnes, $index, $lignes);
        }

        return array_merge([
            'vue' => $vue,
            'date' => $date->format('Y-m-d'),
            'libelle' => $libelle,
            'colonnes' => $colonnes,
            'lignes' => $lignes,
            'periodes' => $periodes,
        ], $extra);
    }

    /**
     * @param list<array<string, mixed>> $colonnes
     *
     * @return array{debut: \DateTimeImmutable, fin: \DateTimeImmutable}
     */
    private function bornesColonnes(array $colonnes): array
    {
        $dates = [];
        foreach ($colonnes as $colonne) {
            foreach ($colonne['dates'] ?? [] as $date) {
                if (is_string($date) && $date !== '') {
                    $dates[] = $date;
                }
            }
        }
        sort($dates);
        $premiere = $dates[0] ?? (new \DateTimeImmutable('today'))->format('Y-m-d');
        $derniere = $dates[array_key_last($dates)] ?? $premiere;

        return [
            'debut' => new \DateTimeImmutable($premiere),
            'fin' => new \DateTimeImmutable($derniere),
        ];
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function indexerValeurs(\DateTimeImmutable $debut, \DateTimeImmutable $fin): array
    {
        $index = [];
        foreach ($this->valeurRepository->listerEntreDates($debut, $fin) as $valeur) {
            $id = $valeur->getRubrique()->getId();
            if ($id === null) {
                continue;
            }
            $index[$id][$valeur->getDateJour()->format('Y-m-d')] = $valeur->getMontantRealise();
        }

        return $index;
    }

    /**
     * @return list<array{cle: string, libelle: string, actuelle: bool}>
     */
    private function moisDisponibles(\DateTimeImmutable $aujourdHui): array
    {
        $actuel = $aujourdHui->format('Y-m');
        $cles = [];
        foreach ($this->valeurRepository->listerDatesDistinctes() as $date) {
            $cle = $date->format('Y-m');
            if ($cle > $actuel) {
                continue;
            }
            $cles[$cle] = true;
        }
        $cles[$actuel] = true;
        krsort($cles);

        $mois = [];
        foreach (array_keys($cles) as $cle) {
            $debut = new \DateTimeImmutable($cle . '-01');
            $mois[] = [
                'cle' => $cle,
                'libelle' => $this->libelleMois($debut),
                'actuelle' => $cle === $actuel,
            ];
        }

        return $mois;
    }

    /**
     * @return list<array{cle: string, libelle: string, actuelle: bool}>
     */
    private function anneesDisponibles(\DateTimeImmutable $aujourdHui): array
    {
        $actuelle = (int) $aujourdHui->format('Y');
        $annees = [];
        foreach ($this->valeurRepository->listerDatesDistinctes() as $date) {
            $annee = (int) $date->format('Y');
            if ($annee > $actuelle) {
                continue;
            }
            $annees[$annee] = true;
        }
        $annees[$actuelle] = true;
        krsort($annees);

        $liste = [];
        foreach (array_keys($annees) as $annee) {
            $liste[] = [
                'cle' => (string) $annee,
                'libelle' => (string) $annee,
                'actuelle' => $annee === $actuelle,
            ];
        }

        return $liste;
    }

    /**
     * @param array<string, mixed> $definition
     */
    private function creerDepuisDefinition(
        array $definition,
        ?ConsoRubrique $parent,
        TypeSection $type,
        int $ordre,
    ): ConsoRubrique {
        $nom = trim((string) ($definition['libelle'] ?? ''));
        $cle = $this->cleUnique($parent, $nom);
        $rubrique = new ConsoRubrique($nom, $cle, $type);
        $rubrique->setOrdre($ordre);
        $parent?->ajouterEnfant($rubrique);
        $this->rubriqueRepository->save($rubrique);

        $enfants = $definition['sous_sections'] ?? [];
        if (is_array($enfants)) {
            $rang = 1;
            foreach ($enfants as $enfantDef) {
                if (!is_array($enfantDef)) {
                    continue;
                }
                $this->creerDepuisDefinition($enfantDef, $rubrique, $type, $rang++);
            }
        }

        return $rubrique;
    }

    /**
     * Rapproche une section au même type et au même libellé (normalisé).
     * Si aucune rubrique correspondante n'existe sous le parent, elle est créée.
     *
     * @param array<int, true> $consommees
     */
    private function apparierOuCreer(
        Section $section,
        ?ConsoRubrique $parent,
        array &$consommees,
    ): ConsoRubrique {
        $nomNorm = $this->normaliserNom($section->getNom());
        $type = $section->getType();
        $candidats = $parent === null
            ? $this->rubriqueRepository->listerRacines()
            : $this->enfantsRubrique($parent);

        foreach ($candidats as $candidat) {
            $id = $candidat->getId();
            if ($id === null || isset($consommees[$id])) {
                continue;
            }
            if ($candidat->getType() !== $type) {
                continue;
            }
            if ($this->normaliserNom($candidat->getNom()) === $nomNorm) {
                $consommees[$id] = true;

                return $candidat;
            }
        }

        $nouvelle = new ConsoRubrique(
            $section->getNom(),
            $this->cleUnique($parent, $section->getNom()),
            $type,
        );
        if ($parent === null) {
            $this->insererRacineParType($nouvelle);
        } else {
            $nouvelle->setOrdre(count($this->enfantsRubrique($parent)) + 1);
            $parent->ajouterEnfant($nouvelle);
            $this->rubriqueRepository->save($nouvelle);
        }
        $this->rubriqueRepository->flush();
        if ($nouvelle->getId() !== null) {
            $consommees[$nouvelle->getId()] = true;
        }

        return $nouvelle;
    }

    private function insererRacineParType(ConsoRubrique $nouvelle): void
    {
        $racines = $this->rubriqueRepository->listerRacines();
        $ordre = count($racines) + 1;
        $vuType = false;
        foreach ($racines as $racine) {
            if ($racine->getType() === $nouvelle->getType()) {
                $vuType = true;
                $ordre = $racine->getOrdre() + 1;
            } elseif ($vuType) {
                break;
            }
        }
        foreach ($racines as $racine) {
            if ($racine->getOrdre() >= $ordre) {
                $racine->setOrdre($racine->getOrdre() + 1);
            }
        }
        $nouvelle->setOrdre($ordre);
        $this->rubriqueRepository->save($nouvelle);
    }

    private function fusionnerNoeud(
        Section $section,
        ConsoRubrique $rubrique,
        \DateTimeImmutable $date,
        string $referenceJournee,
    ): void {
        $consommees = [];
        foreach ($this->enfantsSection($section) as $enfant) {
            if (MaquetteFicheBleue::estConteneurType($enfant->getNom(), $enfant->getType(), false)) {
                $this->fusionnerNoeud($enfant, $rubrique, $date, $referenceJournee);
                continue;
            }
            $cible = $this->apparierOuCreer($enfant, $rubrique, $consommees);
            $this->fusionnerNoeud($enfant, $cible, $date, $referenceJournee);
        }

        if (
            $section->getSousSections()->isEmpty()
            && !MaquetteFicheBleue::estConteneurType(
                $section->getNom(),
                $section->getType(),
                !$section->estSousSection(),
            )
        ) {
            $this->upsertValeur($rubrique, $date, $section->getMontantRealise(), $referenceJournee);
        }
    }

    private function upsertValeur(
        ConsoRubrique $rubrique,
        \DateTimeImmutable $date,
        string $montant,
        string $referenceJournee,
    ): void {
        $existant = $this->valeurRepository->trouverPourRubriqueEtDate($rubrique, $date);
        $normalise = $this->normaliserMontant($montant);
        if ($existant !== null) {
            $existant->setMontantRealise($normalise);
            $existant->setJourneeReference($referenceJournee);

            return;
        }

        $this->valeurRepository->save(new ConsoValeurJour(
            $rubrique,
            $date,
            $normalise,
            $referenceJournee,
        ));
    }

    /**
     * @param list<array<string, mixed>> $colonnes
     * @param array<int, array<string, string>> $index
     * @param list<array<string, mixed>> $lignes
     */
    private function aplatirRubrique(
        ConsoRubrique $rubrique,
        int $niveau,
        array $colonnes,
        array $index,
        array &$lignes,
    ): void {
        $id = $rubrique->getId() ?? 0;
        $valeurs = [];
        $totauxSemaine = [];

        foreach ($colonnes as $colonne) {
            if (($colonne['type'] ?? '') === 'total') {
                continue;
            }
            $cle = (string) ($colonne['cle'] ?? $colonne['date'] ?? '');
            $dates = $colonne['dates'] ?? (isset($colonne['date']) ? [$colonne['date']] : []);
            $somme = null;
            foreach ($dates as $date) {
                if (!is_string($date)) {
                    continue;
                }
                $montant = $this->montantPourDate($rubrique, $date, $index);
                if ($montant === null) {
                    continue;
                }
                $somme = $somme === null
                    ? $montant
                    : bcadd($somme, $montant, 2);
            }
            if ($cle !== '' && $somme !== null) {
                $valeurs[$cle] = $somme;
            }
        }

        foreach ($colonnes as $colonne) {
            if (($colonne['type'] ?? '') !== 'total') {
                continue;
            }
            $somme = null;
            foreach ($colonnes as $periode) {
                if (($periode['type'] ?? '') === 'total') {
                    continue;
                }
                $clePeriode = (string) ($periode['cle'] ?? $periode['date'] ?? '');
                $montant = $valeurs[$clePeriode] ?? null;
                if ($montant === null) {
                    continue;
                }
                $somme = $somme === null
                    ? $montant
                    : bcadd($somme, $montant, 2);
            }
            if ($somme !== null) {
                $totauxSemaine[$colonne['cle']] = $somme;
            }
        }

        $lignes[] = [
            'id' => $id,
            'nom' => $rubrique->getNom(),
            'type' => $rubrique->getType()->value,
            'niveau' => $niveau,
            'est_feuille' => $rubrique->estFeuille(),
            'est_racine' => $rubrique->estRacine(),
            'valeurs' => $valeurs,
            'totaux_semaine' => $totauxSemaine,
        ];

        foreach ($this->enfantsRubrique($rubrique) as $enfant) {
            $this->aplatirRubrique($enfant, $niveau + 1, $colonnes, $index, $lignes);
        }
    }

    /**
     * @param array<int, array<string, string>> $index
     */
    private function montantPourDate(ConsoRubrique $rubrique, string $date, array $index): ?string
    {
        $id = $rubrique->getId();
        $propre = $id === null ? null : ($index[$id][$date] ?? null);
        if ($rubrique->estFeuille()) {
            return $propre;
        }

        $somme = null;
        foreach ($this->enfantsRubrique($rubrique) as $enfant) {
            $montant = $this->montantPourDate($enfant, $date, $index);
            if ($montant === null) {
                continue;
            }
            $somme = $somme === null
                ? $montant
                : bcadd($somme, $montant, 2);
        }

        return $somme ?? $propre;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function colonnesSemaine(\DateTimeImmutable $lundi): array
    {
        $joursFr = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
        $dates = [];
        $colonnes = [];
        for ($i = 0; $i < 5; $i++) {
            $jour = $lundi->modify(sprintf('+%d days', $i));
            $date = $jour->format('Y-m-d');
            $dates[] = $date;
            $colonnes[] = [
                'type' => 'periode',
                'cle' => $date,
                'date' => $date,
                'libelle' => $joursFr[$i],
                'sous_libelle' => $jour->format('d/m'),
                'jour_semaine' => $i + 1,
                'dates' => [$date],
            ];
        }
        $colonnes[] = [
            'type' => 'total',
            'cle' => $lundi->format('o-\WW'),
            'libelle' => 'TOTAL',
            'dates' => $dates,
        ];

        return $colonnes;
    }

    /**
     * Semaines du mois (lundi–vendredi, bornées au mois) + TOTAL.
     *
     * @return list<array<string, mixed>>
     */
    private function colonnesMois(
        \DateTimeImmutable $debutMois,
        \DateTimeImmutable $finMois,
        \DateTimeImmutable $aujourdHui,
    ): array {
        $lundiActuel = $this->lundiDe($aujourdHui);
        $lundi = $this->lundiDe($debutMois);
        $colonnes = [];
        $toutesDates = [];

        while ($lundi <= $finMois) {
            if ($lundi > $lundiActuel) {
                break;
            }
            $vendredi = $lundi->modify('+4 days');
            $dates = [];
            for ($i = 0; $i < 5; $i++) {
                $jour = $lundi->modify(sprintf('+%d days', $i));
                if ($jour < $debutMois || $jour > $finMois) {
                    continue;
                }
                $dates[] = $jour->format('Y-m-d');
            }
            if ($dates !== []) {
                $colonnes[] = [
                    'type' => 'periode',
                    'cle' => $lundi->format('Y-m-d'),
                    'libelle' => $this->libelleSemaine($lundi, $vendredi),
                    'sous_libelle' => sprintf(
                        '%s – %s',
                        $lundi->format('d/m'),
                        $vendredi->format('d/m'),
                    ),
                    'dates' => $dates,
                ];
                $toutesDates = array_merge($toutesDates, $dates);
            }
            $lundi = $lundi->modify('+7 days');
        }

        $colonnes[] = [
            'type' => 'total',
            'cle' => $debutMois->format('Y-m'),
            'libelle' => 'TOTAL',
            'dates' => $toutesDates,
        ];

        return $colonnes;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function colonnesAnnee(int $annee): array
    {
        $colonnes = [];
        $toutesDates = [];
        foreach ($this->nomsMois() as $numero => $nom) {
            $debut = new \DateTimeImmutable(sprintf('%04d-%02d-01', $annee, $numero));
            $fin = $debut->modify('last day of this month');
            $dates = $this->joursOuvresEntre($debut, $fin);
            $colonnes[] = [
                'type' => 'periode',
                'cle' => $debut->format('Y-m'),
                'libelle' => ucfirst($nom),
                'dates' => $dates,
            ];
            $toutesDates = array_merge($toutesDates, $dates);
        }
        $colonnes[] = [
            'type' => 'total',
            'cle' => (string) $annee,
            'libelle' => 'TOTAL',
            'dates' => $toutesDates,
        ];

        return $colonnes;
    }

    /**
     * @return list<string>
     */
    private function joursOuvresEntre(\DateTimeImmutable $debut, \DateTimeImmutable $fin): array
    {
        $dates = [];
        for ($jour = $debut; $jour <= $fin; $jour = $jour->modify('+1 day')) {
            if ((int) $jour->format('N') >= 6) {
                continue;
            }
            $dates[] = $jour->format('Y-m-d');
        }

        return $dates;
    }

    /**
     * @return array<int, string>
     */
    private function nomsMois(): array
    {
        return [
            1 => 'janvier', 2 => 'février', 3 => 'mars', 4 => 'avril',
            5 => 'mai', 6 => 'juin', 7 => 'juillet', 8 => 'août',
            9 => 'septembre', 10 => 'octobre', 11 => 'novembre', 12 => 'décembre',
        ];
    }

    private function libelleMois(\DateTimeImmutable $jour): string
    {
        return sprintf(
            '%s %s',
            $this->nomsMois()[(int) $jour->format('n')],
            $jour->format('Y'),
        );
    }

    private function parserDateIso(?string $dateIso): \DateTimeImmutable
    {
        if ($dateIso === null || trim($dateIso) === '') {
            return new \DateTimeImmutable('today');
        }
        $date = \DateTimeImmutable::createFromFormat('Y-m-d', trim($dateIso));
        if ($date === false || $date->format('Y-m-d') !== trim($dateIso)) {
            throw new DonneesInvalidesException(
                'Le paramètre "date" doit être au format YYYY-MM-DD.',
            );
        }

        return $date;
    }

    private function lundiDe(\DateTimeImmutable $jour): \DateTimeImmutable
    {
        $decalage = ((int) $jour->format('N')) - 1;

        return $jour->modify(sprintf('-%d days', $decalage))->setTime(0, 0);
    }

    private function libelleSemaine(\DateTimeImmutable $lundi, \DateTimeImmutable $vendredi): string
    {
        $mois = $this->nomsMois();
        $jLundi = (int) $lundi->format('j');
        $jVendredi = (int) $vendredi->format('j');
        $mLundi = (int) $lundi->format('n');
        $mVendredi = (int) $vendredi->format('n');
        $aLundi = (int) $lundi->format('Y');
        $aVendredi = (int) $vendredi->format('Y');

        if ($mLundi === $mVendredi && $aLundi === $aVendredi) {
            return sprintf(
                'Semaine du %d au %d %s %d',
                $jLundi,
                $jVendredi,
                $mois[$mVendredi],
                $aVendredi,
            );
        }
        if ($aLundi === $aVendredi) {
            return sprintf(
                'Semaine du %d %s au %d %s %d',
                $jLundi,
                $mois[$mLundi],
                $jVendredi,
                $mois[$mVendredi],
                $aVendredi,
            );
        }

        return sprintf(
            'Semaine du %d %s %d au %d %s %d',
            $jLundi,
            $mois[$mLundi],
            $aLundi,
            $jVendredi,
            $mois[$mVendredi],
            $aVendredi,
        );
    }

    /**
     * Traverse les anciens conteneurs de type pour n'exposer que les vraies
     * sections comme racines de fusion (Salaires, RECETTES IMPOTS, …).
     *
     * @return list<Section>
     */
    private function noeudsEffectifsCommeRacines(Section $section, bool $estRacineFiche): array
    {
        if (!MaquetteFicheBleue::estConteneurType($section->getNom(), $section->getType(), $estRacineFiche)) {
            return [$section];
        }

        $effectifs = [];
        foreach ($this->enfantsSection($section) as $enfant) {
            foreach ($this->noeudsEffectifsCommeRacines($enfant, false) as $noeud) {
                $effectifs[] = $noeud;
            }
        }

        return $effectifs;
    }

    /**
     * Remonte les sections hors des anciens conteneurs RECETTES / 1-RECETTES
     * / DEPENSES / 2-DEPENSES.
     */
    private function extraireHorsConteneursType(): int
    {
        $aSupprimer = [];
        foreach ($this->rubriqueRepository->listerRacines() as $racine) {
            $this->collecterConteneursType($racine, 0, $aSupprimer);
        }
        if ($aSupprimer === []) {
            return 0;
        }

        usort(
            $aSupprimer,
            static fn (array $a, array $b): int => $b['profondeur'] <=> $a['profondeur'],
        );

        foreach ($aSupprimer as $item) {
            $this->rubriqueRepository->promouvoirEnfantsEtSupprimerConteneur(
                $item['id'],
                $item['parent_id'],
            );
        }

        return count($aSupprimer);
    }

    /**
     * @param list<array{id: int, parent_id: int|null, profondeur: int}> $out
     */
    private function collecterConteneursType(ConsoRubrique $noeud, int $profondeur, array &$out): void
    {
        $id = $noeud->getId();
        if (
            $id !== null
            && MaquetteFicheBleue::estConteneurType($noeud->getNom(), $noeud->getType(), $noeud->estRacine())
        ) {
            $out[] = [
                'id' => $id,
                'parent_id' => $noeud->getParent()?->getId(),
                'profondeur' => $profondeur,
            ];
        }

        foreach ($this->enfantsRubrique($noeud) as $enfant) {
            $this->collecterConteneursType($enfant, $profondeur + 1, $out);
        }
    }

    /**
     * @return list<Section>
     */
    private function racinesFiche(FicheExecution $fiche): array
    {
        $racines = array_values(array_filter(
            $fiche->getSections()->toArray(),
            static fn (Section $s): bool => !$s->estSousSection(),
        ));
        usort(
            $racines,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId() ?? 0] <=> [$b->getOrdre(), $b->getId() ?? 0],
        );

        return $racines;
    }

    /**
     * @return list<Section>
     */
    private function enfantsSection(Section $section): array
    {
        $enfants = $section->getSousSections()->toArray();
        usort(
            $enfants,
            static fn (Section $a, Section $b): int => [$a->getOrdre(), $a->getId() ?? 0] <=> [$b->getOrdre(), $b->getId() ?? 0],
        );

        return $enfants;
    }

    /**
     * @return list<ConsoRubrique>
     */
    private function enfantsRubrique(ConsoRubrique $rubrique): array
    {
        $enfants = $rubrique->getEnfants()->toArray();
        usort(
            $enfants,
            static fn (ConsoRubrique $a, ConsoRubrique $b): int => [$a->getOrdre(), $a->getId() ?? 0] <=> [$b->getOrdre(), $b->getId() ?? 0],
        );

        return $enfants;
    }

    private function cleUnique(?ConsoRubrique $parent, string $nom): string
    {
        $prefixe = $parent === null ? '' : $parent->getCle() . '/';
        $base = $prefixe . $this->slug($nom);
        $cle = $base;
        $suffixe = 2;
        while (
            isset($this->clesUtilisees[$cle])
            || $this->rubriqueRepository->trouverParCle($cle) !== null
        ) {
            $cle = $base . '-' . $suffixe;
            $suffixe++;
        }
        $this->clesUtilisees[$cle] = true;

        return $cle;
    }

    private function slug(string $nom): string
    {
        $normalise = $this->normaliserNom($nom);
        $slug = preg_replace('/[^A-Z0-9]+/', '-', $normalise) ?? $normalise;
        $slug = trim($slug, '-');

        return $slug === '' ? 'rubrique' : $slug;
    }

    private function normaliserNom(string $nom): string
    {
        $haut = mb_strtoupper(trim($nom));
        $sansAccents = strtr($haut, [
            'À' => 'A', 'Á' => 'A', 'Â' => 'A', 'Ä' => 'A',
            'È' => 'E', 'É' => 'E', 'Ê' => 'E', 'Ë' => 'E',
            'Ì' => 'I', 'Í' => 'I', 'Î' => 'I', 'Ï' => 'I',
            'Ò' => 'O', 'Ó' => 'O', 'Ô' => 'O', 'Ö' => 'O',
            'Ù' => 'U', 'Ú' => 'U', 'Û' => 'U', 'Ü' => 'U',
            'Ç' => 'C', 'Œ' => 'OE', 'Æ' => 'AE',
        ]);
        $compact = preg_replace('/\s+/', ' ', $sansAccents) ?? $sansAccents;

        return trim($compact);
    }

    private function normaliserMontant(string $brut): string
    {
        $normalise = str_replace([' ', ','], ['', '.'], trim($brut));
        if ($normalise === '' || !is_numeric($normalise)) {
            return '0.00';
        }

        return number_format((float) $normalise, 2, '.', '');
    }

    private function dateIsoJournee(JourneeTresorerie $journee): \DateTimeImmutable
    {
        if (preg_match('/^JT-(\d{2})-(\d{2})-(\d{4})-/', $journee->getReference(), $m) === 1) {
            $date = \DateTimeImmutable::createFromFormat('Y-m-d', sprintf('%s-%s-%s', $m[3], $m[2], $m[1]));
            if ($date instanceof \DateTimeImmutable) {
                return $date;
            }
        }

        return $journee->getDateCreation()->setTime(0, 0);
    }
}
