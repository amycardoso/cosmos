// Where the job keeps what must survive between runs: the Spotify history, the Bingers
// mirror and cursor, and the last good output of each source. In Actions this is a
// Cloudflare KV namespace; locally (no Cloudflare variables) it is the .state/ folder.
// None of it is ever written to the repository or to the Actions logs.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';

export function store(env) {
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN && env.COSMOS_KV_NAMESPACE) return kv(env);
  return folder(env.COSMOS_STATE_DIR || '.state');
}

function kv(env) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${env.COSMOS_KV_NAMESPACE}/values/`;
  const headers = { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` };
  return {
    async get(key) {
      const res = await fetch(base + encodeURIComponent(key), { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`KV get answered ${res.status}`);
      return JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8'));
    },
    async put(key, value) {
      const res = await fetch(base + encodeURIComponent(key), { method: 'PUT', headers, body: gzipSync(JSON.stringify(value)) });
      if (!res.ok) throw new Error(`KV put answered ${res.status}`);
    },
  };
}

function folder(dir) {
  return {
    async get(key) {
      try {
        return JSON.parse(await readFile(`${dir}/${key}.json`, 'utf8'));
      } catch {
        return null;
      }
    },
    async put(key, value) {
      await mkdir(dir, { recursive: true });
      await writeFile(`${dir}/${key}.json`, JSON.stringify(value));
    },
  };
}
