'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './PlayerWithFallback.module.css';

type ProviderData = {
    error: boolean;
    provider: string;
    searched_endpoint: string;
    episode: string | null;
    message?: string;
    index: number;
    total: number;
    nextIndex: number | null;

    isEmbed?: boolean;
    isHls?: boolean;
    headers?: Record<string, string> | null;
    requiresProxy?: boolean;
};

type Props = {
    slug: string;
    episode: string | number;
    season?: number;
    title?: string;
    initialData?: ProviderData | null;
};

export default function PlayerWithFallback({ slug, episode, season = 1, title, initialData = null }: Props) {
    const [data, setData] = useState<ProviderData | null>(initialData ?? null);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState<string | null>(null);
    const [tried, setTried] = useState<number[]>(initialData ? [initialData.index] : []);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<any>(null);

    const proxiedUrl = useMemo(() => {
        if (!data?.episode) return null;
        if (data?.requiresProxy) {
            const referer = data.headers?.Referer || data.headers?.referer || '';
            return `/api/proxy?url=${encodeURIComponent(data.episode)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`;
        }
        return data.episode;
    }, [data]);

    const fetchFrom = useCallback(async (start: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/animes/${encodeURIComponent(slug)}/episodes/${encodeURIComponent(String(episode))}?season=${season}${title ? `&title=${encodeURIComponent(title)}` : ''}&start=${start}`,
                { cache: 'no-store' }
            );
            const json: ProviderData = await res.json();
            if (!res.ok || json.error || !json.episode) {
                throw new Error(json.message || `Erro ${res.status}`);
            }
            setData(json);
            setTried((arr) => (arr.includes(json.index) ? arr : [...arr, json.index]));
        } catch (e: any) {
            setError(e?.message || 'Falha ao obter link do episódio.');
        } finally {
            setLoading(false);
        }
    }, [slug, episode, season, title]);

    useEffect(() => {
        if (!initialData) {
            fetchFrom(0);
        }
        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy?.();
                hlsRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, episode, season, title]);

    const tryNext = useCallback(() => {
        if (!data) return;
        const next = data.index + 1;
        if (next >= (data.total ?? Infinity)) {
            setError('Todos os providers falharam.');
            return;
        }
        if (hlsRef.current) {
            hlsRef.current.destroy?.();
            hlsRef.current = null;
        }
        fetchFrom(next);
    }, [data, fetchFrom]);

    useEffect(() => {
        (async () => {
            if (!data?.isHls || !proxiedUrl || !videoRef.current) return;

            const video = videoRef.current;
            const canNativeHls = video.canPlayType('application/vnd.apple.mpegURL');
            if (canNativeHls) {
                video.src = proxiedUrl;
                return;
            }

            try {
                const Hls = (await import('hls.js')).default;
                if (Hls.isSupported()) {
                    const hls = new Hls({ enableWorker: true });
                    hlsRef.current = hls;
                    hls.loadSource(proxiedUrl);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.ERROR, (_e: any, d: any) => {
                        if (d?.fatal) {
                            tryNext();
                        }
                    });
                } else {
                    video.src = proxiedUrl;
                }
            } catch {
                tryNext();
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.isHls, proxiedUrl]);

    const onVideoError = useCallback(() => {
        tryNext();
    }, [tryNext]);

    return (
        <section className={styles.card}>
            <header className={styles.header}>
                <div className={styles.left}>
                    <h2 className={styles.title}>{title ?? slug.replace(/-/g, ' ')}</h2>
                    <p className={styles.subtitle}>Episódio {String(episode)} • Temporada {season}</p>
                </div>
                <div className={styles.right}>
                    {data && (
                        <span className={styles.badge}>
              Provider: <strong>{data.provider}</strong> ({(data.index ?? 0) + 1}/{data.total ?? '?'})
            </span>
                    )}
                </div>
            </header>

            {loading && <div className={styles.loading}>Carregando...</div>}

            {!loading && (error || !data?.episode) && (
                <div className={styles.alert}>
                    <strong>Não foi possível carregar o episódio.</strong>
                    <div className={styles.small}>{error || data?.message || 'Erro desconhecido'}</div>
                    {data && data.index + 1 < (data.total ?? 0) && (
                        <button className={styles.btn} onClick={tryNext}>Tentar próximo provider</button>
                    )}
                </div>
            )}

            {!loading && data?.episode && (
                <>
                    {data.isEmbed ? (
                        <div className={styles.fallback}>
                            <p>Fonte do tipo página (pode ter anúncios). Abra em nova aba:</p>
                            <a
                                className={styles.btn}
                                href={proxiedUrl || data.episode}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Abrir no provedor
                            </a>
                            {data.nextIndex != null && (
                                <button className={styles.btnGhost} onClick={tryNext}>Tentar próximo provider</button>
                            )}
                        </div>
                    ) : data.isHls ? (
                        <video
                            ref={videoRef}
                            className={styles.player}
                            controls
                            playsInline
                            autoPlay
                            onError={onVideoError}
                        />
                    ) : (
                        <video
                            ref={videoRef}
                            className={styles.player}
                            src={proxiedUrl || data.episode}
                            controls
                            playsInline
                            autoPlay
                            onError={onVideoError}
                        />
                    )}

                    <div className={styles.meta}>
                        <div className={styles.kv}><span>Endpoint pesquisado:</span><a href={data.searched_endpoint} target="_blank" rel="noreferrer">{data.searched_endpoint}</a></div>
                        <div className={styles.kv}><span>URL do episódio:</span><a href={data.episode} target="_blank" rel="noreferrer">{data.episode}</a></div>
                        {tried.length > 0 && (
                            <div className={styles.kv}><span>Providers testados:</span><em>{tried.map(i => i + 1).join(', ')}</em></div>
                        )}
                    </div>

                    {data.nextIndex != null && (
                        <div className={styles.actions}>
                            <button className={styles.btnGhost} onClick={tryNext}>Próximo provider →</button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}