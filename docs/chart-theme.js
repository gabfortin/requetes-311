/* ═══════════════════════════════════════════════════════════════════════════
   Couleurs des graphiques, lues depuis les jetons CSS de glass.css
   (--chart-*), pour que Chart.js suive le mode clair / sombre.

   À appeler une fois, au début du script de la page (après le chargement
   des feuilles de style) :  const CT = applyChartTheme();

   Les couleurs sont lues au chargement : si le thème de l'appareil change
   pendant la visite, la page est rechargée pour redessiner les graphiques.
   ═══════════════════════════════════════════════════════════════════════════ */
function applyChartTheme() {
  const css = getComputedStyle(document.documentElement);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;

  const accentRGB = v("--chart-accent-rgb", "29,184,96");
  const CT = {
    text:      v("--chart-text", "#6b7d74"),
    grid:      v("--chart-grid", "rgba(15,40,28,.08)"),
    accent:    `rgb(${accentRGB})`,
    accentA:   (a) => `rgba(${accentRGB},${a})`,
    muted:     v("--chart-muted", "#c3cec8"),
    muted2:    v("--chart-muted-2", "#9aa9a1"),
    estimate:  v("--chart-estimate", "#e0a526"),
    weekend:   v("--chart-weekend", "#c97a35"),
    faded:     v("--chart-faded", "rgba(15,40,28,.08)"),
    arcBorder: v("--chart-arc-border", "#ffffff"),
    pointHover:v("--chart-point-hover", "#ffffff"),
  };

  Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  Chart.defaults.color = CT.text;
  Chart.defaults.borderColor = CT.grid;
  Chart.defaults.elements.arc.borderColor = CT.arcBorder;
  return CT;
}

(function () {
  if (!window.matchMedia) return;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const reload = () => location.reload();
  if (mq.addEventListener) mq.addEventListener("change", reload);
  else if (mq.addListener) mq.addListener(reload);
})();
