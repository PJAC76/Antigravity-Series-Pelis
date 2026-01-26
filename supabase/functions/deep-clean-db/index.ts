import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const TMDB_API_KEY = '92393fc7fd8b4372108ffc37ea213f2f';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const logs: string[] = [];
    const log = (msg: string) => {
        console.log(msg);
        logs.push(msg);
    };

    log('🏥 STARTING GLOBAL DATABASE DEEP CLEAN (CLONE STRATEGY)...');

    // 1. Fetch Candidates (Truncated Items)
    // Fetch critical fields to detect truncation
    const { data: allItems, error: fetchErr } = await supabase
        .from('media_items')
        .select('id, title, year, type, synopsis_short')
        .order('created_at', { ascending: true }); // Process oldest first (likely the broken ones)

    if (fetchErr) throw fetchErr;

    const truncatedItems = allItems.filter(i => 
        i.synopsis_short && i.synopsis_short.length <= 205 // Tolerance for 200-ish
    );

    log(`🔎 Found ${truncatedItems.length} potentially truncated items out of ${allItems.length}.`);

    let repairedToken = 0;

    for (const item of truncatedItems) {
        log(`\n🚑 REPAIRING: ${item.title} (Len: ${item.synopsis_short.length})`);

        // 2. Get Clean Data from TMDB
        let tmdbData;
        const mediaType = item.type === 'series' ? 'tv' : 'movie';
        
        try {
            let searchUrl = `${TMDB_BASE_URL}/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(item.title)}&year=${item.year}&language=es-ES`;
            let resp = await fetch(searchUrl);
            tmdbData = await resp.json();

            if (!tmdbData.results?.length) {
                // Retry without year
                searchUrl = `${TMDB_BASE_URL}/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(item.title)}&language=es-ES`;
                resp = await fetch(searchUrl);
                tmdbData = await resp.json();
            }
        } catch (e) {
            log(`   ❌ TMDB Fetch Error: ${e.message}`);
            continue;
        }

        if (!tmdbData.results?.length) {
            log(`   ❌ TMDB Not Found for ${item.title}`);
            continue;
        }

        const hit = tmdbData.results[0];
        const newOverview = hit.overview;

        if (!newOverview || newOverview.length <= 200) {
             log(`   ⚠️ TMDB overview is also short (${newOverview?.length}). Skipping.`);
             continue; // No point cloning if source is also short
        }

        const cleanData = {
            type: item.type,
            title: hit.name || hit.title,
            year: item.year || parseInt((hit.first_air_date || hit.release_date || '0').substring(0, 4)),
            synopsis_short: newOverview,
            poster_url: hit.poster_path ? `${TMDB_IMAGE_BASE}${hit.poster_path}` : null,
            // Keep original genres or other fields if needed, but usually fresh is better
        };

        log(`   📦 Packed New Data: "${cleanData.title}" (${cleanData.synopsis_short.length} chars)`);

        // 3. INSERT NEW ROW (Clone)
        const { data: inserted, error: insError } = await supabase
            .from('media_items')
            .insert(cleanData)
            .select()
            .single();

        if (insError) {
            log(`   ❌ FAIL TO INSERT NEW ROW: ${insError.message}`);
            continue;
        }

        // Verify length immediately
        if (inserted.synopsis_short.length <= 200) {
             log(`   💀 CRITICAL: New row truncated again! DB Trigger is very aggressive. Keeping new row, but failed to fix.`);
             // If this happens, we failed.
        } else {
             log(`   ✨ INSERTED NEW ROW: ID ${inserted.id} (Verified Len: ${inserted.synopsis_short.length})`);
             
             // 4. MIGRATE & DELETE OLD
             log(`   🔄 Migrating data from ${item.id} to ${inserted.id}...`);
             
             await supabase.from('sources_scores').update({ media_item_id: inserted.id }).eq('media_item_id', item.id);
             await supabase.from('user_favorites').update({ media_item_id: inserted.id }).eq('media_item_id', item.id);
             await supabase.from('recommendations').update({ media_item_id: inserted.id }).eq('media_item_id', item.id);

             const { error: delError } = await supabase.from('media_items').delete().eq('id', item.id);
             if (delError) log(`      ❌ Delete Old Failed: ${delError.message}`);
             else log(`      ✅ Old Row Deleted.`);
             
             repairedToken++;
        }
    }

    return new Response(JSON.stringify({ 
        success: true, 
        repaired: repairedToken,
        logs 
    }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
    });
  }
});
