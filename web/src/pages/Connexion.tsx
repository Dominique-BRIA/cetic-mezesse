import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Moon, Sun, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/contexte';
import type { Utilisateur } from '../lib/types';
import { MotifFond } from '../components/MotifFond';
import { Erreur } from '../components/ui';

// Signe de l'établissement en version claire, pour le panneau bleu.
function SigneClair({ taille = 44 }: { taille?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={taille} height={taille} aria-hidden>
      <rect width="32" height="32" rx="7" fill="white" />
      <path d="M8 23 L8 9 L19 23 Z" fill="none" stroke="#123f73" strokeWidth="2" strokeLinejoin="round" />
      <path d="M21 9 v14 M18 12 h6" stroke="#123f73" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

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
    <div className="grid min-h-screen bg-surface lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Panneau de l'établissement : bandeau sur mobile, demi-écran sur grand écran */}
      <aside className="relative overflow-hidden bg-[#123f73] text-white dark:bg-[#0d2540]">
        <MotifFond trait="rgb(255 255 255 / 0.13)" className="pointer-events-none absolute inset-0 h-full w-full" />
        <div className="relative flex h-full flex-col justify-between gap-8 px-6 py-6 sm:px-10 lg:px-14 lg:py-12">
          <div className="flex items-center gap-3">
            <SigneClair taille={40} />
            <div className="leading-tight">
              <div className="text-base font-bold">CETIC de Mezessé</div>
              <div className="text-xs text-white/70">Gestion scolaire</div>
            </div>
          </div>

          <div className="hidden max-w-lg lg:block">
            <h1 className="text-[2.1rem] font-bold leading-[1.15] tracking-tight">
              Collège d'Enseignement Technique Industriel et Commercial de Mezessé
            </h1>
            <p className="mt-4 text-[1.02rem] leading-relaxed text-white/80">
              Notes, bulletins, listes et statistiques de l'établissement, sur ordinateur comme sur téléphone.
            </p>
          </div>

          <div className="hidden border-t border-white/20 pt-5 text-sm leading-relaxed text-white/75 lg:block">
            <div className="font-semibold text-white">République du Cameroun</div>
            <div className="italic">Paix – Travail – Patrie</div>
            <div className="mt-2">Ministère des Enseignements Secondaires</div>
            <div>Sangmélima · Dja-et-Lobo · Région du Sud</div>
          </div>
        </div>
      </aside>

      {/* Formulaire */}
      <main className="relative flex items-start justify-center px-6 pb-12 pt-10 sm:items-center sm:pt-6">
        <button
          type="button"
          onClick={basculerTheme}
          className="bouton-discret absolute right-4 top-4"
          title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="hidden sm:inline">{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
        </button>

        <form onSubmit={soumettre} className="w-full max-w-[22rem]">
          <h2 className="text-[1.65rem] font-bold tracking-tight">Connexion</h2>
          <p className="mt-1.5 text-[0.95rem] text-encre-2">Entrez votre téléphone ou votre adresse e-mail, puis votre mot de passe.</p>

          <div className="mt-8 space-y-5">
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
          </div>

          <p className="mt-6 border-t border-bord pt-5 text-sm text-encre-2">
            Mot de passe oublié ? Le Surveillant Général peut le réinitialiser.
          </p>
        </form>
      </main>
    </div>
  );
}
