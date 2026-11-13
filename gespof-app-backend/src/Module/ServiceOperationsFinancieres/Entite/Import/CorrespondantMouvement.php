<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Import;

use App\Module\ServiceOperationsFinancieres\Enum\SensMontantCompte;
use App\Module\ServiceOperationsFinancieres\Repository\CorrespondantMouvementRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Mouvement correspondant (F10 · DSI) : un montant FCFA par mois, catégorie et compte.
 */
#[ORM\Entity(repositoryClass: CorrespondantMouvementRepository::class)]
#[ORM\Table(name: 'sof_correspondant_mouvement')]
#[ORM\Index(name: 'idx_sof_correspondant_mouvement_lot', columns: ['lot_id'])]
#[ORM\Index(name: 'idx_sof_correspondant_mouvement_sens_categorie', columns: ['sens', 'categorie'])]
#[ORM\Index(name: 'idx_sof_correspondant_mouvement_compte_mois', columns: ['compte', 'mois'])]
class CorrespondantMouvement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: LotImport::class)]
    #[ORM\JoinColumn(name: 'lot_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private LotImport $lot;

    #[ORM\Column(name: 'sens', type: Types::STRING, length: 16, enumType: SensMontantCompte::class)]
    private SensMontantCompte $sens;

    #[ORM\Column(name: 'categorie', type: Types::STRING, length: 128, nullable: true)]
    private ?string $categorie = null;

    #[ORM\Column(name: 'compte', type: Types::STRING, length: 32, nullable: true)]
    private ?string $compte = null;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255, nullable: true)]
    private ?string $libelle = null;

    #[ORM\Column(name: 'mois', type: Types::INTEGER)]
    private int $mois;

    #[ORM\Column(name: 'montant', type: Types::DECIMAL, precision: 20, scale: 2, options: ['default' => '0.00'])]
    private string $montant = '0.00';

    public function __construct(
        LotImport $lot,
        SensMontantCompte $sens,
        int $mois,
        string $montant,
        ?string $categorie = null,
        ?string $compte = null,
        ?string $libelle = null,
    ) {
        $this->lot = $lot;
        $this->sens = $sens;
        $this->mois = $mois;
        $this->montant = $montant;
        $this->categorie = $categorie;
        $this->compte = $compte;
        $this->libelle = $libelle;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getLot(): LotImport
    {
        return $this->lot;
    }

    public function getSens(): SensMontantCompte
    {
        return $this->sens;
    }

    public function getCategorie(): ?string
    {
        return $this->categorie;
    }

    public function getCompte(): ?string
    {
        return $this->compte;
    }

    public function getLibelle(): ?string
    {
        return $this->libelle;
    }

    public function getMois(): int
    {
        return $this->mois;
    }

    public function getMontant(): string
    {
        return $this->montant;
    }
}
