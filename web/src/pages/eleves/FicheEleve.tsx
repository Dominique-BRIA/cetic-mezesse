import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Camera, FileText, IdCard, Loader2, Pencil, UserMinus, UserPlus } from 'lucide-react';
import { api, telecharger, urlProtegee } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import { date, PERIODES } from '../../lib/format';
import type { Classe, CodePeriode, Eleve, Inscription } from '../../lib/types';
import { Carte, Chargement, Champ, Erreur, Etat, Modale, Page } from '../../components/ui';
import { FormEleve } from './FormEleve';

type FicheData = Eleve & { inscriptions: Omit<Inscription, 'eleve'>[] };

export default function FicheEleve() {
  const { id } = useParams();
  const { a, annee } = useApp();
  const client = useQueryClient();
  const fiche = useQuery({ queryKey: ['eleve', id], queryFn: () => api<FicheData>(`/eleves/${id}`) });
  const classes = useQuery({ queryKey: ['classes', annee?.id], queryFn: () => api<Classe[]>('/classes') });
  const [edition, setEdition] = useState(false);
  const [renvoi, setRenvoi] = useState(false);
  const [reintegration, setReintegration] = useState(false);
  const [periode, setPeriode] = useState<CodePeriode>('S1');
  const fichierPhoto = useRef<HTMLInputElement>(null);

  const photo = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData();
      fd.append('photo', f);
      return api(`/eleves/${id}/photo`, { methode: 'POST', corps: fd });
    },
    onSuccess: () => {
      toast.success('Photo enregistrée.');
      client.invalidateQueries({ queryKey: ['eleve', id] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (fiche.isLoading) return <Chargement />;
  if (fiche.error) return <Erreur erreur={fiche.error} />;
  const e = fiche.data!;
  const actuelle = e.inscriptions.find((i) => i.anneeId === annee?.id) ?? null;

  return (
    <Page
      titre={`${e.nom} ${e.prenoms}`}
      description={
        <Link to="/eleves" className="lien inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour aux élèves
        </Link>
      }
      actions={
        <>
          {a('SURVEILLANT_GENERAL') && actuelle && (
            <button type="button" className="bouton-secondaire" onClick={() => setEdition(true)}>
              <Pencil className="h-4 w-4" /> Modifier
            </button>
          )}
          {a('PROVISEUR') && actuelle?.statut === 'ACTIF' && (
            <button type="button" className="bouton-secondaire text-danger" onClick={() => setRenvoi(true)}>
              <UserMinus className="h-4 w-4" /> Renvoyer
            </button>
          )}
          {a('PROVISEUR') && actuelle?.statut === 'RENVOYE' && (
            <button type="button" className="bouton-primaire" onClick={() => setReintegration(true)}>
              <UserPlus className="h-4 w-4" /> Réintégrer
            </button>
          )}
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
        <div className="space-y-3">
          <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg border border-bord bg-surface-2">
            {e.photoCle ? (
              <img src={urlProtegee(`/eleves/${e.id}/photo`, e.photoCle)} alt={`Photo de ${e.nom}`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm text-encre-3">Pas de photo</span>
            )}
          </div>
          <input
            ref={fichierPhoto}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(ev) => ev.target.files?.[0] && photo.mutate(ev.target.files[0])}
          />
          <button type="button" className="bouton-secondaire w-full" onClick={() => fichierPhoto.current?.click()} disabled={photo.isPending}>
            {photo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {e.photoCle ? 'Changer la photo' : 'Ajouter une photo'}
          </button>
        </div>

        <div className="space-y-4">
          <Carte titre="Identité">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ['Matricule scolaire', e.matricule],
                ['Matricule national', e.matriculeNational ?? 'Non renseigné'],
                ['Sexe', e.sexe === 'F' ? 'Féminin' : 'Masculin'],
                ['Né(e) le', `${date(e.dateNaissance)} à ${e.lieuNaissance}`],
                ['Parent ou tuteur', e.parentNom ?? '—'],
                ['Téléphone du parent', e.parentTelephone ?? '—'],
                ['Adresse du parent', e.parentAdresse ?? '—'],
              ].map(([l, v]) => (
                <div key={l}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-encre-2">{l}</dt>
                  <dd className="mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
          </Carte>

          {actuelle && actuelle.statut === 'ACTIF' && (
            <Carte titre="Bulletin">
              <div className="flex flex-wrap items-end gap-3">
                <Champ libelle="Période">
                  <select className="champ w-48" value={periode} onChange={(ev) => setPeriode(ev.target.value as CodePeriode)}>
                    {PERIODES.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.libelle}
                      </option>
                    ))}
                  </select>
                </Champ>
                <button
                  type="button"
                  className="bouton-secondaire"
                  onClick={() =>
                    telecharger('/documents/bulletins', {
                      methode: 'POST',
                      corps: { periode, inscriptionIds: [actuelle.id] },
                      ouvrir: true,
                    }).catch((err) => toast.error(err.message))
                  }
                >
                  <FileText className="h-4 w-4" /> Générer le bulletin
                </button>
                <button
                  type="button"
                  className="bouton-secondaire"
                  disabled={!e.photoCle}
                  title={e.photoCle ? undefined : 'Ajoutez d’abord la photo : elle est obligatoire sur la carte.'}
                  onClick={() =>
                    telecharger('/documents/cartes', { methode: 'POST', corps: { inscriptionIds: [actuelle.id] }, ouvrir: true }).catch((err) =>
                      toast.error(err.message),
                    )
                  }
                >
                  <IdCard className="h-4 w-4" /> Carte scolaire
                </button>
              </div>
            </Carte>
          )}

          <Carte titre="Parcours dans l'établissement" sansMarge>
            <table className="tableau">
              <thead>
                <tr>
                  <th>Année</th>
                  <th>Classe</th>
                  <th>Redoublant</th>
                  <th>Situation</th>
                </tr>
              </thead>
              <tbody>
                {e.inscriptions.map((i) => (
                  <tr key={i.id}>
                    <td className="tabular-nums">{i.annee.libelle}</td>
                    <td>{i.classe.nom}</td>
                    <td>{i.redoublant ? 'Oui' : 'Non'}</td>
                    <td>{i.statut === 'ACTIF' ? <Etat ton="succes">Inscrit</Etat> : <Etat ton="danger">Renvoyé</Etat>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Carte>

          {e.inscriptions.some((i) => i.renvois.length) && (
            <Carte titre="Renvois et réintégrations">
              <ol className="space-y-3 text-sm">
                {e.inscriptions.flatMap((i) =>
                  i.renvois.map((r) => (
                    <li key={r.id} className="border-l-2 border-bord pl-3">
                      <div>
                        <span className="font-semibold">Renvoyé le {date(r.date)}</span>{' '}
                        <span className="text-encre-2">
                          ({i.annee.libelle}, par {r.par.prenom} {r.par.nom})
                        </span>
                      </div>
                      <div className="text-encre-2">Motif : {r.motif}</div>
                      {r.reintegreLe && (
                        <div className="mt-1 text-succes">
                          Réintégré le {date(r.reintegreLe)}
                          {r.reintegrePar && ` par ${r.reintegrePar.prenom} ${r.reintegrePar.nom}`}
                          {r.motifReintegration && ` : ${r.motifReintegration}`}
                        </div>
                      )}
                    </li>
                  )),
                )}
              </ol>
            </Carte>
          )}
        </div>
      </div>

      {edition && actuelle && classes.data && (
        <FormEleve ouverte fermer={() => setEdition(false)} classes={classes.data} inscription={{ ...actuelle, eleve: e } as Inscription} />
      )}
      {renvoi && actuelle && <Renvoi inscriptionId={actuelle.id} nom={`${e.nom} ${e.prenoms}`} fermer={() => setRenvoi(false)} />}
      {reintegration && actuelle && (
        <Reintegration inscriptionId={actuelle.id} nom={`${e.nom} ${e.prenoms}`} fermer={() => setReintegration(false)} />
      )}
    </Page>
  );
}

export function Renvoi({ inscriptionId, nom, fermer }: { inscriptionId: string; nom: string; fermer: () => void }) {
  const client = useQueryClient();
  const [motif, setMotif] = useState('');
  const [jour, setJour] = useState(new Date().toISOString().slice(0, 10));
  const envoi = useMutation({
    mutationFn: () => api(`/eleves/inscriptions/${inscriptionId}/renvoyer`, { methode: 'POST', corps: { motif, date: jour } }),
    onSuccess: () => {
      toast.success(`${nom} a été renvoyé(e).`);
      client.invalidateQueries();
      fermer();
    },
  });
  return (
    <Modale
      titre={`Renvoyer ${nom}`}
      ouverte
      fermer={fermer}
      pied={
        <>
          <button type="button" className="bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="button" className="bouton-danger" disabled={!motif.trim() || envoi.isPending} onClick={() => envoi.mutate()}>
            {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmer le renvoi
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-encre-2">
          L'élève sort de la liste principale, des classements et des bulletins. Ses notes sont conservées et tout revient s'il est
          réintégré.
        </p>
        {envoi.error ? <Erreur erreur={envoi.error} /> : null}
        <Champ libelle="Date du renvoi">
          <input className="champ" type="date" value={jour} onChange={(e) => setJour(e.target.value)} />
        </Champ>
        <Champ libelle="Motif">
          <textarea className="champ min-h-[5rem]" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={500} required />
        </Champ>
      </div>
    </Modale>
  );
}

export function Reintegration({ inscriptionId, nom, fermer }: { inscriptionId: string; nom: string; fermer: () => void }) {
  const client = useQueryClient();
  const [motif, setMotif] = useState('');
  const envoi = useMutation({
    mutationFn: () => api(`/eleves/inscriptions/${inscriptionId}/reintegrer`, { methode: 'POST', corps: { motif } }),
    onSuccess: () => {
      toast.success(`${nom} a été réintégré(e).`);
      client.invalidateQueries();
      fermer();
    },
  });
  return (
    <Modale
      titre={`Réintégrer ${nom}`}
      ouverte
      fermer={fermer}
      pied={
        <>
          <button type="button" className="bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="button" className="bouton-primaire" disabled={envoi.isPending} onClick={() => envoi.mutate()}>
            {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Réintégrer
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-encre-2">L'élève retrouve sa classe, ses notes et sa place dans les classements.</p>
        {envoi.error ? <Erreur erreur={envoi.error} /> : null}
        <Champ libelle="Observation (facultative)">
          <textarea className="champ min-h-[4rem]" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={500} />
        </Champ>
      </div>
    </Modale>
  );
}
