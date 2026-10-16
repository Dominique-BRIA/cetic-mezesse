// Accès à l'API : jeton dans l'en-tête, année scolaire choisie ajoutée aux requêtes, erreurs en français.

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

const CLE_JETON = 'cetic-jeton';
const CLE_ANNEE = 'cetic-annee';

function lireStockage(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireStockage(cle: string, valeur: string | null) {
  try {
    if (valeur === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, valeur);
  } catch {
    // stockage indisponible (navigation privée) : la session ne survivra pas au rechargement
  }
}

let jeton = lireStockage(CLE_JETON);
let anneeId = lireStockage(CLE_ANNEE);

export const session = {
  jeton: () => jeton,
  definirJeton(j: string | null) {
    jeton = j;
    ecrireStockage(CLE_JETON, j);
  },
  annee: () => anneeId,
  definirAnnee(id: string | null) {
    anneeId = id;
    ecrireStockage(CLE_ANNEE, id);
  },
};

export class ErreurApi extends Error {
  constructor(public statut: number, message: string) {
    super(message);
  }
}

let surExpiration: (() => void) | null = null;
export function quandSessionExpire(f: () => void) {
  surExpiration = f;
}

function url(chemin: string, avecAnnee = true): string {
  const u = new URL(API_URL + chemin);
  if (avecAnnee && anneeId && !u.searchParams.has('anneeId')) u.searchParams.set('anneeId', anneeId);
  return u.toString();
}

async function traiter(r: Response) {
  if (r.status === 401 && jeton) {
    session.definirJeton(null);
    surExpiration?.();
  }
  if (!r.ok) {
    let message = `Erreur ${r.status}`;
    try {
      const j = await r.json();
      if (j?.message) message = j.message;
    } catch {
      // réponse sans JSON
    }
    throw new ErreurApi(r.status, message);
  }
}

export async function api<T = unknown>(chemin: string, options: { methode?: string; corps?: unknown; annee?: boolean } = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url(chemin, options.annee !== false), {
      method: options.methode ?? 'GET',
      headers: {
        ...(options.corps !== undefined && !(options.corps instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      },
      body:
        options.corps === undefined
          ? undefined
          : options.corps instanceof FormData
            ? options.corps
            : JSON.stringify(options.corps),
    });
  } catch {
    throw new ErreurApi(0, 'Impossible de joindre le serveur. Vérifiez votre connexion.');
  }
  await traiter(r);
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

// Téléchargement d'un fichier (PDF, Excel) : ouvre le PDF dans un onglet, enregistre le reste.
export async function telecharger(chemin: string, options: { methode?: string; corps?: unknown; ouvrir?: boolean } = {}) {
  const onglet = options.ouvrir ? window.open('', '_blank') : null;
  try {
    const r = await fetch(url(chemin), {
      method: options.methode ?? 'GET',
      headers: {
        ...(options.corps ? { 'Content-Type': 'application/json' } : {}),
        ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      },
      body: options.corps ? JSON.stringify(options.corps) : undefined,
    });
    await traiter(r);
    const blob = await r.blob();
    const nom = r.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'document';
    const lien = URL.createObjectURL(blob);
    if (onglet) {
      onglet.location.href = lien;
    } else {
      const a = document.createElement('a');
      a.href = lien;
      a.download = nom;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(lien), 60_000);
  } catch (e) {
    onglet?.close();
    throw e;
  }
}

// Adresse d'une image protégée (le jeton passe en paramètre car <img> n'envoie pas d'en-tête).
export function urlProtegee(chemin: string, version?: string | null): string {
  const u = new URL(API_URL + chemin);
  if (jeton) u.searchParams.set('jeton', jeton);
  if (version) u.searchParams.set('v', version);
  return u.toString();
}
