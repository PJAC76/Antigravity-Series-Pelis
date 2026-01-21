import { getSupabaseClient } from '../_shared/db.ts';

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = getSupabaseClient();
        console.log("Calculating rankings...");

        // 1. Get all media items with their scores
        const { data: items, error: fetchError } = await supabase
            .from('media_items')
            .select(`
        id,
        year,
        sources_scores (
          score_normalized,
          votes_count
        )
      `);

        if (fetchError) throw fetchError;

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1; // 1-12
        
        // Recent = Current Year (2026) and Previous Year (2025) and even 2024 (12-24 months prior)
        // Let's make it simple: Last 2 years = 2026, 2025, 2024.
        // If current year is 2026, we want 2026, 2025, 2024 to be safe for "recent" lists.
        const cutoffYear = currentYear - 2; // 2026 - 2 = 2024
        
        const rankings = [];

        for (const item of items) {
            if (!item.sources_scores || item.sources_scores.length === 0) continue;

            // Calculate weighted average
            let totalScore = 0;
            let totalVotes = 0;

            item.sources_scores.forEach((s: any) => {
                totalScore += s.score_normalized;
                totalVotes += s.votes_count;
            });

            const avgScore = totalScore / item.sources_scores.length;
            // Boost score slightly for high vote counts (popularity factor)
            const popularityBonus = Math.min(0.5, totalVotes / 100000);
            const finalScore = Math.min(10, parseFloat((avgScore + popularityBonus).toFixed(1)));

            // Check if item is from the last 12 months
            // Simple check: if year >= cutoffYear, it's recent (covers 2025 and 2026)
            const rankingType = (item.year >= cutoffYear) ? 'recent' : 'historical';

            rankings.push({
                media_item_id: item.id,
                final_score: finalScore,
                ranking_type: rankingType,
                updated_at: new Date().toISOString()
            });
        }

        // Sort and keep top ones if needed, or just upsert all and limit in the UI
        const { error: upsertError } = await supabase
            .from('aggregated_scores')
            .upsert(rankings);

        if (upsertError) throw upsertError;

        return new Response(JSON.stringify({
            success: true,
            processed: rankings.length
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
