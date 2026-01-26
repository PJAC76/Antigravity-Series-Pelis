import { getSupabaseClient } from '../_shared/db.ts';
import { corsHeaders } from '../_shared/cors.ts';

const TMDB_API_KEY = '92393fc7fd8b4372108ffc37ea213f2f';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = getSupabaseClient();
        // Fetch a batch of items to check for repairs
        // We limit to 100 to avoid memory issues, and then filter in JS
        const { data: allItems, error } = await supabase
            .from('media_items')
            .select('id, title, year, type, poster_url, synopsis_short')
            .order('created_at', { ascending: false })
            .limit(10); // Reduced limit for safety

        if (error) throw error;

        // TARGETED REPAIR FOR "The Last of Us" and "Spider-Man"
        // We do this explicitly to ensure they are fixed despite batch logic
        const targets = ['The Last of Us', 'Spider-Man: Across the Spider-Verse'];
        
        for (const title of targets) {
             const { data: specificItems } = await supabase
                .from('media_items')
                .select('*')
                .ilike('title', `%${title}%`);
                
             if (specificItems && specificItems.length > 0) {
                 for (const targetItem of specificItems) {
                     console.log(`🎯 Force Repairing: ${targetItem.title} (${targetItem.id})`);
                     
                     // Get TMDB Data
                     const mediaType = targetItem.type === 'series' ? 'tv' : 'movie';
                     const searchUrl = `${TMDB_BASE_URL}/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(targetItem.title)}&language=es-ES`;
                     const resp = await fetch(searchUrl);
                     const data = await resp.json();
                     
                     if (data.results?.[0]?.overview) {
                         const overview = data.results[0].overview;
                         console.log(`   Found TMDB Overview: ${overview.length} chars`);
                         
                         const { error: upErr } = await supabase
                            .from('media_items')
                            .update({ synopsis_short: overview })
                            .eq('id', targetItem.id);
                            
                         if (upErr) console.error(`   ❌ DB Update Failed: ${upErr.message}`);
                         else console.log(`   ✅ DB Update Success`);
                     }
                 }
             }
        }
        
        // Resume normal batch processing...

        // Filter: Detect items with missing or suspiciously short synopses
        // UPDATED: Now we consider synopses with exactly 200 chars as truncated
        // as well as anything shorter than 300 chars (to catch edge cases)
        const items = allItems.filter((item: any) => 
            !item.synopsis_short || 
            item.synopsis_short.length === 200 ||  // Exactly 200 = likely truncated
            item.synopsis_short.length < 300       // Less than 300 = potentially incomplete
        ).slice(0, 25); // Process 25 at a time to prevent Edge Function timeout

        console.log(`Found ${items?.length || 0} items needing repair in this batch`);

        let updated = 0;
        let failed = 0;

        for (const item of items) {
            try {
                // Determine search endpoint (movie or tv)
                const mediaType = item.type === 'series' ? 'tv' : 'movie';
                
                // Search TMDB
                const searchUrl = `${TMDB_BASE_URL}/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(item.title)}&year=${item.year}&language=es-ES`;
                
                const response = await fetch(searchUrl);
                if (!response.ok) {
                    console.warn(`TMDB search failed for ${item.title}`);
                    failed++;
                    continue;
                }

                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    const result = data.results[0];
                    const posterPath = result.poster_path;
                    const tmdbId = result.id;
                    const overview = result.overview;
                    
                    // Skip if still no overview available from TMDB
                    if (!overview || overview.trim().length === 0) {
                        console.warn(`No overview available from TMDB for ${item.title}`);
                        failed++;
                        continue;
                    }
                    
                    // Fetch Watch Providers
                    let providersData = null;
                    try {
                        const providersUrl = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`;
                        const providersResponse = await fetch(providersUrl);
                        if (providersResponse.ok) {
                            const pData = await providersResponse.json();
                            const esProviders = pData.results?.ES?.flatrate; // Spain/Flatrate
                            if (esProviders) {
                                providersData = esProviders.map((p: any) => ({
                                    id: p.provider_id,
                                    name: p.provider_name,
                                    logo_path: `${TMDB_IMAGE_BASE}${p.logo_path}`
                                }));
                            }
                        }
                    } catch (provErr) {
                         console.warn(`Failed to fetch providers for ${item.title}`);
                    }

                    const posterUrl = posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : item.poster_url;
                    
                    // Update the media item with full synopsis, poster AND providers
                    const { error: updateError } = await supabase
                        .from('media_items')
                        .update({ 
                            poster_url: posterUrl,
                            synopsis_short: overview,  // Full overview from TMDB
                            providers: providersData
                        })
                        .eq('id', item.id);

                    if (!updateError) {
                        updated++;
                        console.log(`✅ Updated ${item.title} (synopsis: ${overview.length} chars)`);
                    } else {
                        console.error(`❌ Update error for ${item.title}:`, updateError);
                        failed++;
                    }
                } else {
                    console.warn(`No TMDB results for ${item.title}`);
                    failed++;
                }
                
                // Small delay to respect rate limits
                await new Promise(r => setTimeout(r, 100));
                
            } catch (itemError) {
                console.error(`Error processing ${item.title}:`, itemError);
                failed++;
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            processed: items?.length || 0,
            updated,
            failed,
            message: `Successfully updated ${updated} items, ${failed} failed`
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("Fatal error:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), { 
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }
});
