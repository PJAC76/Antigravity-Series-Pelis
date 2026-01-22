import { getSupabaseClient } from '../_shared/db.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = getSupabaseClient();
        const body = await req.json().catch(() => ({}));
        const { userId } = body;

        console.log("Generating recommendations for user:", userId);

        if (!userId) throw new Error("userId_is_required");

        // 1. Get user favorites
        const { data: favorites, error: favError } = await supabase
            .from('user_favorites')
            .select('media_item_id, media_items(*)')
            .eq('user_id', userId);

        if (favError) {
            console.error("Favorites fetch error:", favError);
            throw new Error(`FAV_FETCH_ERROR: ${favError.message}`);
        }

        if (!favorites || favorites.length === 0) {
            return new Response(JSON.stringify({
                message: "No favorites found.",
                recommendations: []
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 2. Extract favorite genres
        const favoriteGenres = new Set<string>();
        favorites.forEach((f: any) => {
            if (f.media_items && f.media_items.genres) {
                f.media_items.genres.forEach((g: string) => favoriteGenres.add(g));
            }
        });

        // 3. Find candidate items
        const favoriteIds = favorites.map((f: any) => f.media_item_id).filter((id: string) => !!id);
        
        let movieCandidates = [];
        let seriesCandidates = [];
        
        try {
            const [{ data: mData, error: mError }, { data: sData, error: sError }] = await Promise.all([
                supabase
                    .from('media_items')
                    .select('*, sources_scores(*)')
                    .eq('type', 'movie')
                    .not('id', 'in', favoriteIds)
                    .limit(30),
                supabase
                    .from('media_items')
                    .select('*, sources_scores(*)')
                    .eq('type', 'series')
                    .not('id', 'in', favoriteIds)
                    .limit(30)
            ]);

            if (mError) throw mError;
            if (sError) throw sError;
            
            movieCandidates = mData || [];
            seriesCandidates = sData || [];
        } catch (fetchErr: any) {
            console.error("Candidates fetch failed:", fetchErr);
            throw new Error(`CANDIDATES_FETCH_FAILED: ${fetchErr.message || 'Unknown error'}`);
        }

        const candidates = [...movieCandidates, ...seriesCandidates];

        if (candidates.length === 0) throw new Error("DATABASE_EMPTY_OR_NO_CANDIDATES");

        // 4. Recommendation Logic
        const results = candidates.map((item: any) => {
            let score = 0;
            const itemGenres = item.genres || [];
            const commonGenres = itemGenres.filter((g: string) => favoriteGenres.has(g));
            score += commonGenres.length * 2;

            let finalReason = "";
            const scores = item.sources_scores || [];
            const avgScore = scores.length > 0 
                ? scores.reduce((acc: number, s: any) => acc + (s.score_normalized || 0), 0) / scores.length 
                : 0;
            
            if (commonGenres.length > 0 && avgScore > 7.5) {
                finalReason = `Match Directo: Tu afinidad por el género ${commonGenres[0]} encaja con este título (${avgScore.toFixed(1)} de media).`;
            } else if (avgScore > 8.5) {
                finalReason = `Consenso Crítico: Con una media de ${avgScore.toFixed(1)}, '${item.title}' es una apuesta segura validada por datos.`;
            } else {
                finalReason = `Validación Estadística: '${item.title}' presenta métricas sólidas. Una elección racional basada en la consistencia de guion.`;
            }

            return {
                user_id: userId,
                media_item_id: item.id,
                reason_text: finalReason,
                similarity_score: score
            };
        });

        const topRecs = results
            .sort((a: any, b: any) => b.similarity_score - a.similarity_score)
            .slice(0, 10)
            .map(({ similarity_score, ...rest }) => rest);

        // 6. Save recommendations to DB
        if (topRecs.length > 0) {
            await supabase
                .from('recommendations')
                .delete()
                .eq('user_id', userId);

            const { error: saveError } = await supabase
                .from('recommendations')
                .insert(topRecs);
            
            if (saveError) {
                console.error("Save recommendations error:", saveError);
                throw new Error(`SAVE_ERROR: ${saveError.message}`);
            }
        }

        return new Response(JSON.stringify({ success: true, count: topRecs.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("CRITICAL FUNCTION ERROR:", error);
        return new Response(JSON.stringify({ error: error.message || "Unknown error" }), { 
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
