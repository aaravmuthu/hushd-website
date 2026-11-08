import { createFileRoute } from "@tanstack/react-router";

import { handleBetaRedeem } from "@/lib/licensing/beta";

// POST /api/beta/redeem, called by the /beta page.
export const Route = createFileRoute("/api/beta/redeem")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Loaded here, not at the top: route files also ship to the browser bundle.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        return handleBetaRedeem(request, (fn, args) => supabaseAdmin.rpc(fn, args));
      },
    },
  },
});
