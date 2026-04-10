import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  if (!code) {
    // Redirigir a GitHub OAuth
    const clientId = 'Iv23li4A1b1J1J1J1J1J'; // Placeholder - necesita configurarse
    const redirectUri = encodeURIComponent('https://starstrek-web.vercel.app/api/auth');
    const scope = encodeURIComponent('repo');
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`
      }
    });
  }
  
  // Intercambiar código por token
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      })
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      // Redirigir al admin con el token
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `/admin/#access_token=${data.access_token}`
        }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Auth failed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
