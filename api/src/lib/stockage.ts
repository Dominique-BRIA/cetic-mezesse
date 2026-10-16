// Stockage des photos d'élèves : Backblaze B2 (API compatible S3) si configuré,
// sinon le dossier local api/uploads (développement).
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';

const b2Actif = Boolean(config.b2.endpoint && config.b2.keyId && config.b2.applicationKey && config.b2.bucket);
const dossierLocal = path.resolve(__dirname, '../../uploads');

const client = b2Actif
  ? new S3Client({
      endpoint: config.b2.endpoint,
      region: config.b2.endpoint.match(/s3\.([a-z0-9-]+)\./)?.[1] ?? 'us-west-004',
      credentials: { accessKeyId: config.b2.keyId, secretAccessKey: config.b2.applicationKey },
    })
  : null;

export async function deposer(cle: string, contenu: Buffer, type: string): Promise<void> {
  if (client) {
    await client.send(new PutObjectCommand({ Bucket: config.b2.bucket, Key: cle, Body: contenu, ContentType: type }));
    return;
  }
  const fichier = path.join(dossierLocal, cle);
  await mkdir(path.dirname(fichier), { recursive: true });
  await writeFile(fichier, contenu);
}

export async function lire(cle: string): Promise<Buffer | null> {
  try {
    if (client) {
      const r = await client.send(new GetObjectCommand({ Bucket: config.b2.bucket, Key: cle }));
      return Buffer.from(await r.Body!.transformToByteArray());
    }
    return await readFile(path.join(dossierLocal, cle));
  } catch {
    return null;
  }
}

export async function supprimer(cle: string): Promise<void> {
  try {
    if (client) await client.send(new DeleteObjectCommand({ Bucket: config.b2.bucket, Key: cle }));
    else await unlink(path.join(dossierLocal, cle));
  } catch {
    // fichier déjà absent : rien à faire
  }
}

export const stockageDistant = b2Actif;
