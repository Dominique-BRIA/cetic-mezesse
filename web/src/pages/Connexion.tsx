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
    // Pleine page, sans carte : bandes sur toute la largeur, puis le formulaire sur le motif adouci.
    <div className="flex min-h-screen flex-col bg-surface">
          <div className="flex h-3 shrink-0" aria-hidden>
            <div className="flex-1" style={{ background: DRAPEAU[0] }} />
            <div className="flex flex-1 items-center justify-center" style={{ background: DRAPEAU[1] }}>
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5">
                <path d="M5 0.4 L6.1 3.7 L9.6 3.7 L6.8 5.8 L7.9 9.2 L5 7.1 L2.1 9.2 L3.2 5.8 L0.4 3.7 L3.9 3.7 Z" fill={DRAPEAU[2]} />
              </svg>
            </div>
            <div className="flex-1" style={{ background: DRAPEAU[2] }} />
          </div>

          {/* En-tête officiel bilingue : français à gauche, anglais à droite */}
          <div className="border-b border-bord bg-surface-2">
          <div className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 sm:px-8">
            <div className="text-[0.68rem] leading-snug text-encre-2 sm:text-sm">
              <div className="font-bold uppercase tracking-wide text-encre">République du Cameroun</div>
              <div className="italic">Paix – Travail – Patrie</div>
              <div className="mt-0.5">MINESEC · DRES-Sud</div>
              <div>DDES Dja-et-Lobo</div>
            </div>
            <img src="/logo.png" alt="Sceau du CETIC de Mezesse" className="h-16 w-16 sm:h-24 sm:w-24" />
            <div className="text-right text-[0.68rem] leading-snug text-encre-2 sm:text-sm">
              <div className="font-bold uppercase tracking-wide text-encre">Republic of Cameroon</div>
              <div className="italic">Peace – Work – Fatherland</div>
              <div className="mt-0.5">MINSEC · South RDSE</div>
              <div>Dja and Lobo DDSE</div>
            </div>
          </div>
          </div>

          {/* Établissement */}
          <div className="relative border-b border-bord px-5 py-5 text-center">
            <div className="text-xl font-bold uppercase tracking-wide sm:text-2xl">CETIC de Mezesse</div>
            <div className="text-sm text-encre-2 sm:text-base">Collège d'Enseignement Technique Industriel et Commercial</div>
            <div className="mt-0.5 text-xs font-semibold text-primaire sm:text-sm">Gestion scolaire et pédagogique</div>
            <button
              type="button"
              className="bouton-discret absolute right-3 top-3 sm:right-6"
              onClick={basculerTheme}
              title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden md:inline">{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
            </button>
          </div>

          {/* Formulaire, sur le motif adouci pour rester lisible sans cadre */}
          <main className="relative flex-1">
          <MotifFond trait="rgb(var(--motif) / 0.22)" className="pointer-events-none absolute inset-0 h-full w-full" />
          <form onSubmit={soumettre} className="relative mx-auto w-full max-w-md px-5 pb-12 pt-8 sm:pt-12">
            <h1 className="text-2xl font-bold">Connexion</h1>
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
          </main>
    </div>
  );
}
