import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../lib/contexte';
import type { Classe, Inscription } from '../../lib/types';
import { Carte, Chargement, Champ, Erreur, Page, Vide } from '../../components/ui';

// Passage d'une année à l'autre : on choisit les élèves d'une classe de l'année précédente
// et la classe où les inscrire cette année.
export default function Reinscription() {
  const { annee, annees } = useApp();
  const client = useQueryClient();
  const precedentes = annees.filter((x) => x.id !== annee?.id);
  const [sourceId, setSourceId] = useState(precedentes[0]?.id ?? '');
  const [classeSource, setClasseSource] = useState('');
  const [cible, setCible] = useState('');
  const [redoublant, setRedoublant] = useState(false);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());

  const classesSource = useQuery({
    queryKey: ['classes', sourceId],
    queryFn: () => api<Classe[]>(`/classes?anneeId=${sourceId}`),
    enabled: Boolean(sourceId),
  });
  const classesCible = useQuery({ queryKey: ['classes', annee?.id], queryFn: () => api<Classe[]>('/classes') });
  const eleves = useQuery({
    queryKey: ['eleves', sourceId, classeSource],
    queryFn: () => api<Inscription[]>(`/eleves?anneeId=${sourceId}&classeId=${classeSource}&statut=TOUS`),
    enabled: Boolean(sourceId && classeSource),
  });
  const dejaInscrits = useQuery({ queryKey: ['eleves', annee?.id, 'tous'], queryFn: () => api<Inscription[]>('/eleves?statut=TOUS') });
  const inscritsCetteAnnee = useMemo(() => new Set(dejaInscrits.data?.map((i) => i.eleveId)), [dejaInscrits.data]);

  const envoi = useMutation({
    mutationFn: () =>
      api<{ message: string }>('/eleves/reinscrire', {
        methode: 'POST',
        corps: { eleveIds: [...choisis], classeId: cible, redoublant },
      }),
    onSuccess: (r) => {
      toast.success(r.message);
      setChoisis(new Set());
      client.invalidateQueries({ queryKey: ['eleves'] });
      client.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  if (!precedentes.length) {
    return (
      <Page titre="Réinscriptions">
        <Vide titre="Il n'y a qu'une année scolaire">Créez la nouvelle année dans « Années et séquences » pour y réinscrire les élèves.</Vide>
      </Page>
    );
  }

  const disponibles = eleves.data?.filter((i) => !inscritsCetteAnnee.has(i.eleveId)) ?? [];
  const basculer = (id: string) => {
    const s = new Set(choisis);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setChoisis(s);
  };

  return (
    <Page
      titre="Réinscriptions"
      description={`Inscrire en ${annee?.libelle} des élèves d'une année précédente, en gardant leur matricule et leur historique.`}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="1. Élèves à réinscrire">
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ libelle="Année d'origine">
              <select className="champ" value={sourceId} onChange={(e) => (setSourceId(e.target.value), setClasseSource(''), setChoisis(new Set()))}>
                {precedentes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.libelle}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Classe d'origine">
              <select className="champ" value={classeSource} onChange={(e) => (setClasseSource(e.target.value), setChoisis(new Set()))}>
                <option value="">Choisir…</option>
                {classesSource.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </Champ>
          </div>
        </Carte>
        <Carte titre={`2. Classe en ${annee?.libelle}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ libelle="Classe d'accueil">
              <select className="champ" value={cible} onChange={(e) => setCible(e.target.value)}>
                <option value="">Choisir…</option>
                {classesCible.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </Champ>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={redoublant} onChange={(e) => setRedoublant(e.target.checked)} />
              Inscrire comme redoublants
            </label>
          </div>
        </Carte>
      </div>

      {classeSource && (
        <Carte
          sansMarge
          titre={`${disponibles.length} élève(s) pas encore inscrit(s) cette année`}
          actions={
            disponibles.length > 0 && (
              <button
                type="button"
                className="bouton-discret"
                onClick={() => setChoisis(choisis.size === disponibles.length ? new Set() : new Set(disponibles.map((i) => i.eleveId)))}
              >
                {choisis.size === disponibles.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            )
          }
        >
          {eleves.isLoading ? (
            <div className="px-4">
              <Chargement />
            </div>
          ) : !disponibles.length ? (
            <Vide titre="Tous les élèves de cette classe sont déjà inscrits cette année" />
          ) : (
            <ul className="divide-y divide-bord/70">
              {disponibles.map((i) => (
                <li key={i.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-surface-2">
                    <input type="checkbox" className="h-4 w-4" checked={choisis.has(i.eleveId)} onChange={() => basculer(i.eleveId)} />
                    <span className="font-medium">
                      {i.eleve.nom} {i.eleve.prenoms}
                    </span>
                    <span className="tabular-nums text-encre-3">{i.eleve.matricule}</span>
                    {i.statut === 'RENVOYE' && <span className="text-xs text-danger">renvoyé l'an passé</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      )}

      {envoi.error ? <Erreur erreur={envoi.error} /> : null}
      <div className="flex justify-end">
        <button type="button" className="bouton-primaire" disabled={!choisis.size || !cible || envoi.isPending} onClick={() => envoi.mutate()}>
          {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Réinscrire {choisis.size || ''} élève(s)
        </button>
      </div>
    </Page>
  );
}
