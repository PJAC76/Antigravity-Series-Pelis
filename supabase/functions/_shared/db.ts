import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const getSupabaseClient = () => {
    // CRITICAL: We MUST use the Service Role Key for scrapers to bypass RLS.
    // Do NOT fall back to Anon Key, as it cannot write to these tables.
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("CRITICAL ERROR: Missing SUPABASE_SERVICE_ROLE_KEY. Operations will fail.");
        throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Scrapers require admin privileges.");
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

export async function upsertMediaItem(supabase: any, item: {
    title: string;
    year: number;
    type: 'movie' | 'series';
    genres?: string[];
    poster_url?: string;
    synopsis_short?: string;
}) {
    // 1. Check if item exists (Manual check to avoid Unique Constraint dependency)
    const { data: existing } = await supabase
        .from('media_items')
        .select('id')
        .eq('title', item.title)
        .eq('year', item.year)
        .limit(1);

    if (existing && existing.length > 0) {
        return existing[0].id; // Return existing ID
    }

    // 2. Insert if not found
    const { data: inserted, error } = await supabase
        .from('media_items')
        .insert(item)
        .select('id')
        .single();

    if (error) {
        // If error is "duplicate key" (race condition), try fetching again
        if (error.code === '23505') {
             const { data: raceResult } = await supabase
                .from('media_items')
                .select('id')
                .eq('title', item.title)
                .eq('year', item.year)
                .limit(1);
            if (raceResult && raceResult.length > 0) return raceResult[0].id;
        }
        console.error(`Error inserting ${item.title}:`, error.message);
        throw error;
    }
    return inserted.id;
}

export async function updateSourceScore(supabase: any, scoreInfo: {
    media_item_id: string;
    source: 'forocoches' | 'filmaffinity' | 'reddit';
    score_normalized: number;
    votes_count: number;
}) {
    // 1. Check if score exists manually
    const { data: existing } = await supabase
        .from('sources_scores')
        .select('id')
        .eq('media_item_id', scoreInfo.media_item_id)
        .eq('source', scoreInfo.source)
        .limit(1);

    if (existing && existing.length > 0) {
        // 2. Update
        const { error } = await supabase
            .from('sources_scores')
            .update({
                score_normalized: scoreInfo.score_normalized,
                votes_count: scoreInfo.votes_count,
                scraped_at: new Date().toISOString()
            })
            .eq('id', existing[0].id);
        
        if (error) throw error;
    } else {
        // 3. Insert
        const { error } = await supabase
            .from('sources_scores')
            .insert(scoreInfo);
        
        if (error) throw error;
    }
}
