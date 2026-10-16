import { useId } from 'react';

// Fond de l'application : motif répété d'objets scolaires et techniques dessinés au trait.
// Tout est tracé ici en SVG ; la couleur suit le thème (variable --motif).

function engrenage(dents: number, rExt: number, rInt: number): string {
  const pts: string[] = [];
  const pas = (Math.PI * 2) / dents;
  for (let i = 0; i < dents; i++) {
    const a = i * pas;
    const p = (r: number, ang: number) => `${(r * Math.cos(ang)).toFixed(2)} ${(r * Math.sin(ang)).toFixed(2)}`;
    pts.push(`${i === 0 ? 'M' : 'L'}${p(rInt, a - pas * 0.3)}`);
    pts.push(`L${p(rExt, a - pas * 0.18)}`);
    pts.push(`L${p(rExt, a + pas * 0.18)}`);
    pts.push(`L${p(rInt, a + pas * 0.3)}`);
  }
  return `${pts.join(' ')} Z M4 0 A4 4 0 1 0 -4 0 A4 4 0 1 0 4 0`;
}

function graduationsRapporteur(): string {
  const traits: string[] = [];
  for (let i = 1; i < 12; i++) {
    const a = Math.PI - (i * Math.PI) / 12;
    const l = i % 3 === 0 ? 5 : 3;
    const x1 = 22 * Math.cos(a);
    const y1 = -22 * Math.sin(a);
    const x2 = (22 - l) * Math.cos(a);
    const y2 = -(22 - l) * Math.sin(a);
    traits.push(`M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`);
  }
  return traits.join(' ');
}

function touchesCalculatrice(): string {
  const t: string[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) t.push(`M${-9 + c * 6} ${-4 + r * 6} h3 v3 h-3 Z`);
  return t.join(' ');
}

function spirales(): string {
  const s: string[] = [];
  for (let i = 0; i < 6; i++) s.push(`M-15 ${-17 + i * 7} a2 2 0 1 0 0.01 0`);
  return s.join(' ');
}

// Chaque objet est dessiné autour de l'origine (0, 0), sur environ 48 unités.
const OBJETS: Record<string, string> = {
  equerre: 'M-16 -20 L-16 20 L16 20 Z M-10 -6 L-10 14 L6 14 Z M-16 -12 h4 M-16 -4 h4 M-16 4 h4 M-16 12 h4',
  compas:
    'M0 -21 a3 3 0 1 0 0.01 0 M0 -15 L-11 20 M0 -15 L11 20 L10 16 M-6 4 Q0 8 6 4 M-1.5 -24 V-27 M1.5 -24 V-27',
  cle: 'M-12 -3 H10 M-12 3 H10 M-25 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M-21 0 l1.5 -2.6 h3 l1.5 2.6 l-1.5 2.6 h-3 Z M10 -3 C12 -9 20 -10 23 -6 L18 -2 L18 2 L23 6 C20 10 12 9 10 3',
  ampoule:
    'M0 -20 C-10 -20 -15 -12 -13 -5 C-12 0 -7 3 -6 8 H6 C7 3 12 0 13 -5 C15 -12 10 -20 0 -20 Z M-5 12 H5 M-4 16 H4 M-3 -4 L0 2 L3 -4 M-2 20 H2',
  livre: 'M-21 -12 Q-10 -16 0 -11 Q10 -16 21 -12 V16 Q10 12 0 17 Q-10 12 -21 16 Z M0 -11 V17 M-16 -6 Q-9 -8 -4 -5 M-16 0 Q-9 -2 -4 1 M4 -5 Q9 -8 16 -6',
  crayon: 'M-20 -4 H12 L20 0 L12 4 H-20 Z M12 -4 V4 M-14 -4 V4 M17 -1.4 L20 0 L17 1.4',
  regle: 'M-28 -6 H28 V6 H-28 Z M-22 -6 V-1 M-16 -6 V-3 M-10 -6 V-1 M-4 -6 V-3 M2 -6 V0 M8 -6 V-3 M14 -6 V-1 M20 -6 V-3',
  engrenage: engrenage(9, 15, 11.5),
  multimetre:
    'M-14 -21 H14 a3 3 0 0 1 3 3 V18 a3 3 0 0 1 -3 3 H-14 a3 3 0 0 1 -3 -3 V-18 a3 3 0 0 1 3 -3 Z M-11 -16 H11 V-6 H-11 Z M-6 6 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M0 6 L4 2 M-9 17 a1.5 1.5 0 1 0 0.01 0 M9 17 a1.5 1.5 0 1 0 0.01 0 M-7 -11 h5 M2 -13 v4',
  calculatrice: `M-14 -22 H14 V22 H-14 Z M-10 -18 H10 V-9 H-10 Z ${touchesCalculatrice()}`,
  tournevis: 'M-22 -5 H-8 a2 2 0 0 1 2 2 V3 a2 2 0 0 1 -2 2 H-22 a2 2 0 0 1 -2 -2 V-3 a2 2 0 0 1 2 -2 Z M-20 -5 V5 M-16 -5 V5 M-12 -5 V5 M-6 0 H20 M20 -2 V2',
  resistance: 'M-26 0 H-14 L-11 -6 L-5 6 L1 -6 L7 6 L13 -6 L16 0 H26 M-26 0 a1.5 1.5 0 1 0 0.01 0',
  toque: 'M0 -14 L22 -4 L0 6 L-22 -4 Z M-12 1 V11 Q0 18 12 11 V1 M22 -4 V8 M20 13 L22 8 L24 13 Z',
  rapporteur: `M-22 8 A22 22 0 0 1 22 8 Z M-10 8 A10 10 0 0 1 10 8 ${graduationsRapporteur().replace(/(-?\d+\.\d+) (-?\d+\.\d+)/g, (_m, x, y) => `${x} ${(Number(y) + 8).toFixed(2)}`)}`,
  eprouvette: 'M-4 -20 V14 a4 4 0 0 0 8 0 V-20 M-7 -20 H7 M-4 4 H4 M-1 9 a1 1 0 1 0 0.01 0 M1 0 a1 1 0 1 0 0.01 0',
  cahier: `M-12 -22 H16 V22 H-12 Z ${spirales()} M-6 -12 H11 M-6 -6 H11 M-6 0 H8 M-6 6 H11`,
  prise: 'M-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 M-6 -2 v5 M6 -2 v5 M-3 9 h6',
};

const PETITS: Record<string, string> = {
  plus: 'M-4 0 H4 M0 -4 V4',
  rond: 'M-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0',
  triangle: 'M0 -4 L4 3 H-4 Z',
  zigzag: 'M-7 0 L-4 -3 L-1 0 L2 -3 L5 0',
  etoile: 'M0 -5 L1.5 -1.5 L5 -1.5 L2.2 0.8 L3.2 4.5 L0 2.3 L-3.2 4.5 L-2.2 0.8 L-5 -1.5 L-1.5 -1.5 Z',
};

// Placement sur une tuile de 400 × 400 : une grille 4 × 4 légèrement décalée.
const PLACEMENT: [keyof typeof OBJETS, number, number, number][] = [
  ['equerre', 52, 48, -12],
  ['ampoule', 150, 58, 10],
  ['regle', 252, 44, -28],
  ['cahier', 352, 56, 8],
  ['cle', 46, 152, -40],
  ['livre', 152, 146, -8],
  ['multimetre', 250, 156, 12],
  ['toque', 350, 148, -10],
  ['calculatrice', 54, 252, 14],
  ['compas', 148, 250, -18],
  ['engrenage', 252, 248, 0],
  ['crayon', 348, 254, 35],
  ['resistance', 50, 352, -20],
  ['tournevis', 150, 350, 40],
  ['rapporteur', 252, 352, -14],
  ['eprouvette', 350, 346, 22],
];

const PETITS_PLACES: [keyof typeof PETITS, number, number][] = [
  ['plus', 100, 100],
  ['rond', 200, 104],
  ['triangle', 300, 98],
  ['etoile', 4, 100],
  ['zigzag', 100, 200],
  ['plus', 204, 200],
  ['rond', 300, 202],
  ['triangle', 2, 200],
  ['etoile', 102, 300],
  ['triangle', 200, 298],
  ['zigzag', 300, 300],
  ['rond', 4, 302],
  ['triangle', 100, 4],
  ['plus', 200, 2],
  ['etoile', 302, 4],
  ['zigzag', 4, 2],
];

// Par défaut : fond de page fixe aux couleurs du thème. Avec trait et className, le motif
// peut habiller un panneau (couleur de trait libre, sans fond).
export function MotifFond({ trait, className }: { trait?: string; className?: string } = {}) {
  const id = useId();
  return (
    <svg
      aria-hidden
      className={className ?? 'pointer-events-none fixed inset-0 -z-10 h-full w-full'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id={id} width="400" height="400" patternUnits="userSpaceOnUse">
          <g
            fill="none"
            stroke={trait ?? 'rgb(var(--motif))'}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {PLACEMENT.map(([nom, x, y, r]) => (
              <path key={`${nom}-${x}`} d={OBJETS[nom]} transform={`translate(${x} ${y}) rotate(${r}) scale(0.95)`} />
            ))}
            {PETITS_PLACES.map(([nom, x, y], i) => (
              <path key={i} d={PETITS[nom]} transform={`translate(${x} ${y}) rotate(${i * 23})`} />
            ))}
          </g>
        </pattern>
      </defs>
      {!trait && <rect width="100%" height="100%" fill="rgb(var(--fond))" />}
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
