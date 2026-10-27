import type { APIRoute } from "astro";
import { getBike } from "../../../lib/data/bikes";
import { readFileByKey } from "../../../lib/storage";

// Bike photos (the one in the bike form) are only for the owner. Listings have their own public photos.
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return new Response(null, { status: 401 });
  const bike = await getBike(params.id!);
  if (!bike?.photoPath || bike.ownerId !== user.id) return new Response(null, { status: 404 });
  const body = await readFileByKey(bike.photoPath);
  if (!body) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
};
