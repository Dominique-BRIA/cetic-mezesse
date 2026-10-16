import { config } from './config';
import { creerApp } from './app';

creerApp().listen(config.port, () => {
  console.log(`API du CETIC de Mezessé à l'écoute sur le port ${config.port}`);
});
