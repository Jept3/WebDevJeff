import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (!clientId || !username || !password || password.length < 8) throw new Error("Invalid request.");

    const { data: client, error: clientError } = await admin.from("clients")
      .select("id,email,client_username").eq("id", clientId).single();
    if (clientError || !client) throw new Error("Client not found.");

    const email = client.email;
    if (!email) throw new Error("Client needs an email address.");

    // Find existing auth user by paging users; suitable for a small CRM.
    let existing: any = null;
    for (let page = 1; page <= 20 && !existing; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      existing = data.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
      if (data.users.length < 100) break;
    }

    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (error) throw error;
    } else {
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
    }

    const { error: updateError } = await admin.from("clients")
      .update({ client_username: username }).eq("id", clientId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ ok: true, username }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }
});
