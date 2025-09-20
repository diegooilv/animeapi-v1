'use client';

import Image from 'next/image';
import Link from 'next/link';
import styles from './AnimeCard.module.css';
import type { AnimeSummary } from '@/types/anime';
import { slugify } from '@/lib/slug';

type Props = { anime: AnimeSummary };

export default function AnimeCard({ anime }: Props) {
    const slug = slugify(anime.title);
    const href = `/anime/${slug}?title=${encodeURIComponent(anime.title)}&eps=${anime.episodes ?? ''}`;

    return (
        <article className={styles.card}>
            <Link href={href} className={styles.media} aria-label={`Abrir ${anime.title}`}>
                {anime.image ? (
                    <Image
                        src={anime.image}
                        alt={anime.title}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                        className={styles.img}
                        priority={false}
                    />
                ) : (
                    <div className={styles.placeholder} />
                )}
                {anime.score != null && (
                    <div className={`${styles.badge} ${styles.badgeScore}`}>★ {anime.score}</div>
                )}
                {anime.status && (
                    <div className={`${styles.badge} ${styles.badgeStatus}`}>{anime.status}</div>
                )}
            </Link>

            <div className={styles.body}>
                <h3 className={styles.title} title={anime.title}>
                    <Link href={href} className={styles.titleLink}>{anime.title}</Link>
                </h3>

                {anime.genres?.length > 0 && (
                    <div className={styles.genres}>
                        {anime.genres.slice(0,3).map((g) => (
                            <span key={g} className={styles.genre}>{g}</span>
                        ))}
                    </div>
                )}

                {anime.synopsis && (
                    <p className={styles.synopsis}>{anime.synopsis}</p>
                )}

                <div className={styles.footer}>
                    <span className={styles.meta}>Eps: {anime.episodes ?? '—'}</span>
                    <Link href={href} className={styles.link}>Ver episódios →</Link>
                </div>
            </div>
        </article>
    );
}