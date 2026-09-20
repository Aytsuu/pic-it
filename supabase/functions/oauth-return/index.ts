const CORS_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
};

function decodeAppUri(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return 'exp+pic-it://google-auth';
  }
}

function appendCode(appUri: string, code: string): string {
  if (!code) return appUri;
  const join = appUri.includes('?') ? '&' : '?';
  return `${appUri}${join}code=${encodeURIComponent(code)}`;
}

function htmlPage(target: string, errorMessage: string | null): string {
  const intentPath = target.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const intentUrl = `intent://${intentPath}#Intent;scheme=exp;package=host.exp.exponent;end`;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Returning to Pic It</title>
    <style>
      body { font-family: system-ui, sans-serif; display: flex; min-height: 100vh;
        align-items: center; justify-content: center; margin: 0; background: #f4f4f5; }
      .card { background: #fff; padding: 24px; border-radius: 12px; max-width: 360px;
        text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
      a.btn { display: inline-block; margin-top: 16px; background: #208AEF; color: #fff;
        text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; }
      p { color: #444; line-height: 1.4; }
    </style>
  </head>
  <body>
    <div class="card">
      ${
        errorMessage
          ? `<p>${errorMessage}</p>`
          : `<p>Sign-in complete. Return to Pic It to continue.</p>
             <a class="btn" href="${target}">Open Pic It</a>
             <p style="font-size:12px;color:#888;margin-top:16px;">If nothing happens, tap the button above.</p>`
      }
    </div>
    ${
      errorMessage
        ? ''
        : `<script>
            var target = ${JSON.stringify(target)};
            var intentUrl = ${JSON.stringify(intentUrl)};
            setTimeout(function () { window.location.replace(intentUrl); }, 50);
            setTimeout(function () { window.location.replace(target); }, 400);
          </script>`
    }
  </body>
</html>`;
}

Deno.serve((req) => {
  const url = new URL(req.url);
  const appParam = url.searchParams.get('app');
  const encodedPath = url.pathname.split('/').filter(Boolean).pop() ?? '';
  const appUri =
    appParam ||
    (encodedPath && encodedPath !== 'oauth-return' ? decodeAppUri(encodedPath) : 'exp+pic-it://google-auth');
  const code = url.searchParams.get('code') ?? '';
  const error = url.searchParams.get('error_description') ?? url.searchParams.get('error');

  if (error) {
    return new Response(htmlPage(appUri, error), { headers: CORS_HEADERS });
  }

  return new Response(htmlPage(appendCode(appUri, code), null), { headers: CORS_HEADERS });
});
