/**
 * Verifies Xtream Codes credentials taken from environment variables against
 * a real portal and reports account status plus basic catalog counts.
 *
 * Reads IPTV_URL, IPTV_USER, and IPTV_PASSWORD, performs the same
 * `player_api.php` handshake the app performs (VLC-style User-Agent, JSON
 * accept, 30s timeout), and resolves the portal status with the same rules
 * as `resolveXtreamPortalStatus` in `libs/shared/interfaces`.
 *
 * Output is redaction-safe by design: the username, password, and full
 * server host never reach stdout. Pass --show-host to print the host when
 * running locally.
 *
 * Usage:
 *   IPTV_URL=... IPTV_USER=... IPTV_PASSWORD=... node tools/iptv/verify-credentials.mjs
 *
 * Exit codes: 0 = credentials verified (active), 1 = verification failed,
 * 2 = required environment variables missing.
 */

const XTREAM_CLIENT_USER_AGENT = 'VLC/3.0.18 LibVLC/3.0.18';
const REQUEST_TIMEOUT_MS = 30_000;
const SHOW_HOST = process.argv.includes('--show-host');

// Mirrors normalizeXtreamServerUrl() in libs/shared/interfaces — a plain
// .mjs script cannot import the TS source without a build step.
function normalizeServerUrl(value) {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Only http and https Xtream URLs are supported');
    }
    const basePath = url.pathname
        .replace(/\/+$/, '')
        .replace(/\/(?:get|player_api)\.php$/i, '');
    return `${url.origin}${basePath}`;
}

// Mirrors resolveXtreamPortalStatus() in libs/shared/interfaces.
function resolvePortalStatus(response, now = new Date()) {
    const userInfo = response?.user_info;
    if (!userInfo) return 'unavailable';

    const auth =
        userInfo.auth === true || userInfo.auth === 1 || userInfo.auth === '1'
            ? true
            : userInfo.auth === false ||
                userInfo.auth === 0 ||
                userInfo.auth === '0'
              ? false
              : null;
    if (auth === false) return 'inactive';

    const status = userInfo.status?.trim().toLowerCase() ?? '';
    if (status === 'expired') return 'expired';

    const isActive = status === 'active' || (auth === true && !status);
    if (!isActive) return status ? 'inactive' : 'unavailable';

    const exp = Number(userInfo.exp_date);
    if (Number.isFinite(exp) && exp > 0 && exp * 1000 < now.getTime()) {
        return 'expired';
    }
    return 'active';
}

function maskHost(url) {
    const { hostname, port } = new URL(url);
    if (SHOW_HOST) return port ? `${hostname}:${port}` : hostname;
    const masked =
        hostname.length <= 4
            ? '***'
            : `${hostname.slice(0, 2)}***${hostname.slice(-2)}`;
    return port ? `${masked}:${port}` : masked;
}

function formatEpochSeconds(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 'n/a';
    return new Date(parsed * 1000).toISOString();
}

async function apiRequest(baseUrl, credentials, action) {
    const url = new URL(`${baseUrl}/player_api.php`);
    url.searchParams.set('username', credentials.username);
    url.searchParams.set('password', credentials.password);
    if (action) url.searchParams.set('action', action);

    const response = await fetch(url, {
        headers: {
            'User-Agent': XTREAM_CLIENT_USER_AGENT,
            Accept: 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} (${action ?? 'handshake'})`);
    }
    return response.json();
}

async function categorySummary(baseUrl, credentials, action, label) {
    try {
        const categories = await apiRequest(baseUrl, credentials, action);
        if (!Array.isArray(categories)) {
            return `  ${label}: unexpected response shape`;
        }
        const samples = categories
            .slice(0, 3)
            .map((category) => category?.category_name)
            .filter(Boolean)
            .join(', ');
        return `  ${label}: ${categories.length} categories${samples ? ` (e.g. ${samples})` : ''}`;
    } catch (error) {
        return `  ${label}: request failed — ${error.message}`;
    }
}

const serverUrl = (process.env.IPTV_URL ?? '').trim();
const username = (process.env.IPTV_USER ?? '').trim();
const password = (process.env.IPTV_PASSWORD ?? '').trim();

if (!serverUrl || !username || !password) {
    console.error(
        'Missing required environment variables: set IPTV_URL, IPTV_USER, and IPTV_PASSWORD.'
    );
    process.exit(2);
}

let baseUrl;
try {
    baseUrl = normalizeServerUrl(serverUrl);
} catch (error) {
    console.error(`Invalid IPTV_URL: ${error.message}`);
    process.exit(2);
}

console.log(`Verifying Xtream credentials against ${maskHost(baseUrl)} ...`);

let handshake;
try {
    handshake = await apiRequest(baseUrl, { username, password });
} catch (error) {
    console.error(`Handshake failed: ${error.message}`);
    process.exit(1);
}

const portalStatus = resolvePortalStatus(handshake);
const userInfo = handshake?.user_info ?? {};
const serverInfo = handshake?.server_info ?? {};

console.log(`\nPortal status: ${portalStatus.toUpperCase()}`);
console.log('Account:');
console.log(`  status:          ${userInfo.status ?? 'n/a'}`);
console.log(`  expires:         ${formatEpochSeconds(userInfo.exp_date)}`);
console.log(`  trial:           ${userInfo.is_trial === '1' ? 'yes' : 'no'}`);
console.log(
    `  connections:     ${userInfo.active_cons ?? '?'} active / ${userInfo.max_connections ?? '?'} max`
);
console.log(
    `  output formats:  ${(userInfo.allowed_output_formats ?? []).join(', ') || 'n/a'}`
);
console.log('Server:');
console.log(`  timezone:        ${serverInfo.timezone ?? 'n/a'}`);
console.log(`  protocol:        ${serverInfo.server_protocol ?? 'n/a'}`);

if (portalStatus !== 'active') {
    console.error(`\nVerification failed: portal status is ${portalStatus}.`);
    process.exit(1);
}

console.log('\nCatalog:');
const credentials = { username, password };
for (const [action, label] of [
    ['get_live_categories', 'live'],
    ['get_vod_categories', 'vod'],
    ['get_series_categories', 'series'],
]) {
    console.log(await categorySummary(baseUrl, credentials, action, label));
}

console.log('\nCredentials verified successfully.');
