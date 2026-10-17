// Réduit une photo avant l'envoi : 600 px au plus sur le grand côté, en JPEG. Une photo de
// téléphone de plusieurs Mo descend à ~100 Ko (le serveur refuse au-delà de 3 Mo).
export async function reduirePhoto(fichier: File, cote = 600): Promise<Blob> {
  const url = URL.createObjectURL(fichier);
  try {
    const image = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error(`« ${fichier.name} » n'est pas une image lisible (JPEG ou PNG).`));
      i.src = url;
    });
    const echelle = Math.min(1, cote / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * echelle);
    canvas.height = Math.round(image.naturalHeight * echelle);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; // fond blanc pour les PNG transparents
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Photo illisible.'))), 'image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Le matricule écrit dans le nom du fichier (« CTM26-0047.jpg », « photo ctm26-0047 (2).png »).
export function matriculeDuFichier(nom: string, matricules: string[]): string | null {
  const n = nom.toUpperCase().replace(/\s+/g, '');
  return matricules.find((m) => n.includes(m.toUpperCase())) ?? null;
}
