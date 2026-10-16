import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Loader2, Lock, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import { note } from '../../lib/format';
import type { Matiere, Sequence, Sexe } from '../../lib/types';
import { Carte, Chargement, Champ, Erreur, Etat, Page, Vide } from '../../components/ui';

interface Feuille {
  matiere: { id: string; nom: string; coefficient: number; classe: { id: string; nom: string } };
  sequence: Sequence;
  competence: string;
  eleves: { inscriptionId: string; matricule: string; nom: string; prenoms: string; sexe: Sexe; note: number | null }[];
}

// « 12,5 » ou « 12.5 » → 12.5 ; vide → null ; sinon NaN.
export function lireNote(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return Number.NaN;
  const v = Number(t);
  return v >= 0 && v <= 20 ? v : Number.NaN;
}

export default function Saisie() {
  const { annee } = useApp();
  const [params, setParams] = useSearchParams();
  const matieres = useQuery({ queryKey: ['matieres', 'miennes', annee?.id], queryFn: () => api<Matiere[]>('/matieres') });
  const sequences = annee?.sequences ?? [];
  const matiereId = params.get('matiere') ?? matieres.data?.[0]?.id ?? '';
  const sequenceId = params.get('sequence') ?? sequences.find((s) => s.saisieOuverte)?.id ?? sequences[0]?.id ?? '';

  const choisir = (cle: 'matiere' | 'sequence', v: string) => {
    const p = new URLSearchParams(params);
    p.set('matiere', matiereId);
    p.set('sequence', sequenceId);
    p.set(cle, v);
    setParams(p, { replace: true });
  };

  return (
    <Page titre="Saisie des notes" description="Notes sur 20, deux décimales au plus. Laissez la case vide pour un élève sans note.">
      {matieres.isLoading ? (
        <Chargement />
      ) : matieres.error ? (
        <Erreur erreur={matieres.error} />
      ) : !matieres.data?.length ? (
        <Vide titre="Aucune matière ne vous est attribuée" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
            <Champ libelle="Matière et classe">
              <select className="champ" value={matiereId} onChange={(e) => choisir('matiere', e.target.value)}>
                {matieres.data.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom} · {m.classe.nom} (coef {m.coefficient})
                  </option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Séquence">
              <select className="champ" value={sequenceId} onChange={(e) => choisir('sequence', e.target.value)}>
                {sequences.map((s) => (
                  <option key={s.id} value={s.id}>
                    Séquence {s.numero} {s.saisieOuverte ? '(ouverte)' : '(fermée)'}
                  </option>
                ))}
              </select>
            </Champ>
          </div>
          {matiereId && sequenceId && <FeuilleDeNotes key={`${matiereId}-${sequenceId}`} matiereId={matiereId} sequenceId={sequenceId} />}
        </>
      )}
    </Page>
  );
}

function FeuilleDeNotes({ matiereId, sequenceId }: { matiereId: string; sequenceId: string }) {
  const client = useQueryClient();
  const cle = ['feuille', matiereId, sequenceId];
  const feuille = useQuery({ queryKey: cle, queryFn: () => api<Feuille>(`/notes/feuille?matiereId=${matiereId}&sequenceId=${sequenceId}`) });
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [competence, setCompetence] = useState('');
  const champs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!feuille.data) return;
    setValeurs(Object.fromEntries(feuille.data.eleves.map((e) => [e.inscriptionId, e.note === null ? '' : note(e.note).replace(/,00$/, '')])));
    setCompetence(feuille.data.competence);
  }, [feuille.data]);

  const initiales = useMemo(
    () => new Map(feuille.data?.eleves.map((e) => [e.inscriptionId, e.note]) ?? []),
    [feuille.data],
  );
  const modifiees = Object.entries(valeurs).filter(([id, v]) => {
    const n = lireNote(v);
    return !(Number.isNaN(n) ? false : n === initiales.get(id));
  });
  const invalides = new Set(Object.entries(valeurs).filter(([, v]) => Number.isNaN(lireNote(v))).map(([id]) => id));
  const competenceModifiee = feuille.data ? competence.trim() !== feuille.data.competence : false;
  const aEnregistrer = modifiees.length > 0 || competenceModifiee;

  // Avertir avant de quitter la page avec des notes non enregistrées
  useEffect(() => {
    if (!aEnregistrer) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [aEnregistrer]);

  const enregistrer = useMutation({
    mutationFn: () =>
      api<{ message: string }>('/notes/feuille', {
        methode: 'PUT',
        corps: {
          matiereId,
          sequenceId,
          competence: competence.trim(),
          notes: modifiees.map(([inscriptionId, v]) => ({ inscriptionId, valeur: lireNote(v) })),
        },
      }),
    onSuccess: (r) => {
      toast.success(r.message);
      client.invalidateQueries({ queryKey: cle });
      client.invalidateQueries({ queryKey: ['avancement'] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (feuille.isLoading) return <Chargement />;
  if (feuille.error) return <Erreur erreur={feuille.error} />;
  const f = feuille.data!;
  const fermee = !f.sequence.saisieOuverte;
  const saisies = Object.values(valeurs).map(lireNote).filter((v): v is number => v !== null && !Number.isNaN(v));
  const moyenne = saisies.length ? saisies.reduce((a, b) => a + b, 0) / saisies.length : null;

  const deplacer = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      champs.current[i + 1]?.focus();
      champs.current[i + 1]?.select();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      champs.current[i - 1]?.focus();
      champs.current[i - 1]?.select();
    }
  };

  return (
    <div className="space-y-4">
      {fermee && (
        <div className="flex items-center gap-2 rounded border border-bord bg-surface-2 px-3 py-2.5 text-sm text-encre-2">
          <Lock className="h-4 w-4" />
          La saisie de la séquence {f.sequence.numero} est fermée : les notes sont en lecture seule. Le Surveillant Général peut la
          rouvrir.
        </div>
      )}

      <Champ libelle="Compétence visée" aide="Elle s'imprime sur le bulletin de la séquence, en face de la matière.">
        <input
          className="champ"
          maxLength={300}
          value={competence}
          disabled={fermee}
          onChange={(e) => setCompetence(e.target.value)}
          placeholder="Par exemple : résoudre des problèmes de proportionnalité"
        />
      </Champ>

      <Carte
        sansMarge
        titre={`${f.matiere.nom} · ${f.matiere.classe.nom} · séquence ${f.sequence.numero}`}
        actions={
          <span className="text-sm text-encre-2">
            {saisies.length}/{f.eleves.length} notes · moyenne provisoire <strong className="text-encre">{note(moyenne)}</strong>
          </span>
        }
      >
        {!f.eleves.length ? (
          <Vide titre="Aucun élève dans cette classe" />
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau">
              <thead>
                <tr>
                  <th className="w-12">N°</th>
                  <th>Nom et prénoms</th>
                  <th className="hidden sm:table-cell">Matricule</th>
                  <th className="w-14">Sexe</th>
                  <th className="w-32">Note / 20</th>
                  <th className="hidden w-32 md:table-cell" />
                </tr>
              </thead>
              <tbody>
                {f.eleves.map((e, i) => {
                  const v = valeurs[e.inscriptionId] ?? '';
                  const invalide = invalides.has(e.inscriptionId);
                  const modifiee = modifiees.some(([id]) => id === e.inscriptionId);
                  return (
                    <tr key={e.inscriptionId}>
                      <td className="tabular-nums text-encre-3">{i + 1}</td>
                      <td className="font-medium">
                        {e.nom} {e.prenoms}
                      </td>
                      <td className="hidden tabular-nums text-encre-2 sm:table-cell">{e.matricule}</td>
                      <td className="text-encre-2">{e.sexe}</td>
                      <td>
                        <input
                          ref={(el) => {
                            champs.current[i] = el;
                          }}
                          className={clsx(
                            'champ w-24 py-1.5 text-right tabular-nums',
                            invalide && 'border-danger focus:border-danger focus:ring-danger/20',
                            modifiee && !invalide && 'border-primaire',
                          )}
                          inputMode="decimal"
                          value={v}
                          disabled={fermee}
                          aria-invalid={invalide}
                          aria-label={`Note de ${e.nom} ${e.prenoms}`}
                          onChange={(ev) => setValeurs({ ...valeurs, [e.inscriptionId]: ev.target.value })}
                          onKeyDown={(ev) => deplacer(i, ev)}
                          onFocus={(ev) => ev.target.select()}
                        />
                      </td>
                      <td className="hidden md:table-cell">
                        {invalide ? (
                          <Etat ton="danger">Note invalide</Etat>
                        ) : modifiee ? (
                          <Etat ton="alerte">Non enregistrée</Etat>
                        ) : v === '' ? (
                          <span className="text-xs text-encre-3">Sans note</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Carte>

      {!fermee && (
        <div className="sticky bottom-3 flex flex-wrap items-center justify-end gap-3 rounded-lg border border-bord bg-surface px-4 py-3 shadow-feuille">
          <span className="mr-auto text-sm text-encre-2">
            {invalides.size
              ? `${invalides.size} note(s) invalide(s) à corriger`
              : aEnregistrer
                ? `${modifiees.length} note(s) modifiée(s)${competenceModifiee ? ' et la compétence visée' : ''}`
                : 'Tout est enregistré.'}
          </span>
          <button
            type="button"
            className="bouton-primaire"
            disabled={!aEnregistrer || invalides.size > 0 || enregistrer.isPending}
            onClick={() => enregistrer.mutate()}
          >
            {enregistrer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}
