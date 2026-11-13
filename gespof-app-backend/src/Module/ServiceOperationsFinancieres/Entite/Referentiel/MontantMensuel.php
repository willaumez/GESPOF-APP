<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Enum\OrigineMontantMensuel;
use App\Module\ServiceOperationsFinancieres\Repository\MontantMensuelRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Montant mensuel par rubrique (plan phase 1 — montant_mensuel).
 */
#[ORM\Entity(repositoryClass: MontantMensuelRepository::class)]
#[ORM\Table(name: 'sof_montant_mensuel')]
#[ORM\UniqueConstraint(
    name: 'uniq_sof_montant_mensuel',
    columns: ['exercice_annee', 'rubrique_code', 'mois', 'origine'],
)]
#[ORM\Index(name: 'idx_sof_montant_mensuel_exercice_mois', columns: ['exercice_annee', 'mois'])]
class MontantMensuel
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'exercice_annee', type: Types::INTEGER)]
    private int $exerciceAnnee;

    #[ORM\Column(name: 'rubrique_code', type: Types::STRING, length: 16)]
    private string $rubriqueCode;

    #[ORM\Column(name: 'mois', type: Types::INTEGER)]
    private int $mois;

    #[ORM\Column(name: 'origine', type: Types::STRING, length: 16, enumType: OrigineMontantMensuel::class)]
    private OrigineMontantMensuel $origine;

    #[ORM\Column(name: 'montant', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montant = '0.00';

    public function __construct(
        int $exerciceAnnee,
        string $rubriqueCode,
        int $mois,
        OrigineMontantMensuel $origine,
        string $montant = '0.00',
    ) {
        $this->exerciceAnnee = $exerciceAnnee;
        $this->rubriqueCode = $rubriqueCode;
        $this->mois = $mois;
        $this->origine = $origine;
        $this->montant = $montant;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getExerciceAnnee(): int
    {
        return $this->exerciceAnnee;
    }

    public function getRubriqueCode(): string
    {
        return $this->rubriqueCode;
    }

    public function getMois(): int
    {
        return $this->mois;
    }

    public function getOrigine(): OrigineMontantMensuel
    {
        return $this->origine;
    }

    public function getMontant(): string
    {
        return $this->montant;
    }

    public function setMontant(string $montant): static
    {
        $this->montant = $montant;

        return $this;
    }
}
