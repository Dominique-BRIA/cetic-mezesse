import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, Moon, Sun } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/contexte';
import type { Utilisateur } from '../lib/types';
import { MotifFond } from '../components/MotifFond';
import { Marque } from '../components/Marque';
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
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-[6vh]">
        <div className="w-full max-w-[25rem] rounded-lg border border-bord bg-surface shadow-feuille">
          <div className="border-b border-bord px-6 pb-5 pt-6">
            <Marque />
            <p className="mt-4 text-[0.7rem] font-semibold uppercase leading-relaxed tracking-[0.08em] text-encre-3">
              République du Cameroun · Ministère des Enseignements Secondaires
            </p>
            <p className="text-[0.7rem] uppercase tracking-[0.08em] text-encre-3">Sangmélima · Dja-et-Lobo · Sud</p>
          </div>
          <form onSubmit={soumettre} className="space-y-4 px-6 py-6">
            <div>
              <h1 className="text-lg font-bold">Connexion</h1>
              <p className="text-sm text-encre-2">Avec votre téléphone ou votre adresse électronique.</p>
            </div>
            {erreur ? <Erreur erreur={erreur} /> : null}
            <label className="block">
              <span className="etiquette">Téléphone ou e-mail</span>
              <input
                className="champ"
                autoComplete="username"
                inputMode="email"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label className="block">
              <span className="etiquette">Mot de passe</span>
              <div className="relative">
                <input
                  className="champ pr-10"
                  type={voir ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-3 text-encre-3 hover:text-encre"
                  onClick={() => setVoir(!voir)}
                  aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {voir ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <button type="submit" className="bouton-primaire w-full py-2.5" disabled={envoi}>
              {envoi && <Loader2 className="h-4 w-4 animate-spin" />}
              Se connecter
            </button>
            <p className="text-xs text-encre-3">Mot de passe oublié ? Adressez-vous au Surveillant Général.</p>
          </form>
        </div>
      </main>
    </div>
  );
}
