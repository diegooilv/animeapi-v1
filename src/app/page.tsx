'use client';

import { useCallback, useMemo, useState } from 'react';
import styles from './page.module.css';
import SearchBar from '@/components/SearchBar';
import AnimeCard from '@/components/AnimeCard';
import SkeletonCard from '@/components/SkeletonCard';
import ThemeToggle from '@/components/ThemeToggle';
import type { AnimeSummary } from '@/types/anime';

type State =
    | { status: 'idle'; data: AnimeSummary[] }
    | { status: 'loading'; data: AnimeSummary[] }
    | { status: 'error'; error: string; data: AnimeSummary[] }
    | { status: 'success'; data: AnimeSummary[] };

export default function HomePage() {
    const [state, setState] = useState<State>({ status: 'idle', data: [] });

    const fetchAnimes = useCallback(async (q: string) => {
        const query = q.trim();
        if (!query) {
            setState({ status: 'idle', data: [] });
            return;
        }
        setState((s) => ({ ...s, status: 'loading' }));
        try {
            const res = await fetch(`/api/animes?nome=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error(`Erro ${res.status}`);
            const json = await res.json();
            const list: AnimeSummary[] = Array.isArray(json?.data) ? json.data : [];
            setState({ status: 'success', data: list.slice(0, 24) });
        } catch (e: any) {
            setState({ status: 'error', error: e?.message || 'Erro ao buscar', data: [] });
        }
    }, []);

    const content = useMemo(() => {
        if (state.status === 'loading') {
            return (
                <div className={styles.grid}>
                    {Array.from({ length: 12 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            );
        }

        if (state.status === 'error') {
            return (
                <div className={styles.cardInfo}>
                    <h3 style={{ fontWeight: 700, marginBottom: '.25rem' }}>Ocorreu um erro</h3>
                    <p style={{ color: `rgb(var(--muted))` }}>{state.error}</p>
                </div>
            );
        }

        if (state.data.length === 0) {
            return (
                <div className={styles.cardInfo}>
                    <h3 style={{ fontWeight: 700, marginBottom: '.25rem' }}>Busque por um anime</h3>
                    <p style={{ color: `rgb(var(--muted))` }}>Ex.: Naruto, One Piece, Attack on Titan...</p>
                </div>
            );
        }

        return (
            <div className={styles.grid}>
                {state.data.map((a) => (
                    <AnimeCard key={a.id + a.title} anime={a} />
                ))}
            </div>
        );
    }, [state]);

    return (
        <main style={{ display: 'grid', gap: '1.25rem' }}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>AnimeVerse</h1>
                    <p className={styles.subtitle}>Procure seus animes favoritos!</p>
                </div>
                <ThemeToggle />
            </header>

            <SearchBar onSearch={fetchAnimes} />

            {content}
        </main>
    );
}