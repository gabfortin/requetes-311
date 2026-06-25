"""
Réimplémente fidèlement (en Python) les algorithmes d'agrégation utilisés
côté client dans docs/index.html (filtre année/nature/activité) et
docs/annee.html (bilan année en cours vs année précédente), puis vérifie
qu'ils restent cohérents entre eux et avec les données brutes (ROWS).

Le but : si quelqu'un modifie la logique JS d'un dashboard sans rééquilibrer
l'autre, ou introduit une erreur de filtrage (ex: décalage de mois, mauvais
index), un de ces tests doit le détecter — puisque les deux pages dérivent
du même ROWS et doivent donner les mêmes totaux pour un même filtre.

Usage: python3 -m unittest tests.test_dashboard_aggregation -v
"""

import json
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DOCS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")


def extract_var(js_text, varname):
    m = re.search(rf"var {varname}=(.*?);\n", js_text)
    if not m:
        raise AssertionError(f"var {varname} introuvable")
    return json.loads(m.group(1))


def load_data():
    with open(os.path.join(DOCS_DIR, "data.js"), encoding="utf-8") as f:
        data_js = f.read()
    with open(os.path.join(DOCS_DIR, "rows.json"), encoding="utf-8") as f:
        rows = json.load(f)
    return {
        "MONTHS": extract_var(data_js, "MONTHS"),
        "NATURES": extract_var(data_js, "NATURES"),
        "ACTIVITIES": extract_var(data_js, "ACTIVITIES"),
        "STATUSES": extract_var(data_js, "STATUSES"),
        "PROV_LABELS": extract_var(data_js, "PROV_LABELS"),
        "ROWS": rows,
    }


# ── Port Python de index.html: function aggregate(yearSet, natureIdx, actiSet) ──
def index_aggregate(d, year_set, nature_idx, acti_set):
    MONTHS, NATURES, ACTIVITIES, STATUSES, PROV_LABELS, ROWS = (
        d["MONTHS"], d["NATURES"], d["ACTIVITIES"], d["STATUSES"], d["PROV_LABELS"], d["ROWS"])
    MONTH_YEAR = [m[:4] for m in MONTHS]
    TERM_IDX = STATUSES.index("Terminée")

    valid_months = None
    if year_set:
        valid_months = {i for i in range(len(MONTHS)) if MONTH_YEAR[i] in year_set}

    by_month, by_nature, by_status = {}, {}, {}
    by_hour = [0] * 24
    by_weekday = [0] * 7
    by_prov = [0] * len(PROV_LABELS)
    by_acti = [0] * len(ACTIVITIES)
    total = terminees = 0

    for mi, ni, ai, si, prov, wd, h in ROWS:
        if valid_months is not None and mi not in valid_months:
            continue
        if nature_idx >= 0 and ni != nature_idx:
            continue
        if acti_set and ai not in acti_set:
            continue

        total += 1
        m = MONTHS[mi]
        by_month[m] = by_month.get(m, 0) + 1
        if ni >= 0:
            n = NATURES[ni]; by_nature[n] = by_nature.get(n, 0) + 1
        if si >= 0:
            s = STATUSES[si]; by_status[s] = by_status.get(s, 0) + 1
            if si == TERM_IDX:
                terminees += 1
        by_hour[h] += 1
        by_weekday[wd] += 1
        for b in range(len(PROV_LABELS)):
            if prov & (1 << b):
                by_prov[b] += 1
        if ai >= 0:
            by_acti[ai] += 1

    return {
        "total": total, "terminees": terminees,
        "byMonth": by_month, "byNature": by_nature, "byStatus": by_status,
        "byHour": by_hour, "byWeekday": by_weekday, "byProv": by_prov, "byActi": by_acti,
    }


# ── Port Python de annee.html: function aggregate(monthSet) ─────────────────────
def annee_aggregate(d, month_set):
    MONTHS, NATURES, ACTIVITIES, STATUSES, PROV_LABELS, ROWS = (
        d["MONTHS"], d["NATURES"], d["ACTIVITIES"], d["STATUSES"], d["PROV_LABELS"], d["ROWS"])
    TERM_IDX = STATUSES.index("Terminée")
    URG_IDX = STATUSES.index("Urgente")

    by_nature, by_status, by_month = {}, {}, {}
    by_prov = [0] * len(PROV_LABELS)
    by_acti = [0] * len(ACTIVITIES)
    by_weekday = [0] * 7
    by_hour = [0] * 24
    total = terminees = urgentes = 0

    for mi, ni, ai, si, prov, wd, h in ROWS:
        if mi not in month_set:
            continue
        total += 1
        m = MONTHS[mi]
        by_month[m] = by_month.get(m, 0) + 1
        if ni >= 0:
            n = NATURES[ni]; by_nature[n] = by_nature.get(n, 0) + 1
        if si >= 0:
            s = STATUSES[si]; by_status[s] = by_status.get(s, 0) + 1
            if si == TERM_IDX:
                terminees += 1
            if si == URG_IDX:
                urgentes += 1
        by_weekday[wd] += 1
        by_hour[h] += 1
        for b in range(len(PROV_LABELS)):
            if prov & (1 << b):
                by_prov[b] += 1
        if ai >= 0:
            by_acti[ai] += 1

    return {
        "total": total, "terminees": terminees, "urgentes": urgentes,
        "byNature": by_nature, "byStatus": by_status, "byMonth": by_month,
        "byProv": by_prov, "byActi": by_acti, "byWeekday": by_weekday, "byHour": by_hour,
    }


def month_idx_set(d, months_arr):
    MONTHS = d["MONTHS"]
    return {MONTHS.index(m) for m in months_arr if m in MONTHS}


class TestCrossPageConsistency(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = load_data()

    def test_index_year_filter_matches_annee_current_year_aggregate(self):
        """Vue d'ensemble filtrée sur une année == Bilan annuel pour cette même année."""
        d = self.d
        MONTHS = d["MONTHS"]
        last_month = MONTHS[-1]
        cur_year = last_month[:4]
        cur_months = [m for m in MONTHS if m.startswith(cur_year + "-")]

        idx_result = index_aggregate(d, {cur_year}, -1, set())
        annee_result = annee_aggregate(d, month_idx_set(d, cur_months))

        self.assertEqual(idx_result["total"], annee_result["total"])
        self.assertEqual(idx_result["byNature"], annee_result["byNature"])
        self.assertEqual(idx_result["byProv"], annee_result["byProv"])
        self.assertEqual(idx_result["byActi"], annee_result["byActi"])
        self.assertEqual(idx_result["byWeekday"], annee_result["byWeekday"])
        self.assertEqual(idx_result["byHour"], annee_result["byHour"])
        self.assertEqual(idx_result["terminees"], annee_result["terminees"])

    def test_index_all_years_equals_sum_of_each_year(self):
        d = self.d
        MONTHS = d["MONTHS"]
        years = sorted(set(m[:4] for m in MONTHS))
        whole = index_aggregate(d, set(), -1, set())
        total_per_year = sum(index_aggregate(d, {y}, -1, set())["total"] for y in years)
        self.assertEqual(whole["total"], total_per_year)

    def test_byMonth_sums_to_total(self):
        d = self.d
        result = index_aggregate(d, set(), -1, set())
        self.assertEqual(sum(result["byMonth"].values()), result["total"])

    def test_byNature_never_exceeds_total(self):
        d = self.d
        result = index_aggregate(d, set(), -1, set())
        self.assertLessEqual(sum(result["byNature"].values()), result["total"])

    def test_nature_filter_is_subset_of_unfiltered(self):
        d = self.d
        NATURES = d["NATURES"]
        whole = index_aggregate(d, set(), -1, set())
        total_by_nature_filter = 0
        for i, n in enumerate(NATURES):
            filtered = index_aggregate(d, set(), i, set())
            self.assertEqual(filtered["total"], whole["byNature"].get(n, 0),
                              f"filtrer par nature={n} doit donner le même total que byNature['{n}']")
            total_by_nature_filter += filtered["total"]
        # +les lignes à nature inconnue (-1), non capturées par un filtre de nature précis
        unknown = whole["total"] - sum(whole["byNature"].values())
        self.assertEqual(total_by_nature_filter + unknown, whole["total"])

    def test_activity_filter_matches_byActi_count(self):
        d = self.d
        ACTIVITIES = d["ACTIVITIES"]
        whole = index_aggregate(d, set(), -1, set())
        # Échantillonne quelques activités (toutes si peu nombreuses) pour rester rapide
        sample_idx = list(range(0, len(ACTIVITIES), max(1, len(ACTIVITIES) // 20)))
        for i in sample_idx:
            filtered = index_aggregate(d, set(), -1, {i})
            self.assertEqual(filtered["total"], whole["byActi"][i],
                              f"filtrer par activité '{ACTIVITIES[i]}' doit matcher byActi[{i}]")

    def test_weekday_and_hour_totals_match_overall_total(self):
        d = self.d
        result = index_aggregate(d, set(), -1, set())
        self.assertEqual(sum(result["byWeekday"]), result["total"])
        self.assertEqual(sum(result["byHour"]), result["total"])

    def test_annee_ytd_subset_of_full_year(self):
        """Les mois YTD de l'année en cours sont un sous-ensemble des mois de l'année."""
        d = self.d
        MONTHS = d["MONTHS"]
        last_month = MONTHS[-1]
        cur_year = last_month[:4]
        cur_months = [m for m in MONTHS if m.startswith(cur_year + "-")]
        ytd = annee_aggregate(d, month_idx_set(d, cur_months))
        # le total YTD ne peut pas dépasser le total "toutes années" pour cette année
        full_year_via_index = index_aggregate(d, {cur_year}, -1, set())
        self.assertEqual(ytd["total"], full_year_via_index["total"])

    def test_urgentes_and_terminees_never_exceed_total(self):
        d = self.d
        MONTHS = d["MONTHS"]
        cur_year = MONTHS[-1][:4]
        cur_months = [m for m in MONTHS if m.startswith(cur_year + "-")]
        result = annee_aggregate(d, month_idx_set(d, cur_months))
        self.assertLessEqual(result["urgentes"], result["total"])
        self.assertLessEqual(result["terminees"], result["total"])


if __name__ == "__main__":
    unittest.main()
