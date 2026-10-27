import type { APIRoute } from "astro";
import { getLoanForUser, getSignature } from "../../../lib/data/loans";

// Signature images: only the lender and the borrower linked to the loan.
export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(null, { status: 401 });
  const sig = await getSignature(params.id!);
  if (!sig || !(await getLoanForUser(sig.loanId, locals.user.id))) return new Response(null, { status: 404 });
  const b64 = sig.pngDataUrl.slice(sig.pngDataUrl.indexOf(",") + 1);
  return new Response(new Uint8Array(Buffer.from(b64, "base64")), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
};
