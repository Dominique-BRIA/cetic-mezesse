import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { session } from '../lib/auth';

// Notifications de l'utilisateur connecté (RG-32).
export const notifications = Router();

notifications.get('/', async (req, res) => {
  const id = session(req).id;
  const [liste, nonLues] = await Promise.all([
    prisma.notification.findMany({ where: { destinataireId: id }, orderBy: { creeLe: 'desc' }, take: 30 }),
    prisma.notification.count({ where: { destinataireId: id, lue: false } }),
  ]);
  res.json({ notifications: liste, nonLues });
});

notifications.post('/lues', async (req, res) => {
  await prisma.notification.updateMany({ where: { destinataireId: session(req).id, lue: false }, data: { lue: true } });
  res.status(204).end();
});

notifications.post('/:id/lue', async (req, res) => {
  await prisma.notification.updateMany({ where: { id: String(req.params.id), destinataireId: session(req).id }, data: { lue: true } });
  res.status(204).end();
});
