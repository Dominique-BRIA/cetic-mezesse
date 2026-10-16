import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileSpreadsheet, FileText, Loader2, Pencil, Plus } from 'lucide-react';
import { api, telecharger } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import type { Classe, Enseignant } from '../../lib/types';
import { Carte, Chargement, Champ, Erreur, Modale, Page, Vide } from '../../components/ui';

export default function Classes() {
  const { a, annee } = useApp();
  const q = useQuery({ queryKey: ['classes', annee?.id], queryFn: () => api<Classe[]>('/classes') });
  const [edition, setEdition] = useState<Classe | 'nouvelle' | null>(null);
  const sg = a('SURVEILLANT_GENERAL');

  return (
    <Page
      titre="Classes"
      description={`Classes de l'année ${annee?.libelle ?? ''}.`}
      actions={
        sg && (
          <button type="button" className="bouton-primaire" onClick={() => setEdition('nouvelle')}>
            <Plus className="h-4 w-4" /> Nouvelle classe
          </button>
        )
      }
    >
      {q.isLoading ? (
        <Chargement />
      ) : q.error ? (
        <Erreur erreur={q.error} />
      ) : !q.data?.length ? (
        <Carte>
          <Vide titre="Aucune classe">Commencez par créer les classes de l'année, puis les groupes de matières.</Vide>
        </Carte>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((c) => (
            <Carte
              key={c.id}
              titre={c.nom}
              actions={
                sg && (
                  <button type="button" className="bouton-discret" onClick={() => setEdition(c)} aria-label={`Modifier ${c.nom}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                )
              }
            >
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-encre-2">Élèves</dt>
                  <dd className="font-semibold tabular-nums">{c._count.inscriptions}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-encre-2">Matières</dt>
                  <dd className="font-semibold tabular-nums">{c._count.matieres}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-encre-2">Prof. principal</dt>
                  <dd className="text-right">{c.profPrincipal ? `${c.profPrincipal.prenom} ${c.profPrincipal.nom}` : '—'}</dd>
                </div>
                {c.specialite && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-encre-2">Spécialité</dt>
                    <dd className="text-right">{c.specialite}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-bord pt-3 text-sm">
                <Link className="lien" to={`/eleves?classe=${c.id}`}>
                  Élèves
                </Link>
                <Link className="lien" to={`/matieres?classe=${c.id}`}>
                  Matières
                </Link>
                <button
                  type="button"
                  className="lien inline-flex items-center gap-1"
                  onClick={() => telecharger(`/documents/liste?classeId=${c.id}&format=pdf`, { ouvrir: true }).catch((e) => toast.error(e.message))}
                >
                  <FileText className="h-3.5 w-3.5" /> Liste PDF
                </button>
                <button
                  type="button"
                  className="lien inline-flex items-center gap-1"
                  onClick={() => telecharger(`/documents/liste?classeId=${c.id}&format=xlsx`).catch((e) => toast.error(e.message))}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </button>
              </div>
            </Carte>
          ))}
        </div>
      )}
      {edition && <FormClasse classe={edition === 'nouvelle' ? null : edition} fermer={() => setEdition(null)} />}
    </Page>
  );
}

function FormClasse({ classe, fermer }: { classe: Classe | null; fermer: () => void }) {
  const client = useQueryClient();
  const profs = useQuery({ queryKey: ['enseignants'], queryFn: () => api<Enseignant[]>('/utilisateurs?role=PROFESSEUR') });
  const [f, setF] = useState({
    nom: classe?.nom ?? '',
    nomEn: classe?.nomEn ?? '',
    niveau: classe?.niveau ?? 1,
    specialite: classe?.specialite ?? '',
    profPrincipalId: classe?.profPrincipalId ?? '',
  });
  const envoi = useMutation({
    mutationFn: () => {
      const corps = { ...f, profPrincipalId: f.profPrincipalId || null };
      return classe ? api(`/classes/${classe.id}`, { methode: 'PUT', corps }) : api('/classes', { methode: 'POST', corps });
    },
    onSuccess: () => {
      toast.success(classe ? 'Classe modifiée.' : 'Classe créée.');
      client.invalidateQueries({ queryKey: ['classes'] });
      fermer();
    },
  });
  return (
    <Modale
      titre={classe ? `Modifier ${classe.nom}` : 'Nouvelle classe'}
      ouverte
      fermer={fermer}
      pied={
        <>
          <button type="button" className="bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="button" className="bouton-primaire" disabled={!f.nom.trim() || envoi.isPending} onClick={() => envoi.mutate()}>
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
        <Champ libelle="Nom" aide="Tel qu'il s'imprime : « 2e année », « 1re année ELEC »…">
          <input className="champ" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} maxLength={60} />
        </Champ>
        <Champ libelle="Nom en anglais" aide="Facultatif.">
          <input className="champ" value={f.nomEn} onChange={(e) => setF({ ...f, nomEn: e.target.value })} maxLength={60} />
        </Champ>
        <Champ libelle="Niveau">
          <select className="champ" value={f.niveau} onChange={(e) => setF({ ...f, niveau: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? '1re' : `${n}e`} année
              </option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Spécialité" aide="Facultatif.">
          <input className="champ" value={f.specialite} onChange={(e) => setF({ ...f, specialite: e.target.value })} maxLength={80} />
        </Champ>
        <Champ libelle="Professeur principal" className="sm:col-span-2">
          <select className="champ" value={f.profPrincipalId} onChange={(e) => setF({ ...f, profPrincipalId: e.target.value })}>
            <option value="">Aucun</option>
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
