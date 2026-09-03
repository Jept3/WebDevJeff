import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 48);
}

function getDefaultKey(envName: string, legacyName: string) {
  const modern = Deno.env.get(envName);
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed.default) return parsed.default;
      const first = Object.values(parsed)[0];
      if (first) return String(first);
    } catch (_) {}
  }
  return Deno.env.get(legacyName) || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing admin Authorization header." }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL") || "";
    const publishable = getDefaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const secret = getDefaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !publishable || !secret) {
      return json({ error: "Supabase function environment keys are unavailable." }, 500);
    }

    // verify_jwt is intentionally disabled at the platform layer.
    // We still authenticate the actual signed-in caller here.
    const caller = createClient(url, publishable, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) {
      return json({ error: "Admin authentication failed. Sign in again." }, 401);
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return json({ error: "Admin access required." }, 403);
    }

    const { clientId, username, password } = await req.json();
    const cleanUsername = normalizeUsername(username || "");

    if (!clientId || !cleanUsername || !password || password.length < 8) {
      return json(
        { error: "Client, username, and password of at least 8 characters are required." },
        400,
      );
    }

    const { data: duplicate } = await admin
      .from("clients")
      .select("id")
      .ilike("client_username", cleanUsername)
      .neq("id", clientId)
      .maybeSingle();

    if (duplicate) {
      return json({ error: "That username is already in use." }, 409);
    }

    const { data: client, error: clientError } = await admin
      .from("clients")
      .select("id,auth_user_id,login_email")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return json({ error: "Client record not found." }, 404);
    }

    const internalEmail =
      client.login_email ||
      `${cleanUsername}.${clientId.slice(0, 8)}@login.jeffdesign101.invalid`;

    let authUserId = client.auth_user_id;

    if (authUserId) {
      const { error } = await admin.auth.admin.updateUserById(authUserId, {
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: { client_username: cleanUsername, client_id: clientId },
      });
      if (error) throw error;
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: { client_username: cleanUsername, client_id: clientId },
      });
      if (error) throw error;
      authUserId = created.user.id;
    }

    const { error: updateError } = await admin
      .from("clients")
      .update({
        client_username: cleanUsername,
        auth_user_id: authUserId,
        login_email: internalEmail,
      })
      .eq("id", clientId);

    if (updateError) throw updateError;

    const { error: profileUpsertError } = await admin.from("profiles").upsert(
      {
        id: authUserId,
        email: internalEmail,
        role: "client",
      },
      { onConflict: "id" },
    );
    if (profileUpsertError) throw profileUpsertError;

    return json({
      ok: true,
      username: cleanUsername,
      authUserId,
    });
  } catch (err) {
    console.error("admin-create-client-user:", err);
    return json({ error: err?.message || String(err) }, 400);
  }
});
