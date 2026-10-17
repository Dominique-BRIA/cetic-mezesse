// État global : utilisateur connecté, année scolaire consultée, thème.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, quandSessionExpire, session } from './api';
import type { Annee, Role, Utilisateur } from './types';

interface Contexte {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  connecter: (jeton: string, u: Utilisateur, persistant?: boolean) => void;
  deconnecter: () => void;
  rafraichirProfil: () => Promise<void>;
  majProfil: (u: Utilisateur) => void;
  a: (...roles: Role[]) => boolean;
  annees: Annee[];
  annee: Annee | null;
  choisirAnnee: (id: string) => void;
  theme: 'light' | 'dark';
  basculerTheme: () => void;
}

const Ctx = createContext<Contexte | null>(null);

export function FournisseurApp({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(Boolean(session.jeton()));
  const [anneeId, setAnneeId] = useState<string | null>(session.annee());
  const [theme, setTheme] = useState<'light' | 'dark'>(
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );

  const deconnecter = useCallback(() => {
    session.definirJeton(null);
    setUtilisateur(null);
    client.clear();
  }, [client]);

  useEffect(() => {
    quandSessionExpire(() => {
      setUtilisateur(null);
      client.clear();
    });
    if (!session.jeton()) return;
    api<Utilisateur>('/auth/moi', { annee: false })
      .then(setUtilisateur)
      .catch(() => session.definirJeton(null))
      .finally(() => setChargement(false));
  }, [client]);

  const anneesQ = useQuery({
    queryKey: ['annees'],
    queryFn: () => api<Annee[]>('/annees', { annee: false }),
    enabled: Boolean(utilisateur),
  });
  const annees = useMemo(() => anneesQ.data ?? [], [anneesQ.data]);
  const annee = annees.find((a) => a.id === anneeId) ?? annees.find((a) => a.active) ?? annees[0] ?? null;

  // L'année mémorisée a pu disparaître : on retombe sur l'année active.
  useEffect(() => {
    if (annee && annee.id !== session.annee()) session.definirAnnee(annee.id);
  }, [annee]);

  const valeur: Contexte = {
    utilisateur,
    chargement,
    connecter: (jeton, u, persistant = true) => {
      session.definirJeton(jeton, persistant);
      client.clear();
      setUtilisateur(u);
    },
    deconnecter,
    rafraichirProfil: async () => setUtilisateur(await api<Utilisateur>('/auth/moi', { annee: false })),
    majProfil: setUtilisateur,
    a: (...roles) => Boolean(utilisateur && roles.includes(utilisateur.role)),
    annees,
    annee,
    choisirAnnee: (id) => {
      session.definirAnnee(id);
      setAnneeId(id);
      client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'annees' });
    },
    theme,
    basculerTheme: () => {
      const t = theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = t;
      try {
        localStorage.setItem('cetic-theme', t);
      } catch {
        // préférence non mémorisée
      }
      setTheme(t);
    },
  };
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp hors du fournisseur');
  return c;
}
