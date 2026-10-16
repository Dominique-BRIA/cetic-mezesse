import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import type { Classe, Groupe } from '../../lib/types';
import { Carte, Chargement, Champ, Erreur, Modale, Page, Vide } from '../../components/ui';

export default function Groupes() {
  const { a, annee } = useApp();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ['groupes', annee?.id], queryFn: () => api<Groupe[]>('/groupes') });
  const [edition, setEdition] = useState<Groupe | 'nouveau' | null>(null);
  const sg = a('SURVEILLANT_GENERAL');
  const suppression = useMutation({
    mutationFn: (g: Groupe) => api(`/groupes/${g.id}`, { methode: 'DELETE' }),
    onSuccess: () => {
      toast.success('Groupe supprimé.');
      client.invalidateQueries({ queryKey: ['groupes'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Page
      titre="Groupes de matières"
      description="Les groupes structurent le bulletin (sous-totaux et moyennes par groupe). Un même groupe peut servir à plusieurs classes."
      actions={
        sg && (
          <button type="button" className="bouton-primaire" onClick={() => setEdition('nouveau')}>
            <Plus className="h-4 w-4" /> Nouveau groupe
          </button>
        )
      }
    >
      <Carte sansMarge>
        {q.isLoading ? (
          <div className="px-4">
            <Chargement />
          </div>
        ) : q.error ? (
          <div className="p-4">
            <Erreur erreur={q.error} />
          </div>
        ) : !q.data?.length ? (
          <Vide titre="Aucun groupe">Par exemple : matières générales, matières professionnelles, matières complémentaires.</Vide>
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau">
              <thead>
                <tr>
                  <th className="w-16">Ordre</th>
                  <th>Groupe</th>
                  <th>Classes</th>
                  <th className="text-right">Matières</th>
                  {sg && <th />}
                </tr>
              </thead>
              <tbody>
                {q.data.map((g) => (
                  <tr key={g.id}>
                    <td className="tabular-nums">{g.ordre}</td>
                    <td>
                      <div className="font-medium">{g.nom}</div>
                      {g.nomEn && <div className="text-xs italic text-encre-3">{g.nomEn}</div>}
                    </td>
                    <td className="text-encre-2">{g.classes.map((c) => c.nom).join(', ')}</td>
                    <td className="text-right tabular-nums">{g._count.matieres}</td>
                    {sg && (
                      <td className="whitespace-nowrap text-right">
                        <button type="button" className="bouton-discret" onClick={() => setEdition(g)} aria-label="Modifier">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="bouton-discret hover:text-danger"
                          aria-label="Supprimer"
                          onClick={() => confirm(`Supprimer le groupe « ${g.nom} » ?`) && suppression.mutate(g)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>
      {edition && <FormGroupe groupe={edition === 'nouveau' ? null : edition} suivant={(q.data?.length ?? 0) + 1} fermer={() => setEdition(null)} />}
    </Page>
  );
}

function FormGroupe({ groupe, suivant, fermer }: { groupe: Groupe | null; suivant: number; fermer: () => void }) {
  const client = useQueryClient();
  const { annee } = useApp();
  const classes = useQuery({ queryKey: ['classes', annee?.id], queryFn: () => api<Classe[]>('/classes') });
  const [f, setF] = useState({ nom: groupe?.nom ?? '', nomEn: groupe?.nomEn ?? '', ordre: groupe?.ordre ?? suivant });
  const [choisies, setChoisies] = useState<Set<string>>(new Set(groupe?.classes.map((c) => c.id) ?? []));
  const envoi = useMutation({
    mutationFn: () => {
      const corps = { ...f, classeIds: [...choisies] };
      return groupe ? api(`/groupes/${groupe.id}`, { methode: 'PUT', corps }) : api('/groupes', { methode: 'POST', corps });
    },
    onSuccess: () => {
      toast.success(groupe ? 'Groupe modifié.' : 'Groupe créé.');
      client.invalidateQueries({ queryKey: ['groupes'] });
      client.invalidateQueries({ queryKey: ['classes'] });
      fermer();
    },
  });
  const basculer = (id: string) => {
    const s = new Set(choisies);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setChoisies(s);
  };
  return (
    <Modale
      titre={groupe ? `Modifier ${groupe.nom}` : 'Nouveau groupe de matières'}
      ouverte
      fermer={fermer}
      pied={
        <>
          <button type="button" className="bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="button" className="bouton-primaire" disabled={!f.nom.trim() || !choisies.size || envoi.isPending} onClick={() => envoi.mutate()}>
            {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {envoi.error ? <Erreur erreur={envoi.error} /> : null}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem]">
          <Champ libelle="Nom">
            <input className="champ" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} maxLength={80} />
          </Champ>
          <Champ libelle="Nom en anglais">
            <input className="champ" value={f.nomEn} onChange={(e) => setF({ ...f, nomEn: e.target.value })} maxLength={80} />
          </Champ>
          <Champ libelle="Ordre">
            <input className="champ" type="number" min={1} max={20} value={f.ordre} onChange={(e) => setF({ ...f, ordre: Number(e.target.value) })} />
          </Champ>
        </div>
        <fieldset>
          <legend className="etiquette">Classes concernées</legend>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {classes.data?.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded border border-bord px-3 py-2 text-sm hover:bg-surface-2">
                <input type="checkbox" className="h-4 w-4" checked={choisies.has(c.id)} onChange={() => basculer(c.id)} />
                {c.nom}
              </label>
            ))}
          </div>
          {classes.data && classes.data.length > 1 && (
            <button
              type="button"
              className="lien mt-2 text-sm"
              onClick={() => setChoisies(choisies.size === classes.data.length ? new Set() : new Set(classes.data.map((c) => c.id)))}
            >
              {choisies.size === classes.data.length ? 'Aucune' : 'Toutes les classes'}
            </button>
          )}
        </fieldset>
      </div>
    </Modale>
  );
}
