import {
  delay,
  downloadMediaMessage,
  type proto,
  type WASocket,
} from '@whiskeysockets/baileys';
import {
  type MessageProcessingProps,
  type ProcessChatStateProps,
  type RetryRequestProps,
} from '../types';
import { splitMessages } from '../util/messages';
import { mainGoogle } from '../services/google';
import {
  convertAndTranscriptionAudio,
  mainOpenAI,
  transcriptionImage,
} from '../services/openai';
import { handleMessagesUpsert } from '.';

const sentMessageIds = new Set<string>();
const excludedNumbersByIntervention = new Set<string>();
const lastSentMessageWarningByChatId = new Map<string, string>();

const messageBufferPerChatId = new Map();
const MAX_RETRIES = 30;
const DELAY_BETWEEN_ATTEMPTS = 1000;
type AIOption = 'GPT' | 'GEMINI';
const AI_SELECTED: AIOption = (process.env.AI_SELECTED as AIOption) || 'GEMINI';

export async function retryRequest({
  handler,
  chatId,
  currentMessage,
  attempt = 1,
  sock,
  processingStates,
  messageTimeouts,
}: RetryRequestProps): Promise<string | undefined> {
  try {
    const answer = await handler({ currentMessage, chatId });
    processChatState({ chatId, sock, processingStates, messageTimeouts });
    return answer;
  } catch (error) {
    console.error(`Erro na tentativa ${attempt}:`, error);
    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_ATTEMPTS)
      );
      return await retryRequest({
        handler,
        chatId,
        currentMessage,
        attempt: attempt + 1,
        sock,
        processingStates,
        messageTimeouts,
      });
    } else {
      console.error('Máximo de tentativas de conexão com a LLM excedido');
      console.error('Mensagem ignorada: ', currentMessage);
      processChatState({ chatId, sock, processingStates, messageTimeouts });
    }
  }
}

export function processChatState({
  chatId,
  sock,
  processingStates,
  messageTimeouts,
}: ProcessChatStateProps): void {
  processingStates.set(chatId, false);
  const currentChatHasNewMessages = messageBufferPerChatId.get(chatId)?.length;
  if (currentChatHasNewMessages) {
    checkAndProcessMessageBuffer({ chatId, sock });
  }
  messageTimeouts.delete(chatId);
}

export async function processMessage({
  chatId,
  sock,
  processingStates,
  messageTimeouts,
  activeChatId,
}: MessageProcessingProps): Promise<void> {
  processingStates.set(chatId, true);
  const messagesToProcess = [...(messageBufferPerChatId.get(chatId) || [])];
  messageBufferPerChatId.delete(chatId);

  const currentMessage = messagesToProcess.join(' \n ');

  const handler = getHandler(AI_SELECTED);
  const answer = await retryRequest({
    handler,
    chatId,
    currentMessage,
    sock,
    processingStates,
    messageTimeouts,
  });

  if (!answer) {
    return;
  }

  console.log('Resposta da IA: ', answer);
  const messages = splitMessages(answer);
  console.log('Enviando mensagens...');

  for (const [, messageToSend] of messages.entries()) {
    await sendMessage({ chatId, messageToSend, sock, activeChatId });
  }
}

export function getHandler(
  aiSelected: string
): (params: { currentMessage: string; chatId: string }) => Promise<string> {
  return aiSelected === 'GPT' ? mainOpenAI : mainGoogle;
}

export function checkAndProcessMessageBuffer({
  chatId,
  sock,
}: {
  chatId: string;
  sock: WASocket;
}): void {
  console.log(
    `Novas mensagens detectadas para ${chatId}, reiniciando o processamento.`
  );

  setImmediate(async () => {
    const bufferedMessages = messageBufferPerChatId
      .get(chatId)
      .map((message: string) => ({
        message: { conversation: message },
        key: { remoteJid: chatId },
      }));
    messageBufferPerChatId.delete(chatId);
    await handleMessagesUpsert({
      sock,
      messagesUpsert: {
        messages: bufferedMessages,
        type: 'notify',
      },
    });
  });
}

export function storeMessageInBuffer({
  chatId,
  messageReceived,
}: {
  chatId: string;
  messageReceived: string;
}): void {
  if (!messageBufferPerChatId.has(chatId)) {
    messageBufferPerChatId.set(chatId, [messageReceived]);
  } else {
    messageBufferPerChatId.set(chatId, [
      ...messageBufferPerChatId.get(chatId),
      messageReceived,
    ]);
  }
}

export function storeMessageIdTracking({
  msgId,
  messagesIdsAlreadyAnswered,
  chatId,
}: {
  msgId: string;
  messagesIdsAlreadyAnswered: Map<string, string[]>;
  chatId: string;
}): void {
  if (msgId) {
    if (messagesIdsAlreadyAnswered.has(chatId)) {
      messagesIdsAlreadyAnswered.set(chatId, [
        ...messagesIdsAlreadyAnswered.get(chatId)!,
        msgId,
      ]);
      return;
    }
    messagesIdsAlreadyAnswered.set(chatId, [msgId]);
    setTimeout(
      () => {
        messagesIdsAlreadyAnswered.delete(chatId);
      },
      24 * 60 * 60 * 1000 // 24 horas
    );
  }
}

export async function processNonTextMessage({
  msg,
  sock,
  chatId,
}: {
  msg: proto.IWebMessageInfo;
  sock: WASocket;
  chatId: string;
}): Promise<boolean> {
  const isVideoMessage =
    msg.message?.videoMessage ||
    msg.message?.ephemeralMessage?.message?.videoMessage;
  const isLocationMessage =
    msg.message?.locationMessage ||
    msg.message?.ephemeralMessage?.message?.locationMessage ||
    msg.message?.liveLocationMessage ||
    msg.message?.ephemeralMessage?.message?.liveLocationMessage;
  const isDocumentMessage =
    msg.message?.documentMessage ||
    msg.message?.ephemeralMessage?.message?.documentMessage;

  if (isLocationMessage || isDocumentMessage || isVideoMessage) {
    const messageToSend =
      process.env.MENSAGEM_PARA_ENVIAR_QUANDO_RECEBER_TIPO_DESCONHECIDO!;
    await sendMessage({ sock, chatId, messageToSend });

    return true;
  }

  return false;
}

export async function sendMessage({
  sock,
  messageToSend,
  chatId,
  activeChatId,
}: {
  sock: WASocket;
  messageToSend: string;
  chatId: string;
  activeChatId?: Set<string>;
}): Promise<void> {
  if (
    excludedNumbersByIntervention.has(chatId) &&
    activeChatId &&
    activeChatId.has(chatId)
  ) {
    console.log('Ignorando', chatId, 'por intervenção humana');
    return;
  }

  const trimmedMessage = messageToSend.trimStart().trimEnd();

  if (lastSentMessageWarningByChatId.get(chatId) === trimmedMessage) {
    console.log('Mensagem repetida, ignorando...');
    return;
  }

  await sock.sendPresenceUpdate('composing', chatId);
  const dynamicDelay = messageToSend.length * 50;

  await delay(dynamicDelay);
  await sock.sendPresenceUpdate('paused', chatId);
  console.log('Mensagem enviada: ', trimmedMessage);
  const result = await sock.sendMessage(chatId, {
    text: trimmedMessage,
  });

  lastSentMessageWarningByChatId.set(chatId, trimmedMessage);
  if (result?.key.id) {
    sentMessageIds.add(result?.key.id);
  }
}

export function hasSentMessagesIds(messageId: string): boolean {
  return sentMessageIds.has(messageId);
}

export function hasExcludedNumbersByIntervention(
  chatId: string | undefined | null
): boolean {
  if (chatId) {
    return excludedNumbersByIntervention.has(chatId);
  }
  return false;
}

export function addExcludedNumbersByIntervention(chatId: string): void {
  excludedNumbersByIntervention.add(chatId);
}

export function deleteExcludedNumbersByIntervention(chatId: string): void {
  excludedNumbersByIntervention.delete(chatId);
}

export async function getMessageReceivedInText(
  msg: proto.IWebMessageInfo
): Promise<string | null | undefined> {
  const isAudioMessage =
    msg.message?.audioMessage ||
    msg.message?.ephemeralMessage?.message?.audioMessage;
  const isImageMessage =
    msg.message?.imageMessage ||
    msg.message?.ephemeralMessage?.message?.audioMessage;

  if (isAudioMessage) {
    if (!msg.key.id) {
      console.log('msg.key.id não encontrado');
      return;
    }
    const bufferAudio = (await downloadMediaMessage(
      msg,
      'buffer',
      {}
    )) as Buffer;
    const transcriptionText = await convertAndTranscriptionAudio({
      bufferAudio,
      messageId: msg.key.id,
    });

    console.log({ transcriptionText });

    return transcriptionText;
  }

  if (isImageMessage) {
    if (!msg.key.id) {
      console.log('msg.key.id não encontrado');
      return;
    }
    console.log(msg.message);

    const bufferImage = (await downloadMediaMessage(
      msg,
      'buffer',
      {}
    )) as Buffer;

    const transcriptionText = await transcriptionImage({
      bufferImage,
      messageId: msg.key.id,
      caption: (msg.message?.imageMessage?.caption ||
        msg.message?.ephemeralMessage?.message?.audioMessage) as string | null,
    });

    console.log('imagem:', transcriptionText);

    return transcriptionText;
  }
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.ephemeralMessage?.message?.conversation ||
    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text
  );
}
