import { type WASocket } from '@whiskeysockets/baileys';

export interface RetryRequestProps {
  handler: (params: {
    currentMessage: string;
    chatId: string;
  }) => Promise<string>;
  chatId: string;
  currentMessage: string;
  attempt?: number;
  sock: WASocket;
  processingStates: Map<string, boolean>;
  messageTimeouts: Map<string, boolean>;
}

export interface ProcessChatStateProps {
  chatId: string;
  sock: WASocket;
  processingStates: Map<string, boolean>;
  messageTimeouts: Map<string, boolean>;
}
export interface MessageProcessingProps {
  chatId: string;
  sock: WASocket;
  processingStates: Map<string, boolean>;
  messageTimeouts: Map<string, boolean>;
  activeChatId?: Set<string>;
}
