import { getSupabaseClient } from '../_shared/db.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log("[RECS] Starting balanced recommendation logic...");
        const supabase = getSupabaseClient();
        
        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error("[RECS] JSON Parse error:", e);
            throw new Error("INVALID_JSON_BODY");
        }

        const userId = body?.userId;
        if (!userId) throw new Error("MISSING_USER_ID");

        // 1. Get user favorites
        const { data: favorites, error: favError } = await supabase
            .from('user_favorites')
            .select('media_item_id, media_items(*)')
            .eq('user_id', userId);

        if (favError) throw new Error(`FAVORITES_LOAD_ERROR: ${favError.message}`);
        
        if (!favorites || favorites.length === 0) {
            return new Response(JSON.stringify({
                message: "Añade favoritos para recibir recomendaciones.",
                recommendations: []
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 2. Extract favorite genres
        const favoriteGenres = new Set<string>();
        favorites.forEach((f: any) => {
            if (f.media_items?.genres) {
                f.media_items.genres.forEach((g: string) => favoriteGenres.add(g));
            }
        });

        const favoriteIds = favorites.map((f: any) => f.media_item_id);
        
        // 3. Fetch candidates (separate pools)
        const fetchPool = async (type: 'movie' | 'series') => {
            let query = supabase
                .from('media_items')
                .select('*, sources_scores(*)')
                .eq('type', type)
                .limit(60);
            
            if (favoriteIds.length > 0) {
                query = query.not('id', 'in', `(${favoriteIds.join(',')})`);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        };

        const [movies, series] = await Promise.all([
            fetchPool('movie'),
            fetchPool('series')
        ]);

        console.log(`[RECS] Found ${movies.length} movies and ${series.length} series candidates.`);

        // 4. Scoring Logic Helper
        const scoreItem = (item: any) => {
            let score = 0;
            const commonGenres = item.genres?.filter((g: string) => favoriteGenres.has(g)) || [];
            score += commonGenres.length * 3; // Genre weight

            const scores = item.sources_scores || [];
            const avgScore = scores.length > 0 
                ? scores.reduce((acc: number, s: any) => acc + s.score_normalized, 0) / scores.length 
                : 0;
            
            // Artificial boost for high ratings to ensure quality
            score += avgScore;

            let finalReason = "";
            if (commonGenres.length > 0) {
                finalReason = `Te lo recomendamos porque te gusta el género ${commonGenres[0]} y tiene una nota de ${avgScore.toFixed(1)}.`;
            } else {
                finalReason = `Elegido por su alta valoración de la comunidad (${avgScore.toFixed(1)}). Una apuesta segura para tu catálogo.`;
            }

            return {
                user_id: userId,
                media_item_id: item.id,
                reason_text: finalReason,
                similarity_score: score
            };
        };

        // 5. Build Balanced Top 10 (5 movies + 5 series)
        const scoredMovies = movies.map(scoreItem).sort((a, b) => b.similarity_score - a.similarity_score);
        const scoredSeries = series.map(scoreItem).sort((a, b) => b.similarity_score - a.similarity_score);

        const topMovies = scoredMovies.slice(0, 5);
        const topSeries = scoredSeries.slice(0, 5);

        // If one category is empty, fill with the other up to 10 total
        let finalRecs = [...topMovies, ...topSeries];
        
        if (finalRecs.length < 10) {
            if (topMovies.length === 5 && scoredMovies.length > 5) {
                finalRecs = [...finalRecs, ...scoredMovies.slice(5, 10 - finalRecs.length)];
            } else if (topSeries.length === 5 && scoredSeries.length > 5) {
                finalRecs = [...finalRecs, ...scoredSeries.slice(5, 10 - finalRecs.length)];
            }
        }

        // 6. Save and Return
        if (finalRecs.length > 0) {
            const cleanRecs = finalRecs.map(({ similarity_score, ...rest }) => rest);
            await supabase.from('recommendations').delete().eq('user_id', userId);
            const { error: saveError } = await supabase.from('recommendations').insert(cleanRecs);
            if (saveError) throw new Error(`DB_INSERT_ERROR: ${saveError.message}`);
        }

        return new Response(JSON.stringify({ success: true, count: finalRecs.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("[RECS] ERROR:", error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
