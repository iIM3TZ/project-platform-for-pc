// The interactive PC case on the Build page: an SVG drawing of an open case, with a line from
// each core part to a circle. The circles are real <button>s laid over the drawing, so they
// work with the keyboard and screen readers.

import { t } from '/js/i18n.js';
import { el } from '/js/components/dom.js';

// Drawing size (the SVG viewBox). Positions below are in these units.
const WIDTH = 1000;
const HEIGHT = 620;

// For each part: `anchor` is where it sits in the drawing, `dot` is where its circle is
const HOTSPOTS = {
  cpu: { anchor: [440, 222], dot: [140, 120] },
  motherboard: { anchor: [345, 372], dot: [140, 260] },
  gpu: { anchor: [352, 325], dot: [140, 400] },
  psu: { anchor: [330, 495], dot: [140, 530] },
  cooler: { anchor: [468, 138], dot: [870, 90] },
  ram: { anchor: [564, 200], dot: [870, 210] },
  storage: { anchor: [658, 150], dot: [870, 330] },
  case: { anchor: [732, 420], dot: [870, 460] },
};

// The case seen from its open side; the top and side faces give it a 3D look.
// Colors come from CSS classes (build.css), so it follows the light and dark themes.
const CASE_DRAWING = `
  <polygon class="pc-top" points="300,60 700,60 760,20 360,20"/>
  <polygon class="pc-side" points="700,60 760,20 760,520 700,560"/>
  <rect class="pc-inside" x="300" y="60" width="400" height="500" rx="6"/>
  <rect class="pc-board" x="330" y="90" width="280" height="300" rx="4"/>
  <rect class="pc-chip" x="410" y="150" width="80" height="80" rx="4"/>
  <rect class="pc-part" x="425" y="105" width="86" height="66" rx="6"/>
  <circle class="pc-fan" cx="468" cy="138" r="24"/>
  <rect class="pc-part" x="520" y="110" width="9" height="150" rx="2"/>
  <rect class="pc-part" x="536" y="110" width="9" height="150" rx="2"/>
  <rect class="pc-part" x="552" y="110" width="9" height="150" rx="2"/>
  <rect class="pc-part" x="568" y="110" width="9" height="150" rx="2"/>
  <rect class="pc-part" x="360" y="268" width="90" height="12" rx="2"/>
  <rect class="pc-part" x="628" y="100" width="60" height="110" rx="4"/>
  <rect class="pc-chip" x="634" y="112" width="48" height="38" rx="3"/>
  <rect class="pc-chip" x="634" y="160" width="48" height="38" rx="3"/>
  <rect class="pc-part" x="340" y="300" width="300" height="50" rx="6"/>
  <circle class="pc-fan" cx="420" cy="325" r="18"/>
  <circle class="pc-fan" cx="500" cy="325" r="18"/>
  <line class="pc-edge" x1="300" y1="430" x2="700" y2="430"/>
  <rect class="pc-part" x="320" y="450" width="150" height="90" rx="6"/>
  <circle class="pc-fan" cx="395" cy="495" r="30"/>
  <rect class="pc-frame" x="300" y="60" width="400" height="500" rx="6"/>
`;

function linesFor(slugs) {
  return slugs.map((slug) => {
    const { anchor: [ax, ay], dot: [dx, dy] } = HOTSPOTS[slug];
    return `<line class="pc-line" x1="${ax}" y1="${ay}" x2="${dx}" y2="${dy}"/>`
      + `<circle class="pc-anchor" cx="${ax}" cy="${ay}" r="6"/>`;
  }).join('');
}

// container: an empty element. options:
//   slugs: core category slugs to show, in order
//   categoryName(slug), partName(slug) (null when nothing is chosen)
//   status(slug): 'empty' | 'chosen' | 'error'
//   onPick(slug): called when a circle is pressed
export function renderPcCase(container, { slugs, categoryName, partName, status, onPick }) {
  const shown = slugs.filter((slug) => HOTSPOTS[slug]);
  container.innerHTML = `<svg class="pc-drawing" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true" focusable="false">`
    + CASE_DRAWING + linesFor(shown) + '</svg>';

  // The circles are placed with left/top in drawing coordinates on purpose (not inline-start):
  // the drawing does not flip between Arabic and English, so the circles must not flip either.
  const buttons = shown.map((slug) => {
    const [x, y] = HOTSPOTS[slug].dot;
    const chosen = partName(slug);
    const label = t('build.hotspot', { category: categoryName(slug), part: chosen || t('build.notChosen') });
    const button = el('button', {
      class: `pc-dot is-${status(slug)} ${x < WIDTH / 2 ? 'tip-right' : 'tip-left'}`,
      type: 'button',
      style: `left: ${(x / WIDTH) * 100}%; top: ${(y / HEIGHT) * 100}%`,
      'aria-label': label,
    }, el('span', { class: 'pc-tip', 'aria-hidden': 'true', text: label }));
    button.addEventListener('click', () => onPick(slug));
    return button;
  });
  container.append(...buttons);
}
