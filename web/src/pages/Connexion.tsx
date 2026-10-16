import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, Moon, Sun } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/contexte';
import type { Utilisateur } from '../lib/types';
import { MotifFond } from '../components/MotifFond';
import { Erreur } from '../components/ui';

// Couleurs du drapeau, pour le filet en haut de la feuille.
const DRAPEAU = ['#007a5e', '#ce1126', '#fcd116'];

export function Connexion() {
  const { connecter, theme, basculerTheme } = useApp();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [memoriser, setMemoriser] = useState(true);
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
      connecter(r.jeton, r.utilisateur, memoriser);
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

      <main className="flex flex-1 items-start justify-center px-3 pb-16 sm:px-4 sm:pt-[2vh]">
        <div className="w-full max-w-[30rem] overflow-hidden rounded-lg border border-bord bg-surface shadow-feuille">
          <div className="flex h-1.5" aria-hidden>
            {DRAPEAU.map((c) => (
              <div key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>

          {/* En-tête officiel bilingue : français à gauche, anglais à droite */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-bord bg-surface-2 px-4 py-3.5 sm:px-6">
            <div className="text-[0.68rem] leading-snug text-encre-2 sm:text-xs">
              <div className="font-bold uppercase tracking-wide text-encre">République du Cameroun</div>
              <div className="italic">Paix – Travail – Patrie</div>
              <div className="mt-0.5">MINESEC · DRES-Sud</div>
              <div>DDES Dja-et-Lobo</div>
            </div>
            <svg viewBox="0 0 32 32" className="h-10 w-10 sm:h-11 sm:w-11" aria-hidden>
              <rect width="32" height="32" rx="7" className="fill-primaire" />
              <path d="M8 23 L8 9 L19 23 Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              <path d="M21 9 v14 M18 12 h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div className="text-right text-[0.68rem] leading-snug text-encre-2 sm:text-xs">
              <div className="font-bold uppercase tracking-wide text-encre">Republic of Cameroon</div>
              <div className="italic">Peace – Work – Fatherland</div>
              <div className="mt-0.5">MINSEC · South RDSE</div>
              <div>Dja and Lobo DDSE</div>
            </div>
          </div>

          {/* Établissement */}
          <div className="border-b border-bord px-5 py-4 text-center sm:px-7">
            <div className="text-lg font-bold uppercase tracking-wide">CETIC de Mezessé</div>
            <div className="text-sm text-encre-2">Collège d'Enseignement Technique Industriel et Commercial</div>
            <div className="mt-0.5 text-xs font-semibold text-primaire">Gestion scolaire et pédagogique</div>
          </div>

          {/* Formulaire */}
          <form onSubmit={soumettre} className="px-5 pb-7 pt-6 sm:px-7">
            <h1 className="text-xl font-bold">Connexion</h1>
            <p className="mt-1 text-sm text-encre-2">Espace réservé aux enseignants et au personnel administratif.</p>

            <div className="mt-6 space-y-5">
              {erreur ? <Erreur erreur={erreur} /> : null}

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Téléphone ou e-mail</span>
                <input
                  className="champ h-11"
                  autoComplete="username"
                  placeholder="Ex. : 677 00 00 00"
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  required
                  autoFocus
                />
                <span className="mt-1.5 block text-xs text-encre-3">Le numéro ou l'adresse enregistré par le Surveillant Général.</span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Mot de passe</span>
                <div className="relative">
                  <input
                    className="champ h-11 pr-11"
                    type={voir ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
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

              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-bord accent-[rgb(var(--primaire))]"
                  checked={memoriser}
                  onChange={(e) => setMemoriser(e.target.checked)}
                />
                Rester connecté sur cet appareil
              </label>

              <button
                type="submit"
                disabled={envoi}
                className="bouton h-11 w-full bg-[#16324f] text-white hover:bg-[#10263d] dark:bg-primaire dark:text-[rgb(12_24_38)] dark:hover:bg-primaire-fonce"
              >
                {envoi && <Loader2 className="h-4 w-4 animate-spin" />}
                Se connecter
              </button>
            </div>

            <p className="mt-6 border-t border-bord pt-4 text-center text-xs text-encre-2">
              Mot de passe oublié ? Adressez-vous au Surveillant Général.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
