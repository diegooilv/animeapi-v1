import {NextRequest} from 'next/server';
import {buscarAnimes} from '@/lib/services/buscarAnime';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const {searchParams} = new URL(req.url);
    const nome = searchParams.get('nome') ?? searchParams.get('q');

    if (!nome || !nome.trim()) {
        return Response.json({error: 'Parâmetro "nome" é obrigatório.'}, {status: 400});
    }

    try {
        const data = await buscarAnimes(nome);
        return Response.json({data});
    } catch (err: any) {
        return Response.json(
            {error: true, message: err?.message || 'Erro ao buscar animes.'},
            {status: 502}
        );
    }
}