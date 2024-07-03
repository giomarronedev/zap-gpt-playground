import { type Boom } from '@hapi/boom';
import { initBaileysClient } from '../clients/baileys';
import {
  DisconnectReason,
  type MessageUpsertType,
  type WASocket,
  type proto,
} from '@whiskeysockets/baileys';
import { initializeNewAIChatSession } from '../services/openai';
import { shouldReplyToMessage } from '../util/messages';
import {
  storeMessageInBuffer,
  processMessage,
  storeMessageIdTracking,
  processNonTextMessage,
  hasSentMessagesIds,
  hasExcludedNumbersByIntervention,
  addExcludedNumbersByIntervention,
  deleteExcludedNumbersByIntervention,
  getMessageReceivedInText,
  sendMessage,
} from './message';
import fs from 'node:fs';
import { isAllowedToProcess } from '../util/permissions';

const messageTimeouts = new Map();
const activeChatId = new Set<string>();

const messagesIdsAlreadyAnswered = new Map<string, string[]>();

// serve para saber quando aquele chat em especifico está buscando uma resposta na API da LLM
const processingStates = new Map<string, boolean>();

type AIOption = 'GPT' | 'GEMINI';
const AI_SELECTED: AIOption = (process.env.AI_SELECTED as AIOption) || 'GEMINI';

export function handleConnectionClose(
  lastDisconnect: { error: Error | undefined; date: Date } | undefined
): void {
  const shouldReconnect =
    (lastDisconnect?.error as Boom)?.output?.statusCode !==
    DisconnectReason.loggedOut;
  console.log('Connection closed, reconnecting', shouldReconnect);
  if (shouldReconnect) initBaileysClient();
  if (!shouldReconnect) {
    try {
      fs.rmdirSync('auth_info', { recursive: true });
      console.log('Pasta auth_info removida com sucesso.');
      initBaileysClient();
    } catch (error) {
      console.error(`Erro ao remover a pasta auth_info: ${error as any}`);
    }
  }
}

export async function handleMessagesUpsert({
  sock,
  messagesUpsert,
}: {
  sock: WASocket;
  messagesUpsert: {
    messages: proto.IWebMessageInfo[];
    type: MessageUpsertType;
  };
}): Promise<void> {
  if (messagesUpsert.type === 'notify') {
    for (const msg of messagesUpsert.messages) {
      const messageType = Object.keys(msg.message ?? {})[0];
      const chatId = msg.key.remoteJid!;
      const { fromMe, id: messageId } = msg.key;

      if (!chatId) {
        return;
      }

      console.log('message received', JSON.stringify(msg));
      console.log('message type', messageType);

      const isIgnoredDueToIntervention =
        hasExcludedNumbersByIntervention(chatId) && activeChatId.has(chatId);

      const isHumanInterventionDetected =
        fromMe &&
        messageId &&
        !hasSentMessagesIds(messageId) &&
        chatId !== 'status@broadcast' &&
        activeChatId.has(chatId);

      const shouldSendErrorMessage =
        !messageType &&
        msg?.messageStubType === 2 &&
        msg.key.remoteJid &&
        !msg.key.participant &&
        msg.key.id;

      if (isIgnoredDueToIntervention) {
        console.log('Ignorando', msg.key.remoteJid, 'por intervenção humana');
        return;
      }

      if (isHumanInterventionDetected) {
        console.log('Intervenção humanada detectada', msg.key);
        addExcludedNumbersByIntervention(chatId);
        setTimeout(
          () => {
            deleteExcludedNumbersByIntervention(chatId);
          },
          Number(process.env.HORAS_PARA_REATIVAR_IA!) * 60 * 60 * 1000
        );
        return;
      }

      if (!isAllowedToProcess(chatId)) return;

      if (shouldSendErrorMessage) {
        setTimeout(() => {
          if (
            messagesIdsAlreadyAnswered.has(msg.key.remoteJid!) &&
            !messagesIdsAlreadyAnswered
              .get(msg.key.remoteJid!)
              ?.includes(msg.key.id!)
          ) {
            sendMessage({
              chatId: msg.key.remoteJid!,
              messageToSend:
                'Oi, tive um problema para processar sua mensagem, pode enviar novamente?',
              sock,
            });
          }
        }, 30000);
      }

      if (
        shouldReplyToMessage(
          msg,
          messageType,
          messagesIdsAlreadyAnswered,
          msg.key.remoteJid
        )
      ) {
        if (!chatId) {
          console.log('chatId não encontrado');
          console.log({ chatId });
          return;
        }

        // if (chatId !== '555192194386@s.whatsapp.net') {
        //   return;
        // }

        const isNonTextMessage = await processNonTextMessage({
          chatId,
          msg,
          sock,
        });

        if (isNonTextMessage) {
          return;
        }

        if (AI_SELECTED === 'GPT') {
          await initializeNewAIChatSession(chatId);
        }

        const messageReceivedText = await getMessageReceivedInText(msg);

        console.log('messageReceivedText ', messageReceivedText);

        if (!messageReceivedText) {
          console.log('mensagem recebida não encontrada');
          console.log({ chatId, messageReceivedText });
          return;
        }

        storeMessageInBuffer({ chatId, messageReceived: messageReceivedText });

        setTimeout(async () => {
          await sock.readMessages([msg.key]);
        }, 1000);

        if (processingStates.get(chatId)) {
          console.log(
            `Processamento em andamento para ${chatId}. Mensagem adicionada ao buffer.`
          );
          continue;
        }

        if (messageTimeouts.has(chatId)) {
          clearTimeout(messageTimeouts.get(chatId));
        }

        console.log(`Aguardando novas mensagens de ${chatId}...`);

        messageTimeouts.set(
          chatId,
          setTimeout(
            async () => {
              activeChatId.add(chatId);
              setTimeout(
                () => {
                  activeChatId.delete(chatId);
                },
                24 * 60 * 60 * 1000 // 24 horas
              );
              await processMessage({
                chatId,
                sock,
                processingStates,
                messageTimeouts,
                activeChatId,
              });
              if (msg.key.id) {
                storeMessageIdTracking({
                  chatId,
                  msgId: msg.key.id,
                  messagesIdsAlreadyAnswered,
                });
              }
            },
            Number(process.env.SEGUNDOS_PARA_ESPERAR_ANTES_DE_GERAR_RESPOSTA!) *
              1000
          )
        );
      }
    }
  }
}

// export function handlePresenceUpdate(p: {
//   id: string;
//   presences: Record<string, PresenceData>;
// }): void {
//   const { id, presences } = p;
//   const lastKnownPresence = presences[id]?.lastKnownPresence;
//   console.log('lastKnownPresence',lastKnownPresence)
//   if (lastKnownPresence === 'composing') {
//     isTypingChatId.add(id);
//   } else if (lastKnownPresence === 'available') {
//     if (isTypingChatId.has(id)) {
//       isTypingChatId.delete(id);
//     }
//   }
// }
