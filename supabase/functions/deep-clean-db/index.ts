import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const TMDB_API_KEY = '92393fc7fd8b4372108ffc37ea213f2f';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const TARGETS = [
  { term: 'The Last of Us', type: 'tv', year: 2023 },
  { term: 'Spider-Man: Across the Spider-Verse', type: 'movie', year: 2023 },
  { term: 'Succession', type: 'tv', year: 2018 }
];

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

    log('🏥 STARTING SERVER-SIDE DATABASE TRANSPLANT...');

    for (const t of TARGETS) {
        log(`\n🔍 PROCESSING: ${t.term}`);

        // 1. Get Clean Data from TMDB
        let tmdbData;
        try {
            let searchUrl = `${TMDB_BASE_URL}/search/${t.type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(t.term)}&year=${t.year}&language=es-ES`;
            let resp = await fetch(searchUrl);
            tmdbData = await resp.json();

            if (!tmdbData.results?.length) {
                // Try without year
                searchUrl = `${TMDB_BASE_URL}/search/${t.type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(t.term)}&language=es-ES`;
                resp = await fetch(searchUrl);
                tmdbData = await resp.json();
            }
        } catch (e) {
            log(`   ❌ TMDB Fetch Error: ${e.message}`);
            continue;
        }

        if (!tmdbData.results?.length) {
            log(`   ❌ TMDB Not Found for ${t.term}`);
            continue;
        }

        const hit = tmdbData.results[0];
        const cleanData = {
            type: t.type === 'tv' ? 'series' : 'movie',
            title: hit.name || hit.title,
            year: t.year || parseInt((hit.first_air_date || hit.release_date || '0').substring(0, 4)),
            synopsis_short: hit.overview,
            poster_url: hit.poster_path ? `${TMDB_IMAGE_BASE}${hit.poster_path}` : null,
        };

        log(`   📦 Packed New Data: "${cleanData.title}" (${cleanData.synopsis_short.length} chars)`);

        // 2. Find Old Corrupted Rows
        const { data: oldRows, error: findError } = await supabase
            .from('media_items')
            .select('*')
            .ilike('title', `%${t.term}%`);

        if (findError) {
            log(`   ❌ Error searching: ${findError.message}`);
            continue;
        }

        log(`   🏚️ Found ${oldRows?.length || 0} old/corrupted rows.`);

        // 3. INSERT NEW ROW
        const { data: inserted, error: insError } = await supabase
            .from('media_items')
            .insert(cleanData)
            .select() // Need to enable SELECT policy or use service role (which we are)
            .single();

        if (insError) {
            log(`   ❌ FAIL TO INSERT NEW ROW: ${insError.message}`);
            continue;
        }

        log(`   ✨ INSERTED NEW ROW: ID ${inserted.id}`);
        log(`      Length Verified: ${inserted.synopsis_short.length} chars`);

        // 4. MIGRATION & CLEANUP
        if (oldRows && oldRows.length > 0) {
            for (const old of oldRows) {
                if (old.id === inserted.id) continue;

                log(`   Migrating dependencies from ${old.id} to ${inserted.id} (Best Effort)`);
                
                // Migrate Source Scores
                await supabase.from('sources_scores').update({ media_item_id: inserted.id }).eq('media_item_id', old.id);
                // Migrate Favorites
                await supabase.from('user_favorites').update({ media_item_id: inserted.id }).eq('media_item_id', old.id);
                // Migrate Recs
                await supabase.from('recommendations').update({ media_item_id: inserted.id }).eq('media_item_id', old.id);

                log(`   🗑️ Deleting Old Row: ${old.title} (${old.id})`);
                const { error: delError } = await supabase
                    .from('media_items')
                    .delete()
                    .eq('id', old.id);

                if (delError) {
                    log(`      ❌ Delete Failed: ${delError.message}`);
                } else {
                    log(`      ✅ Deleted.`);
                }
            }
        }
    }

    return new Response(JSON.stringify({ success: true, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
    });
  }
});
