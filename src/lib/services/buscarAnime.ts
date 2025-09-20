export type AnimeSummary = {
    id: number;
    title: string;
    synopsis: string | null;
    image: string | null;
    score: number | null;
    genres: string[];
    episodes: number | null;
    status: string | null;
    aired_from: string | null;
    aired_to: string | null;
    url: string;
};

export async function buscarAnimes(nome: string): Promise<AnimeSummary[]> {
    if (!nome || typeof nome !== 'string' || !nome.trim()) {
        throw new Error('O nome do anime é obrigatório.');
    }

    const endpoint = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(nome)}`;

    const response = await fetch(endpoint, {
        // Opcional: cache/balanceamento
        // next: { revalidate: 60 },
    });

    if (!response.ok) {
        throw new Error(`Erro na requisição à Jikan API: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as { data: any[] };
    const data = payload?.data;

    if (!Array.isArray(data)) {
        throw new Error('Resposta inesperada da Jikan API.');
    }

    return data.map((anime: any): AnimeSummary => ({
        id: anime.mal_id,
        title: anime.title_english || anime.title,
        synopsis: anime.synopsis ?? null,
        image: anime.images?.jpg?.image_url ?? null,
        score: anime.score ?? null,
        genres: Array.isArray(anime.genres) ? anime.genres.map((g: any) => g?.name).filter(Boolean) : [],
        episodes: anime.episodes ?? null,
        status: anime.status ?? null,
        aired_from: anime.aired?.from ? String(anime.aired.from).slice(0, 10) : null,
        aired_to: anime.aired?.to ? String(anime.aired.to).slice(0, 10) : null,
        url: anime.url,
    }));
}