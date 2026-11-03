import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { tk } from "../i18n";
import { getConversationForUser, MAX_MESSAGE_LENGTH, sendMessage, startConversation } from "../lib/data/conversations";
import { notifyNewMessage } from "../lib/notify";
import { allow, RULES } from "../lib/rate-limit";
import { guard, requireUser } from "./util";

const body = z
  .string({ required_error: tk("Bitte eine Nachricht schreiben."), invalid_type_error: tk("Bitte eine Nachricht schreiben.") })
  .trim()
  .min(1, tk("Bitte eine Nachricht schreiben."))
  .max(MAX_MESSAGE_LENGTH, tk("Höchstens 4000 Zeichen."));

// Per member: a burst of 10 messages a minute, 120 an hour.
async function limitMessages(userId: string) {
  if (!(await allow(RULES.messageMinute, userId)) || !(await allow(RULES.messageHour, userId))) {
    throw new ActionError({ code: "TOO_MANY_REQUESTS", message: tk("Du schreibst gerade sehr viele Nachrichten. Bitte kurz warten.") });
  }
}

async function notify(conversationId: string, senderId: string, senderName: string) {
  const c = await getConversationForUser(conversationId, senderId);
  if (c) await notifyNewMessage({ conversationId, recipientId: c.other.id, senderName, listingTitle: c.listing.title });
}

export const messageActions = {
  /** First message about a listing. Reuses an existing conversation. */
  start: defineAction({
    accept: "form",
    input: z.object({ listingId: z.string(), body }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        await limitMessages(user.id);
        const conversationId = await startConversation(input.listingId, user.id, input.body);
        await notify(conversationId, user.id, user.name);
        return { conversationId };
      }),
  }),

  send: defineAction({
    accept: "form",
    input: z.object({ conversationId: z.string(), body }),
    handler: (input, context) =>
      guard(async () => {
        const user = requireUser(context);
        await limitMessages(user.id);
        const msg = await sendMessage(input.conversationId, user.id, input.body);
        await notify(input.conversationId, user.id, user.name);
        return { conversationId: input.conversationId, id: msg.id, createdAt: msg.createdAt.toISOString() };
      }),
  }),
};
