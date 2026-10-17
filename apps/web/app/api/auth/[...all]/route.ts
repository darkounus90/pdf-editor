import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "../../../../lib/server/auth";

// Better Auth atiende /api/auth/* (registro, inicio de sesión, Google, enlace mágico…).
const handler = async (req: Request) => (await getAuth()).handler(req);

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(handler);
