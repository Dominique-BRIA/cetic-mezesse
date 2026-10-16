import { useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  ClipboardList,
  FileText,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  PenLine,
  Settings,
  Sun,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  GraduationCap,
  School,
  X,
} from 'lucide-react';
import { useApp } from '../lib/contexte';
import { ROLES } from '../lib/format';
import type { Role } from '../lib/types';
import { MotifFond } from './MotifFond';
import { Marque } from './Marque';

interface Lien {
  vers: string;
  libelle: string;
  icone: ComponentType<{ className?: string }>;
  roles: Role[];
}

const P: Role = 'PROVISEUR';
const SG: Role = 'SURVEILLANT_GENERAL';
const PR: Role = 'PROFESSEUR';

const SECTIONS: { titre: string | null; liens: Lien[] }[] = [
  {
    titre: null,
    liens: [{ vers: '/', libelle: 'Tableau de bord', icone: LayoutDashboard, roles: [P, SG, PR] }],
  },
  {
    titre: 'Mes cours',
    liens: [
      { vers: '/saisie', libelle: 'Saisie des notes', icone: PenLine, roles: [PR] },
      { vers: '/manquantes', libelle: 'Élèves sans note', icone: ListChecks, roles: [PR] },
      { vers: '/statistiques-matieres', libelle: 'Statistiques', icone: BarChart3, roles: [PR] },
    ],
  },
  {
    titre: 'Scolarité',
    liens: [
      { vers: '/eleves', libelle: 'Élèves', icone: Users, roles: [P, SG] },
      { vers: '/renvoyes', libelle: 'Élèves renvoyés', icone: UserMinus, roles: [P, SG] },
      { vers: '/reinscription', libelle: 'Réinscriptions', icone: UserPlus, roles: [SG] },
    ],
  },
  {
    titre: 'Organisation',
    liens: [
      { vers: '/classes', libelle: 'Classes', icone: School, roles: [P, SG] },
      { vers: '/groupes', libelle: 'Groupes de matières', icone: Layers, roles: [P, SG] },
      { vers: '/matieres', libelle: 'Matières', icone: BookOpen, roles: [P, SG] },
      { vers: '/enseignants', libelle: 'Enseignants', icone: GraduationCap, roles: [P, SG] },
    ],
  },
  {
    titre: 'Évaluations',
    liens: [
      { vers: '/notes', libelle: 'Notes', icone: ClipboardList, roles: [P, SG] },
      { vers: '/bulletins', libelle: 'Bulletins et listes', icone: FileText, roles: [P, SG] },
      { vers: '/statistiques', libelle: 'Statistiques', icone: BarChart3, roles: [P, SG] },
      { vers: '/classement', libelle: 'Classement général', icone: Trophy, roles: [P, SG] },
    ],
  },
  {
    titre: 'Administration',
    liens: [
      { vers: '/annees', libelle: 'Années et séquences', icone: CalendarRange, roles: [P, SG] },
      { vers: '/parametres', libelle: 'Paramètres', icone: Settings, roles: [SG] },
    ],
  },
];

export function Cadre() {
  const { utilisateur, deconnecter, annees, annee, choisirAnnee, theme, basculerTheme } = useApp();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const lieu = useLocation();
  const naviguer = useNavigate();
  useEffect(() => setMenuOuvert(false), [lieu.pathname]);
  if (!utilisateur) return null;

  const sections = SECTIONS.map((s) => ({ ...s, liens: s.liens.filter((l) => l.roles.includes(utilisateur.role)) })).filter(
    (s) => s.liens.length,
  );

  const barre = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <Marque />
        <button type="button" className="bouton-discret lg:hidden" onClick={() => setMenuOuvert(false)} aria-label="Fermer le menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 pb-3">
        <label className="etiquette" htmlFor="annee">
          Année scolaire
        </label>
        <select id="annee" className="champ py-1.5" value={annee?.id ?? ''} onChange={(e) => choisirAnnee(e.target.value)}>
          {annees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.libelle}
              {a.active ? ' (en cours)' : ''}
            </option>
          ))}
        </select>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Navigation principale">
        {sections.map((s, i) => (
          <div key={i} className="mt-3 first:mt-0">
            {s.titre && <div className="px-2 pb-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-encre-3">{s.titre}</div>}
            <ul className="space-y-0.5">
              {s.liens.map((l) => (
                <li key={l.vers}>
                  <NavLink
                    to={l.vers}
                    end={l.vers === '/'}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 rounded px-2 py-[0.42rem] text-sm transition-colors',
                        isActive
                          ? 'bg-primaire-pale font-semibold text-primaire'
                          : 'text-encre-2 hover:bg-surface-2 hover:text-encre',
                      )
                    }
                  >
                    <l.icone className="h-4 w-4 shrink-0" />
                    {l.libelle}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-bord px-3 py-3">
        <div className="px-1">
          <div className="truncate text-sm font-semibold">
            {utilisateur.prenom} {utilisateur.nom}
          </div>
          <div className="text-xs text-encre-2">{ROLES[utilisateur.role]}</div>
        </div>
        <div className="mt-2 flex items-center gap-1">
          <button type="button" className="bouton-discret" onClick={basculerTheme} title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button type="button" className="bouton-discret" onClick={() => naviguer('/mot-de-passe')} title="Changer mon mot de passe">
            <KeyRound className="h-4 w-4" />
          </button>
          <button type="button" className="bouton-discret ml-auto" onClick={deconnecter}>
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <MotifFond />
      {/* Barre latérale : fixe sur grand écran, tiroir sur mobile */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-bord bg-surface lg:block">{barre}</aside>
      {menuOuvert && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgb(10_20_32/0.45)]"
            onClick={() => setMenuOuvert(false)}
            aria-label="Fermer le menu"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-bord bg-surface">{barre}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-bord bg-surface px-4 py-2.5 lg:hidden">
          <button type="button" className="bouton-discret -ml-2" onClick={() => setMenuOuvert(true)} aria-label="Ouvrir le menu">
            <Menu className="h-5 w-5" />
          </button>
          <Marque compacte />
          <span className="ml-auto text-xs text-encre-2">{annee?.libelle}</span>
        </div>
        <main className="px-3 py-4 sm:px-6 sm:py-7">
          <div className="mx-auto max-w-[1240px] rounded-lg border border-bord bg-surface px-4 py-5 shadow-feuille sm:px-7 sm:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
