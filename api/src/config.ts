import 'dotenv/config';

function requis(nom: string): string {
  const v = process.env[nom];
  if (!v) throw new Error(`Variable d'environnement manquante : ${nom}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: requis('JWT_SECRET'),
  dureeJeton: '12h' as const,
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  b2: {
    endpoint: process.env.B2_ENDPOINT ?? '',
    keyId: process.env.B2_KEY_ID ?? '',
    applicationKey: process.env.B2_APPLICATION_KEY ?? '',
    bucket: process.env.B2_BUCKET ?? '',
  },
  // Mot de passe donné à un compte après réinitialisation par le SG (décision du 16/10/2026).
  motDePasseReinitialise: 'password',
};
