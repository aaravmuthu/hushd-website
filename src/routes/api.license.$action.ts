import { createFileRoute } from "@tanstack/react-router";

import { handleLicenseRequest } from "@/lib/licensing/handler";

// POST /api/license/activate | validate | deactivate, called by the Hushd Mac app.
export const Route = createFileRoute("/api/license/$action")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        // Loaded here, not at the top: route files also ship to the browser bundle.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        return handleLicenseRequest(params.action, request, (fn, args) =>
          supabaseAdmin.rpc(fn, args as { p_key: string; p_device_id: string }),
        );
      },
    },
  },
});
