/* Icônes des catégories (Propreté, Circulation) et des indicateurs du Bilan annuel.
   Dessinées à la main dans le style de l'icône du site : traits arrondis de la couleur
   de la catégorie (currentColor), formes blanches (.f), aplats teintés (.t).
   Chaque partie animable porte une classe « i-… » ; les animations jouent au survol
   de la carte (glass.css, « Icônes des catégories »).
   Clés : id des catégories de generate.py (depots, nettoyage…) et des indicateurs
   d'annee.html (total, completion…). L'emoji « icon » des données reste utilisé pour
   le texte des notifications du navigateur. */
(function () {
  "use strict";
  const svg = (id, corps) =>
    `<svg class="ico ico-${id}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${corps}</svg>`;

  const roue = (cx, cy, r, rayons) =>
    `<g class="i-roue"><circle class="f" cx="${cx}" cy="${cy}" r="${r}"/>` +
    `<path d="M${cx} ${cy - r + 1.5}V${cy + r - 1.5}${rayons ? `M${cx - r + 1.5} ${cy}H${cx + r - 1.5}` : ""}" stroke-width="${rayons ? 1.6 : 2}" opacity=".55"/></g>`;

  const TEL = "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67" +
    "A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6" +
    "l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z";

  const ICONES = {
    // ── Propreté ─────────────────────────────────────────────────────────────
    // Dépôts illégaux : poubelle ; au survol, le couvercle s'ouvre et un sac tombe dedans
    depots: svg("depots",
      '<rect class="i-sac" x="19" y="2" width="10" height="9" rx="3" fill="currentColor" stroke="none"/>' +
      '<path class="f" d="M13 19h22l-2.3 21.6a3 3 0 0 1-3 2.4H18.3a3 3 0 0 1-3-2.4Z"/>' +
      '<path d="M20 25v12M24 25v12M28 25v12" stroke-width="2.4" opacity=".55"/>' +
      '<g class="i-couvercle"><path d="M20 12.5v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
      '<rect x="9.5" y="12.5" width="29" height="5" rx="2.5" fill="currentColor"/></g>'),

    // Nettoyage : balai ; au survol, il balaie et soulève un peu de poussière
    nettoyage: svg("nettoyage",
      '<g class="i-poussiere" fill="currentColor" stroke="none"><circle cx="8" cy="40" r="2"/><circle cx="5" cy="33.5" r="1.4"/><circle cx="11.5" cy="45" r="1.3"/></g>' +
      '<g class="i-balai"><path d="M36 4 25 23.5" stroke-width="3.4"/>' +
      '<path class="f" d="M19 22.5l10.5 5.8-3.6 13.4c-5.2.4-11.4-3-14.4-7.8Z"/>' +
      '<path d="M22 31.6 17.6 38.2M25.4 33.6 22.8 41" stroke-width="2.2" opacity=".55"/>' +
      '<path d="M18.6 23.4l11 6" stroke-width="3.8"/></g>'),

    // Collecte ordures : camion à benne ; au survol, il roule (roues et route)
    ordures: svg("ordures",
      '<path class="i-route" d="M2 45h44" stroke-width="2.4" stroke-dasharray="6 5" opacity=".45"/>' +
      '<g class="i-camion"><rect class="f" x="4" y="12" width="26" height="22" rx="3"/>' +
      '<path d="M9 19.5h16M9 26h11" stroke-width="2.4" opacity=".55"/>' +
      '<path class="f" d="M30 18.5h6.6a2 2 0 0 1 1.7 1L43 27a2 2 0 0 1 .3 1V32a2 2 0 0 1-2 2H30Z"/>' +
      '<path class="t" d="M33 22h3.6l3.2 5.2H33Z" stroke="none"/>' +
      roue(12.5, 36, 4.6) + roue(36, 36, 4.6) + "</g>"),

    // Collecte recyclage : trois flèches qui se suivent ; au survol, elles tournent
    recyclage: svg("recyclage",
      '<g class="i-fleches" stroke-width="3.6"><path d="M29.2 11A14 14 0 0 1 37.6 27.4M42.3 27L36.6 31.3L33.6 24.8' +
      'M32.6 35A14 14 0 0 1 14.3 34.1M12.2 38.3L11.4 31.3L18.5 31.9M10.1 25.9A14 14 0 0 1 20.1 10.5M17.5 6.6L24 9.4L19.9 15.3"/></g>' +
      '<circle class="f" cx="24" cy="24" r="5.5" stroke-width="2.6"/>'),

    // Collecte organiques : pousse dans la terre ; au survol, elle grandit en se balançant
    organiques: svg("organiques",
      '<g class="i-pousse"><path d="M24 36V22"/>' +
      '<path class="f" d="M24 29c-7.5.3-12-3.7-12.5-11 7.2-.4 12 3.6 12.5 11Z"/>' +
      '<path class="f" d="M24 24.5c.4-8.2 5.4-12.8 13.5-13 .2 8-4.8 12.7-13.5 13Z"/>' +
      '<path d="M24 29l-6-5.5M24 24.5l6.5-6.5" stroke-width="1.8" opacity=".55"/></g>' +
      '<path class="f" d="M7.5 42.5c3.6-4.8 9.8-7.3 16.5-7.3s12.9 2.5 16.5 7.3Z"/>'),

    // ── Circulation ──────────────────────────────────────────────────────────
    // Études de circulation : loupe sur un petit graphique ; au survol, elle balaie
    etudes: svg("etudes",
      '<g class="i-loupe"><path d="M30 30l10 10" stroke-width="5"/>' +
      '<circle class="f" cx="21" cy="21" r="12.5"/>' +
      '<path class="i-mesures" d="M15.5 26v-3M21 26v-8.5M26.5 26v-5.5" stroke-width="3.2"/></g>'),

    // Feux de circulation : au survol, le feu passe du vert au jaune, puis au rouge
    feux: svg("feux",
      '<path d="M24 42v4" stroke-width="3.4"/>' +
      '<rect class="f" x="15" y="3" width="18" height="39" rx="7"/>' +
      '<circle class="i-rouge" cx="24" cy="12" r="4.4" fill="#dc2626" stroke="none"/>' +
      '<circle class="i-jaune" cx="24" cy="22.5" r="4.4" fill="#f59e0b" stroke="none"/>' +
      '<circle class="i-vert" cx="24" cy="33" r="4.4" fill="#1DB860" stroke="none"/>'),

    // Signalisation : panneau losange sur son poteau ; au survol, il oscille
    signalisation: svg("signalisation",
      '<g class="i-panneau"><path d="M24 31v14" stroke-width="3.4"/>' +
      '<path class="f" d="M21.9 4.9a3 3 0 0 1 4.2 0l12 12a3 3 0 0 1 0 4.2l-12 12a3 3 0 0 1-4.2 0l-12-12a3 3 0 0 1 0-4.2Z"/>' +
      '<path d="M19 23.5v-2.5a3 3 0 0 1 3-3h7M26.5 15l3 3-3 3" stroke-width="2.8"/></g>'),

    // Marquage au sol : route en perspective ; au survol, la ligne pointillée défile
    marquage: svg("marquage",
      '<path class="t" d="M17 5h14l9.5 38h-33Z" stroke="none"/>' +
      '<path d="M17 5 7.5 43M31 5l9.5 38"/>' +
      '<path class="i-ligne" d="M24 7v36" stroke-dasharray="5 5"/>'),

    // Vélo : au survol, les roues tournent et le vélo avance un peu
    velo: svg("velo",
      '<g class="i-velo">' + roue(11.5, 31, 8, true) + roue(36.5, 31, 8, true) +
      '<path d="M11.5 31l7-12.5L24 31Zm7-12.5H31L24 31m7-12.5 5.5 12.5M31 18.5l-1.5-5M27 13.5h5.5M18.5 18.5l-1-3.5M14.5 15h6" stroke-width="2.8"/></g>'),

    // Chaussée et trottoirs : cône de chantier ; au survol, il sautille
    chaussee: svg("chaussee",
      '<g class="i-cone"><path class="f" d="M21.2 7.5a3 3 0 0 1 5.6 0L35 38H13Z"/>' +
      '<path d="M18.4 19.5h11.2M15.9 28.5h16.2" stroke-width="4"/>' +
      '<rect x="8.5" y="38" width="31" height="5" rx="2.5" fill="currentColor"/></g>'),

    // ── Bilan annuel ─────────────────────────────────────────────────────────
    // Total requêtes : barres ; au survol, elles remontent une à une
    total: svg("total",
      '<path d="M6 42.5h36"/>' +
      '<rect class="f i-barre" x="9.5" y="26" width="7.5" height="13.5" rx="2"/>' +
      '<rect class="f i-barre" x="20.25" y="16" width="7.5" height="23.5" rx="2"/>' +
      '<rect class="f i-barre" x="31" y="7" width="7.5" height="32.5" rx="2"/>'),

    // Taux de complétion : crochet dans un cercle ; au survol, le crochet se redessine
    completion: svg("completion",
      '<circle class="f i-cercle" cx="24" cy="24" r="17.5"/>' +
      '<path class="i-coche" d="M15.5 24.5l6 6L33 18.5" stroke-width="3.8" pathLength="1" stroke-dasharray="1"/>'),

    // Requêtes urgentes : gyrophare ; au survol, il clignote
    urgentes: svg("urgentes",
      '<path class="i-rayons" d="M24 3v4.5M9.5 8.5l3 3M38.5 8.5l-3 3M4 20.5h4.5M44 20.5h-4.5" stroke-width="2.8"/>' +
      '<path class="f i-dome" d="M14 35V25a10 10 0 0 1 20 0v10Z"/>' +
      '<path d="M19.5 25a4.5 4.5 0 0 1 4.5-4.5" stroke-width="2.4" opacity=".6"/>' +
      '<rect x="9.5" y="35" width="29" height="6.5" rx="2.5" fill="currentColor"/>'),

    // Plaintes : bulle avec un point d'exclamation ; au survol, elle s'agite
    plaintes: svg("plaintes",
      '<g class="i-bulle"><path class="f" d="M10 7h28a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H22l-8 7.5V33h-4a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4Z"/>' +
      '<path d="M24 13v8.5" stroke-width="3.8"/><circle cx="24" cy="27" r="2.2" fill="currentColor" stroke="none"/></g>'),

    // Canal principal : combiné de téléphone (comme le logo) ; au survol, il sonne
    canal: svg("canal",
      '<g class="i-ondes"><path d="M29.5 5.5a13 13 0 0 1 13 13"/><path d="M29 12a6.5 6.5 0 0 1 7 7"/></g>' +
      `<g class="i-tel"><g transform="translate(4 10) scale(1.45)"><path class="f" d="${TEL}" stroke-width="2.1"/></g></g>`),

    // Activité la plus fréquente : trophée ; au survol, il saute et brille
    activite: svg("activite",
      '<g class="i-etincelles" fill="currentColor" stroke="none"><path d="M41 24l1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6-2.6-1.1 2.6-1.1Z"/>' +
      '<path d="M7 22l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z"/></g>' +
      '<g class="i-trophee"><path d="M15 9.5H9.5v2a6 6 0 0 0 6 6M33 9.5h5.5v2a6 6 0 0 1-6 6"/>' +
      '<path class="f" d="M15 5.5h18V16a9 9 0 0 1-18 0Z"/>' +
      '<path d="M24 25v7"/><path class="f" d="M17.5 32h13l2 9.5h-17Z"/></g>'),
  };

  window.ICONES = ICONES;
  window.icone = (id) => ICONES[id] || "";
})();
