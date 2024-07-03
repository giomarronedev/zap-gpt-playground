export function formatPhoneNumber(phoneNumber: string): string {
  let cleanNumber = phoneNumber.replace(/\D/g, '');

  if (cleanNumber === '') {
    return '';
  }

  if (cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
    cleanNumber = cleanNumber.slice(0, 4) + cleanNumber.slice(5);
  }
  return `${cleanNumber}@c.us`;
}

export function normalizePhoneNumber(phoneNumber: string): string {
  let cleanNumber = phoneNumber.replace(/\D/g, '');
  if (cleanNumber.startsWith('55')) {
    cleanNumber = cleanNumber.substring(2);
    if (cleanNumber.length === 11) {
      cleanNumber = cleanNumber.substring(0, 2) + cleanNumber.substring(3);
    }
  }
  return cleanNumber;
}

export function isPhoneNumberMatch(
  chatId: string,
  phoneNumber: string
): boolean {
  const normalizedChatId = normalizePhoneNumber(chatId);
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  return normalizedChatId === normalizedPhoneNumber;
}
