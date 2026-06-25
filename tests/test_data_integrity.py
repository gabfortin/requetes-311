"""
Vérifie l'intégrité des données déjà générées dans docs/ (data.js, rows.json,
proprete_data.js) : bornes d'index valides, cohérence interne, et surtout
cohérence CROISÉE entre les deux pipelines indépendants de generate.py
(ROWS d'un côté, PROPRETE_DATA de l'autre) qui dérivent tous les deux du même
CSV source mais sont calculés par des requêtes SQL séparées.

Usage: python3 -m unittest tests.test_data_integrity -v   (depuis la racine du repo)
"""

import json
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import generate as gen

DOCS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")


def extract_var(js_text, varname):
    m = re.search(rf"var {varname}=(.*?);\n", js_text)
    if not m:
        raise AssertionError(f"var {varname} introuvable")
    return json.loads(m.group(1))


class TestDataFiles(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(DOCS_DIR, "data.js"), encoding="utf-8") as f:
            data_js = f.read()
        cls.MONTHS      = extract_var(data_js, "MONTHS")
        cls.NATURES     = extract_var(data_js, "NATURES")
        cls.ACTIVITIES  = extract_var(data_js, "ACTIVITIES")
        cls.STATUSES    = extract_var(data_js, "STATUSES")
        cls.WEEKDAYS    = extract_var(data_js, "WEEKDAYS")
        cls.PROV_LABELS = extract_var(data_js, "PROV_LABELS")
        with open(os.path.join(DOCS_DIR, "rows.json"), encoding="utf-8") as f:
            cls.ROWS = json.load(f)
        with open(os.path.join(DOCS_DIR, "proprete_data.js"), encoding="utf-8") as f:
            proprete_js = f.read()
        cls.PROPRETE_CATS  = extract_var(proprete_js, "PROPRETE_CATS")
        cls.PROPRETE_MONTHS = extract_var(proprete_js, "PROPRETE_MONTHS")
        cls.PROPRETE_DATA  = extract_var(proprete_js, "PROPRETE_DATA")

    # ── Lookup tables ───────────────────────────────────────────────────────────
    def test_months_are_sorted_and_unique(self):
        self.assertEqual(self.MONTHS, sorted(self.MONTHS))
        self.assertEqual(len(self.MONTHS), len(set(self.MONTHS)))

    def test_no_duplicate_lookups(self):
        for name, arr in [("NATURES", self.NATURES), ("ACTIVITIES", self.ACTIVITIES),
                           ("STATUSES", self.STATUSES)]:
            self.assertEqual(len(arr), len(set(arr)), f"{name} contient des doublons")

    def test_weekdays_has_7_entries(self):
        self.assertEqual(len(self.WEEKDAYS), 7)

    # ── ROWS ────────────────────────────────────────────────────────────────────
    def test_rows_indices_within_bounds(self):
        for mi, ni, ai, si, prov, wd, h in self.ROWS:
            self.assertTrue(-1 <= mi < len(self.MONTHS), f"month_idx hors bornes: {mi}")
            self.assertTrue(-1 <= ni < len(self.NATURES), f"nature_idx hors bornes: {ni}")
            self.assertTrue(-1 <= ai < len(self.ACTIVITIES), f"acti_idx hors bornes: {ai}")
            self.assertTrue(-1 <= si < len(self.STATUSES), f"status_idx hors bornes: {si}")
            self.assertTrue(0 <= prov < (1 << len(self.PROV_LABELS)), f"prov_mask hors bornes: {prov}")
            self.assertTrue(0 <= wd <= 6, f"weekday hors bornes: {wd}")
            self.assertTrue(0 <= h <= 23, f"hour hors bornes: {h}")

    def test_rows_not_empty(self):
        self.assertGreater(len(self.ROWS), 0)

    def test_every_month_in_lookup_has_at_least_one_row(self):
        used_months = {row[0] for row in self.ROWS}
        missing = [i for i in range(len(self.MONTHS)) if i not in used_months]
        self.assertEqual(missing, [], f"mois sans aucune requête : {[self.MONTHS[i] for i in missing]}")

    # ── Cohérence croisée ROWS <-> PROPRETE_DATA ────────────────────────────────
    # generate.py calcule ROWS et PROPRETE_DATA via deux requêtes SQL séparées.
    # Si la liste d'activités d'une catégorie propreté est mal orthographiée ou
    # désynchronisée de ACTIVITIES, ce test le détecte : on recompte les
    # activités de chaque catégorie à partir de ROWS et on compare à PROPRETE_DATA.
    def test_proprete_data_matches_rows_recount(self):
        # PROPRETE_CATS (le méta-fichier JS) n'a pas la liste d'activités par
        # catégorie ; on la reprend de generate.py, la source de vérité.
        acti_to_cat = {}
        for cat in gen.PROPRETE_CATS:
            for acti in cat["activities"]:
                acti_to_cat[acti] = cat["id"]

        acti_idx_to_cat = {}
        for i, label in enumerate(self.ACTIVITIES):
            if label in acti_to_cat:
                acti_idx_to_cat[i] = acti_to_cat[label]

        term_idx = self.STATUSES.index("Terminée")
        recount = {}  # {month: {cat_id: {"t":, "d":}}}
        for mi, ni, ai, si, prov, wd, h in self.ROWS:
            cat_id = acti_idx_to_cat.get(ai)
            if cat_id is None:
                continue
            month = self.MONTHS[mi]
            bucket = recount.setdefault(month, {}).setdefault(cat_id, {"t": 0, "d": 0})
            bucket["t"] += 1
            if si == term_idx:
                bucket["d"] += 1

        # Comparer uniquement les mois présents dans PROPRETE_DATA (recount peut
        # avoir des mois supplémentaires si PROPRETE_DATA a été régénéré séparément).
        mismatches = []
        for month, cats in self.PROPRETE_DATA.items():
            for cat_id, vals in cats.items():
                got = recount.get(month, {}).get(cat_id, {"t": 0, "d": 0})
                if got != vals:
                    mismatches.append((month, cat_id, vals, got))

        self.assertEqual(mismatches, [],
                          f"Désaccord ROWS vs PROPRETE_DATA (attendu, recalculé) : {mismatches[:10]}")

    def test_proprete_activities_lists_exist_in_activities_lookup(self):
        # Si une activité listée dans generate.py:PROPRETE_CATS est mal orthographiée,
        # elle n'apparaîtra jamais dans ACTIVITIES et la catégorie sera silencieusement vide.
        missing = []
        for cat in gen.PROPRETE_CATS:
            for acti in cat["activities"]:
                if acti not in self.ACTIVITIES:
                    missing.append((cat["id"], acti))
        self.assertEqual(missing, [], f"activités propreté absentes de ACTIVITIES : {missing}")

    def test_proprete_months_are_subset_of_months(self):
        self.assertTrue(set(self.PROPRETE_MONTHS) <= set(self.MONTHS))


if __name__ == "__main__":
    unittest.main()
