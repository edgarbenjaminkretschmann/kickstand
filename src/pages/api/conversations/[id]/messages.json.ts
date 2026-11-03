import type { APIRoute } from "astro";
import { markReadChecked, pollMessages } from "../../../../lib/data/conversations";
import { isLang, LOCALE_TAG, type Lang } from "../../../../i18n";
import { formatTimestamp, TIME_ZONE } from "../../../../lib/dates";

/** "23.10.2026, 14:05 Uhr" in German, the locale's short date and time otherwise (always Berlin time). */
function messageTime(d: Date, lang: Lang): string {
  if (lang === "de") return formatTimestamp(d);
  return new Intl.DateTimeFormat(LOCALE_TAG[lang], { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" }).format(d);
}

// New messages for the open thread (polled every 15 s). Only buyer and seller get anything.
// One indexed read per poll; the write only happens when there is something unread. Never cached.
// `after` is a millisecond timestamp; the client drops ids it already shows. /api paths carry no language
// prefix, so the thread page sends its language as `lang` for the formatted time.
export const GET: APIRoute = async ({ params, locals, url }) => {
  if (!locals.user) return new Response(null, { status: 401 });
  const qLang = url.searchParams.get("lang");
  const lang: Lang = isLang(qLang) ? qLang : locals.lang;
  const afterMs = Number(url.searchParams.get("after"));
  const after = Number.isFinite(afterMs) && afterMs > 0 ? new Date(afterMs - 1) : undefined;
  const messages = await pollMessages(params.id!, locals.user.id, after);
  if (!messages) return new Response(null, { status: 404 });
  if (messages.some((m) => m.senderId !== locals.user!.id && !m.readAt)) await markReadChecked(params.id!, locals.user.id);
  const userId = locals.user.id;
  return new Response(
    JSON.stringify({
      messages: messages.map((m) => ({
        id: m.id,
        mine: m.senderId === userId,
        body: m.body,
        at: m.createdAt.getTime(),
        time: messageTime(m.createdAt, lang),
      })),
    }),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
};
