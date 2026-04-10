// OAuth proxy for Netlify CMS - GitHub authentication
// Deployed as Vercel Serverless Function

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code, state } = req.query;

  // OAuth Step 1: Redirect to GitHub for authorization
  if (!code) {
    const clientId = process.env.GITHUB_CLIENT_ID || 'Ov23lijTIYBaFOyrHjYu';
    const redirectUri = encodeURIComponent('https://starstrek-web.vercel.app/api/auth');
    const scope = encodeURIComponent('repo read:user user:email');
    
    const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&scope=${scope}` +
      `&state=${state || 'random-state'}`;
    
    return res.redirect(githubAuthUrl);
  }

  // OAuth Step 2: Exchange code for access token
  try {
    const clientId = process.env.GITHUB_CLIENT_ID || 'Ov23lijTIYBaFOyrHjYu';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientSecret) {
      return res.status(500).json({ 
        error: 'GitHub OAuth not configured. Please set GITHUB_CLIENT_SECRET environment variable.' 
      });
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        state: state,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description || tokenData.error });
    }

    // Netlify CMS popup expects the token to be passed via postMessage
    // The opener window listens for 'message' events
    const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
  <title>Authenticating...</title>
  <script>
    (function() {
      var token = '${tokenData.access_token}';
      var sent = false;
      
      function sendToken() {
        if (sent) return;
        
        if (window.opener) {
          // Netlify CMS expects this exact format
          var message = 'authorization:github:success:' + JSON.stringify({
            token: token,
            provider: 'github'
          });
          
          window.opener.postMessage(message, '*');
          sent = true;
          
          // Close after sending
          setTimeout(function() {
            window.close();
          }, 500);
        }
      }
      
      // Try multiple times
      sendToken();
      setTimeout(sendToken, 100);
      setTimeout(sendToken, 500);
      setTimeout(sendToken, 1000);
      
      // Also respond to ping from parent
      window.addEventListener('message', function(e) {
        if (e.data && e.data.indexOf && e.data.indexOf('authorizing') !== -1) {
          sendToken();
        }
      });
    })();
  </script>
</head>
<body>
  <h2>✅ Autenticación exitosa</h2>
  <p>Cerrando ventana...</p>
  <noscript>
    <p>Error: JavaScript es necesario para la autenticación.</p>
  </noscript>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(htmlResponse);

  } catch (error) {
    console.error('OAuth error:', error);
    return res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
}
