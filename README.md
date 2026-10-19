# Requêtes 311 — Le Plateau-Mont-Royal

Tableau de bord public présentant les requêtes adressées au service 311 de la Ville de Montréal pour l'arrondissement du Plateau-Mont-Royal, de 2022 à aujourd'hui.

**Consultation en ligne :** <https://311.gabfortin.com>

## Objet

Ce projet vise à rendre plus accessibles les données ouvertes du 311 en offrant une lecture synthétique de l'activité de l'arrondissement : volume des requêtes, nature des demandes, délais de traitement et évolution dans le temps. Il s'adresse aux citoyens, aux élus, au personnel municipal et à toute personne intéressée par la qualité des services de proximité.

## Contenu du tableau de bord

| Section | Description |
|---|---|
| **Vue d'ensemble** | Portrait global, filtrable par année, type de requête (requête, plainte, commentaire) et activité : évolution mensuelle, statuts, principales activités, canaux de contact, répartition horaire et hebdomadaire. |
| **Propreté** | Suivi mensuel de cinq catégories : dépôts illégaux, nettoyage du domaine public, collecte des ordures, du recyclage et des matières organiques. |
| **Circulation** | Suivi mensuel de six catégories : études de circulation, feux de circulation, signalisation, marquage au sol, aménagements cyclables, chaussée et trottoirs. |
| **Bilan annuel** | Comparaison de l'année en cours avec la même période de l'année précédente. |

Pour chaque catégorie des sections Propreté et Circulation, le tableau présente :

- le nombre de requêtes du mois de référence et sa variation par rapport au mois précédent, à il y a deux mois et aux mêmes mois des deux années précédentes ;
- le cumul de l'année en cours, comparé à la même période de l'année précédente ;
- le total de l'année précédente ;
- le taux de complétion, soit la proportion des requêtes au statut « Terminée ».

Ces sections permettent également de configurer des alertes de seuil, enregistrées localement dans le navigateur de l'utilisateur.

## Source des données

Les données proviennent du jeu de données **[Requêtes 311](https://donnees.montreal.ca/dataset/requete-311)** publié par la Ville de Montréal sur son portail de données ouvertes, sous licence [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.fr).

Seules les requêtes dont l'arrondissement est « Le Plateau-Mont-Royal » sont retenues.

### Mise à jour

Les données sont actualisées automatiquement chaque jour à 6 h (UTC) par un flux GitHub Actions ([`.github/workflows/refresh.yml`](.github/workflows/refresh.yml)) qui :

1. repère l'adresse du fichier CSV courant au moyen de l'API CKAN du portail ;
2. télécharge le fichier ;
3. exécute [`generate.py`](generate.py) ;
4. publie les fichiers de données régénérés s'ils ont changé.

### Mises en garde

- Le mois en cours est généralement incomplet. Dans les graphiques d'évolution, sa valeur est extrapolée au prorata des jours écoulés et signalée comme une estimation.
- Le statut d'une requête peut évoluer après sa création. Les taux de complétion des mois récents sont donc appelés à augmenter.
- Le regroupement des activités en catégories relève de choix éditoriaux propres à ce projet. Il ne correspond pas nécessairement à la classification administrative de la Ville.
- Ce projet est une initiative indépendante. Il n'est ni produit ni approuvé par la Ville de Montréal.

## Architecture

Le site est entièrement statique et hébergé sur GitHub Pages à partir du répertoire `docs/`. Le filtrage et l'agrégation s'effectuent dans le navigateur.

```
generate.py              Extraction et encodage des données (DuckDB)
docs/
  index.html             Vue d'ensemble
  proprete.html          Section Propreté
  circulation.html       Section Circulation
  annee.html             Bilan annuel
  categorie.js / .css    Logique et styles communs aux sections par catégorie
  glass.css              Thème visuel commun
  data.js, rows.js       Tables de correspondance et requêtes encodées
  proprete_data.js       Agrégats mensuels — Propreté
  circulation_data.js    Agrégats mensuels — Circulation
tests/                   Tests unitaires et d'intégrité des données
Dockerfile, entrypoint.sh  Alternative conteneurisée au flux de mise à jour
```

Les catégories et les activités qu'elles regroupent sont définies dans `generate.py` (`PROPRETE_CATS` et `CIRCULATION_CATS`).

## Utilisation locale

**Prérequis :** Python 3.9 ou plus récent.

```bash
pip install -r requirements.txt

# Télécharger le fichier CSV depuis le portail et l'enregistrer sous requetes311.csv, puis :
python3 generate.py

# Servir le site localement
python3 -m http.server 8000 --directory docs
```

Le site est alors accessible à l'adresse <http://localhost:8000>. Un serveur HTTP est nécessaire, car les pages chargent leurs données par requête réseau.

### Tests

```bash
python3 -m unittest tests.test_generate tests.test_data_integrity tests.test_dashboard_aggregation
```

Les tests vérifient l'exactitude de l'encodage sur un jeu de données synthétique, la cohérence interne des fichiers publiés et la concordance entre les données détaillées et les agrégats par catégorie.

## Contact

Toute question ou suggestion peut être soumise au moyen des [*issues*](https://github.com/gabfortin/requetes-311/issues) du dépôt.
