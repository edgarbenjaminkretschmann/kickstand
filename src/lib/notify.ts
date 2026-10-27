// Notifications for new messages. A stub for now: no e-mail, no push. Wire a provider in here later.

export interface NewMessageNotice {
  conversationId: string;
  recipientId: string;
  senderName: string;
  listingTitle: string;
}

export async function notifyNewMessage(notice: NewMessageNotice): Promise<void> {
  if (import.meta.env?.DEV) console.info(`[notify] new message for ${notice.recipientId} in ${notice.conversationId}`);
}
