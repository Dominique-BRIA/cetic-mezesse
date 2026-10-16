import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './lib/contexte';
import type { Role } from './lib/types';
import { Cadre } from './components/Cadre';
import { Chargement } from './components/ui';
import { Connexion } from './pages/Connexion';
import { MotDePasse } from './pages/MotDePasse';

const TableauDeBord = lazy(() => import('./pages/TableauDeBord'));
const Saisie = lazy(() => import('./pages/prof/Saisie'));
const Manquantes = lazy(() => import('./pages/prof/Manquantes'));
const StatsMatieres = lazy(() => import('./pages/prof/StatsMatieres'));
const Eleves = lazy(() => import('./pages/eleves/Eleves'));
const FicheEleve = lazy(() => import('./pages/eleves/FicheEleve'));
const Renvoyes = lazy(() => import('./pages/eleves/Renvoyes'));
const Reinscription = lazy(() => import('./pages/eleves/Reinscription'));
const Classes = lazy(() => import('./pages/organisation/Classes'));
const Groupes = lazy(() => import('./pages/organisation/Groupes'));
const Matieres = lazy(() => import('./pages/organisation/Matieres'));
const Enseignants = lazy(() => import('./pages/organisation/Enseignants'));
const Notes = lazy(() => import('./pages/evaluations/Notes'));
const Bulletins = lazy(() => import('./pages/evaluations/Bulletins'));
const Statistiques = lazy(() => import('./pages/evaluations/Statistiques'));
const Classement = lazy(() => import('./pages/evaluations/Classement'));
const Annees = lazy(() => import('./pages/admin/Annees'));
const Parametres = lazy(() => import('./pages/admin/Parametres'));

const P: Role = 'PROVISEUR';
const SG: Role = 'SURVEILLANT_GENERAL';
const PR: Role = 'PROFESSEUR';

function Garde({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { a } = useApp();
  return a(...roles) ? <>{children}</> : <Navigate to="/" replace />;
}

export function App() {
  const { utilisateur, chargement } = useApp();
  if (chargement) return <Chargement texte="Ouverture de la session…" />;
  if (!utilisateur) return <Connexion />;
  if (utilisateur.doitChangerMotDePasse) return <MotDePasse obligatoire />;

  const r = (roles: Role[], el: ReactNode) => <Garde roles={roles}>{el}</Garde>;
  return (
    <Suspense fallback={<Chargement />}>
      <Routes>
        <Route element={<Cadre />}>
          <Route index element={<TableauDeBord />} />
          <Route path="mot-de-passe" element={<MotDePasse />} />
          <Route path="saisie" element={r([PR], <Saisie />)} />
          <Route path="manquantes" element={r([PR], <Manquantes />)} />
          <Route path="statistiques-matieres" element={r([PR], <StatsMatieres />)} />
          <Route path="eleves" element={r([P, SG], <Eleves />)} />
          <Route path="eleves/:id" element={r([P, SG], <FicheEleve />)} />
          <Route path="renvoyes" element={r([P, SG], <Renvoyes />)} />
          <Route path="reinscription" element={r([SG], <Reinscription />)} />
          <Route path="classes" element={r([P, SG], <Classes />)} />
          <Route path="groupes" element={r([P, SG], <Groupes />)} />
          <Route path="matieres" element={r([P, SG], <Matieres />)} />
          <Route path="enseignants" element={r([P, SG], <Enseignants />)} />
          <Route path="notes" element={r([P, SG], <Notes />)} />
          <Route path="bulletins" element={r([P, SG], <Bulletins />)} />
          <Route path="statistiques" element={r([P, SG], <Statistiques />)} />
          <Route path="classement" element={r([P, SG], <Classement />)} />
          <Route path="annees" element={r([P, SG], <Annees />)} />
          <Route path="parametres" element={r([SG], <Parametres />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
