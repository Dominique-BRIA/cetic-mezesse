import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Moon, Sun, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/contexte';
import type { Utilisateur } from '../lib/types';
import { MotifFond } from '../components/MotifFond';
import { Erreur } from '../components/ui';

export function Connexion() {
  const { connecter, theme, basculerTheme } = useApp();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api<{ jeton: string; utilisateur: Utilisateur }>('/auth/connexion', {
        methode: 'POST',
        corps: { identifiant, motDePasse },
        annee: false,
      });
      connecter(r.jeton, r.utilisateur);
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MotifFond />
      <div className="flex justify-end p-4">
        <button type="button" className="bouton-secondaire" onClick={basculerTheme}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
        </button>
      </div>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:pt-[4vh]">
        <div className="w-full max-w-[26rem] overflow-hidden rounded-lg border border-bord bg-surface shadow-feuille">
          <div className="px-7 pb-7 pt-8 sm:px-9">
            {/* Établissement */}
            <div className="flex flex-col items-center text-center">
              <svg viewBox="0 0 32 32" className="h-12 w-12" aria-hidden>
                <rect width="32" height="32" rx="7" className="fill-primaire" />
                <path d="M8 23 L8 9 L19 23 Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                <path d="M21 9 v14 M18 12 h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <h1 className="mt-4 text-[1.45rem] font-bold tracking-tight">CETIC de Mezessé</h1>
              <p className="mt-1 max-w-[19rem] text-sm leading-snug text-encre-2">
                Collège d'Enseignement Technique Industriel et Commercial
              </p>
            </div>

            {/* Formulaire */}
            <form onSubmit={soumettre} className="mt-8 space-y-5">
              {erreur ? <Erreur erreur={erreur} /> : null}

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Téléphone ou e-mail</span>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-encre-3" />
                  <input
                    className="champ h-12 pl-11 text-[0.95rem]"
                    autoComplete="username"
                    placeholder="6XX XX XX XX"
                    value={identifiant}
                    onChange={(e) => setIdentifiant(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Mot de passe</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-encre-3" />
                  <input
                    className="champ h-12 pl-11 pr-11 text-[0.95rem]"
                    type={voir ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 px-3.5 text-encre-3 hover:text-encre"
                    onClick={() => setVoir(!voir)}
                    aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {voir ? <EyeOff className="h-[1.1rem] w-[1.1rem]" /> : <Eye className="h-[1.1rem] w-[1.1rem]" />}
                  </button>
                </div>
              </label>

              <button type="submit" className="bouton-primaire h-12 w-full text-[0.95rem]" disabled={envoi}>
                {envoi && <Loader2 className="h-4 w-4 animate-spin" />}
                Se connecter
              </button>

              <p className="text-center text-sm text-encre-2">Mot de passe oublié ? Le Surveillant Général peut le réinitialiser.</p>
            </form>
          </div>

          {/* En-tête officiel, en pied de feuille */}
          <div className="border-t border-bord bg-surface-2 px-7 py-4 text-center text-xs leading-relaxed text-encre-2 sm:px-9">
            République du Cameroun · <span className="italic">Paix – Travail – Patrie</span>
            <br />
            Ministère des Enseignements Secondaires · Sangmélima, Dja-et-Lobo
          </div>
        </div>
      </main>
    </div>
  );
}
