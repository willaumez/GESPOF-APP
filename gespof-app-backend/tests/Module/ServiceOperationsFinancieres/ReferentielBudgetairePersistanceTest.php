<?php

declare(strict_types=1);

namespace App\Tests\Module\ServiceOperationsFinancieres;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\Recette;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\RubriqueRecette;
use App\Module\ServiceOperationsFinancieres\Enum\SectionRecette;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class ReferentielBudgetairePersistanceTest extends KernelTestCase
{
    private EntityManagerInterface $em;

    protected static function getKernelClass(): string
    {
        return \App\Kernel::class;
    }

    protected function setUp(): void
    {
        self::bootKernel();
        $this->em = self::getContainer()->get('doctrine')->getManager();
        $this->em->beginTransaction();
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->rollback();
        }
        $this->em->close();
        parent::tearDown();
    }

    public function testPersistanceRacineEtEnfantCalculeLeNiveau(): void
    {
        $suffixe = substr(bin2hex(random_bytes(3)), 0, 6);
        $codeRacine = 'R'.$suffixe;
        $codeEnfant = 'E'.$suffixe;

        $racine = new RubriqueRecette($codeRacine, 'Racine test', SectionRecette::PETROLE, null, true);
        $enfant = new RubriqueRecette($codeEnfant, 'Enfant test', SectionRecette::PETROLE, $racine);

        $this->em->persist($racine);
        $this->em->persist($enfant);
        $this->em->flush();
        $this->em->clear();

        $racineRelue = $this->em->find(RubriqueRecette::class, $codeRacine);
        $enfantRelu = $this->em->find(RubriqueRecette::class, $codeEnfant);

        self::assertInstanceOf(RubriqueRecette::class, $racineRelue);
        self::assertInstanceOf(RubriqueRecette::class, $enfantRelu);
        self::assertSame(1, $racineRelue->getNiveau());
        self::assertTrue($racineRelue->estRacine());
        self::assertSame(2, $enfantRelu->getNiveau());
        self::assertSame($codeRacine, $enfantRelu->getParent()?->getCode());
    }

    public function testInsertionDupliqueeRecetteEstRejetee(): void
    {
        $suffixe = substr(bin2hex(random_bytes(3)), 0, 6);
        $annee = 1900 + random_int(0, 99);
        $rubrique = new RubriqueRecette('U'.$suffixe, 'Rubrique unique', SectionRecette::EMPRUNT);
        $exercice = new Exercice($annee, '0.00');

        $this->em->persist($rubrique);
        $this->em->persist($exercice);
        $this->em->persist(new Recette($exercice, $rubrique, 3, '10.00', '0.00'));
        $this->em->flush();

        $this->em->persist(new Recette($exercice, $rubrique, 3, '20.00', '0.00'));

        try {
            $this->em->flush();
            self::fail('Une duplication (exercice, rubrique, mois) aurait dû être rejetée.');
        } catch (UniqueConstraintViolationException) {
            $this->addToAssertionCount(1);
        }
    }
}
