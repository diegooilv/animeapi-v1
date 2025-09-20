'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './SearchBar.module.css';

type Props = {
    defaultQuery?: string;
    onSearch: (query: string) => void;
    placeholder?: string;
};

export default function SearchBar({ defaultQuery = 'naruto', onSearch, placeholder = 'Busque por um anime...' }: Props) {
    const [query, setQuery] = useState(defaultQuery);
    const firstRun = useRef(true);

    // debounce simples
    useEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;
            onSearch(defaultQuery);
            return;
        }
        const id = setTimeout(() => onSearch(query), 400);
        return () => clearTimeout(id);
    }, [query, defaultQuery, onSearch]);

    return (
        <div className={styles.wrapper}>
            <div className={styles.inputWrap}>
                <svg aria-hidden className={styles.icon} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z" clipRule="evenodd"/>
                </svg>
                <input
                    className={styles.input}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                    aria-label="Buscar anime"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onSearch(query);
                    }}
                />
            </div>
            <button className={styles.button} onClick={() => onSearch(query)} aria-label="Buscar">
                Buscar
            </button>
        </div>
    );
}