import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { authentifier } from './lib/auth';
import { gestionnaireErreurs, routeInconnue } from './lib/erreurs';
import { auth } from './routes/auth';
import { baremes, etablissement } from './routes/etablissement';
import { annees } from './routes/annees';
import { classes } from './routes/classes';
import { groupes } from './routes/groupes';
import { matieres } from './routes/matieres';
import { utilisateurs } from './routes/utilisateurs';
import { eleves } from './routes/eleves';
import { notes } from './routes/notes';
import { statistiques } from './routes/statistiques';
import { documents } from './routes/documents';
import { specialites } from './routes/specialites';
import { decisions } from './routes/decisions';
import { notifications } from './routes/notifications';

export function creerApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: config.corsOrigins.length ? config.corsOrigins : true,
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/sante', (_req, res) => {
    res.json({ statut: 'ok' });
  });

  app.use('/api/auth', auth);
  const api = express.Router();
  api.use(authentifier);
  api.use('/etablissement', etablissement);
  api.use('/baremes', baremes);
  api.use('/annees', annees);
  api.use('/classes', classes);
  api.use('/specialites', specialites);
  api.use('/groupes', groupes);
  api.use('/matieres', matieres);
  api.use('/utilisateurs', utilisateurs);
  api.use('/eleves', eleves);
  api.use('/notes', notes);
  api.use('/statistiques', statistiques);
  api.use('/documents', documents);
  api.use('/decisions', decisions);
  api.use('/notifications', notifications);
  app.use('/api', api);

  app.use(routeInconnue);
  app.use(gestionnaireErreurs);
  return app;
}
