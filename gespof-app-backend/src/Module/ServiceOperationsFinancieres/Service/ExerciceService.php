<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\LoiEnVigueur;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\StatutExercice;
use App\Module\ServiceOperationsFinancieres\Enum\StatutPeriode;
use App\Module\ServiceOperationsFinancieres\Repository\ExerciceRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Service\Exception\ExerciceIntrouvableException;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Paramétrage de l'exercice budgétaire SOF (Chef SOF).
 */
class ExerciceService
{
    public function __construct(
        private readonly ExerciceRepository $exerciceRepository,
        private readonly PeriodeRepository $periodeRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function lister(): array
    {
        return array_map(
            fn (Exercice $e): array => $this->serialiser($e),
            $this->exerciceRepository->listerParAnneeDesc(),
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    public function courant(): ?array
    {
        $exercice = $this->exerciceRepository->trouverCourant();

        return $exercice instanceof Exercice ? $this->serialiser($exercice) : null;
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenir(int $annee): array
    {
        return $this->serialiser($this->exiger($annee));
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrer(int $annee, array $donnees): array
    {
        $exercice = $this->exiger($annee);

        if (!$exercice->estOuvert()) {
            throw new DonneesInvalidesException(
                sprintf('L\'exercice %d est clôturé : consultation seule.', $annee),
            );
        }

        if (array_key_exists('balance_initiale', $donnees)) {
            $brut = $this->normaliserMontantSaisi((string) $donnees['balance_initiale']);
            try {
                $exercice->setBalanceInitiale($brut);
            } catch (\InvalidArgumentException $e) {
                throw new DonneesInvalidesException($e->getMessage(), 0, $e);
            }
        }

        if (array_key_exists('loi_en_vigueur', $donnees)) {
            $exercice->setLoiEnVigueur($this->parserLoi((string) $donnees['loi_en_vigueur']));
        }

        if (array_key_exists('prefixe_ad', $donnees)) {
            $brut = trim((string) $donnees['prefixe_ad']);
            if ($brut === '') {
                throw new DonneesInvalidesException('Le préfixe des n° d\'AD est obligatoire.');
            }
            $chiffres = preg_replace('/\D+/', '', $brut) ?? '';
            if ($chiffres === '' || (int) $chiffres > 99) {
                throw new DonneesInvalidesException('Le préfixe des n° d\'AD doit être un entier entre 0 et 99.');
            }
            $exercice->setPrefixeAd((int) $chiffres);
        }

        if (array_key_exists('delai_arriere_jours', $donnees)) {
            $delai = (int) $donnees['delai_arriere_jours'];
            if ($delai < 0 || $delai > 3650) {
                throw new DonneesInvalidesException('Le délai avant arriéré doit être entre 0 et 3650 jours.');
            }
            $exercice->setDelaiArriereJours($delai);
        }

        try {
            $this->em->flush();
        } catch (\Doctrine\DBAL\Exception $e) {
            throw new DonneesInvalidesException(
                'Impossible d\'enregistrer l\'exercice : vérifiez la balance initiale et les autres champs.',
                0,
                $e,
            );
        }

        return $this->serialiser($exercice);
    }

    /**
     * Ouvre l'année suivante en recopiant les paramètres de l'exercice courant.
     *
     * @return array<string, mixed>
     */
    public function ouvrirNouvelExercice(?int $anneeSource = null): array
    {
        $source = $anneeSource !== null
            ? $this->exiger($anneeSource)
            : $this->exerciceRepository->trouverCourant();

        if (!$source instanceof Exercice) {
            throw new DonneesInvalidesException('Aucun exercice source pour ouvrir une nouvelle année.');
        }

        $nouvelleAnnee = $source->getAnnee() + 1;
        if ($this->exerciceRepository->findByAnnee($nouvelleAnnee) instanceof Exercice) {
            throw new DonneesInvalidesException(
                sprintf('L\'exercice %d existe déjà.', $nouvelleAnnee),
            );
        }

        if ($source->estOuvert()) {
            throw new DonneesInvalidesException(
                sprintf(
                    'Clôturez d\'abord l\'exercice %d avant d\'ouvrir %d.',
                    $source->getAnnee(),
                    $nouvelleAnnee,
                ),
            );
        }

        $nouveau = new Exercice(
            $nouvelleAnnee,
            '0.00',
            $source->getLoiEnVigueur() ?? LoiEnVigueur::LFI,
            sprintf('AD%02d', $nouvelleAnnee % 100),
            $source->getDelaiArriereJours(),
            StatutExercice::OUVERT,
            new \DateTimeImmutable('today'),
        );

        $this->em->persist($nouveau);
        $this->em->flush();

        return $this->serialiser($nouveau);
    }

    /**
     * @return array<string, mixed>
     */
    public function cloturer(int $annee): array
    {
        $exercice = $this->exiger($annee);

        if (!$exercice->estOuvert()) {
            throw new DonneesInvalidesException(sprintf('L\'exercice %d est déjà clôturé.', $annee));
        }

        $exercice->cloturer();
        $this->em->flush();

        return $this->serialiser($exercice);
    }

    private function exiger(int $annee): Exercice
    {
        $exercice = $this->exerciceRepository->findByAnnee($annee);
        if (!$exercice instanceof Exercice) {
            throw new ExerciceIntrouvableException(sprintf('Exercice %d introuvable.', $annee));
        }

        return $exercice;
    }

    /**
     * @return array<string, mixed>
     */
    public function serialiser(Exercice $e): array
    {
        $loi = $e->getLoiEnVigueur();
        $periodes = $this->periodeRepository->listerParExercice($e->getAnnee());
        $periodeOuverte = null;
        foreach (array_reverse($periodes) as $p) {
            if ($p->getStatut() !== StatutPeriode::PUBLIEE) {
                $periodeOuverte = $p;
                break;
            }
        }
        if ($periodeOuverte === null && $periodes !== []) {
            $periodeOuverte = $periodes[array_key_last($periodes)];
        }

        $validees = array_values(array_filter(
            $periodes,
            static fn (Periode $p): bool => in_array(
                $p->getStatut(),
                [StatutPeriode::VALIDEE, StatutPeriode::PUBLIEE],
                true,
            ),
        ));
        usort($validees, static fn (Periode $a, Periode $b): int => $b->getMois() <=> $a->getMois());
        $dernierValide = $validees[0] ?? null;

        return [
            'annee' => $e->getAnnee(),
            'balance_initiale' => $e->getBalanceInitiale(),
            'loi_en_vigueur' => $loi?->value,
            'loi_en_vigueur_libelle' => $loi?->libelle($e->getAnnee()),
            'prefixe_ad' => $e->getPrefixeAd(),
            'delai_arriere_jours' => $e->getDelaiArriereJours(),
            'statut' => $e->getStatut()->value,
            'statut_libelle' => $e->libelleStatut(),
            'date_ouverture' => $e->getDateOuverture()?->format('Y-m-d'),
            'date_cloture' => $e->getDateCloture()?->format('Y-m-d'),
            'ouvert' => $e->estOuvert(),
            'date_situation' => $periodeOuverte?->getDateSituation()?->format('Y-m-d'),
            'dernier_mois_valide' => $dernierValide instanceof Periode
                ? [
                    'mois' => $dernierValide->getMois(),
                    'libelle' => ($m = Mois::tryFrom($dernierValide->getMois()))
                        ? sprintf('%s %d', ucfirst($m->libelle()), $e->getAnnee())
                        : (string) $dernierValide->getMois(),
                    'statut' => $dernierValide->getStatut()->value,
                ]
                : null,
            // Compat lecture ancienne API
            'loi_finances_en_vigueur' => $loi?->libelle($e->getAnnee()),
            'solde_ouverture' => $e->getBalanceInitiale(),
        ];
    }

    private function parserLoi(string $valeur): LoiEnVigueur
    {
        $normalise = strtoupper(trim($valeur));
        if (str_starts_with($normalise, 'LFR')) {
            return LoiEnVigueur::LFR;
        }
        if (str_starts_with($normalise, 'LFI')) {
            return LoiEnVigueur::LFI;
        }

        throw new DonneesInvalidesException('Loi en vigueur invalide (LFI ou LFR attendu).');
    }

    /** Accepte « 812 437 500 000 », « 812437500000 » ou décimal. */
    private function normaliserMontantSaisi(string $brut): string
    {
        // Espaces classiques + NBSP / fine space (syntaxe PCRE \x{…}, pas \u).
        $net = preg_replace('/[\s\x{00a0}\x{202f}]/u', '', $brut) ?? '';
        $net = str_replace(',', '.', $net);
        if ($net === '' || !is_numeric($net)) {
            throw new DonneesInvalidesException('Balance initiale invalide.');
        }

        // NUMERIC(20,2) : |valeur| < 10^18
        if (strlen(explode('.', ltrim($net, '+-'), 2)[0]) > 18) {
            throw new DonneesInvalidesException(
                'Balance initiale trop élevée (18 chiffres entiers maximum).',
            );
        }

        return $net;
    }
}
