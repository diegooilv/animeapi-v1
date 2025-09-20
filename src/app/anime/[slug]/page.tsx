import styles from './page.module.css';
import Link from 'next/link';
import {headers} from 'next/headers';

type PageProps = {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

async function fetchEpisodesCountByTitle(title: string): Promise<number | null> {
    try {
        const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`, {next: {revalidate: 3600}});
        if (!res.ok) return null;
        const json = await res.json();
        const item = json?.data?.[0];
        const eps = typeof item?.episodes === 'number' ? item.episodes : null;
        return eps;
    } catch {
        return null;
    }
}

export default async function SeriesPage({params, searchParams}: PageProps) {
    const {slug} = await params;
    const sp = await searchParams;

    const title = typeof sp.title === 'string' ? sp.title : slug.replace(/-/g, ' ');
    const epsFromQuery = typeof sp.eps === 'string' ? Number(sp.eps) : NaN;
    let totalEpisodes = Number.isFinite(epsFromQuery) && epsFromQuery > 0 ? epsFromQuery : null;

    if (!totalEpisodes) {
        totalEpisodes = (await fetchEpisodesCountByTitle(title)) ?? 12; // fallback
    }

    const season = 1;
    const origin = await getOrigin();

    return (
        <main className={styles.wrap}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>{title}</h1>
                    <p className={styles.subtitle}>
                        {totalEpisodes} episódios • Temporada {season}
                    </p>
                </div>
            </header>

            <section className={styles.card}>
                <h2 className={styles.sectionTitle}>Episódios</h2>
                <ul className={styles.episodes}>
                    {Array.from({length: totalEpisodes}).map((_, idx) => {
                        const ep = idx + 1;
                        const href = `/anime/${slug}/episodes/${ep}?season=${season}&title=${encodeURIComponent(title)}`;
                        return (
                            <li key={ep}>
                                <Link href={href} className={styles.episodeLink} prefetch>
                                    Episódio {ep}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </section>

            <footer className={styles.footer}>
                <a href={`${origin}/api/animes?nome=${encodeURIComponent(title)}`} target="_blank" rel="noreferrer">
                    Ver dados brutos da API →
                </a>
            </footer>
        </main>
    );
}

async function getOrigin() {
    const h = await headers();
    const host = h.get('host') || 'localhost:3000';
    const protocol = process.env.VERCEL ? 'https' : 'http';
    return `${protocol}://${host}`;
}