import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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
            message = `"${title}" ha sido añadida. Los datos se completarán en la próxima actualización automática.`;
            console.log(`[DB] Created new media: ${mediaItemId}`);
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
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
