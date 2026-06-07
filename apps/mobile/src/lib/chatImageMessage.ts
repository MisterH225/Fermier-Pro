const CHAT_IMAGE_PREFIX = '{"chatImage":';

export type ChatImagePayload = {
  url: string;
};

export function buildChatImageMessageBody(url: string): string {
  return JSON.stringify({ chatImage: { url } });
}

export function parseChatImageMessage(body: string): ChatImagePayload | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith(CHAT_IMAGE_PREFIX)) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as { chatImage?: { url?: string } };
    const url = parsed.chatImage?.url?.trim();
    if (!url) {
      return null;
    }
    return { url };
  } catch {
    return null;
  }
}
