import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { api, urlProtegee } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import { matriculeDuFichier, reduirePhoto } from '../../lib/photo';
import type { Classe, Inscription } from '../../lib/types';
import { Chargement, Champ, Erreur, Modale, Vide } from '../../components/ui';

interface Choix {
  photo: Blob;
  apercu: string;
}

// Photos de plusieurs élèves d'une classe, enregistrées d'un coup. Un fichier nommé d'après le
// matricule (« CTM26-0047.jpg ») est rangé automatiquement chez le bon élève.
export function PhotosEleves({
  classes,
  classeParDefaut,
  sansPhotoParDefaut = false,
  fermer,
}: {
  classes: Classe[];
  classeParDefaut: string;
  sansPhotoParDefaut?: boolean;
  fermer: () => void;
}) {
  const { annee } = useApp();
  const client = useQueryClient();
  const [classeId, setClasseId] = useState(classeParDefaut || classes[0]?.id || '');
  const [sansPhoto, setSansPhoto] = useState(sansPhotoParDefaut);
  const [choix, setChoix] = useState<Record<string, Choix>>({});
  const [nonRanges, setNonRanges] = useState<string[]>([]);
  const [survol, setSurvol] = useState(false);

  const eleves = useQuery({
    queryKey: ['eleves', annee?.id, classeId, ''],
    queryFn: () => api<Inscription[]>(`/eleves?classeId=${classeId}&q=`),
    enabled: Boolean(classeId),
  });
  const liste = (eleves.data ?? []).filter((i) => !sansPhoto || !i.eleve.photoCle || choix[i.eleve.id]);
  const nombre = Object.keys(choix).length;

  // Les aperçus sont libérés à la fermeture.
  useEffect(() => () => Object.values(choix).forEach((c) => URL.revokeObjectURL(c.apercu)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const poser = async (eleveId: string, fichier: File) => {
    const photo = await reduirePhoto(fichier);
    setChoix((c) => {
      if (c[eleveId]) URL.revokeObjectURL(c[eleveId].apercu);
      return { ...c, [eleveId]: { photo, apercu: URL.createObjectURL(photo) } };
    });
  };

  // Plusieurs fichiers : rangés d'après le matricule écrit dans leur nom.
  const plusieurs = async (fichiers: File[]) => {
    const parMatricule = new Map((eleves.data ?? []).map((i) => [i.eleve.matricule, i.eleve.id]));
    const restes: string[] = [];
    let ranges = 0;
    for (const f of fichiers) {
      const m = matriculeDuFichier(f.name, [...parMatricule.keys()]);
      if (!m) {
        restes.push(f.name);
        continue;
      }
      try {
        await poser(parMatricule.get(m)!, f);
        ranges++;
      } catch (e) {
        restes.push(`${f.name} (${(e as Error).message})`);
      }
    }
    setNonRanges(restes);
    if (ranges) toast.success(`${ranges} photo(s) rangée(s) d'après le matricule.`);
  };

  const enlever = (eleveId: string) =>
    setChoix((c) => {
      const { [eleveId]: retire, ...reste } = c;
      if (retire) URL.revokeObjectURL(retire.apercu);
      return reste;
    });

  const envoi = useMutation({
    mutationFn: () => {
      const formulaire = new FormData();
      for (const [id, c] of Object.entries(choix)) formulaire.append(`photo_${id}`, c.photo, `${id}.jpg`);
      return api<{ message: string }>('/eleves/photos', { methode: 'POST', corps: formulaire, annee: false });
    },
    onSuccess: (r) => {
      toast.success(r.message);
      client.invalidateQueries({ queryKey: ['eleves'] });
      client.invalidateQueries({ queryKey: ['cartes-verification'] });
      fermer();
    },
  });

  return (
    <Modale
      titre="Photos des élèves"
      ouverte
      fermer={fermer}
      large="tres"
      pied={
        <>
          <span className="mr-auto self-center text-sm text-encre-2">
            {nombre ? `${nombre} photo(s) à enregistrer` : 'Choisissez au moins une photo.'}
          </span>
          <button type="button" className="bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="button" className="bouton-primaire" disabled={!nombre || envoi.isPending} onClick={() => envoi.mutate()}>
            {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer {nombre ? `${nombre} photo(s)` : ''}
          </button>
        </>
      }
    >
      <div
        className={clsx('space-y-4 rounded', survol && 'outline-dashed outline-2 outline-offset-4 outline-primaire')}
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          plusieurs([...e.dataTransfer.files]);
        }}
      >
        <div className="flex flex-wrap items-end gap-4">
          <Champ libelle="Classe" className="w-64">
            <select
              className="champ"
              value={classeId}
              onChange={(e) => {
                setClasseId(e.target.value);
                setNonRanges([]);
              }}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </Champ>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={sansPhoto} onChange={(e) => setSansPhoto(e.target.checked)} />
            Seulement les élèves sans photo
          </label>
          <label className="bouton-secondaire ml-auto cursor-pointer">
            <ImagePlus className="h-4 w-4" /> Choisir plusieurs photos
            <input
              type="file"
              accept="image/jpeg,image/png"
              multiple
              className="sr-only"
              onChange={(e) => {
                plusieurs([...(e.target.files ?? [])]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="text-xs text-encre-2">
          Touchez un élève pour choisir sa photo. Pour en ajouter beaucoup d'un coup, nommez chaque fichier avec le matricule de
          l'élève (par exemple <code>CTM26-0047.jpg</code>) puis choisissez-les ensemble, ou déposez-les sur cette fenêtre.
        </p>

        {envoi.error ? <Erreur erreur={envoi.error} /> : null}
        {nonRanges.length > 0 && (
          <div className="rounded border border-alerte/40 bg-alerte/5 px-3 py-2 text-sm">
            <span className="font-semibold text-alerte">{nonRanges.length} fichier(s) sans matricule reconnu dans cette classe :</span>{' '}
            <span className="text-encre-2">{nonRanges.join(', ')}</span>
          </div>
        )}

        {eleves.isLoading ? (
          <Chargement />
        ) : !liste.length ? (
          <Vide titre={sansPhoto ? 'Tous les élèves de cette classe ont une photo' : 'Aucun élève dans cette classe'} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {liste.map(({ eleve: e }) => {
              const c = choix[e.id];
              const source = c?.apercu ?? (e.photoCle ? urlProtegee(`/eleves/${e.id}/photo`, e.photoCle) : null);
              return (
                <li key={e.id} className={clsx('relative rounded border p-2', c ? 'border-primaire bg-primaire-pale/50' : 'border-bord')}>
                  <label className="block cursor-pointer" title={c ? 'Changer la photo choisie' : 'Choisir une photo'}>
                    <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded bg-surface-2 text-encre-3">
                      {source ? <img src={source} alt="" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6" />}
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      className="sr-only"
                      aria-label={`Photo de ${e.nom} ${e.prenoms}`}
                      onChange={(ev) => {
                        const f = ev.target.files?.[0];
                        if (f) poser(e.id, f).catch((err) => toast.error(err.message));
                        ev.target.value = '';
                      }}
                    />
                  </label>
                  <div className="mt-1.5 truncate text-xs font-semibold" title={`${e.nom} ${e.prenoms}`}>
                    {e.nom} {e.prenoms}
                  </div>
                  <div className="text-[0.7rem] tabular-nums text-encre-3">
                    {e.matricule} · {c ? <span className="font-semibold text-primaire">nouvelle</span> : e.photoCle ? 'photo' : 'sans photo'}
                  </div>
                  {c && (
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-surface p-0.5 text-encre-2 shadow hover:text-danger"
                      onClick={() => enlever(e.id)}
                      aria-label={`Retirer la photo choisie pour ${e.nom}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modale>
  );
}
