import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ErreurApi } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import type { Classe, Enseignant, Groupe, Matiere } from '../../lib/types';
import { Carte, Chargement, Champ, Erreur, Modale, Page, Vide } from '../../components/ui';

export default function Matieres() {
  const { a, annee } = useApp();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const classes = useQuery({ queryKey: ['classes', annee?.id], queryFn: () => api<Classe[]>('/classes') });
  const classeId = params.get('classe') ?? classes.data?.[0]?.id ?? '';
  const matieres = useQuery({
    queryKey: ['matieres', annee?.id, classeId],
    queryFn: () => api<Matiere[]>(`/matieres?classeId=${classeId}`),
    enabled: Boolean(classeId),
  });
  const [edition, setEdition] = useState<Matiere | 'nouvelle' | null>(null);
  const sg = a('SURVEILLANT_GENERAL');
  const classe = classes.data?.find((c) => c.id === classeId);

  const suppression = useMutation({
    mutationFn: async (m: Matiere) => {
      try {
        await api(`/matieres/${m.id}`, { methode: 'DELETE' });
      } catch (e) {
        if (e instanceof ErreurApi && e.statut === 409 && confirm(`${e.message}\n\nLes notes seront définitivement perdues.`)) {
          await api(`/matieres/${m.id}?confirmer=oui`, { methode: 'DELETE' });
        } else throw e;
      }
    },
    onSuccess: () => {
      toast.success('Matière supprimée.');
      client.invalidateQueries({ queryKey: ['matieres'] });
      client.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (e) => toast.error(e.message),
  });

  // Regroupement par groupe de matières, dans l'ordre du bulletin
  const parGroupe = new Map<string, { nom: string; ordre: number; matieres: Matiere[] }>();
  for (const m of matieres.data ?? []) {
    const g = parGroupe.get(m.groupe.id) ?? { nom: m.groupe.nom, ordre: m.groupe.ordre, matieres: [] };
    g.matieres.push(m);
    parGroupe.set(m.groupe.id, g);
  }
  const groupes = [...parGroupe.values()].sort((x, y) => x.ordre - y.ordre);
  const totalCoef = matieres.data?.reduce((s, m) => s + m.coefficient, 0) ?? 0;

  return (
    <Page
      titre="Matières"
      description="Les matières de chaque classe, leur groupe, leur coefficient et l'enseignant qui en a la charge."
      actions={
        sg &&
        classeId && (
          <button type="button" className="bouton-primaire" onClick={() => setEdition('nouvelle')}>
            <Plus className="h-4 w-4" /> Nouvelle matière
          </button>
        )
      }
    >
      <Champ libelle="Classe" className="max-w-xs">
        <select className="champ" value={classeId} onChange={(e) => setParams({ classe: e.target.value }, { replace: true })}>
          {classes.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </Champ>

      {!classes.data?.length && !classes.isLoading ? (
        <Carte>
          <Vide titre="Aucune classe">Créez d'abord les classes.</Vide>
        </Carte>
      ) : matieres.isLoading ? (
        <Chargement />
      ) : matieres.error ? (
        <Erreur erreur={matieres.error} />
      ) : !matieres.data?.length ? (
        <Carte>
          <Vide titre={`Aucune matière en ${classe?.nom ?? ''}`}>
            {classe && !classe.groupes.length ? "Rattachez d'abord un groupe de matières à cette classe." : 'Ajoutez les matières une à une.'}
          </Vide>
        </Carte>
      ) : (
        <Carte sansMarge titre={`${matieres.data.length} matières · total des coefficients : ${totalCoef}`}>
          <div className="overflow-x-auto">
            <table className="tableau">
              <thead>
                <tr>
                  <th className="w-14">Ordre</th>
                  <th>Matière</th>
                  <th className="text-right">Coef</th>
                  <th>Enseignant</th>
                  <th className="text-right">Notes</th>
                  {sg && <th />}
                </tr>
              </thead>
              {groupes.map((g) => (
                <tbody key={g.nom}>
                  <tr>
                    <td colSpan={sg ? 6 : 5} className="bg-surface-2 text-xs font-bold uppercase tracking-wide text-encre-2">
                      {g.nom} · coef {g.matieres.reduce((s, m) => s + m.coefficient, 0)}
                    </td>
                  </tr>
                  {g.matieres.map((m) => (
                    <tr key={m.id}>
                      <td className="tabular-nums text-encre-3">{m.ordre}</td>
                      <td>
                        <div className="font-medium">{m.nom}</div>
                        {m.nomEn && <div className="text-xs italic text-encre-3">{m.nomEn}</div>}
                      </td>
                      <td className="text-right font-semibold tabular-nums">{m.coefficient}</td>
                      <td className={m.professeur ? '' : 'text-alerte'}>
                        {m.professeur ? `${m.professeur.prenom} ${m.professeur.nom}` : 'Non attribuée'}
                      </td>
                      <td className="text-right tabular-nums text-encre-2">{m._count.notes}</td>
                      {sg && (
                        <td className="whitespace-nowrap text-right">
                          <button type="button" className="bouton-discret" onClick={() => setEdition(m)} aria-label="Modifier">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="bouton-discret hover:text-danger"
                            aria-label="Supprimer"
                            onClick={() => confirm(`Supprimer la matière « ${m.nom} » de ${m.classe.nom} ?`) && suppression.mutate(m)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </Carte>
      )}
      {edition && classeId && (
        <FormMatiere
          matiere={edition === 'nouvelle' ? null : edition}
          classeId={classeId}
          suivant={(matieres.data?.length ?? 0) + 1}
          fermer={() => setEdition(null)}
        />
      )}
    </Page>
  );
}

function FormMatiere({ matiere, classeId, suivant, fermer }: { matiere: Matiere | null; classeId: string; suivant: number; fermer: () => void }) {
  const client = useQueryClient();
  const { annee } = useApp();
  const groupes = useQuery({ queryKey: ['groupes', annee?.id], queryFn: () => api<Groupe[]>('/groupes') });
  const profs = useQuery({ queryKey: ['enseignants'], queryFn: () => api<Enseignant[]>('/utilisateurs?role=PROFESSEUR') });
  const groupesClasse = groupes.data?.filter((g) => g.classes.some((c) => c.id === classeId)) ?? [];
  const [f, setF] = useState({
    nom: matiere?.nom ?? '',
    nomEn: matiere?.nomEn ?? '',
    coefficient: matiere?.coefficient ?? 1,
    ordre: matiere?.ordre ?? suivant,
    groupeId: matiere?.groupeId ?? '',
    professeurId: matiere?.professeurId ?? '',
  });
  const groupeId = f.groupeId || groupesClasse[0]?.id || '';
  const envoi = useMutation({
    mutationFn: () => {
      const corps = { ...f, groupeId, classeId, professeurId: f.professeurId || null };
      return matiere ? api(`/matieres/${matiere.id}`, { methode: 'PUT', corps }) : api('/matieres', { methode: 'POST', corps });
    },
    onSuccess: () => {
      toast.success(matiere ? 'Matière modifiée.' : 'Matière créée.');
      client.invalidateQueries({ queryKey: ['matieres'] });
      client.invalidateQueries({ queryKey: ['classes'] });
      client.invalidateQueries({ queryKey: ['enseignants'] });
      fermer();
    },
  });
  return (
    <Modale
      titre={matiere ? `Modifier ${matiere.nom}` : 'Nouvelle matière'}
      ouverte
      fermer={fermer}
      pied={
        <>
          <button type="button" className="bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="button" className="bouton-primaire" disabled={!f.nom.trim() || !groupeId || envoi.isPending} onClick={() => envoi.mutate()}>
            {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {envoi.error ? (
          <div className="sm:col-span-2">
            <Erreur erreur={envoi.error} />
          </div>
        ) : null}
        {!groupes.isLoading && !groupesClasse.length && (
          <div className="sm:col-span-2">
            <Erreur erreur={new Error("Aucun groupe de matières n'est rattaché à cette classe. Créez-en un dans « Groupes de matières ».")} />
          </div>
        )}
        <Champ libelle="Nom">
          <input className="champ" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} maxLength={80} />
        </Champ>
        <Champ libelle="Nom en anglais" aide="Imprimé en petit sous le nom, sur le bulletin.">
          <input className="champ" value={f.nomEn} onChange={(e) => setF({ ...f, nomEn: e.target.value })} maxLength={80} />
        </Champ>
        <Champ libelle="Groupe">
          <select className="champ" value={groupeId} onChange={(e) => setF({ ...f, groupeId: e.target.value })}>
            {groupesClasse.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nom}
              </option>
            ))}
          </select>
        </Champ>
        <div className="grid grid-cols-2 gap-3">
          <Champ libelle="Coefficient">
            <input className="champ" type="number" min={1} max={20} value={f.coefficient} onChange={(e) => setF({ ...f, coefficient: Number(e.target.value) })} />
          </Champ>
          <Champ libelle="Ordre">
            <input className="champ" type="number" min={1} max={50} value={f.ordre} onChange={(e) => setF({ ...f, ordre: Number(e.target.value) })} />
          </Champ>
        </div>
        <Champ libelle="Enseignant" className="sm:col-span-2">
          <select className="champ" value={f.professeurId} onChange={(e) => setF({ ...f, professeurId: e.target.value })}>
            <option value="">Non attribuée</option>
            {profs.data
              ?.filter((p) => p.actif)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom} {p.prenom}
                  {p.discipline ? ` (${p.discipline})` : ''}
                </option>
              ))}
          </select>
        </Champ>
      </div>
    </Modale>
  );
}
