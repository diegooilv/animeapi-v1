import {NextRequest} from 'next/server';
import {searchAcrossProviders, totalProviders} from '@/lib/providers';

export const runtime = 'nodejs';

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ slug: string; episode: string }> }
) {
    const {slug, episode} = await ctx.params;

    const {searchParams} = new URL(req.url);
    const seasonParam = searchParams.get('season') ?? '1';
    const startParam = searchParams.get('start') ?? '0';
    const titleHint = searchParams.get('title') ?? undefined;

    const season = Number.isNaN(Number(seasonParam)) ? 1 : parseInt(seasonParam, 10);
    const start = Number.isNaN(Number(startParam)) ? 0 : Math.max(0, parseInt(startParam, 10));

    if (!slug || !episode) {
        return Response.json({error: true, message: 'slug e episode são obrigatórios.'}, {status: 400});
    }

    const {result, index} = await searchAcrossProviders(slug, episode, season, start, titleHint);

    if (index === -1 || result.error || !result.episode) {
        return Response.json(
            {
                error: true,
                message: result.message || 'Episódio não encontrado em nenhum provider.',
                provider: result.provider,
                index,
                total: totalProviders,
                nextIndex: null,
            },
            {status: 404}
        );
    }

    const nextIndex = index + 1 < totalProviders ? index + 1 : null;

    return Response.json({
        ...result,
        error: false,
        index,
        total: totalProviders,
        nextIndex,
    });
}