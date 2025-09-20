import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'AnimeVerse',
    description: 'Busca de animes online',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR">
        <body>
        <div className="container" style={{ padding: '2rem 0' }}>
            {children}
        </div>
        </body>
        </html>
    );
}