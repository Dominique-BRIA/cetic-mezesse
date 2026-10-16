import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileSpreadsheet, FileText, Loader2, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { api, telecharger } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import { nomClasse } from '../../lib/format';
import type { Classe, Enseignant, Specialite } from '../../lib/types';
import { Carte, Chargement, Champ, Erreur, Modale, Page, Vide } from '../../components/ui';

export default function Classes() {
  const { a, annee } = useApp();
  const q = useQuery({ queryKey: ['classes', annee?.id], queryFn: () => api<Classe[]>('/classes') });
  const [edition, setEdition] = useState<Classe | 'nouvelle' | null>(null);
  const [specialites, setSpecialites] = useState(false);
  const sg = a('SURVEILLANT_GENERAL');

  return (
    <Page
      titre="Classes"
      actions={
        sg && (
          <>
            <button type="button" className="bouton-secondaire" onClick={() => setSpecialites(true)}>
              <Tags className="h-4 w-4" /> Spécialités
            </button>
            <button type="button" className="bouton-primaire" onClick={() => setEdition('nouvelle')}>
              <Plus className="h-4 w-4" /> Nouvelle classe
            </button>
          </>
        )
      }
    >
      {q.isLoading ? (
        <Chargement />
      ) : q.error ? (
        <Erreur erreur={q.error} />
      ) : !q.data?.length ? (
        <Carte>
          <Vide titre="Aucune classe">Créez d'abord les spécialités, puis les classes de l'année et leurs groupes de matières.</Vide>
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
                <div className="flex justify-between gap-3">
                  <dt className="text-encre-2">Spécialité</dt>
                  <dd className="text-right">{c.specialite?.nom ?? '—'}</dd>
                </div>
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
      {edition && (
        <FormClasse classe={edition === 'nouvelle' ? null : edition} classes={q.data ?? []} fermer={() => setEdition(null)} />
      )}
      {specialites && <GestionSpecialites fermer={() => setSpecialites(false)} />}
    </Page>
  );
}

function FormClasse({ classe, classes, fermer }: { classe: Classe | null; classes: Classe[]; fermer: () => void }) {
  const client = useQueryClient();
  const profs = useQuery({ queryKey: ['enseignants'], queryFn: () => api<Enseignant[]>('/utilisateurs?role=PROFESSEUR') });
  const specialites = useQuery({ queryKey: ['specialites'], queryFn: () => api<Specialite[]>('/specialites', { annee: false }) });
  const [f, setF] = useState({
    niveau: classe?.niveau ?? 1,
    specialiteId: classe?.specialiteId ?? '',
    profPrincipalId: classe?.profPrincipalId ?? '',
  });
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  // Aperçu du nom : la classe se range après celles qui ont déjà ce niveau et cette spécialité.
  const specialite = specialites.data?.find((s) => s.id === f.specialiteId);
  const memeGroupe = (c: Classe) => c.niveau === f.niveau && (c.specialiteId ?? '') === f.specialiteId;
  const resteDansSonGroupe = classe !== null && memeGroupe(classe);
  const voisines = classes.filter((c) => memeGroupe(c) && c.id !== classe?.id).sort((x, y) => x.numero - y.numero);
  const rang = resteDansSonGroupe ? voisines.filter((c) => c.numero < classe.numero).length : voisines.length;
  const nombre = voisines.length + 1;
  const apercu = nomClasse(f.niveau, specialite?.nom, rang, nombre);
  const renommees = voisines
    .map((c, i) => ({ avant: c.nom, apres: nomClasse(f.niveau, specialite?.nom, i < rang ? i : i + 1, nombre) }))
    .filter((r) => r.avant !== r.apres);

  const invalider = () => {
    client.invalidateQueries({ queryKey: ['classes'] });
    client.invalidateQueries({ queryKey: ['specialites'] });
  };
  const envoi = useMutation({
    mutationFn: () => {
      const corps = { ...f, specialiteId: f.specialiteId || null, profPrincipalId: f.profPrincipalId || null };
      return classe ? api(`/classes/${classe.id}`, { methode: 'PUT', corps }) : api('/classes', { methode: 'POST', corps });
    },
    onSuccess: () => {
      toast.success(classe ? 'Classe modifiée.' : 'Classe créée.');
      invalider();
      fermer();
    },
  });
  const suppression = useMutation({
    mutationFn: () => api(`/classes/${classe!.id}`, { methode: 'DELETE' }),
    onSuccess: () => {
      toast.success('Classe supprimée.');
      invalider();
      fermer();
    },
  });
  const supprimable = classe !== null && classe._count.inscriptions === 0;

  return (
    <Modale
      titre={classe ? `Modifier ${classe.nom}` : 'Nouvelle classe'}
      ouverte
      fermer={fermer}
      pied={
        <>
          {supprimable && (
            <button
              type="button"
              className={confirmerSuppression ? 'bouton-danger mr-auto' : 'bouton-secondaire mr-auto'}
              disabled={suppression.isPending}
              onClick={() => (confirmerSuppression ? suppression.mutate() : setConfirmerSuppression(true))}
            >
              <Trash2 className="h-4 w-4" />
              {confirmerSuppression ? 'Confirmer la suppression' : 'Supprimer'}
            </button>
          )}
          <button type="button" className="bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="button" className="bouton-primaire" disabled={envoi.isPending} onClick={() => envoi.mutate()}>
            {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {envoi.error || suppression.error ? (
          <div className="sm:col-span-2">
            <Erreur erreur={envoi.error ?? suppression.error} />
          </div>
        ) : null}
        <Champ libelle="Niveau">
          <select className="champ" value={f.niveau} onChange={(e) => setF({ ...f, niveau: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? '1re' : `${n}e`} année
              </option>
            ))}
          </select>
        </Champ>
        <Champ
          libelle="Spécialité"
          aide={!specialites.data?.length && !specialites.isLoading ? 'Aucune spécialité : créez-les avec le bouton « Spécialités ».' : undefined}
        >
          <select className="champ" value={f.specialiteId} onChange={(e) => setF({ ...f, specialiteId: e.target.value })}>
            <option value="">Sans spécialité</option>
            {specialites.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </Champ>
        <div className="rounded border border-bord bg-surface-2 px-3 py-2.5 text-sm sm:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-encre-2">Nom de la classe</div>
          <div className="mt-0.5 font-semibold">{apercu}</div>
          {renommees.length > 0 && (
            <div className="mt-1 text-xs text-encre-2">
              {renommees.map((r) => `${r.avant} deviendra ${r.apres}`).join(' · ')}
            </div>
          )}
        </div>
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
        {classe && !supprimable && (
          <p className="text-xs text-encre-3 sm:col-span-2">Une classe qui a des élèves inscrits ne peut pas être supprimée.</p>
        )}
      </div>
    </Modale>
  );
}

function GestionSpecialites({ fermer }: { fermer: () => void }) {
  const client = useQueryClient();
  const q = useQuery({ queryKey: ['specialites'], queryFn: () => api<Specialite[]>('/specialites', { annee: false }) });
  const [edition, setEdition] = useState<{ id: string | null; nom: string; nomEn: string } | null>(null);
  const invalider = () => {
    client.invalidateQueries({ queryKey: ['specialites'] });
    client.invalidateQueries({ queryKey: ['classes'] });
  };
  const envoi = useMutation({
    mutationFn: (e: { id: string | null; nom: string; nomEn: string }) => {
      const corps = { nom: e.nom, nomEn: e.nomEn || null };
      return e.id ? api(`/specialites/${e.id}`, { methode: 'PUT', corps }) : api('/specialites', { methode: 'POST', corps });
    },
    onSuccess: (_r, e) => {
      toast.success(e.id ? 'Spécialité modifiée : les classes qui la portent sont renommées.' : 'Spécialité créée.');
      invalider();
      setEdition(null);
    },
  });
  const suppression = useMutation({
    mutationFn: (id: string) => api(`/specialites/${id}`, { methode: 'DELETE', annee: false }),
    onSuccess: () => {
      toast.success('Spécialité supprimée.');
      invalider();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Modale titre="Spécialités" ouverte fermer={fermer} large>
      <p className="mb-3 text-sm text-encre-2">
        Les spécialités servent d'une année sur l'autre. Renommer une spécialité renomme les classes qui la portent.
      </p>
      {q.isLoading ? (
        <Chargement />
      ) : q.error ? (
        <Erreur erreur={q.error} />
      ) : (
        <div className="overflow-x-auto rounded border border-bord">
          <table className="tableau">
            <thead>
              <tr>
                <th>Spécialité</th>
                <th>En anglais</th>
                <th className="text-right">Classes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data?.map((s) =>
                edition?.id === s.id ? null : (
                  <tr key={s.id}>
                    <td className="font-semibold">{s.nom}</td>
                    <td className="text-encre-2">{s.nomEn ?? '—'}</td>
                    <td className="text-right tabular-nums">{s._count.classes}</td>
                    <td className="whitespace-nowrap text-right">
                      <button
                        type="button"
                        className="bouton-discret"
                        aria-label={`Modifier ${s.nom}`}
                        onClick={() => setEdition({ id: s.id, nom: s.nom, nomEn: s.nomEn ?? '' })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="bouton-discret"
                        aria-label={`Supprimer ${s.nom}`}
                        title={s._count.classes ? 'Portée par des classes : suppression impossible' : 'Supprimer'}
                        disabled={s._count.classes > 0 || suppression.isPending}
                        onClick={() => suppression.mutate(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ),
              )}
              {!q.data?.length && !edition && (
                <tr>
                  <td colSpan={4} className="text-center text-encre-2">
                    Aucune spécialité pour l'instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {edition ? (
        <div className="mt-4 rounded border border-bord p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {envoi.error ? (
              <div className="sm:col-span-2">
                <Erreur erreur={envoi.error} />
              </div>
            ) : null}
            <Champ libelle="Nom" aide="Tel qu'il s'imprime : « Mécanique », « Électricité »…">
              <input
                className="champ"
                autoFocus
                value={edition.nom}
                onChange={(e) => setEdition({ ...edition, nom: e.target.value })}
                maxLength={60}
              />
            </Champ>
            <Champ libelle="Nom en anglais" aide="Facultatif.">
              <input className="champ" value={edition.nomEn} onChange={(e) => setEdition({ ...edition, nomEn: e.target.value })} maxLength={60} />
            </Champ>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="bouton-secondaire" onClick={() => setEdition(null)}>
              Annuler
            </button>
            <button
              type="button"
              className="bouton-primaire"
              disabled={!edition.nom.trim() || envoi.isPending}
              onClick={() => envoi.mutate(edition)}
            >
              {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {edition.id ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="bouton-secondaire mt-4" onClick={() => setEdition({ id: null, nom: '', nomEn: '' })}>
          <Plus className="h-4 w-4" /> Nouvelle spécialité
        </button>
      )}
    </Modale>
  );
}
