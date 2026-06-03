const ENV_ALLOWLIST = 'IP_ALLOWLIST';

function parseAllowlist(raw) {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function getClientIp(request) {
  const netlifyIp = request.headers.get('x-nf-client-connection-ip');
  if (netlifyIp) return netlifyIp.trim();

  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();

  return '';
}

function isValidIpv4(ip) {
  const octets = ip.split('.');
  if (octets.length !== 4) return false;
  return octets.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

function ipv4ToInt(ip) {
  const octets = ip.split('.').map(Number);
  return ((octets[0] << 24) >>> 0) + ((octets[1] << 16) >>> 0) + ((octets[2] << 8) >>> 0) + octets[3];
}

function ipv4InCidr(ip, cidr) {
  const [range, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  if (!isValidIpv4(ip) || !isValidIpv4(range) || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }

  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range) & mask);
}

function isAllowedIp(ip, allowlist) {
  if (!ip) return false;

  for (const entry of allowlist) {
    if (entry.includes('/')) {
      if (ipv4InCidr(ip, entry)) return true;
      continue;
    }

    if (ip === entry) return true;
  }

  return false;
}

export default async (request, context) => {
  const rawAllowlist = Deno.env.get(ENV_ALLOWLIST) || '';
  const allowlist = parseAllowlist(rawAllowlist);

  // Avoid accidental lockout if env var is not configured yet.
  if (allowlist.length === 0) {
    return context.next();
  }

  const ip = getClientIp(request);
  if (isAllowedIp(ip, allowlist)) {
    return context.next();
  }

  return new Response('Forbidden', { status: 403 });
};
