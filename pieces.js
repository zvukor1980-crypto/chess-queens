/* Шахматы Королев — фигуры-героини (встроенный SVG) */
(function (root) {
  'use strict';
  const PAL = {
    L: { line: '#5a3510', skin: '#fad9bf', eye: '#3a2412', lip: '#d4566e', blush: '#ff9fb0',
      gown: 'url(#cqGownL)', cape: 'url(#cqCapeL)', metal: 'url(#cqMetalL)', metalC: '#f6c544',
      hair: 'url(#cqHairL)', hairC: '#e9a92a', trim: '#fffdf4', dot: '#3a2a1a', gem: '#e0245e',
      glow: 'url(#cqGlowL)', stone: 'url(#cqStoneL)', horse: 'url(#cqHorseL)', mane: '#f2b636',
      base: 'url(#cqBaseL)', blade: '#f4f8ff', wood: '#9a6a2c', emblem: '#ffb300' },
    D: { line: '#1c0624', skin: '#e9b896', eye: '#1c0a24', lip: '#b8325a', blush: '#ff7f9f',
      gown: 'url(#cqGownD)', cape: 'url(#cqCapeD)', metal: 'url(#cqMetalD)', metalC: '#c9c6e8',
      hair: 'url(#cqHairD)', hairC: '#4b1f72', trim: '#ece8ff', dot: '#2a1040', gem: '#22d3ee',
      glow: 'url(#cqGlowD)', stone: 'url(#cqStoneD)', horse: 'url(#cqHorseD)', mane: '#9d4edd',
      base: 'url(#cqBaseD)', blade: '#e6e9ff', wood: '#4a2a3a', emblem: '#c4b5fd' }
  };

  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="cqGownL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#fff0c2"/><stop offset="1" stop-color="#e9b44c"/></linearGradient>
  <linearGradient id="cqGownD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d7d"/><stop offset=".5" stop-color="#a3124a"/><stop offset="1" stop-color="#4a0a52"/></linearGradient>
  <linearGradient id="cqCapeL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd76a"/><stop offset="1" stop-color="#d98a12"/></linearGradient>
  <linearGradient id="cqCapeD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b3fd9"/><stop offset="1" stop-color="#2c0b4f"/></linearGradient>
  <linearGradient id="cqMetalL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset=".4" stop-color="#ffcf3d"/><stop offset="1" stop-color="#c47c08"/></linearGradient>
  <linearGradient id="cqMetalD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#c7c3ea"/><stop offset="1" stop-color="#6b5fa8"/></linearGradient>
  <linearGradient id="cqHairL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd768"/><stop offset="1" stop-color="#d08a12"/></linearGradient>
  <linearGradient id="cqHairD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d2a8a"/><stop offset="1" stop-color="#1e0833"/></linearGradient>
  <radialGradient id="cqGlowL"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#fff2a0"/><stop offset="1" stop-color="#ffb300" stop-opacity="0"/></radialGradient>
  <radialGradient id="cqGlowD"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#a5f3fc"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></radialGradient>
  <linearGradient id="cqStoneL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff7e0"/><stop offset=".6" stop-color="#ead39c"/><stop offset="1" stop-color="#b58d45"/></linearGradient>
  <linearGradient id="cqStoneD" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a4e9e"/><stop offset=".6" stop-color="#4b2766"/><stop offset="1" stop-color="#26103a"/></linearGradient>
  <linearGradient id="cqHorseL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f1e6d2"/><stop offset="1" stop-color="#c9b28a"/></linearGradient>
  <linearGradient id="cqHorseD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a3a6e"/><stop offset=".55" stop-color="#2a1538"/><stop offset="1" stop-color="#12061c"/></linearGradient>
  <radialGradient id="cqBaseL" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#fff8d6"/><stop offset=".6" stop-color="#f3c34a"/><stop offset="1" stop-color="#a86a06"/></radialGradient>
  <radialGradient id="cqBaseD" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#d8a6ff"/><stop offset=".6" stop-color="#7a1f6e"/><stop offset="1" stop-color="#2a0730"/></radialGradient>
  </defs></svg>`;

  const sw = 'stroke-linejoin="round" stroke-linecap="round"';

  function face(c, cx, cy, r) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.skin}" stroke="${c.line}" stroke-width="1.8"/>
      <ellipse cx="${cx - r * 0.36}" cy="${cy + r * 0.06}" rx="${r * 0.12}" ry="${r * 0.17}" fill="${c.eye}"/>
      <ellipse cx="${cx + r * 0.36}" cy="${cy + r * 0.06}" rx="${r * 0.12}" ry="${r * 0.17}" fill="${c.eye}"/>
      <circle cx="${cx - r * 0.33}" cy="${cy - r * 0.02}" r="${r * 0.045}" fill="#fff"/>
      <circle cx="${cx + r * 0.39}" cy="${cy - r * 0.02}" r="${r * 0.045}" fill="#fff"/>
      <circle cx="${cx - r * 0.58}" cy="${cy + r * 0.38}" r="${r * 0.17}" fill="${c.blush}" opacity=".55"/>
      <circle cx="${cx + r * 0.58}" cy="${cy + r * 0.38}" r="${r * 0.17}" fill="${c.blush}" opacity=".55"/>
      <path d="M${cx - r * 0.2} ${cy + r * 0.45} Q${cx} ${cy + r * 0.62} ${cx + r * 0.2} ${cy + r * 0.45}" fill="none" stroke="${c.lip}" stroke-width="1.4" stroke-linecap="round"/>`;
  }
  const base = (c, emblem) => `<ellipse cx="50" cy="93" rx="33" ry="5.5" fill="rgba(0,0,0,.28)"/>
    <ellipse cx="50" cy="90" rx="31" ry="6.5" fill="${c.base}" stroke="${c.line}" stroke-width="2"/>
    ${emblem ? `<circle cx="50" cy="90" r="2.6" fill="${c.emblem}" stroke="${c.line}" stroke-width=".8"/>` : ''}`;

  const DRAW = {
    // Король — королева-регент: высокая корона с крестом, мантия с горностаем, скипетр
    K(c) {
      return `${base(c, true)}
      <g class="pc-fig">
        <path class="pc-cape" d="M37 44 C25 56 19 72 15 89 L85 89 C81 72 75 56 63 44 Z" fill="${c.cape}" stroke="${c.line}" stroke-width="2" ${sw}/>
        <path class="pc-hair" d="M40 30 C36 42 35 52 37 62 L63 62 C65 52 64 42 60 30 Z" fill="${c.hair}" stroke="${c.line}" stroke-width="1.8" ${sw}/>
        <path d="M50 43 C40 44 35 58 28 89 L72 89 C65 58 60 44 50 43Z" fill="${c.gown}" stroke="${c.line}" stroke-width="2" ${sw}/>
        <path d="M28.5 82 L71.5 82 L72.5 89 L27.5 89Z" fill="${c.trim}" stroke="${c.line}" stroke-width="1.4"/>
        <g fill="${c.dot}"><circle cx="34" cy="85.5" r="1"/><circle cx="42" cy="85.5" r="1"/><circle cx="50" cy="85.5" r="1"/><circle cx="58" cy="85.5" r="1"/><circle cx="66" cy="85.5" r="1"/></g>
        <path d="M44 50 L50 66 L56 50" fill="none" stroke="${c.metalC}" stroke-width="2.2" ${sw}/>
        <rect x="46.5" y="38" width="7" height="7" fill="${c.skin}"/>
        <path d="M36 47 Q50 41 64 47 Q62 52 50 52 Q38 52 36 47Z" fill="${c.trim}" stroke="${c.line}" stroke-width="1.5"/>
        <g fill="${c.dot}"><circle cx="42" cy="48" r=".9"/><circle cx="50" cy="49.5" r=".9"/><circle cx="58" cy="48" r=".9"/></g>
        <line x1="70" y1="40" x2="65" y2="76" stroke="${c.line}" stroke-width="4.4" stroke-linecap="round"/>
        <line x1="70" y1="40" x2="65" y2="76" stroke="${c.metalC}" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="64" cy="60" r="3.4" fill="${c.skin}" stroke="${c.line}" stroke-width="1.4"/>
        <circle class="pc-glow" cx="70.5" cy="38" r="6" fill="${c.glow}"/>
        <circle cx="70.5" cy="38" r="3" fill="${c.gem}" stroke="${c.line}" stroke-width="1.2"/>
        ${face(c, 50, 31, 9)}
        <path d="M41 29 C41 22 45 20 50 20 C55 20 59 22 59 29 C56 25 53 25 50 26 C47 25 44 25 41 29Z" fill="${c.hair}" stroke="${c.line}" stroke-width="1.4"/>
        <path d="M38.5 24 L38 10 L44 17 L50 7 L56 17 L62 10 L61.5 24 Z" fill="${c.metal}" stroke="${c.line}" stroke-width="2" ${sw}/>
        <rect x="38.5" y="20.5" width="23" height="4.5" rx="1.5" fill="${c.metal}" stroke="${c.line}" stroke-width="1.6"/>
        <circle cx="50" cy="22.7" r="1.6" fill="${c.gem}"/><circle cx="43" cy="22.7" r="1.1" fill="${c.gem}"/><circle cx="57" cy="22.7" r="1.1" fill="${c.gem}"/>
        <path d="M50 0.5 V8 M46.3 3.6 H53.7" stroke="${c.line}" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M50 0.5 V8 M46.3 3.6 H53.7" stroke="${c.metalC}" stroke-width="2.2" stroke-linecap="round"/>
      </g>`;
    },
    // Ферзь — королева-воительница: корона с шариками, кираса, поднятый меч
    Q(c) {
      return `${base(c, true)}
      <g class="pc-fig">
        <path class="pc-cape" d="M39 46 C30 58 24 74 20 89 L80 89 C76 74 70 58 61 46 Z" fill="${c.cape}" stroke="${c.line}" stroke-width="2" ${sw}/>
        <path class="pc-hair" d="M40 30 C34 44 32 58 36 70 C42 66 46 60 50 54 C54 60 58 66 64 70 C68 58 66 44 60 30Z" fill="${c.hair}" stroke="${c.line}" stroke-width="1.8" ${sw}/>
        <path d="M50 52 C42 53 37 66 32 89 L68 89 C63 66 58 53 50 52Z" fill="${c.gown}" stroke="${c.line}" stroke-width="2" ${sw}/>
        <path d="M33 80 L67 80" stroke="${c.metalC}" stroke-width="2.2"/>
        <rect x="46.5" y="38" width="7" height="8" fill="${c.skin}"/>
        <path d="M41 46 Q50 43 59 46 L58 60 Q50 64 42 60Z" fill="${c.metal}" stroke="${c.line}" stroke-width="1.8" ${sw}/>
        <path d="M50 47 V61" stroke="${c.line}" stroke-width="1" opacity=".5"/>
        <circle cx="39.5" cy="48" r="5" fill="${c.metal}" stroke="${c.line}" stroke-width="1.6"/>
        <circle cx="60.5" cy="48" r="5" fill="${c.metal}" stroke="${c.line}" stroke-width="1.6"/>
        <path d="M73 9 L76.5 12 L70 58 L66 57.4 Z" fill="${c.blade}" stroke="${c.line}" stroke-width="1.6" ${sw}/>
        <path d="M74 12 L69 56" stroke="#9fb4d8" stroke-width=".8"/>
        <path d="M61 55 L75 60" stroke="${c.line}" stroke-width="4.6" stroke-linecap="round"/>
        <path d="M61 55 L75 60" stroke="${c.metalC}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M60 51 Q64 56 67 60" fill="none" stroke="${c.line}" stroke-width="5" stroke-linecap="round"/>
        <path d="M60 51 Q64 56 67 60" fill="none" stroke="${c.skin}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="67.5" cy="62.5" r="3.2" fill="${c.skin}" stroke="${c.line}" stroke-width="1.3"/>
        ${face(c, 50, 31, 9)}
        <path d="M41 30 C40 22 45 20 50 20 C55 20 60 22 59 30 C57 26 54 24 50 25 C46 24 43 26 41 30Z" fill="${c.hair}" stroke="${c.line}" stroke-width="1.4"/>
        <path d="M39 24.5 L38 14 L44 20 L50 11 L56 20 L62 14 L61 24.5 Z" fill="${c.metal}" stroke="${c.line}" stroke-width="2" ${sw}/>
        <circle cx="38" cy="12.5" r="2.4" fill="${c.metal}" stroke="${c.line}" stroke-width="1.3"/>
        <circle cx="50" cy="9" r="2.8" fill="${c.gem}" stroke="${c.line}" stroke-width="1.3"/>
        <circle cx="62" cy="12.5" r="2.4" fill="${c.metal}" stroke="${c.line}" stroke-width="1.3"/>
        <circle cx="44" cy="18.5" r="1.8" fill="${c.metal}" stroke="${c.line}" stroke-width="1.1"/>
        <circle cx="56" cy="18.5" r="1.8" fill="${c.metal}" stroke="${c.line}" stroke-width="1.1"/>
      </g>`;
    },
    // Слон — чародейка: островерхая митра с прорезью, посох со светящейся сферой
    B(c) {
      return `${base(c, false)}
      <g class="pc-fig">
        <path class="pc-hair" d="M40 32 C35 46 34 58 37 68 L63 68 C66 58 65 46 60 32Z" fill="${c.hair}" stroke="${c.line}" stroke-width="1.8" ${sw}/>
        <path d="M50 44 C41 45 37 60 32 89 L68 89 C63 60 59 45 50 44Z" fill="${c.gown}" stroke="${c.line}" stroke-width="2" ${sw}/>
        <path d="M50 52 L50 89" stroke="${c.metalC}" stroke-width="3"/>
        <path d="M46 70 l4 -3 l4 3 l-4 3z M46 81 l4 -3 l4 3 l-4 3z" fill="${c.metalC}" stroke="${c.line}" stroke-width=".8"/>
        <rect x="46.5" y="40" width="7" height="6" fill="${c.skin}"/>
        <path d="M39 47 Q50 42 61 47 L57 53 Q50 50 43 53Z" fill="${c.cape}" stroke="${c.line}" stroke-width="1.5"/>
        <line x1="27" y1="22" x2="31" y2="89" stroke="${c.line}" stroke-width="4.6" stroke-linecap="round"/>
        <line x1="27" y1="22" x2="31" y2="89" stroke="${c.wood}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M21 18 Q27 8 33 18" fill="none" stroke="${c.metalC}" stroke-width="2.2" stroke-linecap="round"/>
        <circle class="pc-glow" cx="27" cy="18" r="10" fill="${c.glow}"/>
        <circle cx="27" cy="18" r="3.8" fill="#fff" stroke="${c.line}" stroke-width="1.2"/>
        <path d="M40 50 Q33 54 30 58" fill="none" stroke="${c.line}" stroke-width="5" stroke-linecap="round"/>
        <path d="M40 50 Q33 54 30 58" fill="none" stroke="${c.skin}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="29.5" cy="58" r="3.2" fill="${c.skin}" stroke="${c.line}" stroke-width="1.3"/>
        ${face(c, 50, 34, 9)}
        <path d="M40 30 C40 18 46 10 50 4.5 C54 10 60 18 60 30 Z" fill="${c.gown}" stroke="${c.line}" stroke-width="2" ${sw}/>
        <path d="M54.5 11 L46 25" stroke="${c.line}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M40 29 Q50 25 60 29 L60 31 Q50 27.5 40 31Z" fill="${c.metal}" stroke="${c.line}" stroke-width="1.2"/>
        <circle cx="50" cy="4" r="2.8" fill="${c.metal}" stroke="${c.line}" stroke-width="1.3"/>
      </g>`;
    },
    // Конь — всадница: крупная конская голова (силуэт коня) и наездница с флажком
    N(c) {
      return `${base(c, false)}
      <g class="pc-fig">
        <line x1="80" y1="6" x2="77" y2="62" stroke="${c.line}" stroke-width="4" stroke-linecap="round"/>
        <line x1="80" y1="6" x2="77" y2="62" stroke="${c.wood}" stroke-width="2" stroke-linecap="round"/>
        <path class="pc-hair" d="M80 7 L94 11 L80 16Z" fill="${c.cape}" stroke="${c.line}" stroke-width="1.4" ${sw}/>
        <path class="pc-hair" d="M61 18 C56 26 56 34 58 42 L70 42 C72 34 71 26 67 18Z" fill="${c.hair}" stroke="${c.line}" stroke-width="1.6" ${sw}/>
        <path d="M58 34 Q66 30 74 34 L75 54 L57 54Z" fill="${c.metal}" stroke="${c.line}" stroke-width="1.8" ${sw}/>
        <path d="M73 38 Q78 44 77 50" fill="none" stroke="${c.line}" stroke-width="5" stroke-linecap="round"/>
        <path d="M73 38 Q78 44 77 50" fill="none" stroke="${c.skin}" stroke-width="3" stroke-linecap="round"/>
        ${face(c, 65, 24, 7.5)}
        <path d="M57 24 C56 15 61 13 65 13 C70 13 74 15 73 24 L71 24 C70 19 68 18 65 18 C62 18 60 19 59 24Z" fill="${c.metal}" stroke="${c.line}" stroke-width="1.5" ${sw}/>
        <path class="pc-hair" d="M65 13 C63 7 68 4 72 6 C70 8 68 10 67 13Z" fill="${c.cape}" stroke="${c.line}" stroke-width="1.2"/>
        <g class="pc-horse">
          <path d="M70 89 L28 89 C28 77 34 69 43 63 C37 62 31 61 25 63 C19 65 15 60 17 55 L31 36 C33 30 38 26 44 24 L45 16 L51 23 C63 25 71 37 71 54 C71 68 67 77 70 89Z" fill="${c.horse}" stroke="${c.line}" stroke-width="2.2" ${sw}/>
          <path d="M51 23 C60 26 67 34 69 46 C71 58 66 72 69 86 L64 86 C61 72 64 58 60 46 C57 36 53 30 48 26Z" fill="${c.mane}" stroke="${c.line}" stroke-width="1.4" ${sw}/>
          <circle cx="37" cy="37" r="2.4" fill="${c.line}"/><circle cx="36.3" cy="36.3" r=".8" fill="#fff"/>
          <ellipse cx="20.5" cy="57" rx="1.6" ry="1.1" fill="${c.line}"/>
          <path d="M22 62 C28 60 34 59 42 59" fill="none" stroke="${c.metalC}" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M31 38 L44 50" stroke="${c.metalC}" stroke-width="2" stroke-linecap="round"/>
          <path d="M30 80 L68 80" stroke="${c.metalC}" stroke-width="2.4"/>
        </g>
      </g>`;
    },
    // Ладья — стражница в доспехах у зубчатой башни, со щитом и копьём
    R(c) {
      return `${base(c, false)}
      <g class="pc-tower">
        <path d="M22 89 L24 30 L18 30 L18 10 L28 10 L28 17 L37 17 L37 10 L63 10 L63 17 L72 17 L72 10 L82 10 L82 30 L76 30 L78 89Z" fill="${c.stone}" stroke="${c.line}" stroke-width="2.2" ${sw}/>
        <path d="M18 30 H82" stroke="${c.line}" stroke-width="1.6"/>
        <g stroke="${c.line}" stroke-width=".9" opacity=".45"><path d="M24 40 H34 M24 52 H30 M70 40 H77 M68 52 H77 M24 64 H32 M70 64 H77 M24 76 H30 M71 76 H77"/></g>
      </g>
      <g class="pc-fig">
        <line x1="72" y1="22" x2="70" y2="89" stroke="${c.line}" stroke-width="4.2" stroke-linecap="round"/>
        <line x1="72" y1="22" x2="70" y2="89" stroke="${c.wood}" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M72 13 L75.5 23 L68.5 23Z" fill="${c.blade}" stroke="${c.line}" stroke-width="1.4" ${sw}/>
        <path class="pc-hair" d="M42 36 C38 48 38 56 40 64 L60 64 C62 56 62 48 58 36Z" fill="${c.hair}" stroke="${c.line}" stroke-width="1.6" ${sw}/>
        <path d="M50 50 C42 51 38 64 35 89 L65 89 C62 64 58 51 50 50Z" fill="${c.gown}" stroke="${c.line}" stroke-width="2" ${sw}/>
        <rect x="46.5" y="44" width="7" height="7" fill="${c.skin}"/>
        <path d="M41 52 Q50 48 59 52 L58 66 Q50 69 42 66Z" fill="${c.metal}" stroke="${c.line}" stroke-width="1.8" ${sw}/>
        <path d="M61 55 Q66 58 69 62" fill="none" stroke="${c.line}" stroke-width="5" stroke-linecap="round"/>
        <path d="M61 55 Q66 58 69 62" fill="none" stroke="${c.metalC}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="70" cy="63" r="3" fill="${c.skin}" stroke="${c.line}" stroke-width="1.3"/>
        ${face(c, 50, 40, 8.5)}
        <path d="M40.5 40 C40 30 44 27 50 27 C56 27 60 30 59.5 40 L57 40 C57 35 55 33 50 33 C45 33 43 35 43 40Z" fill="${c.metal}" stroke="${c.line}" stroke-width="1.6" ${sw}/>
        <path d="M50 33 V42" stroke="${c.line}" stroke-width="2.6" stroke-linecap="round"/><path d="M50 33 V41.5" stroke="${c.metalC}" stroke-width="1.2" stroke-linecap="round"/>
        <path class="pc-hair" d="M50 27 C48 21 53 18 58 20 C55 22 53 24 52 27Z" fill="${c.cape}" stroke="${c.line}" stroke-width="1.2"/>
        <path d="M25 55 L45 55 L45 70 Q45 80 35 86 Q25 80 25 70Z" fill="${c.metal}" stroke="${c.line}" stroke-width="2" ${sw}/>
        <path d="M28 58 L42 58 L42 70 Q42 77 35 82 Q28 77 28 70Z" fill="${c.cape}" stroke="${c.line}" stroke-width="1"/>
        <circle cx="35" cy="68" r="4" fill="${c.emblem}" stroke="${c.line}" stroke-width="1"/>
      </g>`;
    },
    // Пешка — лучница в капюшоне (круглая «голова» пешки), с луком
    P(c) {
      return `${base(c, false)}
      <g class="pc-fig">
        <path d="M30 34 Q16 56 30 80" fill="none" stroke="${c.line}" stroke-width="4.6" stroke-linecap="round"/>
        <path d="M30 34 Q16 56 30 80" fill="none" stroke="${c.wood}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M30 34 L30 80" stroke="${c.trim}" stroke-width=".9"/>
        <rect x="62" y="44" width="7" height="20" rx="2" transform="rotate(14 65 54)" fill="${c.wood}" stroke="${c.line}" stroke-width="1.4"/>
        <path d="M66 42 l3 -6 l2 6 M63 41 l1 -6 l3 5" fill="${c.trim}" stroke="${c.line}" stroke-width="1"/>
        <path class="pc-cape" d="M50 46 C41 47 37 62 34 89 L66 89 C63 62 59 47 50 46Z" fill="${c.cape}" stroke="${c.line}" stroke-width="2" ${sw}/>
        <path d="M43 60 L57 60 L59 89 L41 89Z" fill="${c.gown}" stroke="${c.line}" stroke-width="1.4" ${sw}/>
        <path d="M42 70 H58" stroke="${c.metalC}" stroke-width="2.2"/>
        <path d="M44 52 Q36 54 31 56" fill="none" stroke="${c.line}" stroke-width="5" stroke-linecap="round"/>
        <path d="M44 52 Q36 54 31 56" fill="none" stroke="${c.skin}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="31" cy="56.5" r="3" fill="${c.skin}" stroke="${c.line}" stroke-width="1.3"/>
        <path d="M35 37 C35 22 42 16 50 16 C58 16 65 22 65 37 C65 46 58 51 50 51 C42 51 35 46 35 37Z" fill="${c.cape}" stroke="${c.line}" stroke-width="2.2" ${sw}/>
        ${face(c, 50, 37, 9)}
        <path d="M41 34 C42 27 46 25 50 25 C54 25 58 27 59 34 C56 31 53 30 50 31 C47 30 44 31 41 34Z" fill="${c.hair}" stroke="${c.line}" stroke-width="1.2"/>
        <circle cx="50" cy="17.5" r="2.2" fill="${c.metalC}" stroke="${c.line}" stroke-width="1"/>
      </g>`;
    }
  };

  const cache = {};
  function svgHero(type, color) { // сказочные фигуры-героини
    const k = 'h' + type + color;
    if (!cache[k]) { const c = PAL[color === 'w' ? 'L' : 'D']; cache[k] = `<svg class="pc pc-${type} pc-${color} pc-hero" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${DRAW[type](c)}</svg>`; }
    return cache[k];
  }
  function svg(type, color) { return api.style === 'classic' ? svgClassic(type, color) : svgHero(type, color); }
  function svgClassic(type,color){
 const k=type+color;if(cache[k])return cache[k];const light=color==='w',edge=light?'#667b87':'#092634',top=light?'#fff8e7':'#9bd7db',mid=light?'#ead4ac':'#287b91',low=light?'#aa8c61':'#143e5d',gem=light?'#be8b43':'#a6f5eb';
 const head={K:'<path d="M44 13h12v9h8v9H36v-9h8z"/><path d="M32 37q18-10 36 0l-6 18H38z"/>',Q:'<path d="M27 28l10 9 13-18 13 18 10-9-8 27H35z"/><circle cx="27" cy="25" r="4"/><circle cx="50" cy="15" r="4"/><circle cx="73" cy="25" r="4"/>',B:'<path d="M50 17q-25 20-14 32l14 8 14-8q11-12-14-32z"/><path d="M53 27l-8 13" fill="none" stroke="'+edge+'" stroke-width="5"/>',N:'<path d="M31 60l5-21-7-8 13-7 4-11 13 7 13 20-4 10-12-8-1 16z"/><path d="M42 28l-4 17" fill="none" stroke="'+edge+'" stroke-width="3"/><circle cx="57" cy="30" r="2.5" fill="'+edge+'"/>',R:'<path d="M30 22h10v10h7V22h7v10h7V22h10v21l-9 10H38l-8-10z"/>',P:'<circle cx="50" cy="29" r="14"/><path d="M37 46h26l-5 12H42z"/>'}[type]||'';
 return cache[k]='<svg class="pc pc-'+type+' pc-'+color+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gem-'+k+'" x1="0" x2="1" y2="1"><stop stop-color="'+top+'"/><stop offset=".45" stop-color="'+mid+'"/><stop offset="1" stop-color="'+low+'"/></linearGradient></defs><ellipse cx="51" cy="87" rx="30" ry="7" fill="#071a3440"/><g fill="url(#gem-'+k+')" stroke="'+edge+'" stroke-width="2" stroke-linejoin="round">'+head+'<path d="M39 54h22l-4 12 10 13H33l10-13z"/><path d="M30 76h40l5 10H25z"/><rect x="25" y="85" width="50" height="5" rx="2"/></g><path d="M43 58h14l-7 8z" fill="'+gem+'"/><path d="M34 81h30" stroke="'+top+'" stroke-width="2" opacity=".6"/></svg>';
}
  const api = root.CQPieces = { svg, svgHero, svgClassic, DEFS, style: 'hero', NAMES: { K: 'Король', Q: 'Ферзь', B: 'Слон', N: 'Конь', R: 'Ладья', P: 'Пешка' },
    HERO: { K: 'Королева-регент', Q: 'Королева-воительница', B: 'Чародейка', N: 'Всадница', R: 'Стражница', P: 'Лучница' } };
})(window);
