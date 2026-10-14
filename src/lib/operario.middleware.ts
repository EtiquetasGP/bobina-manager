import { createMiddleware } from "@tanstack/react-start";

export const requireOperario = createMiddleware({
  type: "function",
})
  .client(async ({ next }) => {
    const { supabase } = await import(
      "@/integrations/supabase/client"
    );

    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      throw new Error(
        "Inicie sesión con su cuenta para continuar.",
      );
    }

    return next({
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    });
  })
  .server(async ({ next }) => {
    const { getRequest } = await import(
      "@tanstack/react-start/server"
    );

    const authorization =
      getRequest().headers.get("authorization");

    const token =
      authorization?.match(/^Bearer (.+)$/i)?.[1];

    if (!token) {
      throw new Error(
        "Inicie sesión con su cuenta para continuar.",
      );
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } =
      await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      throw new Error(
        "La sesión venció. Inicie sesión nuevamente.",
      );
    }

    return next({
      context: {
        operario: data.user.id,
      },
    });
  });
