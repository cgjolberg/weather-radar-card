// Bumps a Lovelace resource's ?v=devN cache-buster via Home Assistant's
// WebSocket API (the same call the Settings > Dashboards > Resources UI makes).
// Dependency-free: uses Node's built-in global WebSocket (Node >= 21).
//
// Usage:  node bump-ha-resource.mjs <resourceId> [resType]
// Env:    HA_TOKEN (required), HA_HOST (default homeassistant.local), HA_PORT (default 8123)

const host = process.env.HA_HOST || 'homeassistant.local';
const port = process.env.HA_PORT || '8123';
const token = process.env.HA_TOKEN;
const resourceId = process.argv[2];
const resType = process.argv[3] || 'module';

if (!token) {
  console.error('No HA token. Set the HA_TOKEN environment variable to a Home Assistant long-lived access token.');
  process.exit(2);
}
if (!resourceId) {
  console.error('Usage: node bump-ha-resource.mjs <resourceId> [resType]');
  process.exit(2);
}

// Connect by hostname over TLS: HA serves HTTPS on this port with a self-signed
// cert whose CN/SAN is the hostname (not the IP), so we must use the name. Node
// trusts the cert via the NODE_EXTRA_CA_CERTS env var pointing at fullchain.pem.
const wsUrl = `wss://${host}:${port}/api/websocket`;
const ws = new WebSocket(wsUrl);
const send = (obj) => ws.send(JSON.stringify(obj));

let oldUrl, newUrl;

const timer = setTimeout(() => {
  console.error('Timed out talking to Home Assistant.');
  process.exit(1);
}, 15000);

ws.addEventListener('error', (ev) => {
  const err = ev?.error;
  const detail = err?.message || ev?.message || 'connection failed';
  const code = err?.code || err?.cause?.code;
  console.error(`WebSocket error connecting to ${wsUrl}: ${detail}${code ? ` (${code})` : ''}`);
  if (err?.cause && err.cause.message && err.cause.message !== detail) {
    console.error('  cause:', err.cause.message);
  }
  process.exit(1);
});

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);

  if (msg.type === 'auth_required') {
    send({ type: 'auth', access_token: token });
  } else if (msg.type === 'auth_invalid') {
    console.error('HA auth failed:', msg.message);
    process.exit(1);
  } else if (msg.type === 'auth_ok') {
    send({ id: 1, type: 'lovelace/resources' });
  } else if (msg.type === 'result' && msg.id === 1) {
    if (!msg.success) { console.error('Listing resources failed:', msg.error?.message); process.exit(1); }
    const res = msg.result.find((r) => r.id === resourceId);
    if (!res) { console.error('Resource id not found:', resourceId); process.exit(1); }
    oldUrl = res.url;
    const base = res.url.split('?')[0];
    const m = res.url.match(/v=dev(\d+)/);
    const next = (m ? parseInt(m[1], 10) : 0) + 1;
    newUrl = `${base}?v=dev${next}`;
    send({ id: 2, type: 'lovelace/resources/update', resource_id: resourceId, url: newUrl, res_type: resType });
  } else if (msg.type === 'result' && msg.id === 2) {
    if (!msg.success) { console.error('Resource update failed:', msg.error?.message); process.exit(1); }
    clearTimeout(timer);
    console.log(`Bumped Lovelace resource: ${oldUrl}  ->  ${newUrl}`);
    ws.close();
    process.exit(0);
  }
});
