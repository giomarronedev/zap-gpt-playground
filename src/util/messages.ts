import { type proto } from '@whiskeysockets/baileys';

export function splitMessages(text: string): string[] {
  const complexPattern =
    /(http[s]?:\/\/[^\s]+)|(www\.[^\s]+)|([^\s]+@[^\s]+\.[^\s]+)|(["'].*?["'])|(\b\d+\.\s)|(\w+\.\w+)/g;
  const placeholders = text.match(complexPattern) ?? [];

  const placeholder = 'PLACEHOLDER_';
  let currentIndex = 0;
  const textWithPlaceholders = text.replace(
    complexPattern,
    () => `${placeholder}${currentIndex++}`
  );

  const splitPattern = /(?<!\b\d+\.\s)(?<!\w+\.\w+)[^.?!]+(?:[.?!]+["']?|$)/g;
  let parts = textWithPlaceholders.match(splitPattern) ?? ([] as string[]);

  if (placeholders.length > 0) {
    parts = parts.map((part) =>
      placeholders.reduce(
        (acc, val, idx) => acc.replace(`${placeholder}${idx}`, val),
        part
      )
    );
  }

  return parts;
}

export function registerMessageOnHistory({
  chatId,
  message,
  activeChatsHistory,
}: {
  chatId: string;
  message: string;
  activeChatsHistory: Map<any, any>;
}): void {
  if (activeChatsHistory.has(chatId)) {
    const currentHistory = activeChatsHistory.get(chatId);
    activeChatsHistory.set(chatId, [
      ...currentHistory,
      {
        role: 'model',
        parts: message,
      },
    ]);
  } else {
    activeChatsHistory.set(chatId, [
      {
        role: 'model',
        parts: message,
      },
    ]);
  }
}

export function shouldReplyToMessage(
  msg: proto.IWebMessageInfo,
  messageType: string,
  messagesIdsAlreadyAnswered: Map<string, string[]>,
  chatId?: string | null
): boolean {
  if (msg.key.id && chatId) {
    const messagesIds = messagesIdsAlreadyAnswered.get(chatId);
    if (messagesIds?.includes(msg.key.id)) {
      console.log('mensagem já respondida!', msg);
      return false;
    }
  }

  return (
    !msg.key.fromMe &&
    msg.key.remoteJid !== 'status@broadcast' &&
    !msg.key.participant &&
    (messageType === 'conversation' ||
      messageType === 'extendedTextMessage' ||
      messageType === 'messageContextInfo' ||
      messageType === 'locationMessage' ||
      messageType === 'liveLocationMessage' ||
      messageType === 'imageMessage' ||
      messageType === 'audioMessage' ||
      messageType === 'videoMessage' ||
      messageType === 'documentMessage')
  );
}
