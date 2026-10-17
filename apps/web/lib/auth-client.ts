"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

/** Cliente de Better Auth para el navegador (mismo origen: /api/auth). */
export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
