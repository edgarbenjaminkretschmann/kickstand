import type { APIRoute } from "astro";
import { getListingPhoto } from "../../../lib/data/listings";
import { readFileByKey } from "../../../lib/storage";

// Listing photos are public, like the listings themselves. Ids are random and change when a photo is replaced.
export const GET: APIRoute = async ({ params }) => {
  const photo = await getListingPhoto(params.id!);
  if (!photo) return new Response(null, { status: 404 });
  const body = await readFileByKey(photo.key);
  if (!body) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=604800, immutable" },
  });
};
