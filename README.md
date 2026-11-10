# Requêtes 311 — Le Plateau-Mont-Royal

Tableau de bord public des requêtes adressées au service 311 de la Ville de
Montréal pour l'arrondissement du Plateau-Mont-Royal, de 2022 à aujourd'hui :
volume, nature des demandes, délais de traitement et évolution dans le temps.
Pour les citoyen·nes, les élu·es, le personnel municipal et toute personne
intéressée par la qualité des services de proximité.

**En ligne :** [311.gabfortin.com](https://311.gabfortin.com)

## Contenu

| Section | Ce qu'elle montre |
|---|---|
| **Vue d'ensemble** | Portrait global, filtrable par année, type de requête (requête, plainte, commentaire) et activité : évolution mensuelle, statuts, principales activités, canaux de contact, répartition horaire et hebdomadaire. |
| **Propreté** | Suivi mensuel de cinq catégories : dépôts illégaux, nettoyage du domaine public, collecte des ordures, du recyclage et des matières organiques. |
| **Circulation** | Suivi mensuel de six catégories : études de circulation, feux de circulation, signalisation, marquage au sol, aménagements cyclables, chaussée et trottoirs. |
| **Bilan annuel** | L'année en cours comparée à la même période de l'année précédente. |

Pour chaque catégorie de Propreté et de Circulation : le nombre de requêtes du
mois de référence et sa variation (mois précédent, il y a deux mois, mêmes
mois des deux années précédentes), le cumul de l'année comparé à la même
période de l'année précédente, le total de l'année précédente et le taux de
complétion (part des requêtes au statut « Terminée »). Ces sections permettent
aussi de configurer des alertes de seuil, gardées dans le navigateur.

## Données

### Sources

| Source | Producteur, licence | Utilisée pour |
|---|---|---|
| [Requêtes 311](https://donnees.montreal.ca/dataset/requete-311) | Ville de Montréal, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.fr) | Tout le site : seules les requêtes de l'arrondissement « Le Plateau-Mont-Royal » sont retenues |

### Mise à jour

**Automatique**, chaque jour à 6 h (UTC), par
[`.github/workflows/refresh.yml`](.github/workflows/refresh.yml) :

1. trouve l'adresse du fichier CSV courant avec l'API CKAN du portail ;
2. télécharge le fichier ;
3. lance [`generate.py`](generate.py) ;
4. si les données ont changé : ajoute 1 à z de la version et inscrit la date
   du jour dans `docs/version.js` ([`scripts/bump_version.sh`](scripts/bump_version.sh),
   aussi utilisé par `entrypoint.sh`), commite
   (`data: mise à jour quotidienne (AAAA-MM-JJ, vX.Y.Z)`) et publie.

La date des données s'affiche sous la barre du haut de chaque page, la
version dans le bas de page.

**À la main**, avec le CSV téléchargé depuis le portail et enregistré sous
`requetes311.csv` :

```bash
pip install -r requirements.txt
python3 generate.py
```

Une alternative conteneurisée au robot existe (`Dockerfile`, `entrypoint.sh`).

### Mises en garde

- Le mois en cours est généralement incomplet. Dans les graphiques
  d'évolution, sa valeur est extrapolée au prorata des jours écoulés et
  signalée comme une estimation.
- Le statut d'une requête peut évoluer après sa création : les taux de
  complétion des mois récents sont appelés à augmenter.
- Le regroupement des activités en catégories relève de choix éditoriaux
  propres à ce projet. Il ne correspond pas nécessairement à la
  classification administrative de la Ville. Les catégories et les activités
  qu'elles regroupent sont définies dans `generate.py` (`PROPRETE_CATS` et
  `CIRCULATION_CATS`).
- Initiative indépendante : ni produite ni approuvée par la Ville de Montréal.

## Utilisation locale

**Prérequis :** Python 3.9 ou plus récent.

```bash
python3 -m http.server 8000 --directory docs   # http://localhost:8000
```

Un serveur est nécessaire : les pages chargent leurs données par requête réseau.

## Tests

```bash
python3 -m unittest tests.test_generate tests.test_data_integrity tests.test_dashboard_aggregation
```

- `test_generate` : exactitude de l'encodage, sur un jeu de données synthétique ;
- `test_data_integrity` : cohérence interne des fichiers publiés ;
- `test_dashboard_aggregation` : concordance entre les données détaillées et
  les agrégats par catégorie.

## Architecture

```
requetes311.csv → generate.py (DuckDB) → docs/*_data.js, data.js, rows.js → pages de docs/ (statiques)
```

Le site est entièrement statique, servi depuis `docs/`. Le filtrage et
l'agrégation se font dans le navigateur.

| Fichier | Rôle |
|---|---|
| `generate.py` | Extraction et encodage des données (DuckDB) |
| `docs/index.html` | Vue d'ensemble |
| `docs/proprete.html`, `docs/circulation.html` | Sections par catégorie |
| `docs/annee.html` | Bilan annuel |
| `docs/categorie.js`, `docs/categorie.css` | Logique et styles communs aux sections par catégorie |
| `docs/glass.css` | Thème visuel (style B, comme compteurvelo.com), mode clair et sombre |
| `docs/chart-theme.js` | Couleurs des graphiques lues depuis `glass.css` |
| `docs/apropos.js` | Bouton « i » et fenêtre « À propos » (composant commun) |
| `docs/confidentialite.html` | Politique de confidentialité |
| `docs/data.js`, `docs/rows.js` | Tables de correspondance et requêtes encodées (générés) |
| `docs/proprete_data.js`, `docs/circulation_data.js` | Agrégats mensuels par catégorie (générés) |
| `docs/version.js` | Version du site et date des données (écrit par le robot et par le hook de version) |
| `docs/img/` | Photo de l'auteur (barre du haut) |
| `scripts/bump_version.sh` | Ajoute 1 à z de la version (robot et Docker) |
| `tests/` | Tests unitaires et d'intégrité des données |
| `Dockerfile`, `entrypoint.sh` | Alternative conteneurisée au robot |

Style B de [DESIGN-PAGES.md](../DESIGN-PAGES.md). Composants communs :
`.communs.json`.

## Publication

GitHub Pages, branche `main`, dossier `docs/` (domaine dans `docs/CNAME`).
Version x.y.z et `?v=` écrits par le hook de commit (`.version.json`). Le robot
a besoin de *Settings → Actions → General → Workflow permissions → Read and
write permissions*.

## Confidentialité

Aucun cookie ni compte.

| Quand | Ce qui est envoyé | À qui |
|---|---|---|
| Chaque visite | Page, site d'origine, appareil, pays | GoatCounter (mesure d'audience anonyme) |

Les réglages de période et d'alertes restent dans le `localStorage` du
navigateur. Détails : [docs/confidentialite.html](docs/confidentialite.html),
à mettre à jour (avec sa date) si un service externe est ajouté.

## Crédits

- [Chart.js](https://www.chartjs.org) 4.4.4 (MIT), chargé depuis jsDelivr
- [DuckDB](https://duckdb.org) (MIT), pour `generate.py`
- Données © Ville de Montréal (CC BY 4.0)

## Auteur

Développé par [Gabriel Fortin](https://gabfortin.com). Questions et
suggestions : [issues](https://github.com/gabfortin/requetes-311/issues).
