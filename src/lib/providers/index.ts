import { resolveProviderSlug } from './slugResolver';

export type ProviderResult = {
    error: boolean;
    provider: string;
    searched_endpoint: string;
    episode: string | null;
    message?: string;

    isEmbed?: boolean;
    isHls?: boolean;
    headers?: Record<string, string> | null;
    requiresProxy?: boolean;
};

export interface Provider {
    baseUrl: string;
    name: string;
    slug: string;
    hasAds: boolean;
    isEmbed: boolean;
    getSearchEpisodeEndpoint(animeSlug: string, episode: number | string, season?: number): string;
    searchEpisode(
        animeSlug: string,
        episode: number | string,
        season?: number,
        titleHint?: string
    ): Promise<ProviderResult>;
}

function normalizeTitle(s: string) {
    return s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(id);
    }
}

async function fetchText(url: string, timeoutMs = 15000): Promise<string> {
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

/* =============== AnimeFire API (MP4 direto a partir do JSON/Token) =============== */

type AnimeFireJson = {
    data?: Array<{ src?: string; label?: string }>;
    metadata?: any;
    response?: { status?: string; text?: string };
    token?: string;
};

class AnimeFireApiProvider implements Provider {
    baseUrl = 'https://animefire.plus/video/';
    name = 'AnimeFire (API)';
    slug = 'anime-fire-api';
    hasAds = false;
    isEmbed = false;

    getSearchEpisodeEndpoint(animeSlug: string, episode: number | string, season = 1) {
        return `${this.baseUrl}${animeSlug}/${episode}`;
    }

    private pickBest(data: Array<{ src?: string; label?: string }>) {
        if (!data?.length) return null;
        const order = { '1080p': 1080, '720p': 720, '480p': 480, '360p': 360, '240p': 240 };
        const sorted = data
            .filter(i => i.src)
            .sort((a, b) => (order[b.label || ''] || 0) - (order[a.label || ''] || 0));
        return sorted[0]?.src || null;
    }

    private extractGoogleVideoFromHtml(html: string): string | null {
        // Captura links para googlevideo.com (videoplayback). Suporta // e http/https
        const re = /(?:https?:)?\/\/[a-z0-9\-_.]*googlevideo\.com\/[^"'<> \t\r\n]+/i;
        const m = html.match(re);
        if (!m) return null;
        const url = m[0].startsWith('//') ? `https:${m[0]}` : m[0];
        return url;
    }

    async searchEpisode(animeSlug: string, episode: number | string): Promise<ProviderResult> {
        const url = this.getSearchEpisodeEndpoint(animeSlug, episode);
        try {
            const json = await fetchJson<AnimeFireJson>(url, { cache: 'no-store' }, 12000);

            const tokenUrl = json?.token;
            const srcFromData = this.pickBest(json?.data || []);

            if (tokenUrl) {
                const isHls = /\.m3u8($|\?)/i.test(tokenUrl);
                return {
                    error: false,
                    provider: this.name,
                    searched_endpoint: url,
                    episode: tokenUrl, // usa o token como link do vídeo
                    isEmbed: false,
                    isHls,
                    headers: null,
                    requiresProxy: false,
                };
            }

            if (srcFromData) {
                const isHls = /\.m3u8($|\?)/i.test(srcFromData);
                return {
                    error: false,
                    provider: this.name,
                    searched_endpoint: url,
                    episode: srcFromData,
                    isEmbed: false,
                    isHls,
                    headers: null,
                    requiresProxy: false,
                };
            }

            // 2) Fallback com token do Blogger quando data veio vazio
            if (tokenUrl) {
                // Busca o HTML do token e extrai o primeiro link googlevideo (MP4)
                const html = await fetchText(tokenUrl, 12000);
                const gv = this.extractGoogleVideoFromHtml(html);
                if (gv) {
                    return {
                        error: false,
                        provider: this.name,
                        searched_endpoint: url,
                        episode: gv,
                        isEmbed: false,
                        isHls: /\.m3u8($|\?)/i.test(gv),
                        headers: null,
                        requiresProxy: false, // googlevideo costuma tocar direto
                    };
                }
            }

            throw new Error(json?.response?.text || 'Sem links de vídeo na resposta da AnimeFire');
        } catch (e: any) {
            return {
                error: true,
                provider: this.name,
                searched_endpoint: url,
                episode: null,
                message: e?.message || 'Falha ao obter JSON/Token da AnimeFire',
                isEmbed: false,
                isHls: false,
                headers: null,
                requiresProxy: false,
            };
        }
    }
}

/* ========================= Consumet - Gogoanime (HLS/MP4) ========================= */

type ConsumetWatchResponse = {
    headers?: Record<string, string>;
    sources?: Array<{ url: string; quality?: string | number; isM3U8?: boolean }>;
};

type ConsumetInfoEpisode = { id: string; number?: number; title?: string };
type ConsumetInfoResponse = { id: string; title?: string; episodes?: ConsumetInfoEpisode[] };
type ConsumetSearchResultItem = { id: string; title?: string };
type ConsumetSearchResponse = { results?: ConsumetSearchResultItem[] };

class ConsumetGogoProvider implements Provider {
    baseUrl = 'https://api.consumet.org/anime/gogoanime';
    name = 'Consumet - Gogoanime';
    slug = 'consumet-gogoanime';
    hasAds = false;
    isEmbed = false;

    getSearchEpisodeEndpoint(animeSlug: string, episode: number | string, season = 1) {
        return `${this.baseUrl} (search/info/watch flow) slug=${animeSlug} ep=${episode} s=${season}`;
    }

    private bestSource(sources: Array<{ url: string; quality?: string | number; isM3U8?: boolean }>) {
        const byQ = (q?: string | number) =>
            typeof q === 'number' ? q : typeof q === 'string' ? parseInt(q, 10) || 0 : 0;
        return sources.slice().sort((a, b) => byQ(b.quality) - byQ(a.quality)).find(s => s.isM3U8) || sources[0];
    }

    async searchEpisode(
        animeSlug: string,
        episode: number | string,
        season = 1,
        titleHint?: string
    ): Promise<ProviderResult> {
        const searched_endpoint = this.getSearchEpisodeEndpoint(animeSlug, episode, season);
        const epNum = typeof episode === 'string' ? parseInt(episode, 10) : episode;

        try {
            const queries = Array.from(
                new Set([
                    normalizeTitle(titleHint || animeSlug),
                    normalizeTitle(titleHint || animeSlug).replace(/\bmovie\b/gi, '').trim(),
                    normalizeTitle(titleHint || animeSlug).replace(/\bseason\s*\d+\b/gi, '').trim(),
                ])
            ).filter(Boolean);

            let animeId: string | null = null;
            for (const q of queries) {
                const searchUrl = `${this.baseUrl}/${encodeURIComponent(q)}?page=1`;
                const search = await fetchJson<ConsumetSearchResponse>(searchUrl);
                const cand = search?.results?.[0]?.id;
                if (cand) { animeId = cand; break; }
            }
            if (!animeId) throw new Error('Sem resultados na busca');

            const infoUrl = `${this.baseUrl}/info/${encodeURIComponent(animeId)}`;
            const info = await fetchJson<ConsumetInfoResponse>(infoUrl);
            if (!info?.episodes?.length) throw new Error('Sem lista de episódios');

            let target = info.episodes.find(e => (typeof epNum === 'number' ? e.number === epNum : false));
            if (!target && typeof epNum === 'number' && epNum >= 1) target = info.episodes[epNum - 1];
            if (!target?.id) throw new Error('Episódio não encontrado');

            const watchUrl = `${this.baseUrl}/watch/${encodeURIComponent(target.id)}?server=gogocdn`;
            const watch = await fetchJson<ConsumetWatchResponse>(watchUrl);
            const sources = watch?.sources ?? [];
            if (!sources.length) throw new Error('Sem fontes na resposta');

            const best = this.bestSource(sources);
            const isHls = !!best?.url && /\.m3u8($|\?)/i.test(best.url);

            return {
                error: false,
                provider: this.name,
                searched_endpoint,
                episode: best?.url ?? null,
                isEmbed: false,
                isHls,
                headers: watch?.headers ?? null,
                requiresProxy: !!watch?.headers && Object.keys(watch.headers).length > 0,
            };
        } catch (e: any) {
            return {
                error: true,
                provider: this.name,
                searched_endpoint,
                episode: null,
                message: e?.message || 'Falha no Consumet Gogoanime',
                isEmbed: false,
                isHls: false,
                headers: null,
                requiresProxy: false,
            };
        }
    }
}

/* ============================ Providers de página ============================ */

class AnimesOnlineCCPageProvider implements Provider {
    baseUrl = 'https://animesonlinecc.to';
    name = 'Animes Online CC (Página)';
    slug = 'animes-online-cc-page';
    hasAds = true;
    isEmbed = true;

    getSearchEpisodeEndpoint(animeSlug: string, episode: number | string) {
        return `${this.baseUrl}/episodio/{provider-slug}-episodio-${episode}/`;
    }

    async searchEpisode(animeSlug: string, episode: number | string, season = 1, titleHint?: string): Promise<ProviderResult> {
        const q = normalizeTitle(titleHint || animeSlug);
        const providerSlug = await resolveProviderSlug(this.baseUrl, q, { allowEpisodeSlugExtract: true });
        const url = `${this.baseUrl}/episodio/${providerSlug}-episodio-${episode}/`;
        return {
            error: false,
            provider: this.name,
            searched_endpoint: `${this.baseUrl}/?s=${encodeURIComponent(q)}`,
            episode: url,
            isEmbed: true,
            isHls: false,
            headers: null,
            requiresProxy: false,
        };
    }
}

class AnimeFirePageProvider implements Provider {
    baseUrl = 'https://animefire.plus';
    name = 'Anime Fire (Página)';
    slug = 'anime-fire-page';
    hasAds = true;
    isEmbed = true;

    getSearchEpisodeEndpoint(animeSlug: string, episode: number | string) {
        return `${this.baseUrl}/video/{provider-slug}/${episode}`;
    }

    async searchEpisode(animeSlug: string, episode: number | string, season = 1, titleHint?: string): Promise<ProviderResult> {
        const q = normalizeTitle(titleHint || animeSlug);
        const providerSlug = await resolveProviderSlug(this.baseUrl, q, { allowEpisodeSlugExtract: true });
        const url = `${this.baseUrl}/video/${providerSlug}/${episode}`;
        return {
            error: false,
            provider: this.name,
            searched_endpoint: `${this.baseUrl}/?s=${encodeURIComponent(q)}`,
            episode: url,
            isEmbed: true,
            isHls: false,
            headers: null,
            requiresProxy: false,
        };
    }
}

class SuperflixPageProvider implements Provider {
    baseUrl = 'https://superflix.tv';
    name = 'Superflix (Página)';
    slug = 'superflix-page';
    hasAds = true;
    isEmbed = true;

    getSearchEpisodeEndpoint() {
        return `${this.baseUrl} (slug via busca, link da série)`;
    }

    async searchEpisode(animeSlug: string, episode: number | string, season = 1, titleHint?: string): Promise<ProviderResult> {
        const q = normalizeTitle(titleHint || animeSlug);
        const providerSlug = await resolveProviderSlug(this.baseUrl, q, { allowEpisodeSlugExtract: true });
        const seriesUrl = `${this.baseUrl}/serie/${providerSlug}/`;
        return {
            error: false,
            provider: this.name,
            searched_endpoint: `${this.baseUrl}/?s=${encodeURIComponent(q)}`,
            episode: seriesUrl,
            isEmbed: true,
            isHls: false,
            headers: null,
            requiresProxy: false,
        };
    }
}

/* =========================== Ordem de fallback =========================== */

export const providers: Provider[] = [
    new AnimeFireApiProvider(),       // 1) JSON/Token da AnimeFire (MP4)
    new ConsumetGogoProvider(),       // 2) HLS/MP4 (Consumet Gogo)
    new AnimesOnlineCCPageProvider(), // 3) Página do episódio (slug correto)
    new AnimeFirePageProvider(),      // 4) Página do episódio
    new SuperflixPageProvider(),      // 5) Página da série (último recurso)
];

export const totalProviders = providers.length;

export async function searchAcrossProviders(
    animeSlug: string,
    episode: number | string,
    season = 1,
    startIndex = 0,
    titleHint?: string
): Promise<{ result: ProviderResult; index: number } | { result: ProviderResult & { message: string }; index: -1 }> {
    for (let i = startIndex; i < providers.length; i++) {
        const provider = providers[i];
        const result = await provider.searchEpisode(animeSlug, episode, season, titleHint);
        if (!result.error && result.episode) {
            return { result, index: i };
        }
    }
    return {
        result: {
            error: true,
            provider: 'all',
            searched_endpoint: '',
            episode: null,
            message: 'Nenhum provider encontrou o episódio.',
        },
        index: -1,
    };
}

export const providerDocs: Record<string, string> = {
    'AnimeFire (API)': 'https://animefire.plus/video/{slug}/{episode} (retorna JSON; usar token quando data vazio)',
    'Consumet - Gogoanime (API)': 'https://api.consumet.org/anime/gogoanime',
    'Animes Online CC': 'Busca: /?s= ; episódio: /episodio/{slug}-episodio-{n}/',
    'Anime Fire (Página)': 'Busca: /?s= ; episódio: /video/{slug}/{n}',
    'Superflix (Página)': 'Busca: /?s= ; série: /serie/{slug}/',
};