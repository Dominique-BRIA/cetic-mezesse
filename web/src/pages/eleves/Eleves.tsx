import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, FileText, Loader2, Plus, Search, Upload } from 'lucide-react';
import { api, telecharger } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import { date } from '../../lib/format';
import type { Classe, Inscription } from '../../lib/types';
import { Carte, Chargement, Champ, Erreur, Modale, Page, Vide } from '../../components/ui';
import { FormEleve } from './FormEleve';

export default function Eleves() {
  const { a, annee } = useApp();
  const [params, setParams] = useSearchParams();
  const classeId = params.get('classe') ?? '';
  const [recherche, setRecherche] = useState('');
  const [creation, setCreation] = useState(false);
  const [import_, setImport] = useState(false);

  const classes = useQuery({ queryKey: ['classes', annee?.id], queryFn: () => api<Classe[]>('/classes') });
  const eleves = useQuery({
    queryKey: ['eleves', annee?.id, classeId, recherche],
    queryFn: () => api<Inscription[]>(`/eleves?classeId=${classeId}&q=${encodeURIComponent(recherche)}`),
  });

  const exporter = (format: 'pdf' | 'xlsx') =>
    telecharger(`/documents/liste?classeId=${classeId}&format=${format}`, { ouvrir: format === 'pdf' }).catch((e) => toast.error(e.message));

  return (
    <Page
      titre="Élèves"
      description={`Élèves inscrits en ${annee?.libelle ?? ''}. Les élèves renvoyés n'apparaissent pas ici.`}
      actions={
        <>
          {a('SURVEILLANT_GENERAL') && (
            <button type="button" className="bouton-secondaire" onClick={() => setImport(true)}>
              <Upload className="h-4 w-4" /> Importer
            </button>
          )}
          <button type="button" className="bouton-primaire" onClick={() => setCreation(true)} disabled={!classes.data?.length}>
            <Plus className="h-4 w-4" /> Nouvel élève
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <Champ libelle="Classe" className="w-56">
          <select
            className="champ"
            value={classeId}
            onChange={(e) => setParams(e.target.value ? { classe: e.target.value } : {}, { replace: true })}
          >
            <option value="">Toutes les classes</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom} ({c._count.inscriptions})
              </option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Rechercher" className="min-w-[14rem] flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-3" />
            <input className="champ pl-9" placeholder="Nom, prénom ou matricule" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
        </Champ>
        {classeId && (
          <div className="flex gap-2">
            <button type="button" className="bouton-secondaire" onClick={() => exporter('pdf')}>
              <FileText className="h-4 w-4" /> Liste PDF
            </button>
            <button type="button" className="bouton-secondaire" onClick={() => exporter('xlsx')}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
          </div>
        )}
      </div>

      <Carte sansMarge titre={eleves.data ? `${eleves.data.length} élève(s)` : 'Élèves'}>
        {eleves.isLoading ? (
          <div className="px-4">
            <Chargement />
          </div>
        ) : eleves.error ? (
          <div className="p-4">
            <Erreur erreur={eleves.error} />
          </div>
        ) : !eleves.data?.length ? (
          <Vide titre={recherche ? 'Aucun élève ne correspond à la recherche' : 'Aucun élève inscrit'}>
            {!recherche && 'Ajoutez les élèves un par un ou importez un fichier Excel.'}
          </Vide>
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Nom et prénoms</th>
                  <th>Sexe</th>
                  <th className="hidden md:table-cell">Né(e) le</th>
                  <th>Classe</th>
                  <th className="hidden lg:table-cell">Mat. national</th>
                  <th className="hidden sm:table-cell">Redoublant</th>
                </tr>
              </thead>
              <tbody>
                {eleves.data.map((i) => (
                  <tr key={i.id}>
                    <td className="tabular-nums text-encre-2">{i.eleve.matricule}</td>
                    <td>
                      <Link to={`/eleves/${i.eleve.id}`} className="lien">
                        {i.eleve.nom} {i.eleve.prenoms}
                      </Link>
                    </td>
                    <td>{i.eleve.sexe}</td>
                    <td className="hidden tabular-nums md:table-cell">{date(i.eleve.dateNaissance)}</td>
                    <td>{i.classe.nom}</td>
                    <td className="hidden tabular-nums text-encre-2 lg:table-cell">{i.eleve.matriculeNational ?? '—'}</td>
                    <td className="hidden sm:table-cell">{i.redoublant ? 'Oui' : 'Non'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>

      {creation && classes.data && (
        <FormEleve ouverte fermer={() => setCreation(false)} classes={classes.data} classeParDefaut={classeId || undefined} />
      )}
      {import_ && classes.data && <ImportEleves fermer={() => setImport(false)} classes={classes.data} classeParDefaut={classeId} />}
    </Page>
  );
}

function ImportEleves({ fermer, classes, classeParDefaut }: { fermer: () => void; classes: Classe[]; classeParDefaut: string }) {
  const client = useQueryClient();
  const [classeId, setClasseId] = useState(classeParDefaut || classes[0]?.id || '');
  const [fichier, setFichier] = useState<File | null>(null);
  const envoi = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('classeId', classeId);
      fd.append('fichier', fichier!);
      return api<{ message: string }>('/eleves/import', { methode: 'POST', corps: fd });
    },
    onSuccess: (r) => {
      toast.success(r.message);
      client.invalidateQueries({ queryKey: ['eleves'] });
      client.invalidateQueries({ queryKey: ['classes'] });
      fermer();
    },
  });
  return (
    <Modale
      titre="Importer des élèves"
      ouverte
      fermer={fermer}
      pied={
        <>
          <button type="button" className="bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="button" className="bouton-primaire" disabled={!fichier || !classeId || envoi.isPending} onClick={() => envoi.mutate()}>
            {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Importer
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-encre-2">
          Un fichier Excel (.xlsx) ou CSV, une ligne par élève, dans l'ordre des colonnes du modèle. Si une seule ligne est invalide,
          rien n'est importé et les erreurs sont listées.
        </p>
        <button
          type="button"
          className="bouton-secondaire"
          onClick={() => telecharger('/eleves/modele-import').catch((e) => toast.error(e.message))}
        >
          <Download className="h-4 w-4" /> Télécharger le modèle
        </button>
        {envoi.error ? <Erreur erreur={envoi.error} /> : null}
        <Champ libelle="Classe d'inscription">
          <select className="champ" value={classeId} onChange={(e) => setClasseId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Fichier">
          <input
            className="champ file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm file:font-semibold"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
          />
        </Champ>
      </div>
    </Modale>
  );
}
