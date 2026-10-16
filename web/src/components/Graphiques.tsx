// Graphiques des statistiques. Une seule échelle par graphique ; les couleurs viennent du thème.
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../lib/contexte';
import { note, pourcent } from '../lib/format';

function useCouleurs() {
  const { theme } = useApp();
  return useMemo(() => {
    const s = getComputedStyle(document.documentElement);
    const rgb = (n: string) => `rgb(${s.getPropertyValue(n).trim().split(/\s+/).join(',')})`;
    return {
      serie1: s.getPropertyValue('--serie-1').trim(),
      serie2: s.getPropertyValue('--serie-2').trim(),
      grille: s.getPropertyValue('--grille').trim(),
      encre2: rgb('--encre-2'),
      encre3: rgb('--encre-3'),
      surface: rgb('--surface'),
      bord: rgb('--bord'),
      danger: rgb('--danger'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

function Infobulle({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: { name: string; value: number | null; color?: string }[];
  label?: string;
  format: (v: number | null) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-bord bg-surface px-3 py-2 text-xs shadow-feuille">
      <div className="mb-1 font-semibold text-encre">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-encre-2">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
          {p.name} : <span className="font-semibold text-encre">{format(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const axe = (c: ReturnType<typeof useCouleurs>) => ({
  tick: { fill: c.encre2, fontSize: 12 },
  axisLine: { stroke: c.bord },
  tickLine: false,
});

// Répartition par tranches : les tranches sous la moyenne sont plus claires.
export function Repartition({ donnees, unite = 'élèves' }: { donnees: { tranche: string; effectif: number }[]; unite?: string }) {
  const c = useCouleurs();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={donnees} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barCategoryGap={6}>
        <CartesianGrid vertical={false} stroke={c.grille} />
        <XAxis dataKey="tranche" {...axe(c)} />
        <YAxis allowDecimals={false} {...axe(c)} axisLine={false} />
        <Tooltip
          cursor={{ fill: c.grille, opacity: 0.5 }}
          content={<Infobulle format={(v) => `${v ?? 0} ${unite}`} />}
        />
        <Bar dataKey="effectif" name="Effectif" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {donnees.map((d, i) => (
            <Cell key={d.tranche} fill={c.serie1} fillOpacity={i < 3 ? 0.45 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Évolution d'une moyenne sur les périodes, avec la barre des 10/20.
export function Evolution({ donnees }: { donnees: { periode: string; moyenne: number | null }[] }) {
  const c = useCouleurs();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={donnees} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke={c.grille} />
        <XAxis dataKey="periode" {...axe(c)} />
        <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} {...axe(c)} axisLine={false} />
        <ReferenceLine y={10} stroke={c.encre3} strokeDasharray="4 4" />
        <Tooltip content={<Infobulle format={(v) => (v === null ? 'pas de notes' : `${note(v)} / 20`)} />} />
        <Line
          type="monotone"
          dataKey="moyenne"
          name="Moyenne"
          stroke={c.serie1}
          strokeWidth={2}
          dot={{ r: 4, fill: c.serie1, stroke: c.surface, strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Filles et garçons : moyenne et taux de réussite côte à côte, en barres horizontales sur 20 et sur 100.
export function ParSexe({
  donnees,
}: {
  donnees: { sexe: 'F' | 'M'; effectif: number; moyenne: number | null; tauxReussite: number | null }[];
}) {
  const c = useCouleurs();
  const ligne = (sexe: 'F' | 'M') => donnees.find((d) => d.sexe === sexe);
  const f = ligne('F');
  const g = ligne('M');
  const items = [
    { nom: 'Filles', couleur: c.serie2, d: f },
    { nom: 'Garçons', couleur: c.serie1, d: g },
  ];
  return (
    <div className="space-y-4">
      {[
        { titre: 'Moyenne', max: 20, val: (d?: typeof f) => d?.moyenne ?? null, fmt: (v: number | null) => (v === null ? '—' : `${note(v)} / 20`) },
        { titre: 'Taux de réussite', max: 100, val: (d?: typeof f) => d?.tauxReussite ?? null, fmt: pourcent },
      ].map((m) => (
        <div key={m.titre}>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-encre-2">{m.titre}</div>
          <div className="space-y-1.5">
            {items.map((it) => {
              const v = m.val(it.d);
              return (
                <div key={it.nom} className="grid grid-cols-[5.5rem_1fr_6rem] items-center gap-3 text-sm">
                  <span className="text-encre-2">
                    {it.nom} <span className="text-encre-3">({it.d?.effectif ?? 0})</span>
                  </span>
                  <div className="h-3 rounded-sm bg-surface-2">
                    <div
                      className="h-full rounded-sm"
                      style={{ width: `${v === null ? 0 : (v / m.max) * 100}%`, background: it.couleur }}
                      title={m.fmt(v)}
                    />
                  </div>
                  <span className="text-right font-semibold tabular-nums">{m.fmt(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Moyennes par matière ou par classe, en barres horizontales triées.
export function BarresHorizontales({
  donnees,
}: {
  donnees: { nom: string; valeur: number | null; detail?: string }[];
}) {
  const c = useCouleurs();
  const lignes = donnees.filter((d) => d.valeur !== null);
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, lignes.length * 30 + 30)}>
      <BarChart data={lignes} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 8 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={c.grille} />
        <XAxis type="number" domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} {...axe(c)} />
        <YAxis type="category" dataKey="nom" width={170} {...axe(c)} axisLine={false} interval={0} />
        <ReferenceLine x={10} stroke={c.encre3} strokeDasharray="4 4" />
        <Tooltip cursor={{ fill: c.grille, opacity: 0.5 }} content={<Infobulle format={(v) => `${note(v)} / 20`} />} />
        <Bar dataKey="valeur" name="Moyenne" radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fill: c.encre2, fontSize: 11, formatter: (v: unknown) => note(v as number) }}>
          {lignes.map((d) => (
            <Cell key={d.nom} fill={c.serie1} fillOpacity={(d.valeur ?? 0) < 10 ? 0.45 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
