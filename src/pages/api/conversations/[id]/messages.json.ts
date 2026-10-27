import type { APIRoute } from "astro";
import { listMessages, markRead } from "../../../../lib/data/conversations";
import { formatTimestamp } from "../../../../lib/dates";

// New messages for the open thread (polled every 15 s). Only buyer and seller get anything.
// `after` is a millisecond timestamp; the client drops ids it already shows.
export const GET: APIRoute = async ({ params, locals, url }) => {
  if (!locals.user) return new Response(null, { status: 401 });
  const afterMs = Number(url.searchParams.get("after"));
  const after = Number.isFinite(afterMs) && afterMs > 0 ? new Date(afterMs - 1) : undefined;
  const messages = await listMessages(params.id!, locals.user.id, after);
  if (!messages) return new Response(null, { status: 404 });
  if (messages.some((m) => m.senderId !== locals.user!.id && !m.readAt)) await markRead(params.id!, locals.user.id);
  const userId = locals.user.id;
  return new Response(
    JSON.stringify({
      messages: messages.map((m) => ({
        id: m.id,
        mine: m.senderId === userId,
        body: m.body,
        at: m.createdAt.getTime(),
        time: formatTimestamp(m.createdAt),
      })),
    }),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
};
