import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IdCard, Loader2 } from 'lucide-react';
import { api, telecharger } from '../../lib/api';
import { Carte, Erreur, Etat, Page } from '../../components/ui';
import { ChoixEleves, ModeSelection, useSelectionEleves } from '../../components/SelectionEleves';

interface Verification {
  total: number;
  sansPhoto: { inscriptionId: string; eleveId: string; nom: string; prenoms: string; matricule: string; classe: string }[];
}

// Cartes d'identité scolaires (RG-31) : la photo est obligatoire, les élèves sans photo sont écartés.
export default function Cartes() {
  const sel = useSelectionEleves();
  const verification = useQuery({
    queryKey: ['cartes-verification', sel.corps],
    queryFn: () => api<Verification>('/documents/cartes/verification', { methode: 'POST', corps: sel.corps }),
    enabled: sel.nombre > 0,
  });
  const v = sel.nombre > 0 ? verification.data : undefined;
  const imprimables = v ? v.total - v.sansPhoto.length : 0;

  const generer = useMutation({
    mutationFn: () => telecharger('/documents/cartes', { methode: 'POST', ouvrir: true, corps: sel.corps }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <Page titre="Cartes scolaires" description="Format carte bancaire (85,6 × 54 mm), dix cartes par page A4 avec traits de coupe.">
      <Carte>
        <div className="space-y-4">
          <ModeSelection sel={sel} />
          <ChoixEleves sel={sel} />

          {verification.error && sel.nombre > 0 ? <Erreur erreur={verification.error} /> : null}
          {v && v.sansPhoto.length > 0 && (
            <div className="rounded border border-alerte/40 bg-alerte/5 px-3 py-2.5 text-sm">
              <div className="font-semibold text-alerte">
                {v.sansPhoto.length} élève(s) sans photo : leur carte ne sera pas imprimée.
              </div>
              <ul className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {v.sansPhoto.map((e) => (
                  <li key={e.inscriptionId} className="flex items-baseline justify-between gap-2">
                    <Link className="lien" to={`/eleves/${e.eleveId}`}>
                      {e.nom} {e.prenoms}
                    </Link>
                    <span className="text-xs text-encre-3">
                      {e.classe} · {e.matricule}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-encre-2">Ajoutez la photo depuis la fiche de l'élève, puis revenez ici.</p>
            </div>
          )}
          {v && v.total > 0 && v.sansPhoto.length === 0 && <Etat ton="succes">Tous les élèves choisis ont une photo.</Etat>}

          {generer.error ? <Erreur erreur={generer.error} /> : null}
          <div className="flex flex-wrap items-center gap-3 border-t border-bord pt-4">
            <span className="text-sm text-encre-2">
              {!sel.nombre
                ? 'Choisissez des classes ou des élèves.'
                : verification.isFetching && !v
                  ? 'Vérification des photos…'
                  : v
                    ? `${imprimables} carte(s) sur ${Math.ceil(imprimables / 10)} page(s) A4`
                    : ''}
            </span>
            <button
              type="button"
              className="bouton-primaire ml-auto"
              disabled={!imprimables || generer.isPending}
              onClick={() => generer.mutate()}
            >
              {generer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <IdCard className="h-4 w-4" />}
              {generer.isPending ? 'Génération…' : 'Générer les cartes'}
            </button>
          </div>
        </div>
      </Carte>
    </Page>
  );
}
