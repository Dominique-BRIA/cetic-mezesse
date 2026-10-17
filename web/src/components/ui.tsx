import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { AlertCircle, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { ErreurApi } from '../lib/api';
import { PERIODES } from '../lib/format';
import type { CodePeriode } from '../lib/types';

export function Page({
  titre,
  description,
  actions,
  children,
}: {
  titre: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = `${titre} · CETIC de Mezesse`;
  }, [titre]);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-bord pb-4">
        <div className="min-w-0">
          <h1 className="text-[1.4rem] font-bold leading-tight tracking-tight text-encre">{titre}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-encre-2">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Carte({
  titre,
  actions,
  children,
  className,
  sansMarge,
}: {
  titre?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  sansMarge?: boolean;
}) {
  return (
    <section className={clsx('rounded-lg border border-bord bg-surface', className)}>
      {(titre || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bord px-4 py-3">
          {titre && <h2 className="text-sm font-bold text-encre">{titre}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={sansMarge ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-encre-2" role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      {texte}
    </div>
  );
}

export function Erreur({ erreur }: { erreur: unknown }) {
  const message = erreur instanceof ErreurApi || erreur instanceof Error ? erreur.message : 'Une erreur est survenue.';
  return (
    <div className="flex items-start gap-2 rounded border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="whitespace-pre-line">{message}</span>
    </div>
  );
}

export function Vide({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-semibold text-encre">{titre}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-encre-2">{children}</div>}
    </div>
  );
}

export function Modale({
  titre,
  ouverte,
  fermer,
  children,
  pied,
  large,
}: {
  titre: string;
  ouverte: boolean;
  fermer: () => void;
  children: ReactNode;
  pied?: ReactNode;
  large?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouverte && !d.open) d.showModal();
    if (!ouverte && d.open) d.close();
  }, [ouverte]);
  return (
    <dialog
      ref={ref}
      onClose={fermer}
      onCancel={(e) => {
        e.preventDefault();
        fermer();
      }}
      className={clsx(
        'w-[calc(100%-2rem)] rounded-lg border border-bord bg-surface p-0 text-encre shadow-feuille backdrop:bg-[rgb(10_20_32/0.45)]',
        large ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      {ouverte && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-bord px-5 py-3.5">
            <h2 className="text-base font-bold">{titre}</h2>
            <button type="button" className="bouton-discret -mr-2" onClick={fermer} aria-label="Fermer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {pied && <div className="flex justify-end gap-2 border-t border-bord bg-surface-2 px-5 py-3">{pied}</div>}
        </div>
      )}
    </dialog>
  );
}

// Mot de passe avec un œil pour l'afficher ou le masquer.
export function ChampMotDePasse({
  valeur,
  changer,
  autoComplete,
  minLength,
  required,
}: {
  valeur: string;
  changer: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
  required?: boolean;
}) {
  const [voir, setVoir] = useState(false);
  return (
    <div className="relative">
      <input
        className="champ pr-10"
        type={voir ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        value={valeur}
        onChange={(e) => changer(e.target.value)}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 px-3 text-encre-3 hover:text-encre"
        onClick={(e) => {
          e.preventDefault();
          setVoir(!voir);
        }}
        aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        title={voir ? 'Masquer' : 'Afficher'}
      >
        {voir ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Champ({
  libelle,
  aide,
  children,
  className,
}: {
  libelle: string;
  aide?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx('block', className)}>
      <span className="etiquette">{libelle}</span>
      {children}
      {aide && <span className="mt-1 block text-xs text-encre-3">{aide}</span>}
    </label>
  );
}

export function Indicateur({
  libelle,
  valeur,
  detail,
  accent,
}: {
  libelle: string;
  valeur: ReactNode;
  detail?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={clsx('rounded-lg border bg-surface px-4 py-3', accent ? 'border-primaire/40' : 'border-bord')}>
      <div className="text-xs font-semibold uppercase tracking-wide text-encre-2">{libelle}</div>
      <div className={clsx('mt-1 text-2xl font-bold tabular-nums', accent && 'text-primaire')}>{valeur}</div>
      {detail && <div className="mt-0.5 text-xs text-encre-2">{detail}</div>}
    </div>
  );
}

export function ChoixPeriode({
  valeur,
  changer,
  sequencesSeulement,
}: {
  valeur: CodePeriode;
  changer: (p: CodePeriode) => void;
  sequencesSeulement?: boolean;
}) {
  return (
    <select
      className="champ w-auto min-w-[10rem]"
      value={valeur}
      onChange={(e) => changer(e.target.value as CodePeriode)}
      aria-label="Période"
    >
      {PERIODES.filter((p) => !sequencesSeulement || p.code.startsWith('S')).map((p) => (
        <option key={p.code} value={p.code}>
          {p.libelle}
        </option>
      ))}
    </select>
  );
}

// Étiquette d'état : un trait de couleur et du texte, sans pastille.
export function Etat({ ton, children }: { ton: 'succes' | 'danger' | 'alerte' | 'neutre'; children: ReactNode }) {
  const couleurs = {
    succes: 'text-succes border-succes',
    danger: 'text-danger border-danger',
    alerte: 'text-alerte border-alerte',
    neutre: 'text-encre-2 border-encre-3',
  };
  return <span className={clsx('border-l-2 pl-1.5 text-xs font-semibold', couleurs[ton])}>{children}</span>;
}

export function Barre({ valeur, max }: { valeur: number; max: number }) {
  const p = max ? Math.min(100, (valeur / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-sm bg-surface-2" aria-hidden>
      <div className={clsx('h-full rounded-sm', p >= 100 ? 'bg-succes' : 'bg-primaire')} style={{ width: `${p}%` }} />
    </div>
  );
}
