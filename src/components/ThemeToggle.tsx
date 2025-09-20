'use client';

import { useEffect, useState } from 'react';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
    const [theme, setTheme] = useState<'light' | 'dark' | ''>('');

    useEffect(() => {
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark') {
            setTheme(stored);
            document.documentElement.setAttribute('data-theme', stored);
        }
    }, []);

    const toggle = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        setTheme(next as 'light' | 'dark');
    };

    return (
        <button className={styles.toggle} onClick={toggle} aria-label="Alternar tema">
            <div className={styles.iconWrap}>
                <SunIcon />
                <MoonIcon />
            </div>
            <span className={styles.label}>{theme === 'dark' ? 'Escuro' : 'Claro'}</span>
        </button>
    );
}

function SunIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <path fill="currentColor" d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zm9.66-3.54l-1.41-1.41-1.8 1.79 1.41 1.41 1.8-1.79zM20 11v2h3v-2h-3zM11 1v3h2V1h-2zm-6.05 15.36l-1.79 1.8 1.41 1.41 1.8-1.79-1.42-1.42zM12 6a6 6 0 100 12A6 6 0 0012 6z"/>
        </svg>
    );
}

function MoonIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <path fill="currentColor" d="M12.74 2a9 9 0 108.52 12.1A7 7 0 0112.74 2z"/>
        </svg>
    );
}