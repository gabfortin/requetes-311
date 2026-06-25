"""
Génère docs/data.js à partir de requetes311.csv (Le Plateau-Mont-Royal seulement).
Approche : lignes brutes compactes + tables de lookup → filtrage 100% client-side.
Usage: python3 generate.py
"""

import duckdb
import json
import os
from collections import Counter

CSV_PATH = os.path.join(os.path.dirname(__file__), "requetes311.csv")
OUT_PATH = os.path.join(os.path.dirname(__file__), "docs", "data.js")
ROWS_PATH = os.path.join(os.path.dirname(__file__), "docs", "rows.json")
PROPRETE_OUT_PATH = os.path.join(os.path.dirname(__file__), "docs", "proprete_data.js")
ARROND = "Le Plateau-Mont-Royal"

# Colonnes de provenance à inclure (on exclut les quasi-nulles)
PROV_COLS = [
    ("Téléphone",      "PROVENANCE_TELEPHONE"),
    ("Courriel",       "PROVENANCE_COURRIEL"),
    ("En personne",    "PROVENANCE_PERSONNE"),
    ("Courrier",       "PROVENANCE_COURRIER"),
    ("Mobile",         "PROVENANCE_MOBILE"),
    ("Médias sociaux", "PROVENANCE_MEDIASOCIAUX"),
    ("Site internet",  "PROVENANCE_SITEINTERNET"),
]
PROV_LABELS = [label for label, _ in PROV_COLS]
N_PROV = len(PROV_COLS)

# dayofweek DuckDB : 0=Dim, 1=Lun … 6=Sam → remap 0=Lun … 6=Dim
WD_MAP = {1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6}

PROPRETE_CATS = [
    {"id": "depots",     "label": "Dépôts illégaux",     "icon": "🗑️",  "color": "#c0392b",
     "activities": ["Dépôt illégal - Déchets", "Dépôt Illégal - Neige"]},
    {"id": "nettoyage",  "label": "Nettoyage",            "icon": "🧹",  "color": "#16a085",
     "activities": ["Nettoyage du domaine public"]},
    {"id": "ordures",    "label": "Collecte ordures",     "icon": "🚛",  "color": "#2e76c8",
     "activities": ["Collecte de déchets", "Encombrants non ramassés",
                    "Collecte des encombrants", "Bac roulant", "Bac montréalais (67 litres)"]},
    {"id": "recyclage",  "label": "Collecte recyclage",   "icon": "♻️",  "color": "#8e44ad",
     "activities": ["Collecte des matières recyclables", "Bac roulant - Matières recyclables"]},
    {"id": "organiques", "label": "Collecte organiques",  "icon": "🌱",  "color": "#e67e22",
     "activities": ["Collecte de résidus alimentaires", "Bac roulant - Résidus alimentaires",
                    "Collecte de résidus verts", "Collecte des matières organiques"]},
]
TERM_STATUS = "Terminée"


def query_raw(con, csv_path, arrond=ARROND):
    """Lit les lignes brutes (1 par requête) pour un arrondissement donné."""
    prov_select = ", ".join(
        f"COALESCE(TRY_CAST({col} AS INTEGER), 0)"
        for _, col in PROV_COLS
    )
    return con.execute(f"""
        SELECT
            strftime(DDS_DATE_CREATION::TIMESTAMP, '%Y-%m') AS month,
            COALESCE(NATURE, '')          AS nature,
            COALESCE(ACTI_NOM, '')        AS acti,
            COALESCE(DERNIER_STATUT, '')  AS status,
            {prov_select},
            dayofweek(DDS_DATE_CREATION::TIMESTAMP) AS wd,
            HOUR(DDS_DATE_CREATION::TIMESTAMP)      AS h
        FROM read_csv_auto('{csv_path}', ignore_errors=true)
        WHERE ARRONDISSEMENT = '{arrond}'
          AND DDS_DATE_CREATION IS NOT NULL
        ORDER BY month
    """).fetchall()


def build_lookups(raw):
    """Construit les tables de lookup (mois, natures, statuts, activités) à partir des lignes brutes."""
    months   = sorted(set(r[0] for r in raw if r[0]))
    natures  = sorted(set(r[1] for r in raw if r[1]))
    statuses = sorted(set(r[3] for r in raw if r[3]))

    # Activités triées par fréquence (plus utile dans l'autocomplete)
    acti_freq = Counter(r[2] for r in raw if r[2])
    activities = sorted(acti_freq, key=lambda a: -acti_freq[a])

    return months, natures, activities, statuses


def encode_rows(raw, months, natures, activities, statuses):
    """Encode chaque ligne brute en [month_idx, nature_idx, acti_idx, status_idx, prov_mask, weekday, hour].
    Valeur -1 = inconnu/vide."""
    month_idx  = {m: i for i, m in enumerate(months)}
    nature_idx = {n: i for i, n in enumerate(natures)}
    acti_idx   = {a: i for i, a in enumerate(activities)}
    status_idx = {s: i for i, s in enumerate(statuses)}

    encoded = []
    for r in raw:
        mi = month_idx.get(r[0], -1)
        ni = nature_idx.get(r[1], -1) if r[1] else -1
        ai = acti_idx.get(r[2], -1)   if r[2] else -1
        si = status_idx.get(r[3], -1) if r[3] else -1

        prov = 0
        for b in range(N_PROV):
            if r[4 + b]:
                prov |= (1 << b)

        wd = WD_MAP.get(r[4 + N_PROV], 0)
        h  = r[5 + N_PROV] or 0

        encoded.append([mi, ni, ai, si, prov, wd, h])

    return encoded


def query_proprete(con, csv_path, cat, arrond=ARROND):
    """Compte total/terminées par mois pour les activités d'une catégorie propreté donnée."""
    cat_set = set(cat["activities"])
    acti_list = ",".join("'" + a.replace("'", "''") + "'" for a in cat_set)
    return con.execute(f"""
        SELECT
            strftime(DDS_DATE_CREATION::TIMESTAMP, '%Y-%m') AS month,
            COUNT(*) AS total,
            SUM(CASE WHEN DERNIER_STATUT = '{TERM_STATUS}' THEN 1 ELSE 0 END) AS terminees
        FROM read_csv_auto('{csv_path}', ignore_errors=true)
        WHERE ARRONDISSEMENT = '{arrond}'
          AND ACTI_NOM IN ({acti_list})
          AND DDS_DATE_CREATION IS NOT NULL
        GROUP BY month ORDER BY month
    """).fetchall()


def build_proprete_data(con, csv_path, cats=PROPRETE_CATS, arrond=ARROND):
    """Construit {month: {cat_id: {"t": total, "d": terminees}}} pour toutes les catégories."""
    proprete_data = {}
    for cat in cats:
        for month, total, terminees in query_proprete(con, csv_path, cat, arrond):
            proprete_data.setdefault(month, {})[cat["id"]] = {"t": total, "d": int(terminees or 0)}
    return proprete_data


def main():
    con = duckdb.connect()
    print(f"Chargement de {CSV_PATH}...")

    raw = query_raw(con, CSV_PATH)
    print(f"  {len(raw):,} lignes chargées")

    months, natures, activities, statuses = build_lookups(raw)
    encoded = encode_rows(raw, months, natures, activities, statuses)
    print(f"  {len(encoded):,} lignes encodées")

    # ROWS est volumineux (>2 Mo) : on l'écrit en JSON pur dans un fichier séparé,
    # chargé via fetch()+JSON.parse() côté client (plus robuste et moins gourmand
    # en mémoire qu'un énorme littéral JS évalué via <script>, ce qui plantait sur
    # certains mobiles).
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write("// Données 311 – Le Plateau-Mont-Royal (généré automatiquement)\n")
        f.write(f"var MONTHS={json.dumps(months, ensure_ascii=False, separators=(',',':'))};\n")
        f.write(f"var NATURES={json.dumps(natures, ensure_ascii=False, separators=(',',':'))};\n")
        f.write(f"var ACTIVITIES={json.dumps(activities, ensure_ascii=False, separators=(',',':'))};\n")
        f.write(f"var STATUSES={json.dumps(statuses, ensure_ascii=False, separators=(',',':'))};\n")
        f.write(f"var WEEKDAYS={json.dumps(['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'])};\n")
        f.write(f"var PROV_LABELS={json.dumps(PROV_LABELS, ensure_ascii=False, separators=(',',':'))};\n")

    with open(ROWS_PATH, "w", encoding="utf-8") as f:
        f.write(json.dumps(encoded, separators=(',', ':')))

    print(f"Écrit : {OUT_PATH} ({os.path.getsize(OUT_PATH):,} octets)")
    print(f"Écrit : {ROWS_PATH} ({os.path.getsize(ROWS_PATH):,} octets)")

    # ── Données propreté ──────────────────────────────────────────────────────
    proprete_data = build_proprete_data(con, CSV_PATH)
    all_months_sorted = sorted(proprete_data.keys())
    ref_month = all_months_sorted[-1]
    cats_meta = [{"id": c["id"], "label": c["label"], "icon": c["icon"], "color": c["color"]}
                 for c in PROPRETE_CATS]

    with open(PROPRETE_OUT_PATH, "w", encoding="utf-8") as f:
        f.write("// Données propreté – Le Plateau-Mont-Royal (généré automatiquement)\n")
        f.write(f"var PROPRETE_REF_MONTH={json.dumps(ref_month)};\n")
        f.write(f"var PROPRETE_CATS={json.dumps(cats_meta, ensure_ascii=False, separators=(',',':'))};\n")
        f.write(f"var PROPRETE_MONTHS={json.dumps(all_months_sorted, separators=(',',':'))};\n")
        f.write(f"var PROPRETE_DATA={json.dumps(proprete_data, ensure_ascii=False, separators=(',',':'))};\n")

    print(f"Écrit : {PROPRETE_OUT_PATH} ({os.path.getsize(PROPRETE_OUT_PATH):,} octets)")


if __name__ == "__main__":
    main()
