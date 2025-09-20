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