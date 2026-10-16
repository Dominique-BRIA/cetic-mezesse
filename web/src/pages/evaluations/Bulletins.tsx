import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Loader2 } from 'lucide-react';
import { telecharger } from '../../lib/api';
import { libellePeriode } from '../../lib/format';
import type { CodePeriode } from '../../lib/types';
import { Carte, Champ, ChoixPeriode, Erreur, Page } from '../../components/ui';
import { ChoixEleves, ModeSelection, useSelectionEleves } from '../../components/SelectionEleves';

export default function Bulletins() {
  const sel = useSelectionEleves();
  const [periode, setPeriode] = useState<CodePeriode>('S1');

  const generer = useMutation({
    mutationFn: () => telecharger('/documents/bulletins', { methode: 'POST', ouvrir: true, corps: { periode, ...sel.corps } }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <Page titre="Bulletins de notes" description="Un seul PDF, une page A4 par élève, prêt à imprimer.">
      <Carte>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Champ libelle="Période">
              <ChoixPeriode valeur={periode} changer={setPeriode} />
            </Champ>
            <ModeSelection sel={sel} />
          </div>

          <ChoixEleves sel={sel} />

          {generer.error ? <Erreur erreur={generer.error} /> : null}
          <div className="flex flex-wrap items-center gap-3 border-t border-bord pt-4">
            <span className="text-sm text-encre-2">
              {sel.nombre ? `${sel.nombre} bulletin(s) de ${libellePeriode(periode).toLowerCase()}` : 'Choisissez des classes ou des élèves.'}
            </span>
            <button type="button" className="bouton-primaire ml-auto" disabled={!sel.nombre || generer.isPending} onClick={() => generer.mutate()}>
              {generer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {generer.isPending ? 'Génération…' : 'Générer le PDF'}
            </button>
          </div>
        </div>
      </Carte>
    </Page>
  );
}
