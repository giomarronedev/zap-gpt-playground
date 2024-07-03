import {
  type WAMessageContent,
  type WAMessageKey,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
  proto,
} from '@whiskeysockets/baileys';
import NodeCache from 'node-cache';

import { handleConnectionClose, handleMessagesUpsert } from '../handlers';
import pino from 'pino';

const noopLogger = pino({
  level: 'silent',
  stream: {
    write: () => {},
  },
});

const msgRetryCounterCache = new NodeCache();

async function getMessage(
  key: WAMessageKey
): Promise<WAMessageContent | undefined> {
  console.log('message recovery', key);
  return proto.Message.fromObject({});
}

export async function initBaileysClient(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    printQRInTerminal: true,
    syncFullHistory: false,
    msgRetryCounterCache,
    version,
    markOnlineOnConnect: true,
    auth: {
      creds: state.creds,
      keys: state.keys,
    },
    logger: noopLogger,
    getMessage,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') handleConnectionClose(lastDisconnect);
    else if (connection === 'open') console.log('Opened connection');
  });

  sock.ev.on('messages.upsert', async (messagesUpsert) => {
    await handleMessagesUpsert({ sock, messagesUpsert });
  });

  // sock.ev.on('presence.update', (presence) => {
  //   handlePresenceUpdate(presence);
  // });
}

// msg.key.remoteJid === '555181995600@s.whatsapp.net' &&
