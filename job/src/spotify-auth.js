// One-time helper, run on your own computer: gets the Spotify refresh token the job uses.
//   SPOTIFY_CLIENT_ID=… SPOTIFY_CLIENT_SECRET=… npm run spotify-auth
// Add http://127.0.0.1:8888/callback as a Redirect URI in the Spotify app settings first.
// The token is printed only in your terminal; paste it into the SPOTIFY_REFRESH_TOKEN secret.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.log('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.');
  process.exit(1);
}
const redirect = 'http://127.0.0.1:8888/callback';
const state = randomBytes(12).toString('hex');
const scope = 'user-read-recently-played user-read-currently-playing user-top-read';
const url = `https://accounts.spotify.com/authorize?${new URLSearchParams({ response_type: 'code', client_id: id, scope, redirect_uri: redirect, state })}`;

const server = createServer(async (req, res) => {
  const q = new URL(req.url, redirect).searchParams;
  if (!req.url.startsWith('/callback')) return res.end();
  if (q.get('state') !== state || !q.get('code')) {
    res.end('Something went wrong, try again.');
    return server.close();
  }
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirect }),
  });
  const body = await r.json();
  res.end(body.refresh_token ? 'Done. Go back to the terminal.' : 'Spotify refused the code. Check the terminal.');
  console.log(body.refresh_token ? `\nSPOTIFY_REFRESH_TOKEN=${body.refresh_token}\n` : `Spotify answered ${r.status}: ${body.error_description || body.error}`);
  server.close();
});
server.listen(8888, '127.0.0.1', () => console.log(`Open this link and allow access:\n${url}\n`));
