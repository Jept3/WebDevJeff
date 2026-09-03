import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const cleanUsername = (v: string) =>
  v.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 48);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    if (!url || !anon || !service) return json({ error: "Missing Supabase function secrets" }, 500);
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing admin session" }, 401);

    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, service, { auth: { persistSession: false } });

    const { data: callerData, error: callerError } = await caller.auth.getUser();
    if (callerError || !callerData.user) return json({ error: "Invalid admin session" }, 401);

    const { data: profile } = await admin.from("profiles").select("role").eq("id", callerData.user.id).single();
    if (profile?.role !== "admin") return json({ error: "Admin access required" }, 403);

    const { clientId, username, password } = await req.json();
    const usernameClean = cleanUsername(username || "");
    if (!clientId || !usernameClean || !password || password.length < 8)
      return json({ error: "Client, username and password (8+ characters) are required" }, 400);

    const { data: dup } = await admin.from("clients").select("id").ilike("client_username", usernameClean).neq("id", clientId).maybeSingle();
    if (dup) return json({ error: "Username is already in use" }, 409);

    const { data: client, error: clientError } = await admin.from("clients").select("id,auth_user_id,login_email").eq("id", clientId).single();
    if (clientError || !client) return json({ error: "Employer record not found" }, 404);

    const internalEmail = client.login_email || `${usernameClean}.${clientId.slice(0,8)}@login.jeffdesign101.invalid`;
    let authUserId = client.auth_user_id;

    if (authUserId) {
      const { error } = await admin.auth.admin.updateUserById(authUserId, {
        email: internalEmail, password, email_confirm: true,
        user_metadata: { client_username: usernameClean, client_id: clientId }
      });
      if (error) throw error;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: internalEmail, password, email_confirm: true,
        user_metadata: { client_username: usernameClean, client_id: clientId }
      });
      if (error) throw error;
      authUserId = data.user.id;
    }

    const { error: updateError } = await admin.from("clients").update({
      client_username: usernameClean, auth_user_id: authUserId, login_email: internalEmail
    }).eq("id", clientId);
    if (updateError) throw updateError;

    await admin.from("profiles").upsert({
      id: authUserId, email: internalEmail, role: "client"
    }, { onConflict: "id" });

    return json({ ok: true, username: usernameClean });
  } catch (e) {
    console.error(e);
    return json({ error: e?.message || String(e) }, 400);
  }
});