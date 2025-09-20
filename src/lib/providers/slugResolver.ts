type ResolveOptions = {
    timeoutMs?: number;
    allowEpisodeSlugExtract?: boolean;
};

const memoryCache = new Map<string, { value: string; ts: number }>();
const CACHE_TTL_MS = 1000 * 60 * 30;

function normalizeTitle(s: string) {
    return s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(s: string) {
    return s
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function scoreCandidate(candidateSlug: string, query: string) {
    const tksQ = normalizeTitle(query).toLowerCase().split(/\s+/).filter(Boolean);
    const tksC = candidateSlug.toLowerCase().split(/-+/).filter(Boolean);
    if (!tksQ.length || !tksC.length) return 0;

    let hit = 0;
    for (const tk of tksQ) if (tksC.includes(tk)) hit++;
    const base = hit / tksQ.length;
    const penalty = tksC.length < Math.max(2, Math.floor(tksQ.length / 2)) ? 0.15 : 0;
    return Math.max(0, base - penalty);
}

async function fetchText(url: string, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } finally {
        clearTimeout(id);
    }
}

function extractCandidateSlugs(html: string, base: URL, allowEpisodeSlugExtract: boolean) {
    const hrefs = Array.from(html.matchAll(/href\s*=\s*"(.*?)"/gi)).map(m => m[1]).filter(Boolean);
    const candidates = new Set<string>();

    for (const href of hrefs) {
        let u: URL | null = null;
        try { u = new URL(href, base); } catch { continue; }
        if (u.hostname !== base.hostname) continue;

        const p = u.pathname.replace(/\/+/g, '/');

        const m1 = p.match(/^\/(anime|animes|serie|series)\/([^\/]+)\/?$/i);
        if (m1 && m1[2]) { candidates.add(m1[2]); continue; }

        if (allowEpisodeSlugExtract) {
            const m2 = p.match(/^\/episodio\/(.+?)-episodio-\d+\/?$/i);
            if (m2 && m2[1]) { candidates.add(m2[1]); continue; }
        }
    }

    return Array.from(candidates);
}

async function trySearchEndpoints(origin: string, query: string, timeoutMs: number) {
    const base = new URL(origin);
    const paths = [
        `/?s=${encodeURIComponent(query)}`,
        `/search/${encodeURIComponent(query)}`,
        `/buscar/${encodeURIComponent(query)}`,
        `/pesquisar/${encodeURIComponent(query)}`,
    ];

    const attempts = paths.map(p =>
        fetchText(new URL(p, base).toString(), timeoutMs).then(
            txt => ({ ok: true as const, txt, url: new URL(p, base).toString() }),
            err => ({ ok: false as const, err, url: new URL(p, base).toString() }),
        )
    );
    const results = await Promise.all(attempts);
    return results.filter(r => r.ok) as Array<{ ok: true; txt: string; url: string }>;
}

export async function resolveProviderSlug(
    baseOrigin: string,
    titleOrSlug: string,
    options: ResolveOptions = {}
): Promise<string> {
    const { timeoutMs = 12000, allowEpisodeSlugExtract = true } = options;
    const key = `${baseOrigin}|${titleOrSlug.toLowerCase()}`;
    const now = Date.now();

    const cached = memoryCache.get(key);
    if (cached && now - cached.ts < CACHE_TTL_MS) return cached.value;

    const query = normalizeTitle(titleOrSlug);
    const base = new URL(baseOrigin);

    try {
        const results = await trySearchEndpoints(base.origin, query, timeoutMs);

        let best: { slug: string; score: number } | null = null;
        for (const r of results) {
            const slugs = extractCandidateSlugs(r.txt, base, allowEpisodeSlugExtract);
            for (const s of slugs) {
                const sc = scoreCandidate(s, query);
                if (!best || sc > best.score) best = { slug: s, score: sc };
            }
        }

        if (best && best.score >= 0.35) {
            memoryCache.set(key, { value: best.slug, ts: now });
            return best.slug;
        }

        const fallback = slugify(query);
        memoryCache.set(key, { value: fallback, ts: now });
        return fallback;
    } catch {
        const fallback = slugify(query);
        memoryCache.set(key, { value: fallback, ts: now });
        return fallback;
    }
}