# GESPOF

**Gestion des Prévisions et des Opérations Financières**

Application métier de la **Direction des Opérations Monétaires et Financières (DOMF)** pour piloter, depuis un portail unique et sécurisé, les prévisions de trésorerie, les opérations financières et les règlements.

---

## Présentation

GESPOF regroupe en une seule plateforme web les outils auparavant dispersés entre les services de la DOMF. Chaque agent accède, selon son rôle, à un **portail métier** dédié, avec une interface adaptée à son activité quotidienne.

L’application est organisée en deux parties :

| Dossier | Rôle | Stack |
|---------|------|--------|
| `gespof-app-frontend` | Interface utilisateur (portails, tableaux, fiches) | React, TypeScript, Vite |
| `gespof-app-backend` | API métier, persistance, exports Excel, sécurité JWT | PHP 8.3+, Symfony 7, Doctrine |

Quatre portails composent l’expérience :

- **SOF** — Service des Opérations Financières : saisies, règlements, compensation, extractions SROT.
- **SP** — Service de Prévision : journées de trésorerie, fiches (bleue, d’exécution, de dépôt), rapprochements, tableaux de bord.
- **SR** — Service Règlement (Pool SR) : génération et transmission des fiches de dépôt (Systac, Sigma, Numéraire) vers le SP.
- **Admin** — Administration système : utilisateurs, rôles et paramètres transverses.

---

## But du projet

GESPOF vise à :

1. **Centraliser** le suivi des opérations monétaires et financières de la DOMF.
2. **Sécuriser** les flux (authentification, droits d’accès par rôle, audit des actions et connexions).
3. **Fluidifier** la collaboration entre services — notamment le cycle fiche de dépôt (SR → SP), le rapprochement recettes/dépenses et la clôture des journées de trésorerie.
4. **Fiabiliser** la production des documents et indicateurs (exports Excel, historiques, audit journalier).

En résumé : offrir à la DOMF un outil unique pour **prévoir, exécuter, régler et contrôler** les opérations de trésorerie.

---

## Pour qui ?

| Public | Usage |
|--------|--------|
| **Agents SOF** | Opérations financières, extractions et suivis métier |
| **Agents SP** | Prévision, journées de trésorerie, fiches et rapprochements |
| **Agents SR** | Génération et envoi des fiches de dépôt |
| **Administrateurs** | Gestion des comptes, des rôles et du paramétrage |
| **Encadrement DOMF** | Vision consolidée via les tableaux de bord et l’audit |

L’accès se fait par compte nominatif ; chaque utilisateur ne voit que les portails et fonctions autorisés pour son profil.

---

## Structure du dépôt

```
GESPOF-APP/
├── gespof-app-frontend/   # Application React (UI)
├── gespof-app-backend/    # API Symfony
└── README.md
```

Les fichiers d’environnement (`.env`) et la clé JWT privée ne sont pas versionnés : configurer localement à partir des exemples fournis dans chaque projet le cas échéant.
