import type { APIRoute } from "astro";
import { getLoanForUser, getPhotoWithLoan } from "../../../lib/data/loans";
import { readFileByKey } from "../../../lib/storage";

// Protocol photos: only the lender and the borrower linked to the loan.
export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(null, { status: 401 });
  const row = await getPhotoWithLoan(params.id!);
  if (!row || !(await getLoanForUser(row.loan.id, locals.user.id))) return new Response(null, { status: 404 });
  const body = await readFileByKey(row.photo.path);
  if (!body) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400, immutable" },
  });
};
