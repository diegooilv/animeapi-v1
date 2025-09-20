import styles from './page.module.css';
import {headers} from 'next/headers';
import PlayerWithFallback from '@/components/PlayerWithFallback';

type PageProps = {
    params: Promise<{ slug: string; episode: string }>;
    searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

type ProviderData = {
    error: boolean;
    provider: string;
    searched_endpoint: string;
    episode: string | null;
    message?: string;
    index: number;
    total: number;
    nextIndex: number | null;
};

export default async function EpisodePage({params, searchParams}: PageProps) {
    const {slug, episode} = await params;
    const sp = await searchParams;

    const seasonStr = typeof sp.season === 'string' ? sp.season : '1';
    const season = Number.isFinite(Number(seasonStr)) ? parseInt(seasonStr, 10) : 1;
    const title = typeof sp.title === 'string' ? sp.title : slug.replace(/-/g, ' ');

    const origin = await getOrigin();
    const url = `${origin}/api/animes/${encodeURIComponent(slug)}/episodes/${encodeURIComponent(episode)}?season=${season}&title=${encodeURIComponent(title)}`;

    let initialData: ProviderData | null = null;
    try {
        const res = await fetch(url, {cache: 'no-store'});
        const json = await res.json();
        if (res.ok) {
            initialData = json as ProviderData;
        }
    } catch {
    }

    const epNum = Number(episode);
    const hasPrev = Number.isFinite(epNum) && epNum > 1;
    const prevHref = hasPrev
        ? `/anime/${slug}/episodes/${epNum - 1}?season=${season}&title=${encodeURIComponent(title)}`
        : undefined;
    const nextHref = Number.isFinite(epNum)
        ? `/anime/${slug}/episodes/${epNum + 1}?season=${season}&title=${encodeURIComponent(title)}`
        : undefined;

    return (
        <main className={styles.wrap}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>{title}</h1>
                    <p className={styles.subtitle}>Temporada {season} • Episódio {episode}</p>
                </div>
                <nav className={styles.nav}>
                    <a className={styles.btnGhost} href={`/anime/${slug}?title=${encodeURIComponent(title)}`}>
                        ← Voltar para episódios
                    </a>
                </nav>
            </header>

            <PlayerWithFallback
                slug={slug}
                episode={episode}
                season={season}
                title={title}
                initialData={initialData}
            />

            <div className={styles.episodeNav}>
                {hasPrev && prevHref && (
                    <a className={styles.btnGhost} href={prevHref}>
                        ← Anterior
                    </a>
                )}
                {nextHref && (
                    <a className={styles.btnGhost} href={nextHref}>
                        Próximo →
                    </a>
                )}
            </div>
        </main>
    );
}

async function getOrigin() {
    const h = await headers();
    const host = h.get('host') || 'localhost:3000';
    const protocol = process.env.VERCEL ? 'https' : 'http';
    return `${protocol}://${host}`;
}