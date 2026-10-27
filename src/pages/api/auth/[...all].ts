import type { APIRoute } from "astro";
import { handleAuthRequest } from "../../../lib/auth";

export const ALL: APIRoute = (ctx) => handleAuthRequest(ctx.request);
