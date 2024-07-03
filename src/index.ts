import { validateConfig } from './config';

import dotenv from 'dotenv';
import { startLogging } from './log';
import { initBaileysClient } from './clients/baileys';

dotenv.config();

startLogging();

console.log('process.env', process.env);

validateConfig();

initBaileysClient();

console.log(
  `Aplicativo inicializado com a configuração de IA selecionada: ${process.env.AI_SELECTED}`
);
