import { formatPhoneNumber, isPhoneNumberMatch } from './formatters';

const allowedNumbersFormatted =
  process.env.SOMENTE_RESPONDER?.split(',')
    .map(formatPhoneNumber)
    .filter((n) => n) ?? [];
const excludedNumbersFormatted =
  process.env.NAO_RESPONDER?.split(',')
    .map(formatPhoneNumber)
    .filter((n) => n) ?? [];

export const isAllowedToProcess = (chatId: string): boolean => {
  if (
    excludedNumbersFormatted.some((number) =>
      isPhoneNumberMatch(chatId, number)
    )
  ) {
    console.log(
      `Número ${chatId} está na lista de excluídos. Ignorando mensagem.`
    );
    return false;
  }

  if (
    allowedNumbersFormatted.length > 0 &&
    !allowedNumbersFormatted.some((number) =>
      isPhoneNumberMatch(chatId, number)
    )
  ) {
    console.log(
      `Número ${chatId} não está na lista de permitidos. Ignorando mensagem.`
    );
    return false;
  }

  return true;
};
