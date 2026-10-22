<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Remplace utilisateur.acces_retires (liste des acces du metier RETIRES a ce compte)
 * par utilisateur.acces (liste des acces AUTORISES pour ce compte) : la colonne porte
 * desormais directement les habilitations effectives — plus de soustraction a la
 * lecture. Les valeurs existantes sont reprises telles quelles : acces = catalogue du
 * metier moins les acces retires (voir App\Shared\Enum\RoleAcces::accesRole()).
 */
final class Version20260819103000 extends AbstractMigration
{
    /**
     * Copie de RoleAcces::accesRole() figee a la date de cette migration : une
     * migration ne doit pas dependre du code applicatif, qui peut evoluer ensuite.
     */
    private const ACCES_PAR_ROLE = [
        'ADMINISTRATEUR' => [
            'CONSULTER_TABLEAU_BORD_SR', 'GENERER_FICHE_DEPOT', 'CONSULTER_FICHE_DEPOT',
            'TELECHARGER_FICHE_DEPOT', 'GERER_MOUVEMENT_FICHE', 'CONSULTER_HISTORIQUE',
            'VALIDER_FICHE_DEPOT', 'SUPPRIMER_FICHE_DEPOT', 'SUPPRIMER_HISTORIQUE',
            'CONSULTER_UTILISATEURS', 'CREER_UTILISATEUR', 'MODIFIER_UTILISATEUR',
            'DESACTIVER_REACTIVER_UTILISATEUR', 'REINITIALISER_MOT_DE_PASSE_UTILISATEUR',
            'SUPPRIMER_UTILISATEUR',
        ],
        'CHEF_SR' => [
            'CONSULTER_TABLEAU_BORD_SR', 'GENERER_FICHE_DEPOT', 'CONSULTER_FICHE_DEPOT',
            'TELECHARGER_FICHE_DEPOT', 'GERER_MOUVEMENT_FICHE', 'CONSULTER_HISTORIQUE',
            'VALIDER_FICHE_DEPOT', 'SUPPRIMER_FICHE_DEPOT', 'SUPPRIMER_HISTORIQUE',
            'CONSULTER_UTILISATEURS', 'CREER_UTILISATEUR', 'MODIFIER_UTILISATEUR',
            'DESACTIVER_REACTIVER_UTILISATEUR', 'REINITIALISER_MOT_DE_PASSE_UTILISATEUR',
            'SUPPRIMER_UTILISATEUR',
        ],
        'AGENT_SR' => [
            'CONSULTER_TABLEAU_BORD_SR', 'GENERER_FICHE_DEPOT', 'CONSULTER_FICHE_DEPOT',
            'TELECHARGER_FICHE_DEPOT', 'GERER_MOUVEMENT_FICHE', 'CONSULTER_HISTORIQUE',
        ],
        'AGENT_SOF' => [],
        'AGENT_SP' => [],
        'CHEF_SOF' => [
            'CONSULTER_UTILISATEURS', 'CREER_UTILISATEUR', 'MODIFIER_UTILISATEUR',
            'DESACTIVER_REACTIVER_UTILISATEUR', 'REINITIALISER_MOT_DE_PASSE_UTILISATEUR',
            'SUPPRIMER_UTILISATEUR',
        ],
        'CHEF_SP' => [
            'CONSULTER_UTILISATEURS', 'CREER_UTILISATEUR', 'MODIFIER_UTILISATEUR',
            'DESACTIVER_REACTIVER_UTILISATEUR', 'REINITIALISER_MOT_DE_PASSE_UTILISATEUR',
            'SUPPRIMER_UTILISATEUR',
        ],
        'DIRECTEUR_DOMF' => [
            'CONSULTER_TABLEAU_BORD_SR', 'CONSULTER_FICHE_DEPOT', 'TELECHARGER_FICHE_DEPOT',
            'CONSULTER_HISTORIQUE', 'CONSULTER_UTILISATEURS',
        ],
        'DIRECTION_DG' => [
            'CONSULTER_TABLEAU_BORD_SR', 'CONSULTER_FICHE_DEPOT', 'TELECHARGER_FICHE_DEPOT',
            'CONSULTER_HISTORIQUE', 'CONSULTER_UTILISATEURS',
        ],
        'SUPERVISEUR' => [
            'CONSULTER_TABLEAU_BORD_SR', 'CONSULTER_FICHE_DEPOT', 'TELECHARGER_FICHE_DEPOT',
            'CONSULTER_HISTORIQUE', 'CONSULTER_UTILISATEURS',
        ],
    ];

    public function getDescription(): string
    {
        return 'Remplace utilisateur.acces_retires par utilisateur.acces (liste des acces autorises), '
            . 'en reprenant les habilitations existantes (catalogue du metier moins les acces retires).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE utilisateur ADD acces JSON DEFAULT '[]' NOT NULL");
    }

    public function postUp(Schema $schema): void
    {
        foreach ($this->connection->fetchAllAssociative('SELECT id, roles, acces_retires FROM utilisateur') as $ligne) {
            $roles = json_decode((string) $ligne['roles'], true) ?: [];
            $retires = json_decode((string) $ligne['acces_retires'], true) ?: [];

            $catalogue = [];
            foreach ($roles as $role) {
                foreach (self::ACCES_PAR_ROLE[$role] ?? [] as $acces) {
                    $catalogue[$acces] = $acces;
                }
            }

            $acces = array_values(array_diff($catalogue, $retires));

            $this->connection->executeStatement(
                'UPDATE utilisateur SET acces = :acces WHERE id = :id',
                ['acces' => json_encode($acces), 'id' => $ligne['id']],
            );
        }

        $this->connection->executeStatement('ALTER TABLE utilisateur DROP acces_retires');
        $this->connection->executeStatement('ALTER TABLE utilisateur ALTER acces DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql("ALTER TABLE utilisateur ADD acces_retires JSON DEFAULT '[]' NOT NULL");
        $this->addSql('ALTER TABLE utilisateur ALTER acces_retires DROP DEFAULT');
        $this->addSql('ALTER TABLE utilisateur DROP acces');
    }
}
