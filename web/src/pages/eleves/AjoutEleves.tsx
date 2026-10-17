import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Camera, Loader2, Plus, Trash2 } from 'lucide-react';
import { api, ErreurApi } from '../../lib/api';
import { reduirePhoto } from '../../lib/photo';
import type { Classe } from '../../lib/types';
import { Champ, Erreur, Modale } from '../../components/ui';

interface Ligne {
  cle: number;
  nom: string;
  prenoms: string;
  sexe: '' | 'M' | 'F';
  dateNaissance: string;
  lieuNaissance: string;
  redoublant: boolean;
  parentNom: string;
  parentTelephone: string;
  photo: Blob | null; // déjà réduite
  apercu: string | null;
}

const OBLIGATOIRES = ['nom', 'prenoms', 'sexe', 'dateNaissance', 'lieuNaissance'] as const;
let compteur = 0;
const ligneVide = (): Ligne => ({
  cle: ++compteur,
  nom: '',
  prenoms: '',
  sexe: '',
  dateNaissance: '',
  lieuNaissance: '',
  redoublant: false,
  parentNom: '',
  parentTelephone: '',
  photo: null,
  apercu: null,
});
const commencee = (l: Ligne) =>
  Boolean(l.nom || l.prenoms || l.sexe || l.dateNaissance || l.lieuNaissance || l.parentNom || l.parentTelephone || l.photo);
const manquants = (l: Ligne) => OBLIGATOIRES.filter((c) => !String(l[c]).trim());

// Saisie groupée : plusieurs élèves d'une même classe, un seul enregistrement (tout ou rien).
export function AjoutEleves({ classes, classeParDefaut, fermer }: { classes: Classe[]; classeParDefaut: string; fermer: () => void }) {
  const client = useQueryClient();
  const [classeId, setClasseId] = useState(classeParDefaut || classes[0]?.id || '');
  const [lignes, setLignes] = useState<Ligne[]>(() => Array.from({ length: 5 }, ligneVide));
  const [verifier, setVerifier] = useState(false);
  const [erreursServeur, setErreursServeur] = useState<Record<number, string>>({});

  const remplies = lignes.filter(commencee);
  const incompletes = remplies.filter((l) => manquants(l).length > 0);

  const changer = (cle: number, champ: keyof Ligne, valeur: string | boolean | Blob | null) =>
    setLignes((ls) => {
      const maj = ls.map((l) => (l.cle === cle ? { ...l, [champ]: valeur } : l));
      // Une ligne vide est toujours disponible à la fin.
      return commencee(maj[maj.length - 1]) ? [...maj, ligneVide()] : maj;
    });
  const retirer = (cle: number) => setLignes((ls) => (ls.length > 1 ? ls.filter((l) => l.cle !== cle) : [ligneVide()]));

  const choisirPhoto = async (l: Ligne, fichier: File | undefined) => {
    if (!fichier) return;
    try {
      const photo = await reduirePhoto(fichier);
      if (l.apercu) URL.revokeObjectURL(l.apercu);
      setLignes((ls) => {
        const maj = ls.map((x) => (x.cle === l.cle ? { ...x, photo, apercu: URL.createObjectURL(photo) } : x));
        return commencee(maj[maj.length - 1]) ? [...maj, ligneVide()] : maj;
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const envoi = useMutation({
    mutationFn: () => {
      const donnees = {
        classeId,
        eleves: remplies.map(({ cle: _, photo: _p, apercu: _a, sexe, parentNom, parentTelephone, ...l }) => ({
          ...l,
          sexe: sexe || undefined,
          parentNom: parentNom || null,
          parentTelephone: parentTelephone || null,
        })),
      };
      // Avec des photos : formulaire multipart, photo de la ligne n sous « photo_n ».
      if (!remplies.some((l) => l.photo)) return api<{ message: string; nombre: number }>('/eleves/lot', { methode: 'POST', corps: donnees });
      const formulaire = new FormData();
      formulaire.append('donnees', JSON.stringify(donnees));
      remplies.forEach((l, i) => l.photo && formulaire.append(`photo_${i}`, l.photo, `photo-${i}.jpg`));
      return api<{ message: string; nombre: number }>('/eleves/lot', { methode: 'POST', corps: formulaire });
    },
    onSuccess: (r) => {
      toast.success(r.message);
      client.invalidateQueries({ queryKey: ['eleves'] });
      client.invalidateQueries({ queryKey: ['classes'] });
      fermer();
    },
    onError: (e) => {
      // Erreurs ligne par ligne renvoyées par le serveur (numérotées dans l'ordre des lignes envoyées).
      const details = e instanceof ErreurApi ? (e.details as { erreurs?: { ligne: number; message: string }[] }) : undefined;
      const parCle: Record<number, string> = {};
      for (const x of details?.erreurs ?? []) {
        const l = remplies[x.ligne - 1];
        if (l) parCle[l.cle] = x.message;
      }
      setErreursServeur(parCle);
    },
  });

  const enregistrer = () => {
    setVerifier(true);
    setErreursServeur({});
    if (!remplies.length || incompletes.length || !classeId) return;
    envoi.mutate();
  };

  const classeChamp = (l: Ligne, champ: (typeof OBLIGATOIRES)[number]) =>
    clsx('champ px-2 py-1.5 text-sm', verifier && commencee(l) && !String(l[champ]).trim() && 'border-danger ring-1 ring-danger/40');

  return (
    <Modale
      titre="Ajouter des élèves"
      ouverte
      fermer={fermer}
      large="tres"
      pied={
        <>
          <span className="mr-auto self-center text-sm text-encre-2">
            {remplies.length
              ? `${remplies.length} élève(s) à inscrire${incompletes.length && verifier ? ` · ${incompletes.length} ligne(s) incomplète(s)` : ''}`
              : 'Remplissez au moins une ligne.'}
          </span>
          <button type="button" className="bouton-secondaire" onClick={fermer}>
            Annuler
          </button>
          <button type="button" className="bouton-primaire" disabled={envoi.isPending || !remplies.length} onClick={enregistrer}>
            {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer {remplies.length > 0 ? `${remplies.length} élève(s)` : ''}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <Champ libelle="Classe" className="w-64">
            <select className="champ" value={classeId} onChange={(e) => setClasseId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </Champ>
          <p className="max-w-xl pb-2 text-xs text-encre-2">
            Une ligne par élève ; une nouvelle ligne s'ajoute quand vous remplissez la dernière. Les lignes vides sont ignorées.
            Le matricule est attribué à l'enregistrement. Tout ou rien : si une ligne est incomplète, rien n'est enregistré.
          </p>
        </div>

        {envoi.error ? <Erreur erreur={envoi.error} /> : null}

        <div className="overflow-x-auto rounded border border-bord">
          <table className="tableau min-w-[60rem]">
            <thead>
              <tr>
                <th className="w-8">N°</th>
                <th className="w-14">Photo</th>
                <th>Nom *</th>
                <th>Prénoms *</th>
                <th className="w-20">Sexe *</th>
                <th className="w-40">Né(e) le *</th>
                <th>Lieu de naissance *</th>
                <th className="w-16 text-center">Redoublant</th>
                <th>Parent / tuteur</th>
                <th className="w-36">Téléphone parent</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={l.cle} className={clsx(erreursServeur[l.cle] && 'bg-danger/5')}>
                  <td className="align-top tabular-nums text-encre-3">{i + 1}</td>
                  <td className="align-top">
                    <label
                      className="flex h-[3.25rem] w-10 cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed border-bord text-encre-3 hover:border-primaire hover:text-primaire"
                      title={l.photo ? 'Changer la photo' : 'Ajouter une photo'}
                    >
                      {l.apercu ? <img src={l.apercu} alt="" className="h-full w-full object-cover" /> : <Camera className="h-4 w-4" />}
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        className="sr-only"
                        aria-label={`Photo, ligne ${i + 1}`}
                        onChange={(e) => {
                          choisirPhoto(l, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </td>
                  <td className="align-top">
                    <input className={clsx(classeChamp(l, 'nom'), 'uppercase')} value={l.nom} onChange={(e) => changer(l.cle, 'nom', e.target.value)} maxLength={80} aria-label={`Nom, ligne ${i + 1}`} />
                    {erreursServeur[l.cle] && <div className="mt-1 text-xs text-danger">{erreursServeur[l.cle]}</div>}
                  </td>
                  <td className="align-top">
                    <input className={classeChamp(l, 'prenoms')} value={l.prenoms} onChange={(e) => changer(l.cle, 'prenoms', e.target.value)} maxLength={120} aria-label={`Prénoms, ligne ${i + 1}`} />
                  </td>
                  <td className="align-top">
                    <select className={classeChamp(l, 'sexe')} value={l.sexe} onChange={(e) => changer(l.cle, 'sexe', e.target.value)} aria-label={`Sexe, ligne ${i + 1}`}>
                      <option value="" />
                      <option value="M">M</option>
                      <option value="F">F</option>
                    </select>
                  </td>
                  <td className="align-top">
                    <input type="date" className={classeChamp(l, 'dateNaissance')} value={l.dateNaissance} onChange={(e) => changer(l.cle, 'dateNaissance', e.target.value)} aria-label={`Date de naissance, ligne ${i + 1}`} />
                  </td>
                  <td className="align-top">
                    <input className={classeChamp(l, 'lieuNaissance')} value={l.lieuNaissance} onChange={(e) => changer(l.cle, 'lieuNaissance', e.target.value)} maxLength={80} aria-label={`Lieu de naissance, ligne ${i + 1}`} />
                  </td>
                  <td className="text-center align-top">
                    <input type="checkbox" className="mt-2 h-4 w-4" checked={l.redoublant} onChange={(e) => changer(l.cle, 'redoublant', e.target.checked)} aria-label={`Redoublant, ligne ${i + 1}`} />
                  </td>
                  <td className="align-top">
                    <input className="champ px-2 py-1.5 text-sm" value={l.parentNom} onChange={(e) => changer(l.cle, 'parentNom', e.target.value)} maxLength={120} aria-label={`Parent, ligne ${i + 1}`} />
                  </td>
                  <td className="align-top">
                    <input className="champ px-2 py-1.5 text-sm" type="tel" value={l.parentTelephone} onChange={(e) => changer(l.cle, 'parentTelephone', e.target.value)} maxLength={30} aria-label={`Téléphone du parent, ligne ${i + 1}`} />
                  </td>
                  <td className="align-top">
                    <button type="button" className="bouton-discret mt-0.5 px-1.5" onClick={() => retirer(l.cle)} aria-label={`Retirer la ligne ${i + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="bouton-secondaire" onClick={() => setLignes((ls) => [...ls, ligneVide()])}>
          <Plus className="h-4 w-4" /> Ajouter une ligne
        </button>
        <p className="text-xs text-encre-3">
          * obligatoire. La photo est facultative ici, mais nécessaire pour la carte scolaire. Le matricule national et l'adresse du
          parent se complètent ensuite sur la fiche de l'élève.
        </p>
      </div>
    </Modale>
  );
}
