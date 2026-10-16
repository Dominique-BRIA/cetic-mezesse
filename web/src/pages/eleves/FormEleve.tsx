import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { Classe, Inscription } from '../../lib/types';
import { Champ, Erreur, Modale } from '../../components/ui';

// Création (SG, Proviseur) ou modification (SG) d'un élève et de son inscription de l'année.
export function FormEleve({
  ouverte,
  fermer,
  classes,
  inscription,
  classeParDefaut,
}: {
  ouverte: boolean;
  fermer: () => void;
  classes: Classe[];
  inscription?: Inscription | null;
  classeParDefaut?: string;
}) {
  const client = useQueryClient();
  const e = inscription?.eleve;
  const [f, setF] = useState({
    nom: e?.nom ?? '',
    prenoms: e?.prenoms ?? '',
    sexe: e?.sexe ?? 'F',
    dateNaissance: e?.dateNaissance.slice(0, 10) ?? '',
    lieuNaissance: e?.lieuNaissance ?? '',
    matriculeNational: e?.matriculeNational ?? '',
    parentNom: e?.parentNom ?? '',
    parentTelephone: e?.parentTelephone ?? '',
    parentAdresse: e?.parentAdresse ?? '',
    classeId: inscription?.classeId ?? classeParDefaut ?? classes[0]?.id ?? '',
    redoublant: inscription?.redoublant ?? false,
  });
  const maj = (cle: keyof typeof f) => (ev: { target: { value: string } }) => setF({ ...f, [cle]: ev.target.value });

  const envoi = useMutation({
    mutationFn: () =>
      e
        ? api(`/eleves/${e.id}`, { methode: 'PUT', corps: f })
        : api<{ matricule: string }>('/eleves', { methode: 'POST', corps: f }),
    onSuccess: (r) => {
      toast.success(e ? 'Élève modifié.' : `Élève créé, matricule ${(r as { matricule: string }).matricule}.`);
      client.invalidateQueries({ queryKey: ['eleves'] });
      client.invalidateQueries({ queryKey: ['eleve'] });
      client.invalidateQueries({ queryKey: ['classes'] });
      fermer();
    },
  });

  const soumettre = (ev: FormEvent) => {
    ev.preventDefault();
    envoi.mutate();
  };

  return (
    <Modale
      titre={e ? `Modifier ${e.nom} ${e.prenoms}` : 'Nouvel élève'}
      ouverte={ouverte}
      fermer={fermer}
      large
      pied={
        <>
          <button type="button" className="bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="submit" form="form-eleve" className="bouton-primaire" disabled={envoi.isPending}>
            {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </button>
        </>
      }
    >
      <form id="form-eleve" onSubmit={soumettre} className="space-y-5">
        {envoi.error ? <Erreur erreur={envoi.error} /> : null}
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-bold">Identité</legend>
          <Champ libelle="Nom">
            <input className="champ uppercase" value={f.nom} onChange={maj('nom')} required maxLength={80} />
          </Champ>
          <Champ libelle="Prénoms">
            <input className="champ" value={f.prenoms} onChange={maj('prenoms')} required maxLength={120} />
          </Champ>
          <Champ libelle="Sexe">
            <select className="champ" value={f.sexe} onChange={maj('sexe')}>
              <option value="F">Féminin</option>
              <option value="M">Masculin</option>
            </select>
          </Champ>
          <Champ libelle="Date de naissance">
            <input className="champ" type="date" value={f.dateNaissance} onChange={maj('dateNaissance')} required />
          </Champ>
          <Champ libelle="Lieu de naissance">
            <input className="champ" value={f.lieuNaissance} onChange={maj('lieuNaissance')} required maxLength={80} />
          </Champ>
          <Champ libelle="Matricule national" aide="À recopier depuis cartescolaire.cm quand il est connu.">
            <input className="champ" value={f.matriculeNational} onChange={maj('matriculeNational')} maxLength={40} />
          </Champ>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-bold">Scolarité</legend>
          <Champ libelle="Classe">
            <select className="champ" value={f.classeId} onChange={maj('classeId')} required>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </Champ>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--primaire))]" checked={f.redoublant} onChange={(ev) => setF({ ...f, redoublant: ev.target.checked })} />
            Redoublant
          </label>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-bold">Parent ou tuteur</legend>
          <Champ libelle="Nom">
            <input className="champ" value={f.parentNom} onChange={maj('parentNom')} maxLength={120} />
          </Champ>
          <Champ libelle="Téléphone">
            <input className="champ" inputMode="tel" value={f.parentTelephone} onChange={maj('parentTelephone')} maxLength={30} />
          </Champ>
          <Champ libelle="Adresse">
            <input className="champ" value={f.parentAdresse} onChange={maj('parentAdresse')} maxLength={200} />
          </Champ>
        </fieldset>
        {!e && <p className="text-xs text-encre-3">Le matricule scolaire est attribué automatiquement à l'enregistrement.</p>}
      </form>
    </Modale>
  );
}
