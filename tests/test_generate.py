"""
Teste la transformation CSV -> data.js/rows.json/proprete_data.js (generate.py)
sur un petit CSV synthétique dont chaque champ est connu, afin de vérifier que
l'encodage (mois, nature, activité, statut, provenance, jour/heure) est exact
et indépendant de l'état du vrai requetes311.csv.

Usage: python3 -m unittest tests.test_generate -v   (depuis la racine du repo)
"""

import csv
import io
import os
import sys
import tempfile
import unittest

import duckdb

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import generate as gen

CSV_HEADER = [
    "ID_UNIQUE", "NATURE", "ACTI_NOM", "TYPE_LIEU_INTERV", "RUE",
    "RUE_INTERSECTION1", "RUE_INTERSECTION2", "LOC_ERREUR_GDT", "ARRONDISSEMENT",
    "ARRONDISSEMENT_GEO", "LIN_CODE_POSTAL", "DDS_DATE_CREATION", "PROVENANCE_ORIGINALE",
    "PROVENANCE_TELEPHONE", "PROVENANCE_COURRIEL", "PROVENANCE_PERSONNE",
    "PROVENANCE_COURRIER", "PROVENANCE_TELECOPIEUR", "PROVENANCE_INSTANCE",
    "PROVENANCE_MOBILE", "PROVENANCE_MEDIASOCIAUX", "PROVENANCE_SITEINTERNET",
    "UNITE_RESP_PARENT", "LOC_LONG", "LOC_LAT", "LOC_X", "LOC_Y",
    "DERNIER_STATUT", "DATE_DERNIER_STATUT",
]

ARROND = "Le Plateau-Mont-Royal"
AUTRE_ARROND = "Ahuntsic-Cartierville"


def make_row(**kw):
    row = {c: "" for c in CSV_HEADER}
    row["ARRONDISSEMENT"] = ARROND
    row["PROVENANCE_TELEPHONE"] = "0"
    row["PROVENANCE_COURRIEL"] = "0"
    row["PROVENANCE_PERSONNE"] = "0"
    row["PROVENANCE_COURRIER"] = "0"
    row["PROVENANCE_TELECOPIEUR"] = "0"
    row["PROVENANCE_INSTANCE"] = "0"
    row["PROVENANCE_MOBILE"] = "0"
    row["PROVENANCE_MEDIASOCIAUX"] = "0"
    row["PROVENANCE_SITEINTERNET"] = "0"
    row.update(kw)
    return row


# Lignes connues, conçues pour couvrir : plusieurs mois/natures/statuts/activités,
# le remap jour de la semaine (dimanche ET samedi, les deux cas limites de WD_MAP),
# les masques de provenance multi-bits, les valeurs vides (-1), et le filtrage
# par arrondissement.
ROWS_FIXTURE = [
    make_row(  # 0: lundi 08h, téléphone seul -> prov mask = bit0 = 1
        NATURE="Requete", ACTI_NOM="Dépôt illégal - Déchets", DERNIER_STATUT="Terminée",
        DDS_DATE_CREATION="2024-03-04T08:15:00", PROVENANCE_TELEPHONE="1",
    ),
    make_row(  # 1: samedi 23h, courriel+mobile -> prov mask = bit1 | bit4 = 18
        NATURE="Plainte", ACTI_NOM="Nettoyage du domaine public", DERNIER_STATUT="Refusée",
        DDS_DATE_CREATION="2024-03-09T23:00:00", PROVENANCE_COURRIEL="1", PROVENANCE_MOBILE="1",
    ),
    make_row(  # 2: dimanche 00h30 -> cas limite WD_MAP[0]
        NATURE="Commentaire", ACTI_NOM="Collecte de déchets", DERNIER_STATUT="Terminée",
        DDS_DATE_CREATION="2024-03-10T00:30:00", PROVENANCE_SITEINTERNET="1",
    ),
    make_row(  # 3: nature/activité/statut vides -> doivent s'encoder à -1
        NATURE="", ACTI_NOM="", DERNIER_STATUT="",
        DDS_DATE_CREATION="2024-04-01T12:00:00",
    ),
    make_row(  # 4: même mois que la ligne 3, activité hors catégories propreté
        NATURE="Requete", ACTI_NOM="Bruit", DERNIER_STATUT="Terminée",
        DDS_DATE_CREATION="2024-04-15T09:00:00", PROVENANCE_TELEPHONE="1",
    ),
    make_row(  # 5: arrondissement différent -> doit être exclu par le WHERE
        NATURE="Requete", ACTI_NOM="Dépôt illégal - Déchets", DERNIER_STATUT="Terminée",
        DDS_DATE_CREATION="2024-04-02T10:00:00", ARRONDISSEMENT=AUTRE_ARROND,
    ),
]


def write_csv(path, rows):
    # QUOTE_ALL pour matcher le style du vrai requetes311.csv (champs texte
    # systématiquement entre guillemets) : sinon le sniffer de DuckDB détecte
    # "pas de guillemet" sur ce petit échantillon et diverge du comportement réel.
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_HEADER, quoting=csv.QUOTE_ALL)
        w.writeheader()
        for r in rows:
            w.writerow(r)


class TestEncoding(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.csv_path = os.path.join(self.tmpdir, "fixture.csv")
        write_csv(self.csv_path, ROWS_FIXTURE)
        self.con = duckdb.connect()
        self.raw = gen.query_raw(self.con, self.csv_path)

    def test_arrondissement_filter_excludes_other_boroughs(self):
        # 6 lignes dans le fixture, 1 dans un autre arrondissement -> 5 conservées
        self.assertEqual(len(self.raw), 5)

    def test_lookups_contain_expected_values(self):
        months, natures, activities, statuses = gen.build_lookups(self.raw)
        self.assertEqual(months, ["2024-03", "2024-04"])
        self.assertEqual(natures, ["Commentaire", "Plainte", "Requete"])
        self.assertEqual(statuses, ["Refusée", "Terminée"])
        self.assertIn("Dépôt illégal - Déchets", activities)
        self.assertIn("Bruit", activities)
        # la ligne à activité vide ne doit pas créer d'entrée fantôme
        self.assertNotIn("", activities)

    def test_weekday_remap_handles_sunday_and_saturday_edge_cases(self):
        months, natures, activities, statuses = gen.build_lookups(self.raw)
        encoded = gen.encode_rows(self.raw, months, natures, activities, statuses)
        by_date = {tuple(r[:1]): r for r in encoded}  # juste pour debug si besoin

        # lundi 2024-03-04 -> index 0 (Lundi)
        mon_rows = [r for r in encoded if r[0] == months.index("2024-03") and r[6] == 8]
        self.assertEqual(len(mon_rows), 1)
        self.assertEqual(mon_rows[0][5], 0, "lundi doit mapper à l'index 0")

        # samedi 2024-03-09 23h -> index 5 (Samedi)
        sat_rows = [r for r in encoded if r[6] == 23]
        self.assertEqual(len(sat_rows), 1)
        self.assertEqual(sat_rows[0][5], 5, "samedi doit mapper à l'index 5")

        # dimanche 2024-03-10 00h30 -> index 6 (Dimanche), cas limite WD_MAP[0]
        sun_rows = [r for r in encoded if r[6] == 0]
        self.assertEqual(len(sun_rows), 1)
        self.assertEqual(sun_rows[0][5], 6, "dimanche doit mapper à l'index 6 (pas 0)")

    def test_provenance_bitmask_is_correct(self):
        months, natures, activities, statuses = gen.build_lookups(self.raw)
        encoded = gen.encode_rows(self.raw, months, natures, activities, statuses)

        tel_only = [r for r in encoded if r[6] == 8][0]
        self.assertEqual(tel_only[4], 1, "téléphone seul -> bit 0 -> mask 1")

        courriel_mobile = [r for r in encoded if r[6] == 23][0]
        self.assertEqual(courriel_mobile[4], 0b10010, "courriel+mobile -> bits 1 et 4 -> mask 18")

    def test_empty_fields_encode_to_minus_one(self):
        months, natures, activities, statuses = gen.build_lookups(self.raw)
        encoded = gen.encode_rows(self.raw, months, natures, activities, statuses)

        empty_row = [r for r in encoded if r[6] == 12][0]  # ligne 3, 12h00
        self.assertEqual(empty_row[1], -1, "nature vide -> -1")
        self.assertEqual(empty_row[2], -1, "activité vide -> -1")
        self.assertEqual(empty_row[3], -1, "statut vide -> -1")

    def test_row_count_matches_filtered_input(self):
        months, natures, activities, statuses = gen.build_lookups(self.raw)
        encoded = gen.encode_rows(self.raw, months, natures, activities, statuses)
        self.assertEqual(len(encoded), len(self.raw))

    def test_all_encoded_indices_are_in_range(self):
        months, natures, activities, statuses = gen.build_lookups(self.raw)
        encoded = gen.encode_rows(self.raw, months, natures, activities, statuses)
        for mi, ni, ai, si, prov, wd, h in encoded:
            self.assertTrue(-1 <= mi < len(months))
            self.assertTrue(-1 <= ni < len(natures))
            self.assertTrue(-1 <= ai < len(activities))
            self.assertTrue(-1 <= si < len(statuses))
            self.assertTrue(0 <= wd <= 6)
            self.assertTrue(0 <= h <= 23)


class TestMalformedCsvTolerance(unittest.TestCase):
    """Reproduit le vrai problème rencontré sur requetes311.csv : une ligne avec
    un guillemet non terminé ne doit pas faire planter tout le chargement."""

    def test_ignore_errors_skips_bad_line_without_losing_good_rows(self):
        tmpdir = tempfile.mkdtemp()
        csv_path = os.path.join(tmpdir, "fixture_malformed.csv")
        # Le sniffer CSV de DuckDB détecte le dialecte sur un échantillon des
        # 20480 premières lignes. Sur le vrai fichier (470k lignes), la ligne
        # corrompue tombe largement après cet échantillon, donc le sniffing
        # réussit sur des données propres puis ignore_errors=true élimine la
        # ligne corrompue pendant le parsing complet. On reproduit ça en
        # dépassant ce seuil avec des lignes valides répétées.
        n_repeats = 7000  # 7000 * 3 = 21000 lignes valides > 20480
        write_csv(csv_path, ROWS_FIXTURE[:3] * n_repeats)

        with open(csv_path, "a", encoding="utf-8") as f:
            f.write(',"Information","Taxes fon\n')

        con = duckdb.connect()
        # Ne doit pas lever d'exception malgré la ligne corrompue
        raw = gen.query_raw(con, csv_path)
        self.assertEqual(len(raw), 3 * n_repeats,
                          "toutes les lignes valides doivent rester malgré la ligne corrompue")


class TestProprete(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.csv_path = os.path.join(self.tmpdir, "fixture.csv")
        write_csv(self.csv_path, ROWS_FIXTURE)
        self.con = duckdb.connect()

    def test_proprete_categorization_matches_known_activities(self):
        data = gen.build_proprete_data(self.con, self.csv_path)

        # Ligne 0 : "Dépôt illégal - Déchets", 2024-03, statut Terminée
        self.assertEqual(data["2024-03"]["depots"], {"t": 1, "d": 1})
        # Ligne 1 : "Nettoyage du domaine public", 2024-03, statut Refusée
        self.assertEqual(data["2024-03"]["nettoyage"], {"t": 1, "d": 0})
        # Ligne 2 : "Collecte de déchets", 2024-03, statut Terminée
        self.assertEqual(data["2024-03"]["ordures"], {"t": 1, "d": 1})

    def test_activities_outside_categories_are_not_counted(self):
        data = gen.build_proprete_data(self.con, self.csv_path)
        # "Bruit" (ligne 4) n'appartient à aucune catégorie propreté
        self.assertNotIn("recyclage", data.get("2024-04", {}))
        self.assertNotIn("organiques", data.get("2024-04", {}))

    def test_other_borough_excluded_from_proprete_data(self):
        data = gen.build_proprete_data(self.con, self.csv_path)
        # Ligne 5 (autre arrondissement, même activité que la ligne 0) ne doit
        # pas faire gonfler le total "depots" de mars/avril au-delà de 1.
        total_depots = sum(m.get("depots", {}).get("t", 0) for m in data.values())
        self.assertEqual(total_depots, 1)


if __name__ == "__main__":
    unittest.main()
