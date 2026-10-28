// Prints the metric-matched fallback @font-face rules that go into src/styles/fonts.css (run when a font changes):
//   node scripts/font-fallbacks.mjs
// A fallback face is a local system font stretched and re-spaced (size-adjust, ascent/descent/line-gap overrides) to the
// metrics of the web font, so the text takes the same room before and after the web font arrives (no layout jump).
// Metrics come from @capsizecss/metrics (dev dependency). The formulas are the ones of Fontaine and next/font.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const all = require('@capsizecss/metrics/entireMetricsCollection').entireMetricsCollection;

const pairs = [
  { web: 'sourceSerif4', family: 'Source Serif 4', fallback: 'timesNewRoman', locals: ['Times New Roman', 'Liberation Serif', 'Tinos'] },
  { web: 'playfairDisplay', family: 'Playfair Display', fallback: 'timesNewRoman', locals: ['Times New Roman', 'Liberation Serif', 'Tinos'], boost: 1.023 },
  { web: 'oswald', family: 'Oswald', fallback: 'arial', locals: ['Arial', 'Liberation Sans', 'Arimo'] },
];
const pct = (n) => `${(n * 100).toFixed(2)}%`;
// Liberation Serif/Sans and Tinos/Arimo are metric-compatible with Times New Roman and Arial (Linux, ChromeOS, some Androids),
// so the same numbers fit them.
for (const { web, family, fallback, locals, boost = 1 } of pairs) {
  const w = all[web];
  const f = all[fallback];
  if (!w || !f) throw new Error(`no metrics for ${web} or ${fallback}`);
  const avgWeb = w.xWidthAvg / w.unitsPerEm;
  const avgFb = f.xWidthAvg / f.unitsPerEm;
  // boost: headings are set in weights 600-800, which are 2-3% wider than the regular weight the average width is taken from;
  // without it a title that fits one line in the fallback wraps to two when Playfair arrives (a 34 px jump on a phone).
  const sizeAdjust = (avgWeb / avgFb) * boost;
  const ascent = w.ascent / (w.unitsPerEm * sizeAdjust);
  const descent = Math.abs(w.descent) / (w.unitsPerEm * sizeAdjust);
  const lineGap = w.lineGap / (w.unitsPerEm * sizeAdjust);
  console.log(`@font-face {
  font-family: '${family} Fallback';
  src: ${locals.map((n) => `local('${n}')`).join(', ')};
  size-adjust: ${pct(sizeAdjust)};
  ascent-override: ${pct(ascent)};
  descent-override: ${pct(descent)};
  line-gap-override: ${pct(lineGap)};
}
`);
}
