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
            .limit(100);

        if (error) throw error;

        // Filter: Detect items with missing or suspiciously short synopses
        // (Original truncation was often at ~200 chars or missing entirely)
        const items = allItems.filter((item: any) => 
            !item.synopsis_short || 
            item.synopsis_short.length < 600
        ).slice(0, 20); // Process only 20 at a time to prevent Edge Function timeout (10s limit)

        console.log(`Found ${items?.length || 0} items needing repair in this batch`);

        let updated = 0;

        for (const item of items) {
            try {
                // Determine search endpoint (movie or tv)
                const mediaType = item.type === 'series' ? 'tv' : 'movie';
                
                // Search TMDB
                const searchUrl = `${TMDB_BASE_URL}/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(item.title)}&year=${item.year}&language=es-ES`;
                
                const response = await fetch(searchUrl);
                if (!response.ok) {
                    console.warn(`TMDB search failed for ${item.title}`);
                    continue;
                }

                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    const result = data.results[0];
                    const posterPath = result.poster_path;
                    const tmdbId = result.id;
                    
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

                    if (posterPath || providersData) {
                        const posterUrl = posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : item.poster_url;
                        
                        // Update the media item with poster AND providers
                        const { error: updateError } = await supabase
                            .from('media_items')
                            .update({ 
                                poster_url: posterUrl,
                                synopsis_short: result.overview || null,
                                providers: providersData
                            })
                            .eq('id', item.id);

                        if (!updateError) {
                            updated++;
                            console.log(`Updated data for: ${item.title}`);
                        }
                    }
                }
                
                // Small delay to respect rate limits
                await new Promise(r => setTimeout(r, 100));
                
            } catch (itemError) {
                console.error(`Error processing ${item.title}:`, itemError);
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            processed: items?.length || 0,
            updated 
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
