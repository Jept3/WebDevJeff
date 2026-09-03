import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 48);
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service);

    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) throw new Error("Not authenticated.");

    const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
    if (profile?.role !== "admin") throw new Error("Admin access required.");

    const { clientId, username, password } = await req.json();
    const cleanUsername = normalizeUsername(username || "");

    if (!clientId || !cleanUsername || !password || password.length < 8) {
      throw new Error("Client, username, and password of at least 8 characters are required.");
    }

    // Prevent duplicate username on another client.
    const { data: duplicate } = await admin.from("clients")
      .select("id").ilike("client_username", cleanUsername).neq("id", clientId).maybeSingle();
    if (duplicate) throw new Error("That username is already in use.");

    const { data: client, error: clientError } = await admin.from("clients")
      .select("id,auth_user_id,login_email").eq("id", clientId).single();
    if (clientError || !client) throw new Error("Client not found.");

    // Hidden internal email. Client never needs to know or use this.
    const internalEmail = client.login_email || `${cleanUsername}.${clientId.slice(0,8)}@login.jeffdesign101.invalid`;

    let authUserId = client.auth_user_id;

    if (authUserId) {
      const { error } = await admin.auth.admin.updateUserById(authUserId, {
        email: internalEmail,
        password,
        email_confirm: true,
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

    const { error: updateError } = await admin.from("clients").update({
      client_username: cleanUsername,
      auth_user_id: authUserId,
      login_email: internalEmail,
    }).eq("id", clientId);
    if (updateError) throw updateError;

    // Ensure this account stays a client role.
    await admin.from("profiles").upsert({
      id: authUserId,
      email: internalEmail,
      role: "client",
    }, { onConflict: "id" });

    return new Response(JSON.stringify({
      ok: true,
      username: cleanUsername,
      authUserId,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }
});
