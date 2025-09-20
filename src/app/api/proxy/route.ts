import { NextRequest } from 'next/server';

function isAllowedHost(hostname: string) {
    const env = process.env.ALLOWED_PROXY_HOSTS || '';
    const items = env.split(',').map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return false;
    return items.some(rule => {
        if (rule.startsWith('*.')) {
            const dom = rule.slice(2);
            return hostname === dom || hostname.endsWith(`.${dom}`);
        }
        return hostname === rule;
    });
}

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const urlObj = new URL(req.url);
    const target = urlObj.searchParams.get('url');
    const referer = urlObj.searchParams.get('referer') || undefined;

    if (!target) return new Response('Missing url', { status: 400 });

    const targetUrl = new URL(target);
    if (!isAllowedHost(targetUrl.hostname)) {
        return new Response('Host não permitido pelo proxy', { status: 403 });
    }

    const headers: HeadersInit = {};
    if (referer) headers['Referer'] = referer;
    headers['User-Agent'] = req.headers.get('user-agent') || 'Mozilla/5.0';

    const upstream = await fetch(target, { headers });

    const respHeaders = new Headers(upstream.headers);
    respHeaders.set('access-control-allow-origin', '*');
    respHeaders.set('cache-control', 'public, max-age=60');

    return new Response(upstream.body, {
        status: upstream.status,
        headers: respHeaders,
    });
}