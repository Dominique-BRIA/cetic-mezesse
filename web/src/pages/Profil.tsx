import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/contexte';
import { ROLES } from '../lib/format';
import type { Utilisateur } from '../lib/types';
import { Carte, Champ, Erreur, Page } from '../components/ui';

// Espace profil : chacun modifie ses propres informations.
export default function Profil() {
  const { utilisateur, majProfil } = useApp();
  const u = utilisateur!;
  const [f, setF] = useState({
    prenom: u.prenom,
    nom: u.nom,
    telephone: u.telephone ?? '',
    email: u.email ?? '',
    discipline: u.discipline ?? '',
  });
  const [motDePasse, setMotDePasse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);

  // Le téléphone et l'e-mail servent à se connecter : les changer demande le mot de passe.
  const normaliser = (t: string) => t.replace(/[\s.-]/g, '');
  const identifiantChange =
    normaliser(f.telephone) !== normaliser(u.telephone ?? '') || f.email.trim().toLowerCase() !== (u.email ?? '');
  const prof = u.role === 'PROFESSEUR';

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const maj = await api<Utilisateur>('/auth/moi', {
        methode: 'PUT',
        corps: { ...f, ...(identifiantChange ? { motDePasse } : {}) },
        annee: false,
      });
      majProfil(maj);
      setMotDePasse('');
      toast.success('Profil enregistré.');
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Page titre="Mon profil" description={`${ROLES[u.role]} · vos informations, visibles par l'administration.`}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Carte titre="Informations">
          <form onSubmit={enregistrer} className="grid gap-4 sm:grid-cols-2">
            {erreur ? (
              <div className="sm:col-span-2">
                <Erreur erreur={erreur} />
              </div>
            ) : null}
            <Champ libelle="Prénom">
              <input className="champ" value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} maxLength={80} required />
            </Champ>
            <Champ libelle="Nom">
              <input className="champ" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} maxLength={60} required />
            </Champ>
            <Champ libelle="Téléphone" aide="Sert d'identifiant de connexion.">
              <input
                className="champ"
                type="tel"
                autoComplete="tel"
                value={f.telephone}
                onChange={(e) => setF({ ...f, telephone: e.target.value })}
                maxLength={20}
              />
            </Champ>
            <Champ libelle="E-mail" aide="Facultatif si le téléphone est renseigné.">
              <input
                className="champ"
                type="email"
                autoComplete="email"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
                maxLength={120}
              />
            </Champ>
            {prof && (
              <Champ libelle="Discipline" aide="Ce que vous enseignez, à titre indicatif." className="sm:col-span-2">
                <input className="champ" value={f.discipline} onChange={(e) => setF({ ...f, discipline: e.target.value })} maxLength={80} />
              </Champ>
            )}
            {identifiantChange && (
              <Champ
                libelle="Mot de passe actuel"
                aide="Obligatoire pour changer de téléphone ou d'e-mail : ce sont vos identifiants de connexion."
                className="sm:col-span-2"
              >
                <input
                  className="champ"
                  type="password"
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                />
              </Champ>
            )}
            <div className="sm:col-span-2">
              <button type="submit" className="bouton-primaire" disabled={envoi}>
                {envoi && <Loader2 className="h-4 w-4 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </form>
        </Carte>

        <Carte titre="Sécurité">
          <p className="text-sm text-encre-2">Le mot de passe sert sur le web et sur l'application mobile.</p>
          <Link to="/mot-de-passe" className="bouton-secondaire mt-3">
            <KeyRound className="h-4 w-4" /> Changer mon mot de passe
          </Link>
        </Carte>
      </div>
    </Page>
  );
}
