# Modèles de fichiers

## Fiche de dépôt

- **Fichier** : `FICHE_DE_DEPOT_MODELE_CORRIGE.xlsx`
- **Usage** : modèle exact chargé par `FicheDepotExcelGenerator` via `AppConfig::modeleFicheDepotPath()`.
- **Référence métier** : format aligné sur les fiches réelles du Pool DR (ex. `FICHE DE DEPOT DU 17 07 2026.xlsx`).

Ne pas renommer ce fichier sans mettre à jour `AppConfig::modeleFicheDepotPath()`.
