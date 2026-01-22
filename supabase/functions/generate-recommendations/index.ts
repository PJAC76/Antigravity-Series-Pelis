import { getSupabaseClient } from '../_shared/db.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = getSupabaseClient();
        const { userId } = await req.json();

        if (!userId) throw new Error("userId is required");

        // 1. Get user favorites
        const { data: favorites, error: favError } = await supabase
            .from('user_favorites')
            .select('media_item_id, media_items(*)')
            .eq('user_id', userId);

        if (favError) throw favError;
        if (!favorites || favorites.length === 0) {
            return new Response(JSON.stringify({
                message: "No favorites found. Add some to get recommendations.",
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

        // 3. Find candidate items (balanced Movies and Series)
        const favoriteIds = favorites.map((f: any) => f.media_item_id);
        console.log(`User ${userId} has ${favoriteIds.length} favorites.`);
        
        let movieCandidates = [];
        let seriesCandidates = [];
        
        try {
            // PostgREST .not('id', 'in', '(uuid1,uuid2)') is safer for raw filtering
            const filter = `(${favoriteIds.join(',')})`;
            
            const [{ data: mData, error: mError }, { data: sData, error: sError }] = await Promise.all([
                supabase
                    .from('media_items')
                    .select('*, sources_scores(*)')
                    .eq('type', 'movie')
                    .not('id', 'in', filter)
                    .limit(30),
                supabase
                    .from('media_items')
                    .select('*, sources_scores(*)')
                    .eq('type', 'series')
                    .not('id', 'in', filter)
                    .limit(30)
            ]);

            if (mError) throw mError;
            if (sError) throw sError;
            
            movieCandidates = mData || [];
            seriesCandidates = sData || [];
        } catch (fetchErr: any) {
            console.error("Fetch candidates error:", fetchErr);
            throw new Error(`Error fetching candidates: ${fetchErr.message}`);
        }

        const candidates = [...movieCandidates, ...seriesCandidates];
        console.log(`Found ${candidates.length} candidates for recommendations.`);

        if (candidates.length === 0) throw new Error("No candidates found (database might be empty)");

        // 4. Recommendation Logic
        const results = candidates.map((item: any) => {
            let score = 0;
            const commonGenres = item.genres?.filter((g: string) => favoriteGenres.has(g)) || [];
            score += commonGenres.length * 2;

            let finalReason = "";
            const scores = item.sources_scores || [];
            const avgScore = scores.reduce((acc: number, s: any) => acc + s.score_normalized, 0) / (scores.length || 1);
            
            const reddit = scores.find((s: any) => s.source === "reddit");
            const filmaffinity = scores.find((s: any) => s.source === "filmaffinity");
            const forocoches = scores.find((s: any) => s.source === "forocoches");

            if (commonGenres.length > 0 && avgScore > 7.5) {
                const genre = commonGenres[0];
                finalReason = `Match Directo: Tu afinidad por el género ${genre} encaja perfectamente con este título (${avgScore.toFixed(1)} de media).`;
            } else if (avgScore > 8.5) {
                finalReason = `Consenso Crítico: Con una media de ${avgScore.toFixed(1)}, '${item.title}' es una apuesta segura validada por datos.`;
            } else if ((reddit?.score_normalized ?? 0) > 8.2 && (filmaffinity?.score_normalized ?? 0) < 7.0 && filmaffinity) {
                finalReason = `Fenómeno de Nicho: La disparidad entre crítica y Reddit revela una obra de culto que te sorprenderá.`;
            } else if ((forocoches?.score_normalized ?? 0) > 8.5) {
                finalReason = `Alto Impacto: Forocoches destaca '${item.title}' por su ritmo y capacidad de entretenimiento.`;
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
            .slice(0, 10);

        // 6. Save recommendations to DB
        if (topRecs.length > 0) {
            const finalRecs = topRecs.map(({ similarity_score, ...rest }) => rest);
            
            await supabase
                .from('recommendations')
                .delete()
                .eq('user_id', userId);

            const { error: saveError } = await supabase
                .from('recommendations')
                .insert(finalRecs);
            
            if (saveError) throw saveError;
        }

        return new Response(JSON.stringify({ success: true, count: topRecs.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("ERROR IN RECOMMENDATIONS:", error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
