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

        // 2. Extract favorite genres and keywords from titles
        const favoriteGenres = new Set<string>();
        favorites.forEach((f: any) => {
            f.media_items.genres?.forEach((g: string) => favoriteGenres.add(g));
        });

        // 3. Find candidate items (balanced Movies and Series)
        const favoriteIds = favorites.map((f: any) => f.media_item_id);
        
        // Fetch top 30 Movies and top 30 Series to ensure diversity
        const [{ data: movieCandidates }, { data: seriesCandidates }] = await Promise.all([
            supabase
                .from('media_items')
                .select('*, sources_scores(*)')
                .eq('type', 'movie')
                .not('id', 'in', `(${favoriteIds.map((id: string) => `"${id}"`).join(',')})`)
                .limit(30),
            supabase
                .from('media_items')
                .select('*, sources_scores(*)')
                .eq('type', 'series')
                .not('id', 'in', `(${favoriteIds.map((id: string) => `"${id}"`).join(',')})`)
                .limit(30)
        ]);

        const candidates = [...(movieCandidates || []), ...(seriesCandidates || [])];

        if (!candidates || candidates.length === 0) throw new Error("No candidates found for recommendations");

        // 4. Recommendation Logic (Similarity Score + Analytical Insights)
        const results = candidates.map((item: any) => {
            let score = 0;
            const commonGenres = item.genres?.filter((g: string) => favoriteGenres.has(g)) || [];
            score += commonGenres.length * 2; // Genre weight

            // --- EXPERT LOGIC PORT START ---
            let finalReason = "";
            let variant = "default";

            const scores = item.sources_scores || [];
            const avgScore = scores.reduce((acc: number, s: any) => acc + s.score_normalized, 0) / (scores.length || 1);
            
            const reddit = scores.find((s: any) => s.source === "reddit");
            const filmaffinity = scores.find((s: any) => s.source === "filmaffinity");
            const forocoches = scores.find((s: any) => s.source === "forocoches");

            // Logic 0: Personalized Match (High Priority)
            if (commonGenres.length > 0 && avgScore > 7.5) {
                const genre = commonGenres[0];
                const templates = [
                    `Match Directo: Tu afinidad por el género ${genre} cruza perfectamente con este título de alta valoración (${avgScore.toFixed(1)} de media). Una integración de narrativa y estilo visual que encaja con tu historial.`,
                    `Recomendación Personal: Analizando tus favoritos, el sistema predice una alta probabilidad de satisfacción con '${item.title}'. Destaca por su ejecución en ${genre}, superior a la media del sector.`,
                    `Alineación de Perfil: Este título resuena con tus preferencias en ${genre}. La data sugiere que es una de esas obras que refuerzan tu criterio cinematográfico.`
                ];
                finalReason = templates[Math.floor(Math.random() * templates.length)];
                variant = "purple";
            }
            // Logic 1: Universal Masterpiece
            else if (avgScore > 8.5) {
                finalReason = `Consenso Crítico: Con una media global de ${avgScore.toFixed(1)}, '${item.title}' trasciende los gustos subjetivos. Es una pieza de ingeniería narrativa validada unánimemente por todas las fuentes de datos.`;
                variant = "gold";
            }
            // Logic 2: Cult Hit (Polarized)
            else if ((reddit?.score_normalized ?? 0) > 8.2 && (filmaffinity?.score_normalized ?? 0) < 7.0 && filmaffinity) {
                finalReason = `Fenómeno de Nicho: La disparidad entre crítica tradicional y Reddit revela una obra de culto. '${item.title}' ofrece una propuesta arriesgada que conecta profundamente con audiencias específicas.`;
                variant = "blue";
            }
            // Logic 3: Forocoches Recommendation
            else if ((forocoches?.score_normalized ?? 0) > 8.5) {
                finalReason = `Alto Impacto: El algoritmo de Forocoches destaca '${item.title}' por su ritmo y capacidad de entretenimiento puro. Una opción optimizada para sesiones donde se busca eficacia narrativa sin relleno.`;
                variant = "red";
            }
            // Logic 4: Classic Reliability
            else if (item.year < 2015 && avgScore > 7.5) {
                finalReason = `Valor Histórico: '${item.title}' ha resistido la prueba del tiempo. Su puntuación sostenida a lo largo de los años indica una calidad estructural que supera a las producciones efímeras actuales.`;
                variant = "purple";
            }
            // Logic 5: General / Smart Pick
            else {
                const generalTemplates = [
                    `Validación Estadística: '${item.title}' presenta métricas sólidas en todos los frentes. Una elección racional basada en la consistencia de guion y dirección.`,
                    `Perfil Equilibrado: Sin estridencias pero sin fallos. El análisis de datos sitúa a esta obra en el percentil superior de fiabilidad. Cine sólido.`,
                    `Recomendación Algorítmica: Cruzando variables de género y recepción, este título emerge como una opción segura para tu perfil de visionado.`
                ];
                 finalReason = generalTemplates[Math.floor(Math.random() * generalTemplates.length)];
                 variant = "default";
            }
            // --- EXPERT LOGIC PORT END ---

            return {
                user_id: userId,
                media_item_id: item.id,
                reason_text: finalReason,
                similarity_score: score
            };
        });

        // Sort by similarity and keep top 10
        const topRecs = results
            .sort((a: any, b: any) => b.similarity_score - a.similarity_score)
            .slice(0, 10)
            .map(({ similarity_score, ...rest }: any) => rest);

        // 6. Save recommendations to DB
        // We delete old ones and insert new ones to avoid requiring a specific unique constraint (more robust)
        if (topRecs.length > 0) {
            await supabase
                .from('recommendations')
                .delete()
                .eq('user_id', userId);

            const { error: saveError } = await supabase
                .from('recommendations')
                .insert(topRecs);
            
            if (saveError) throw saveError;
        }

        return new Response(JSON.stringify({ success: true, count: topRecs.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
