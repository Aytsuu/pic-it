const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
  }

  const clientId =
    Deno.env.get('GOOGLE_CLIENT_ID') ?? Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID');
  const clientSecret =
    Deno.env.get('GOOGLE_CLIENT_SECRET') ?? Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET');

  if (!clientId || !clientSecret) {
    return Response.json(
      { error: 'Google OAuth secrets are not configured on the server' },
      { status: 500, headers: CORS }
    );
  }

  const { code, codeVerifier, redirectUri } = await req.json();
  if (!code || !redirectUri) {
    return Response.json({ error: 'code and redirectUri are required' }, { status: 400, headers: CORS });
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  if (codeVerifier) body.set('code_verifier', codeVerifier);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokens = await tokenRes.json();

  if (!tokenRes.ok || !tokens.id_token) {
    return Response.json(
      { error: tokens.error_description ?? tokens.error ?? 'Google token exchange failed' },
      { status: 400, headers: CORS }
    );
  }

  return Response.json({ id_token: tokens.id_token }, { headers: CORS });
});
