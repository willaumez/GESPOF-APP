<?php

declare(strict_types=1);

namespace App\Tests\Shared\Service;

use App\Shared\Entite\Utilisateur;
use App\Shared\Enum\Acces;
use App\Shared\Enum\RoleAcces;
use App\Shared\Exception\ActionInterditeException;
use App\Shared\Exception\DonneesInvalidesException;
use App\Shared\Exception\IdentifiantDejaUtiliseException;
use App\Shared\Repository\UtilisateurRepository;
use App\Shared\Service\UtilisateurActiviteVerifierInterface;
use App\Shared\Service\UtilisateurService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Scenarios de validation de la refonte "metier -> portail + autorisations" :
 * un metier unique choisi a la creation attribue automatiquement le portail
 * et les actions (RoleAcces::portail()/actions()), et un CHEF_X ne peut
 * gerer que les metiers de son propre portail (X), un ADMINISTRATEUR gere
 * tout.
 */
final class UtilisateurServiceTest extends TestCase
{
    private UtilisateurRepository $repository;
    private UtilisateurActiviteVerifierInterface $activiteVerifier;
    private UtilisateurService $service;

    protected function setUp(): void
    {
        $this->repository = $this->createStub(UtilisateurRepository::class);
        $this->repository->method('findOneBy')->willReturn(null);

        $hasher = $this->createStub(UserPasswordHasherInterface::class);
        $hasher->method('hashPassword')->willReturn('hash-factice');

        $this->activiteVerifier = $this->createStub(UtilisateurActiviteVerifierInterface::class);

        $this->service = new UtilisateurService($this->repository, $hasher, $this->activiteVerifier);
    }

    private function utilisateurAvecRoles(RoleAcces ...$roles): Utilisateur
    {
        $u = new Utilisateur();
        $u->setRolesAcces($roles);

        return $u;
    }

    private function donneesCreation(string $metier, string $matricule = 'M001'): array
    {
        return [
            'matricule' => $matricule,
            'email' => strtolower($matricule).'@gespof.local',
            'nom' => 'Nom',
            'prenom' => 'Prenom',
            'metier' => $metier,
        ];
    }

    #[DataProvider('metiersPortailEtActions')]
    public function testCreationParUnAdministrateurDeriveLePortailEtLesActionsDuMetier(
        string $metier,
        ?string $portailAttendu,
        array $actionsAttendues,
    ): void {
        $admin = $this->utilisateurAvecRoles(RoleAcces::ADMINISTRATEUR);

        $resultat = $this->service->creer($admin, $this->donneesCreation($metier));

        self::assertSame([$portailAttendu === null ? [] : [$portailAttendu]][0], $resultat['portails']);
        self::assertSame($actionsAttendues, $resultat['actions_autorisees']);
        self::assertSame($metier, $resultat['roles'][0]['valeur']);
    }

    public static function metiersPortailEtActions(): iterable
    {
        yield 'agent SOF' => ['AGENT_SOF', 'SOF', ['CONSULTER', 'AJOUTER', 'MODIFIER']];
        yield 'chef SOF' => ['CHEF_SOF', 'SOF', ['CONSULTER', 'AJOUTER', 'MODIFIER', 'SUPPRIMER']];
        yield 'agent SP' => ['AGENT_SP', 'SP', ['CONSULTER', 'AJOUTER', 'MODIFIER']];
        yield 'chef SP' => ['CHEF_SP', 'SP', ['CONSULTER', 'AJOUTER', 'MODIFIER', 'SUPPRIMER']];
        yield 'agent SR' => ['AGENT_SR', 'SR', ['CONSULTER', 'AJOUTER', 'MODIFIER']];
        yield 'chef SR' => ['CHEF_SR', 'SR', ['CONSULTER', 'AJOUTER', 'MODIFIER', 'SUPPRIMER']];
        yield 'administrateur' => ['ADMINISTRATEUR', 'ADMIN', ['CONSULTER', 'AJOUTER', 'MODIFIER', 'SUPPRIMER']];
        yield 'metier transverse (directeur DOMF)' => ['DIRECTEUR_DOMF', null, ['CONSULTER']];
    }

    public function testUnChefSrNePeutPasCreerUnAgentSof(): void
    {
        $chefSr = $this->utilisateurAvecRoles(RoleAcces::CHEF_SR);

        $this->expectException(ActionInterditeException::class);
        $this->service->creer($chefSr, $this->donneesCreation('AGENT_SOF'));
    }

    public function testUnChefSrPeutCreerUnAgentSrEtUnChefSr(): void
    {
        $chefSr = $this->utilisateurAvecRoles(RoleAcces::CHEF_SR);

        $agent = $this->service->creer($chefSr, $this->donneesCreation('AGENT_SR', 'M010'));
        $chef = $this->service->creer($chefSr, $this->donneesCreation('CHEF_SR', 'M011'));

        self::assertSame(['SR'], $agent['portails']);
        self::assertSame(['SR'], $chef['portails']);
    }

    public function testUnAgentSrNeGereAucunMetierCarPasDeDroitDeSuppression(): void
    {
        $agentSr = $this->utilisateurAvecRoles(RoleAcces::AGENT_SR);

        $this->expectException(ActionInterditeException::class);
        $this->service->creer($agentSr, $this->donneesCreation('AGENT_SR'));
    }

    public function testSeulUnAdministrateurPeutCreerUnMetierTransverse(): void
    {
        $chefSr = $this->utilisateurAvecRoles(RoleAcces::CHEF_SR);

        $this->expectException(ActionInterditeException::class);
        $this->service->creer($chefSr, $this->donneesCreation('DIRECTEUR_DOMF'));
    }

    public function testAdministrateurPeutCreerNimporteQuelMetier(): void
    {
        $admin = $this->utilisateurAvecRoles(RoleAcces::ADMINISTRATEUR);

        foreach (RoleAcces::cases() as $i => $role) {
            $resultat = $this->service->creer($admin, $this->donneesCreation($role->value, 'ADM'.$i));
            self::assertSame($role->value, $resultat['roles'][0]['valeur']);
        }
    }

    public function testMatriculeDejaUtiliseEstRejete(): void
    {
        $admin = $this->utilisateurAvecRoles(RoleAcces::ADMINISTRATEUR);
        $existant = new Utilisateur();
        $this->repository = $this->createStub(UtilisateurRepository::class);
        $this->repository->method('findOneBy')->willReturnCallback(
            static fn (array $critere) => array_key_exists('matricule', $critere) ? $existant : null,
        );
        $hasher = $this->createStub(UserPasswordHasherInterface::class);
        $hasher->method('hashPassword')->willReturn('hash-factice');
        $service = new UtilisateurService($this->repository, $hasher, $this->activiteVerifier);

        $this->expectException(IdentifiantDejaUtiliseException::class);
        $service->creer($admin, $this->donneesCreation('AGENT_SOF'));
    }

    public function testMetierInvalideEstRejete(): void
    {
        $admin = $this->utilisateurAvecRoles(RoleAcces::ADMINISTRATEUR);

        $this->expectException(DonneesInvalidesException::class);
        $this->service->creer($admin, $this->donneesCreation('METIER_INEXISTANT'));
    }

    public function testCreationRemplitLesAccesAvecCeuxDuMetier(): void
    {
        $admin = $this->utilisateurAvecRoles(RoleAcces::ADMINISTRATEUR);

        $resultat = $this->service->creer($admin, $this->donneesCreation('AGENT_SR'));

        self::assertSame(
            array_map(static fn (Acces $a): string => $a->value, RoleAcces::AGENT_SR->accesRole()),
            array_column($resultat['acces'], 'valeur'),
        );
    }

    public function testAdministrateurPeutRestreindreLesAccesALaCreation(): void
    {
        $admin = $this->utilisateurAvecRoles(RoleAcces::ADMINISTRATEUR);

        $resultat = $this->service->creer($admin, $this->donneesCreation('AGENT_SR') + [
            'acces' => ['CONSULTER_FICHE_DEPOT', 'SUPPRIMER_FICHE_DEPOT', 'CODE_INEXISTANT'],
        ]);

        // SUPPRIMER_FICHE_DEPOT (hors catalogue AGENT_SR) et le code inconnu sont ecartes.
        self::assertSame(['CONSULTER_FICHE_DEPOT'], array_column($resultat['acces'], 'valeur'));
    }

    public function testUnChefNePeutPasRestreindreLesAcces(): void
    {
        $chefSr = $this->utilisateurAvecRoles(RoleAcces::CHEF_SR);

        $resultat = $this->service->creer($chefSr, $this->donneesCreation('AGENT_SR') + [
            'acces' => ['CONSULTER_FICHE_DEPOT'],
        ]);

        self::assertCount(count(RoleAcces::AGENT_SR->accesRole()), $resultat['acces']);
    }

    public function testEnumRoleAccesDeriveLePortailEtLesActionsAttendues(): void
    {
        self::assertSame('SR', RoleAcces::CHEF_SR->portail()?->value);
        self::assertNull(RoleAcces::DIRECTEUR_DOMF->portail());
        self::assertNull(RoleAcces::DIRECTION_DG->portail());
        self::assertNull(RoleAcces::SUPERVISEUR->portail());
        self::assertSame(['CONSULTER'], array_map(
            static fn ($a) => $a->value,
            RoleAcces::SUPERVISEUR->actions(),
        ));
    }
}
