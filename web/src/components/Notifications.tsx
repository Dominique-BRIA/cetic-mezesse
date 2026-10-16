import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';
import { Chargement, Modale, Vide } from './ui';

interface Notification {
  id: string;
  titre: string;
  message: string;
  lien: string | null;
  lue: boolean;
  creeLe: string;
}

function quand(d: string): string {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Cloche des notifications (RG-32) : relevée chaque minute, la liste s'ouvre au clic.
export function Cloche() {
  const client = useQueryClient();
  const naviguer = useNavigate();
  const [ouverte, setOuverte] = useState(false);
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ notifications: Notification[]; nonLues: number }>('/notifications', { annee: false }),
    refetchInterval: 60_000,
  });
  const lire = useMutation({
    mutationFn: (id: string | null) =>
      api(id ? `/notifications/${id}/lue` : '/notifications/lues', { methode: 'POST', annee: false }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const nonLues = q.data?.nonLues ?? 0;

  return (
    <>
      <button
        type="button"
        className="bouton-discret relative"
        onClick={() => setOuverte(true)}
        aria-label={nonLues ? `${nonLues} notification(s) non lue(s)` : 'Notifications'}
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {nonLues > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-danger px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-white">
            {nonLues > 9 ? '9+' : nonLues}
          </span>
        )}
      </button>
      <Modale
        titre="Notifications"
        ouverte={ouverte}
        fermer={() => setOuverte(false)}
        pied={
          nonLues > 0 ? (
            <button type="button" className="bouton-secondaire" onClick={() => lire.mutate(null)}>
              Tout marquer comme lu
            </button>
          ) : undefined
        }
      >
        {q.isLoading ? (
          <Chargement />
        ) : !q.data?.notifications.length ? (
          <Vide titre="Aucune notification" />
        ) : (
          <ul className="-mx-5 -my-4 divide-y divide-bord">
            {q.data.notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={clsx('block w-full px-5 py-3 text-left text-sm hover:bg-surface-2', !n.lue && 'bg-primaire-pale/60')}
                  onClick={() => {
                    if (!n.lue) lire.mutate(n.id);
                    if (n.lien) {
                      setOuverte(false);
                      naviguer(n.lien);
                    }
                  }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={clsx('font-semibold', !n.lue && 'text-primaire')}>{n.titre}</span>
                    <span className="shrink-0 text-xs tabular-nums text-encre-3">{quand(n.creeLe)}</span>
                  </div>
                  <p className="mt-0.5 text-encre-2">{n.message}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modale>
    </>
  );
}
