import { getSupabaseClient } from '../_shared/db.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log("[RECS] Starting function...");
        const supabase = getSupabaseClient();
        
        // Use a safe JSON parse
        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error("[RECS] JSON Parse error:", e);
            throw new Error("INVALID_JSON_BODY");
        }

        const userId = body?.userId;
        console.log(`[RECS] Target UserID: ${userId}`);

        if (!userId) throw new Error("MISSING_USER_ID");

        // 1. Get user favorites
        const { data: favorites, error: favError } = await supabase
            .from('user_favorites')
            .select('media_item_id, media_items(*)')
            .eq('user_id', userId);

        if (favError) throw new Error(`FAVORITES_LOAD_ERROR: ${favError.message}`);
        
        if (!favorites || favorites.length === 0) {
            console.log("[RECS] No favorites found for user.");
            return new Response(JSON.stringify({
                message: "Añade favoritos para recibir recomendaciones.",
                recommendations: []
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 2. Extract favorite genres
        const favoriteGenres = new Set<string>();
        favorites.forEach((f: any) => {
            f.media_items?.genres?.forEach((g: string) => favoriteGenres.add(g));
        });

        const favoriteIds = favorites.map((f: any) => f.media_item_id);
        
        // 3. Find candidate items
        let movieCandidates: any[] = [];
        let seriesCandidates: any[] = [];

        try {
            let movieQuery = supabase.from('media_items').select('*, sources_scores(*)').eq('type', 'movie').limit(50);
            let seriesQuery = supabase.from('media_items').select('*, sources_scores(*)').eq('type', 'series').limit(50);
            
            if (favoriteIds.length > 0) {
                movieQuery = movieQuery.not('id', 'in', `(${favoriteIds.join(',')})`);
                seriesQuery = seriesQuery.not('id', 'in', `(${favoriteIds.join(',')})`);
            }

            const [mRes, sRes] = await Promise.all([movieQuery, seriesQuery]);
            
            if (mRes.error) throw mRes.error;
            if (sRes.error) throw sRes.error;
            
            movieCandidates = mRes.data || [];
            seriesCandidates = sRes.data || [];
        } catch (fetchErr: any) {
            console.error("[RECS] Fetch error:", fetchErr);
            throw new Error(`DB_QUERY_ERROR: ${fetchErr.message}`);
        }

        const candidates = [...movieCandidates, ...seriesCandidates];
        const uniqueCandidates = Array.from(new Map(candidates.map((c: any) => [c.id, c])).values());

        if (uniqueCandidates.length === 0) throw new Error("NO_CANDIDATES_AVAILABLE");

        // 4. Scoring logic
        const results = uniqueCandidates.map((item: any) => {
            let score = 0;
            const commonGenres = item.genres?.filter((g: string) => favoriteGenres.has(g)) || [];
            score += commonGenres.length * 2;

            const scores = item.sources_scores || [];
            const avgScore = scores.length > 0 
                ? scores.reduce((acc: number, s: any) => acc + s.score_normalized, 0) / scores.length 
                : 0;

            let finalReason = `Recomendado según tu interés en ${commonGenres[0] || 'novedades'} y su valoración de ${avgScore.toFixed(1)}.`;

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
            .map(({ similarity_score, ...rest }: any) => rest);

        // 5. Save to database
        if (topRecs.length > 0) {
            await supabase.from('recommendations').delete().eq('user_id', userId);
            const { error: saveError } = await supabase.from('recommendations').insert(topRecs);
            if (saveError) throw new Error(`DB_INSERT_ERROR: ${saveError.message}`);
        }

        return new Response(JSON.stringify({ success: true, count: topRecs.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("[RECS] MASTER ERROR CATCH:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        return new Response(JSON.stringify({ error: errorMessage }), { 
            status: 200, // Return 200 to ensure the client sees the JSON body
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
