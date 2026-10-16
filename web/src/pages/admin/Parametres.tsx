import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { Bareme, Etablissement } from '../../lib/types';
import { Carte, Chargement, Champ, Erreur, Page } from '../../components/ui';

export default function Parametres() {
  return (
    <Page titre="Paramètres" description="Ce qui s'imprime en tête des documents, et les barèmes appliqués aux notes.">
      <FormEtablissement />
      <div className="grid gap-4 lg:grid-cols-2">
        <EditeurBareme type="GRADE" titre="Grades par matière" aide="Imprimés dans la colonne « Grade » du bulletin." />
        <EditeurBareme type="COTE" titre="Cotes de la moyenne générale" aide="La cote obtenue est cochée dans le bloc « Travail de l'élève »." />
      </div>
    </Page>
  );
}

const CHAMPS: [keyof Etablissement, string, string?][] = [
  ['nomFr', 'Nom (français)'],
  ['nomEn', 'Nom (anglais)'],
  ['sigle', 'Sigle'],
  ['code', 'Code / immatriculation'],
  ['regionFr', 'Région (français)', 'Sud'],
  ['regionEn', 'Région (anglais)', 'South'],
  ['departementFr', 'Département (français)'],
  ['departementEn', 'Département (anglais)'],
  ['arrondissement', 'Arrondissement'],
  ['localite', 'Localité'],
  ['boitePostale', 'Boîte postale'],
  ['telephone', 'Téléphone'],
  ['prefixeMatricule', 'Préfixe des matricules', 'Exemple : CTM donne CTM26-0001'],
];

function FormEtablissement() {
  const client = useQueryClient();
  const q = useQuery({ queryKey: ['etablissement'], queryFn: () => api<Etablissement | null>('/etablissement', { annee: false }) });
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (q.data) setF(Object.fromEntries(Object.entries(q.data).map(([k, v]) => [k, v === null ? '' : String(v)])));
  }, [q.data]);
  const envoi = useMutation({
    mutationFn: () => api('/etablissement', { methode: 'PUT', corps: f, annee: false }),
    onSuccess: () => {
      toast.success('Informations enregistrées.');
      client.invalidateQueries({ queryKey: ['etablissement'] });
    },
  });
  if (q.isLoading) return <Chargement />;
  return (
    <Carte
      titre="Établissement"
      actions={
        <button type="button" className="bouton-primaire" disabled={envoi.isPending} onClick={() => envoi.mutate()}>
          {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer
        </button>
      }
    >
      {envoi.error ? (
        <div className="mb-3">
          <Erreur erreur={envoi.error} />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CHAMPS.map(([cle, libelle, aide]) => (
          <Champ key={cle} libelle={libelle} aide={cle === 'prefixeMatricule' ? aide : undefined} className={cle === 'nomFr' || cle === 'nomEn' ? 'sm:col-span-2' : ''}>
            <input className="champ" value={f[cle] ?? ''} onChange={(e) => setF({ ...f, [cle]: e.target.value })} />
          </Champ>
        ))}
      </div>
    </Carte>
  );
}

function EditeurBareme({ type, titre, aide }: { type: 'GRADE' | 'COTE'; titre: string; aide: string }) {
  const client = useQueryClient();
  const q = useQuery({ queryKey: ['baremes'], queryFn: () => api<Bareme[]>('/baremes', { annee: false }) });
  const [lignes, setLignes] = useState<{ libelle: string; libelleLong: string; min: string }[]>([]);
  useEffect(() => {
    if (q.data)
      setLignes(
        q.data
          .filter((b) => b.type === type)
          .sort((a, b) => b.min - a.min)
          .map((b) => ({ libelle: b.libelle, libelleLong: b.libelleLong ?? '', min: String(b.min).replace('.', ',') })),
      );
  }, [q.data, type]);
  const envoi = useMutation({
    mutationFn: () =>
      api(`/baremes/${type}`, {
        methode: 'PUT',
        annee: false,
        corps: lignes.map((l) => ({ libelle: l.libelle, libelleLong: l.libelleLong, min: Number(l.min.replace(',', '.')) })),
      }),
    onSuccess: () => {
      toast.success('Barème enregistré. Il s\'applique aux prochains bulletins.');
      client.invalidateQueries({ queryKey: ['baremes'] });
    },
  });
  const maj = (i: number, cle: 'libelle' | 'libelleLong' | 'min', v: string) => setLignes(lignes.map((l, k) => (k === i ? { ...l, [cle]: v } : l)));

  return (
    <Carte
      titre={titre}
      actions={
        <button type="button" className="bouton-primaire" disabled={envoi.isPending} onClick={() => envoi.mutate()}>
          {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer
        </button>
      }
    >
      <p className="mb-3 text-sm text-encre-2">{aide} Chaque mention s'applique à partir de sa note minimale (incluse).</p>
      {envoi.error ? (
        <div className="mb-3">
          <Erreur erreur={envoi.error} />
        </div>
      ) : null}
      <table className="tableau">
        <thead>
          <tr>
            <th className="w-24">Mention</th>
            {type === 'COTE' && <th>Signification</th>}
            <th className="w-28 text-right">À partir de</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i}>
              <td>
                <input className="champ py-1.5 font-semibold" value={l.libelle} onChange={(e) => maj(i, 'libelle', e.target.value)} maxLength={10} />
              </td>
              {type === 'COTE' && (
                <td>
                  <input className="champ py-1.5" value={l.libelleLong} onChange={(e) => maj(i, 'libelleLong', e.target.value)} maxLength={80} />
                </td>
              )}
              <td>
                <input className="champ py-1.5 text-right tabular-nums" inputMode="decimal" value={l.min} onChange={(e) => maj(i, 'min', e.target.value)} />
              </td>
              <td>
                <button type="button" className="bouton-discret hover:text-danger" aria-label="Retirer" onClick={() => setLignes(lignes.filter((_, k) => k !== i))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="bouton-discret mt-2" onClick={() => setLignes([...lignes, { libelle: '', libelleLong: '', min: '' }])}>
        <Plus className="h-4 w-4" /> Ajouter une mention
      </button>
    </Carte>
  );
}
