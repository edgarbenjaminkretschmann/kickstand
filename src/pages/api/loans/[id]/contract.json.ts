import type { APIRoute } from "astro";
import { getLoanForUser } from "../../../../lib/access";
import { loadContractPayload } from "../../../../lib/contract-data";

// Contract data for the in-browser PDF. Contains signatures, so only lender and linked requester get it.
export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(null, { status: 401 });
  const access = await getLoanForUser(params.id!, locals.user.id);
  if (!access) return new Response(null, { status: 404 });
  const payload = await loadContractPayload(access.loan.id);
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
