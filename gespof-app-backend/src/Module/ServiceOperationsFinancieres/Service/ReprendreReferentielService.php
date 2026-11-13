<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\RubriqueRecette;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\SocietePetroliere;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\CodeTofe;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\CompteSuivi;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\PosteComptable;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RubriqueDepense;
use App\Module\ServiceOperationsFinancieres\Enum\CategoriePosteComptable;
use App\Module\ServiceOperationsFinancieres\Enum\FamilleCompteSuivi;
use App\Module\ServiceOperationsFinancieres\Enum\NatureDepense;
use App\Module\ServiceOperationsFinancieres\Enum\SectionRecette;
use App\Module\ServiceOperationsFinancieres\Repository\CodeTofeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\CompteSuiviRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PosteComptableRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueDepenseRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueRecetteRepository;
use App\Module\ServiceOperationsFinancieres\Repository\SocietePetroliereRepository;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Reprises idempotentes des référentiels SOF depuis CSV de référence.
 */
class ReprendreReferentielService
{
    private const CODES_TOFE = [
        '4' => 'IS',
        '7' => 'dont TVA brute',
        '9' => 'Autres Taxes sur les Biens et Services',
        '10' => 'Douanes',
        '11' => 'Impôt sur les Sociétés',
        '12' => 'Impôt sur les personnes physiques',
        '13' => 'Autres Recettes Fiscales',
        '16' => 'RMP',
        '17' => 'Autres',
        '19' => 'Hors pétrolières',
        '20' => 'Recettes comptes de correspondants',
    ];

    /** NIF attendus dans RD Model › Pétrole (24/25). */
    private const NIF_ABSENT_PETROLE = '739969U';

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly CodeTofeRepository $codeTofeRepository,
        private readonly RubriqueRecetteRepository $rubriqueRecetteRepository,
        private readonly RubriqueDepenseRepository $rubriqueDepenseRepository,
        private readonly CompteSuiviRepository $compteSuiviRepository,
        private readonly SocietePetroliereRepository $societePetroliereRepository,
        private readonly PosteComptableRepository $posteComptableRepository,
        private readonly RegleFlechageService $regleFlechageService,
    ) {
    }

    /**
     * @return array{crees: int, modifies: int, ignores: int, details: list<string>, warnings: list<string>}
     */
    public function reprendre(string $nom, string $fichier, bool $dryRun): array
    {
        $chemin = $this->resoudreFichier($fichier);
        $rapport = ['crees' => 0, 'modifies' => 0, 'ignores' => 0, 'details' => [], 'warnings' => []];

        match ($nom) {
            'codes-tofe' => $this->reprendreCodesTofe($rapport, $dryRun),
            'nomenclature-recettes' => $this->reprendreNomenclatureRecettes($chemin, $rapport, $dryRun),
            'nomenclature-depenses' => $this->reprendreNomenclatureDepenses($chemin, $rapport, $dryRun),
            'comptes' => $this->reprendreComptes($chemin, $rapport, $dryRun),
            'societes-petrolieres' => $this->reprendreSocietes($chemin, $rapport, $dryRun),
            'postes-comptables' => $this->reprendrePostes($chemin, $rapport, $dryRun),
            default => throw new DonneesInvalidesException(
                'Référentiel inconnu. Attendu : codes-tofe, nomenclature-recettes, nomenclature-depenses, comptes, societes-petrolieres, postes-comptables.',
            ),
        };

        if (!$dryRun) {
            $this->em->flush();
        }

        if (in_array($nom, ['nomenclature-recettes', 'nomenclature-depenses'], true)) {
            foreach ($this->regleFlechageService->listerOrphelines() as $o) {
                $rapport['warnings'][] = sprintf(
                    'Règle fléchage orpheline #%s → %s (%s)',
                    (string) ($o['id'] ?? '?'),
                    $o['rubrique_code'],
                    $o['domaine'],
                );
            }
        }

        return $rapport;
    }

    /**
     * @param array{crees: int, modifies: int, ignores: int, details: list<string>, warnings: list<string>} $rapport
     */
    private function reprendreCodesTofe(array &$rapport, bool $dryRun): void
    {
        foreach (self::CODES_TOFE as $codeCle => $libelle) {
            // Les clés « 4 », « 7 »… sont castées en int par PHP — forcer string.
            $code = (string) $codeCle;
            $existant = $this->codeTofeRepository->findByCode($code);
            if ($existant instanceof CodeTofe) {
                if ($existant->getLibelle() === $libelle) {
                    ++$rapport['ignores'];
                    $rapport['details'][] = "ignore {$code}";
                    continue;
                }
                ++$rapport['modifies'];
                $rapport['details'][] = "modifie {$code}";
                if (!$dryRun) {
                    $existant->setLibelle($libelle);
                }
                continue;
            }
            ++$rapport['crees'];
            $rapport['details'][] = "cree {$code}";
            if (!$dryRun) {
                $this->em->persist(new CodeTofe($code, $libelle));
            }
        }
    }

    /**
     * @param array{crees: int, modifies: int, ignores: int, details: list<string>, warnings: list<string>} $rapport
     */
    private function reprendreNomenclatureRecettes(string $chemin, array &$rapport, bool $dryRun): void
    {
        $lignes = $this->lireCsv($chemin);
        if (!$dryRun) {
            $this->viderRubriquesRecettes();
        }

        $gen = 0;
        $parCode = [];
        $parentCourant = null;
        $section = SectionRecette::PETROLE;

        foreach ($lignes as $ligne) {
            $ordre = (int) ($ligne['ordre'] ?? 0);
            $codeBrut = trim((string) ($ligne['code'] ?? ''));
            $libelleBrut = (string) ($ligne['libelle'] ?? '');
            $libelle = $this->nettoyerLibelle($libelleBrut);
            $codeTofe = $this->extraireCodeTofe($ligne['code_tofe'] ?? null, $ligne['note'] ?? null);

            if ($libelle === '') {
                continue;
            }

            // Totaux / notes de bas de page : regroupements synthétiques non saisissables
            $estTotal = $this->estLigneTotaleRecette($libelle);
            $synthetique = $codeBrut === '';
            if ($synthetique) {
                ++$gen;
                $code = sprintf('REC-G%02d', $gen);
            } else {
                $code = $codeBrut;
            }

            $section = $this->infererSectionRecette($libelle, $code, $section);

            if ($this->estRacineRecette($libelle, $codeBrut)) {
                $parentCourant = null;
            }

            $parent = $parentCourant;
            if ($synthetique && $this->estRacineRecette($libelle, '')) {
                $parent = null;
            }

            ++$rapport['crees'];
            $rapport['details'][] = sprintf('cree %s · %s', $code, $libelle);
            if ($codeTofe !== null && !isset(self::CODES_TOFE[$codeTofe])) {
                $rapport['warnings'][] = sprintf('code TOFE %s absent pour %s', $codeTofe, $code);
            }

            if (!$dryRun) {
                $rubrique = new RubriqueRecette(
                    $code,
                    $libelle,
                    $section,
                    $parent,
                    $synthetique || $estTotal,
                    $ordre,
                    $codeTofe,
                    !$estTotal,
                );
                $this->em->persist($rubrique);
                $parCode[$code] = $rubrique;
                if ($synthetique || $this->estGroupeRecette($libelle)) {
                    $parentCourant = $rubrique;
                }
            }
        }

        $rapport['warnings'][] = 'Arbre recettes : parents déduits (manuel SROT p.32 + enchaînement CSV) — vérifier rattachements ambigus.';
    }

    /**
     * @param array{crees: int, modifies: int, ignores: int, details: list<string>, warnings: list<string>} $rapport
     */
    private function reprendreNomenclatureDepenses(string $chemin, array &$rapport, bool $dryRun): void
    {
        $lignes = $this->lireCsv($chemin);
        if (!$dryRun) {
            $this->viderRubriquesDepenses();
        }

        $gen = 0;
        $parentCourant = null;

        foreach ($lignes as $ligne) {
            $ordre = (int) ($ligne['ordre'] ?? 0);
            $codeBrut = trim((string) ($ligne['code'] ?? ''));
            $libelle = $this->nettoyerLibelle((string) ($ligne['libelle'] ?? ''));
            $section = trim((string) ($ligne['section'] ?? 'exercice_courant'));
            $exclusion = trim((string) ($ligne['exclusions_brut'] ?? ''));
            $exclusion = $exclusion !== '' ? $exclusion : null;

            if ($libelle === '') {
                continue;
            }

            $nature = NatureDepense::tryFrom($section) ?? NatureDepense::EXERCICE_COURANT;
            $estTotal = str_contains(mb_strtoupper($libelle), 'TOTAL DES');
            $synthetique = $codeBrut === '';
            if ($synthetique) {
                ++$gen;
                $code = sprintf('DEP-G%02d', $gen);
            } else {
                $code = $codeBrut;
            }

            if ($this->estRacineDepense($libelle, $codeBrut)) {
                $parentCourant = null;
            }

            ++$rapport['crees'];
            $rapport['details'][] = sprintf('cree %s · %s', $code, $libelle);

            if (!$dryRun) {
                $rubrique = new RubriqueDepense(
                    $code,
                    $libelle,
                    $nature,
                    $parentCourant,
                    $synthetique || $estTotal,
                    $ordre,
                    null,
                    !$estTotal,
                    $exclusion,
                );
                $this->em->persist($rubrique);
                if ($synthetique || preg_match('/^[A-Z]\./', $libelle) === 1) {
                    $parentCourant = $rubrique;
                }
            }
        }
    }

    /**
     * @param array{crees: int, modifies: int, ignores: int, details: list<string>, warnings: list<string>} $rapport
     */
    private function reprendreComptes(string $chemin, array &$rapport, bool $dryRun): void
    {
        $lignes = $this->lireCsv($chemin);
        $vus = [];

        foreach ($lignes as $ligne) {
            $compte = trim((string) ($ligne['compte'] ?? ''));
            $nature = trim((string) ($ligne['nature'] ?? ''));
            if ($compte === '') {
                continue;
            }
            $cle = $compte.'|'.$nature;
            $vus[$cle] = true;

            $libelle = trim((string) ($ligne['libelle'] ?? ''));
            $famille = FamilleCompteSuivi::tryFrom(strtoupper(trim((string) ($ligne['famille'] ?? ''))))
                ?? FamilleCompteSuivi::DOUANE;
            $type = trim((string) ($ligne['type'] ?? ''));
            $bancaire = $this->parserOui($ligne['bancaire_seulement'] ?? false);
            $ordre = (int) ($ligne['ordre'] ?? 0);
            $fichier = trim((string) ($ligne['fichier'] ?? ''));
            $fichier = $fichier !== '' ? $fichier : null;

            $existant = $this->compteSuiviRepository->trouver($compte, $nature);
            if ($existant instanceof CompteSuivi) {
                $identique = $existant->getLibelle() === $libelle
                    && $existant->getType() === $type
                    && $existant->isBancaireSeulement() === $bancaire
                    && $existant->getOrdre() === $ordre
                    && $existant->getFichier() === $fichier
                    && $existant->getFamille() === $famille;
                if ($identique) {
                    ++$rapport['ignores'];
                    continue;
                }
                ++$rapport['modifies'];
                $rapport['details'][] = "modifie {$cle}";
                if (!$dryRun) {
                    $existant->setLibelle($libelle);
                    $existant->setType($type);
                    $existant->setBancaireSeulement($bancaire);
                    $existant->setOrdre($ordre);
                    $existant->setFichier($fichier);
                    $existant->setFamille($famille);
                }
                continue;
            }

            ++$rapport['crees'];
            $rapport['details'][] = "cree {$cle}";
            if (!$dryRun) {
                $this->em->persist(new CompteSuivi(
                    $compte,
                    $nature,
                    $libelle,
                    $famille,
                    $type,
                    $ordre,
                    $bancaire,
                    $fichier,
                ));
            }
        }

        if (!$dryRun) {
            foreach ($this->compteSuiviRepository->findAll() as $c) {
                $cle = $c->getCompte().'|'.$c->getNature();
                if (!isset($vus[$cle])) {
                    $this->em->remove($c);
                    $rapport['details'][] = "supprime {$cle}";
                }
            }
        }
    }

    /**
     * @param array{crees: int, modifies: int, ignores: int, details: list<string>, warnings: list<string>} $rapport
     */
    private function reprendreSocietes(string $chemin, array &$rapport, bool $dryRun): void
    {
        $lignes = $this->lireCsv($chemin);
        $vus = [];
        $trouveAbsent = false;

        foreach ($lignes as $ligne) {
            $matricule = trim((string) ($ligne['matricule'] ?? ''));
            $nom = trim((string) ($ligne['nom'] ?? ''));
            $nif = trim((string) ($ligne['nif'] ?? ''));
            if ($matricule === '' || $nom === '') {
                continue;
            }
            $vus[$matricule] = true;
            if (strcasecmp($nif, self::NIF_ABSENT_PETROLE) === 0) {
                $trouveAbsent = true;
            }

            $existant = $this->societePetroliereRepository->trouverParMatricule($matricule);
            if ($existant instanceof SocietePetroliere) {
                $identique = $existant->getNom() === $nom
                    && $existant->getChampNif() === ($nif !== '' ? $nif : null)
                    && $existant->isPetrole() === true
                    && $existant->getRedevanceSupMin() === null;
                if ($identique) {
                    ++$rapport['ignores'];
                    continue;
                }
                ++$rapport['modifies'];
                $rapport['details'][] = "modifie {$matricule}";
                if (!$dryRun) {
                    $existant->setNom($nom);
                    $existant->setChampNif($nif !== '' ? $nif : null);
                    $existant->setRedevanceSupMin(null);
                    $existant->setPetrole(true);
                }
                continue;
            }

            ++$rapport['crees'];
            $rapport['details'][] = "cree {$matricule}";
            if (!$dryRun) {
                $this->em->persist(new SocietePetroliere(
                    $matricule,
                    $nom,
                    $nif !== '' ? $nif : null,
                    null,
                    true,
                ));
            }
        }

        if ($trouveAbsent) {
            $rapport['warnings'][] = 'NIF 739969U absent de la feuille Pétrole RD Model (24/25) — avertissement non bloquant.';
        }

        if (!$dryRun) {
            foreach ($this->societePetroliereRepository->findAll() as $s) {
                if (!isset($vus[$s->getMatricule()])) {
                    $this->em->remove($s);
                    $rapport['details'][] = 'supprime '.$s->getMatricule();
                }
            }
        }
    }

    /**
     * @param array{crees: int, modifies: int, ignores: int, details: list<string>, warnings: list<string>} $rapport
     */
    private function reprendrePostes(string $chemin, array &$rapport, bool $dryRun): void
    {
        $lignes = $this->lireCsv($chemin);
        $vus = [];

        foreach ($lignes as $ligne) {
            $code = trim((string) ($ligne['code'] ?? ''));
            $libelle = trim((string) ($ligne['libelle'] ?? ''));
            if ($code === '' || $libelle === '') {
                continue;
            }
            $vus[$code] = true;
            $cat = CategoriePosteComptable::tryFrom(strtoupper(trim((string) ($ligne['categorie_defaut'] ?? 'TPG'))))
                ?? CategoriePosteComptable::TPG;
            $observees = trim((string) ($ligne['categories_observees'] ?? ''));
            $observees = $observees !== '' ? $observees : null;

            $existant = $this->posteComptableRepository->trouverParCode($code);
            if ($existant instanceof PosteComptable) {
                $identique = $existant->getLibelle() === $libelle
                    && $existant->getCategorieDefaut() === $cat
                    && $existant->getCategoriesObservees() === $observees;
                if ($identique) {
                    ++$rapport['ignores'];
                    continue;
                }
                ++$rapport['modifies'];
                $rapport['details'][] = "modifie {$code}";
                if (!$dryRun) {
                    $existant->setLibelle($libelle);
                    $existant->setCategorieDefaut($cat);
                    $existant->setCategoriesObservees($observees);
                }
                continue;
            }

            ++$rapport['crees'];
            $rapport['details'][] = "cree {$code}";
            if (!$dryRun) {
                $this->em->persist(new PosteComptable($code, $libelle, $cat, $observees));
            }
        }

        if (!$dryRun) {
            foreach ($this->posteComptableRepository->findAll() as $p) {
                if (!isset($vus[$p->getCode()])) {
                    $this->em->remove($p);
                    $rapport['details'][] = 'supprime '.$p->getCode();
                }
            }
        }
    }

    private function viderRubriquesRecettes(): void
    {
        // Ordre enfants → parents
        $codes = $this->em->createQuery('SELECT r.code FROM '.RubriqueRecette::class.' r ORDER BY r.niveau DESC')
            ->getSingleColumnResult();
        foreach ($codes as $code) {
            $r = $this->rubriqueRecetteRepository->findByCode((string) $code);
            if ($r instanceof RubriqueRecette) {
                $this->em->remove($r);
            }
        }
        $this->em->flush();
    }

    private function viderRubriquesDepenses(): void
    {
        $codes = $this->em->createQuery('SELECT r.code FROM '.RubriqueDepense::class.' r ORDER BY r.niveau DESC')
            ->getSingleColumnResult();
        foreach ($codes as $code) {
            $r = $this->rubriqueDepenseRepository->findByCode((string) $code);
            if ($r instanceof RubriqueDepense) {
                $this->em->remove($r);
            }
        }
        $this->em->flush();
    }

    private function resoudreFichier(string $fichier): string
    {
        if (is_file($fichier)) {
            return $fichier;
        }
        $local = dirname(__DIR__, 4).'/resources/sof/referentiel/'.basename($fichier);
        if (is_file($local)) {
            return $local;
        }
        throw new DonneesInvalidesException(sprintf('Fichier CSV introuvable : %s', $fichier));
    }

    /**
     * @return list<array<string, string>>
     */
    private function lireCsv(string $chemin): array
    {
        $fh = fopen($chemin, 'rb');
        if ($fh === false) {
            throw new DonneesInvalidesException('Impossible de lire le CSV.');
        }
        $entetes = fgetcsv($fh, 0, ';');
        if (!is_array($entetes)) {
            fclose($fh);
            throw new DonneesInvalidesException('CSV vide.');
        }
        $entetes = array_map(static fn ($h) => strtolower(trim((string) $h)), $entetes);
        $lignes = [];
        while (($row = fgetcsv($fh, 0, ';')) !== false) {
            $assoc = [];
            foreach ($entetes as $i => $cle) {
                $assoc[$cle] = (string) ($row[$i] ?? '');
            }
            $lignes[] = $assoc;
        }
        fclose($fh);

        return $lignes;
    }

    private function nettoyerLibelle(string $libelle): string
    {
        $t = preg_replace('/^\.+\s*/', '', trim($libelle)) ?? trim($libelle);
        $t = preg_replace('/^\s*-\s*/', '', $t) ?? $t;

        return trim($t);
    }

    private function extraireCodeTofe(mixed $brut, mixed $note): ?string
    {
        $s = trim((string) $brut);
        if ($s === '' || !ctype_digit($s) || (int) $s < 1 || (int) $s > 99) {
            // Montants erronés rejetés ; tenter préfixe note « 11.… »
            if (is_string($note) && preg_match('/(\d{1,2})\./', $note, $m) === 1) {
                return (string) (int) $m[1];
            }

            return null;
        }

        return (string) (int) $s;
    }

    private function infererSectionRecette(string $libelle, string $code, SectionRecette $courante): SectionRecette
    {
        $u = mb_strtoupper($libelle);
        if (str_contains($u, 'PETROLE') && !str_contains($u, 'HORS')) {
            return SectionRecette::PETROLE;
        }
        if (str_contains($u, 'EMPRUNT') || in_array($code, ['AUU', 'AV', 'AW', 'AX', 'AY', 'AY2', 'AY3'], true)) {
            return SectionRecette::EMPRUNT;
        }
        if (str_contains($u, 'NON BUDGET') || str_starts_with($code, 'AA')) {
            return SectionRecette::NON_BUDGETAIRE;
        }
        if (str_contains($u, 'AFFECT')) {
            return SectionRecette::RECETTES_AFFECTEES;
        }
        if (str_contains($u, 'NON FISCAL')) {
            return SectionRecette::RECETTES_NON_FISCALES;
        }
        if (str_contains($u, 'FISCAL') || str_contains($u, 'DOUANE') || str_contains($u, 'IMPOT') || str_contains($u, 'TAXE')) {
            return SectionRecette::RECETTES_FISCALES;
        }

        return $courante;
    }

    private function estRacineRecette(string $libelle, string $codeBrut): bool
    {
        $u = mb_strtoupper($libelle);

        return $codeBrut === '' && (
            $u === 'PETROLE'
            || str_contains($u, 'RECETTES HORS')
            || str_starts_with($u, 'TOTAL')
            || $u === 'EMPRUNTS'
            || str_contains($u, 'NON BUDGET')
        );
    }

    private function estGroupeRecette(string $libelle): bool
    {
        $u = mb_strtoupper($libelle);

        return (bool) preg_match('/^(PETROLE|RECETTES |[A-G]\.|Emprunts|Recettes non)/u', $libelle)
            || str_contains($u, 'TAXES SUR')
            || str_contains($u, 'IMPOTS SUR')
            || str_contains($u, 'T.V.A');
    }

    private function estLigneTotaleRecette(string $libelle): bool
    {
        $u = mb_strtoupper($libelle);

        return str_starts_with($u, 'TOTAL')
            || str_contains($u, 'EN MILLIONS')
            || str_contains($u, 'MONTANT IMPOT')
            || str_contains($u, 'TVA BRUTE');
    }

    private function estRacineDepense(string $libelle, string $codeBrut): bool
    {
        $u = mb_strtoupper($libelle);

        return $codeBrut === '' && (
            str_contains($u, 'DEPENSES SUR')
            || str_contains($u, 'SANS ORDONNANCEMENT')
            || str_starts_with($u, 'TOTAL')
        );
    }

    private function parserOui(mixed $v): bool
    {
        if (is_bool($v)) {
            return $v;
        }
        $s = strtolower(trim((string) $v));

        return in_array($s, ['1', 'true', 'oui', 'yes', 'o'], true);
    }
}
