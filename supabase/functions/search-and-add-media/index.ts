import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const TMDB_API_KEY = '92393fc7fd8b4372108ffc37ea213f2f';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Helper function to fetch data from TMDB
async function fetchFromTMDB(title: string, type: string, year?: number) {
    try {
        const mediaType = type === 'series' ? 'tv' : 'movie';
        let searchUrl = `${TMDB_BASE_URL}/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=es-ES`;
        
        // Add year if provided
        if (year) {
            searchUrl += `&year=${year}`;
        }
        
        console.log(`[TMDB] Searching: ${title} (${mediaType})`);
        
        const response = await fetch(searchUrl);
        if (!response.ok) {
            console.warn(`[TMDB] Search failed with status ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            console.warn(`[TMDB] No results found for ${title}`);
            return null;
        }
        
        const result = data.results[0];
        console.log(`[TMDB] Found: ${result.title || result.name}`);
        
        // Extract genres (map genre_ids to names if needed, or just store IDs)
        const genreIds = result.genre_ids || [];
        
        return {
            poster: result.poster_path ? `${TMDB_IMAGE_BASE}${result.poster_path}` : null,
            synopsis: result.overview || '',
            genres: genreIds, // We could map these to names, but for now store IDs
            tmdb_id: result.id
        };
    } catch (error) {
        console.error('[TMDB] Fetch error:', error);
        return null;
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { title, type, year } = await req.json();

        if (!title || !type) {
            return new Response(JSON.stringify({ error: 'Missing title or type' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[Search & Add] Adding: ${title} (${type})`);

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Use provided year or current year
        const mediaYear = year || new Date().getFullYear();

        // Check if media already exists
        const { data: existingMedia } = await supabase
            .from('media_items')
            .select('id, title')
            .eq('title', title)
            .eq('year', mediaYear)
            .maybeSingle();

        let mediaItemId: string;
        let message: string;
        let wasCreated = false;

        if (existingMedia) {
            mediaItemId = existingMedia.id;
            message = `"${title}" ya existe en la base de datos.`;
            console.log(`[DB] Media already exists: ${mediaItemId}`);
        } else {
            // Create new media item with basic info
            const { data: newMedia, error: insertError } = await supabase
                .from('media_items')
                .insert({
                    title,
                    year: mediaYear,
                    type,
                    genres: ['Pendiente'],
                    synopsis_short: 'Esperando actualización automática de datos.',
                })
                .select('id')
                .single();

            if (insertError) throw insertError;
            mediaItemId = newMedia.id;
            wasCreated = true;
            console.log(`[DB] Created new media: ${mediaItemId}`);
            
            // Fetch from TMDB to enrich the data
            console.log(`[TMDB] Fetching data for: ${title}`);
            const tmdbData = await fetchFromTMDB(title, type, year);
            
            if (tmdbData && (tmdbData.poster || tmdbData.synopsis)) {
                // Update the entry with TMDB data
                const updatePayload: any = {};
                
                if (tmdbData.poster) {
                    updatePayload.poster_url = tmdbData.poster;
                }
                
                if (tmdbData.synopsis) {
                    updatePayload.synopsis_short = tmdbData.synopsis;
                }
                
                if (tmdbData.genres && tmdbData.genres.length > 0) {
                    // For now, just store genre IDs as strings
                    // You could map these to genre names later
                    updatePayload.genres = tmdbData.genres.map((id: number) => id.toString());
                }
                
                const { error: updateError } = await supabase
                    .from('media_items')
                    .update(updatePayload)
                    .eq('id', mediaItemId);
                
                if (updateError) {
                    console.error(`[DB] Update error:`, updateError);
                    message = `"${title}" ha sido añadida con datos básicos. Los datos se completarán en la próxima actualización automática.`;
                } else {
                    console.log(`[DB] Updated with TMDB data`);
                    message = `"${title}" ha sido añadida con éxito. ✨`;
                }
            } else {
                console.log(`[TMDB] No data found, keeping placeholders`);
                message = `"${title}" ha sido añadida. Los datos se completarán en la próxima actualización automática.`;
            }
        }

        console.log(`[Success] Processed: ${title} (${mediaItemId})`);

        return new Response(JSON.stringify({
            success: true,
            mediaItemId,
            title,
            year: mediaYear,
            message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Search & Add Error]:', error);
        return new Response(JSON.stringify({ 
            success: false,
            error: error?.message || 'Error al procesar la solicitud'
        }), {
            status: 200, // Return 200 so client can read the error message
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
