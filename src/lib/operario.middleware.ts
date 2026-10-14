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

    // El nombre se obtiene de los datos administrados
    // de la cuenta verificada, nunca del formulario.
    const nombreGuardado: unknown =
      data.user.app_metadata?.nombre_operario;

    const nombreOperario =
      typeof nombreGuardado === "string"
        ? nombreGuardado.trim()
        : "";

    if (!nombreOperario) {
      throw new Error(
        "Esta cuenta todavía no tiene asignado el nombre y apellido del operario.",
      );
    }

    if (nombreOperario.length > 200) {
      throw new Error(
        "El nombre del operario supera el máximo de 200 caracteres.",
      );
    }

    return next({
      context: {
        operario: nombreOperario,
        operarioId: data.user.id,
      },
    });
  });
