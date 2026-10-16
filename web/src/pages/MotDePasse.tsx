import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/contexte';
import { MotifFond } from '../components/MotifFond';
import { Marque } from '../components/Marque';
import { Champ, Erreur, Page } from '../components/ui';

export function MotDePasse({ obligatoire }: { obligatoire?: boolean }) {
  const { rafraichirProfil, deconnecter } = useApp();
  const naviguer = useNavigate();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (nouveau !== confirmation) {
      setErreur(new Error('Les deux nouveaux mots de passe ne sont pas identiques.'));
      return;
    }
    setEnvoi(true);
    try {
      await api('/auth/mot-de-passe', { methode: 'POST', corps: { ancien, nouveau }, annee: false });
      toast.success('Mot de passe modifié.');
      await rafraichirProfil();
      if (!obligatoire) naviguer('/');
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  }

  const formulaire = (
    <form onSubmit={soumettre} className="max-w-sm space-y-4">
      {erreur ? <Erreur erreur={erreur} /> : null}
      <Champ libelle="Mot de passe actuel">
        <input className="champ" type="password" autoComplete="current-password" value={ancien} onChange={(e) => setAncien(e.target.value)} required />
      </Champ>
      <Champ libelle="Nouveau mot de passe" aide="8 caractères au moins.">
        <input className="champ" type="password" autoComplete="new-password" minLength={8} value={nouveau} onChange={(e) => setNouveau(e.target.value)} required />
      </Champ>
      <Champ libelle="Confirmez le nouveau mot de passe">
        <input className="champ" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
      </Champ>
      <div className="flex gap-2">
        <button type="submit" className="bouton-primaire" disabled={envoi}>
          {envoi && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer
        </button>
        {obligatoire && (
          <button type="button" className="bouton-discret" onClick={deconnecter}>
            Se déconnecter
          </button>
        )}
      </div>
    </form>
  );

  if (!obligatoire) {
    return (
      <Page titre="Changer mon mot de passe" description="Le nouveau mot de passe remplace l'ancien sur le web et sur le mobile.">
        {formulaire}
      </Page>
    );
  }
  return (
    <div className="flex min-h-screen items-start justify-center px-4 pt-[10vh]">
      <MotifFond />
      <div className="w-full max-w-md rounded-lg border border-bord bg-surface p-6 shadow-feuille">
        <Marque />
        <h1 className="mt-5 text-lg font-bold">Choisissez votre mot de passe</h1>
        <p className="mb-4 mt-1 text-sm text-encre-2">
          Votre compte utilise le mot de passe provisoire. Remplacez-le avant de continuer.
        </p>
        {formulaire}
      </div>
    </div>
  );
}
