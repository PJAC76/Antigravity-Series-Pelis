import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * One-shot cleanup edge function to:
 * 1. DELETE blacklisted items (el hilo de las series)
 * 2. MERGE duplicate groups (migrate scores/favorites/recs, then delete losers)
 *
 * FK relations use ON DELETE CASCADE, but we migrate first to preserve data.
 */

interface MergeGroup {
    keepId: string;
    deleteIds: string[];
    label: string;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const logs: string[] = [];
        const log = (msg: string) => { console.log(msg); logs.push(msg); };

        log('🧹 DATABASE CLEANUP — Starting...');

        // ==========================================
        // STEP 1: DELETE BLACKLISTED ITEMS
        // ==========================================
        const BLACKLIST_IDS = [
            '00d3b777-7347-48b9-a99d-a994865ca38c', // "El hilo de las SERIES - 2024"
        ];

        log('\n=== 🚫 REMOVING BLACKLISTED ITEMS ===');
        for (const id of BLACKLIST_IDS) {
            // First delete from related tables (even though CASCADE exists, be explicit)
            await supabase.from('recommendations').delete().eq('media_item_id', id);
            await supabase.from('user_favorites').delete().eq('media_item_id', id);
            await supabase.from('aggregated_scores').delete().eq('media_item_id', id);
            await supabase.from('sources_scores').delete().eq('media_item_id', id);

            const { error } = await supabase.from('media_items').delete().eq('id', id);
            if (error) log(`  ❌ Failed to delete ${id}: ${error.message}`);
            else log(`  ✅ Deleted blacklisted item: ${id}`);
        }

        // ==========================================
        // STEP 2: MERGE DUPLICATE GROUPS
        // ==========================================
        const MERGE_GROUPS: MergeGroup[] = [
            {
                label: 'El Padrino',
                keepId: 'b6653890-a320-4398-a90e-14efc7017f85',    // 1972, poster✅, 463ch synopsis, filmaffinity 9
                deleteIds: [
                    'bd9756d0-2099-4eb6-a7a4-60b6d1df80cd',        // 2026 — wrong year
                    'f3c521a1-0ac8-4404-b25e-7a596968a40c',        // 1972 — no poster, short synopsis
                ],
            },
            {
                label: 'La Sociedad de la Nieve',
                keepId: 'a1739774-7a10-44c0-bb52-e8169814f7b4',    // 2023, filmaffinity+forocoches
                deleteIds: [
                    'be77c241-4ddd-4cdb-ba05-c9357685bfc8',        // 2024, forocoches only
                ],
            },
            {
                label: 'Legitima Defensa',
                keepId: '5751048b-2ee7-41ef-90b8-e17faef76e40',    // 2025
                deleteIds: [
                    '97cb7f8f-7393-4b45-8da5-956cd9debae7',        // 2026 — duplicate
                ],
            },
            {
                label: 'Poor Things',
                keepId: '1c2bbeef-2f5c-4f8b-a617-08d480511c5d',    // 2023, filmaffinity, poster✅
                deleteIds: [
                    '31c789b7-4a09-493d-a4f1-38cea0c16c5a',        // 2024, forocoches only
                ],
            },
            {
                label: 'The Bear',
                keepId: '0c35e85a-b10e-4e35-9e0a-a3353d0fc5f4',    // 2024, 3 sources, poster✅
                deleteIds: [
                    '496260cc-631d-4740-bb25-c97b390321f3',        // 2023 — reddit only
                    '17a0cc9b-e2e7-492e-a89e-263a55930242',        // "Temporada 3" — forocoches only, no poster
                ],
            },
        ];

        log('\n=== 🔄 MERGING DUPLICATE GROUPS ===');

        for (const group of MERGE_GROUPS) {
            log(`\n📦 Processing: "${group.label}" — keep ${group.keepId}, delete ${group.deleteIds.length} dupes`);

            for (const deleteId of group.deleteIds) {
                // MIGRATE: Move scores that don't conflict (same source) to the keeper
                const { data: existingScores } = await supabase
                    .from('sources_scores')
                    .select('source')
                    .eq('media_item_id', group.keepId);

                const existingSources = new Set((existingScores || []).map(s => s.source));

                const { data: staleScores } = await supabase
                    .from('sources_scores')
                    .select('id, source, score_normalized')
                    .eq('media_item_id', deleteId);

                for (const score of (staleScores || [])) {
                    if (!existingSources.has(score.source)) {
                        // Migrate this score to the keeper
                        const { error: migErr } = await supabase
                            .from('sources_scores')
                            .update({ media_item_id: group.keepId })
                            .eq('id', score.id);

                        if (migErr) log(`    ⚠️ Failed to migrate score ${score.source}: ${migErr.message}`);
                        else log(`    📊 Migrated score: ${score.source} (${score.score_normalized}) → keeper`);
                    } else {
                        log(`    ⏭️ Score ${score.source} already exists on keeper, will be cascaded`);
                    }
                }

                // MIGRATE: Move favorites pointing to the duplicate
                const { data: staleFavs } = await supabase
                    .from('user_favorites')
                    .select('user_id')
                    .eq('media_item_id', deleteId);

                for (const fav of (staleFavs || [])) {
                    // Check if user already has keeper as favorite
                    const { data: existingFav } = await supabase
                        .from('user_favorites')
                        .select('user_id')
                        .eq('user_id', fav.user_id)
                        .eq('media_item_id', group.keepId)
                        .limit(1);

                    if (!existingFav?.length) {
                        const { error: favErr } = await supabase
                            .from('user_favorites')
                            .update({ media_item_id: group.keepId })
                            .eq('user_id', fav.user_id)
                            .eq('media_item_id', deleteId);

                        if (favErr) log(`    ⚠️ Failed to migrate favorite: ${favErr.message}`);
                        else log(`    ❤️ Migrated favorite for user ${fav.user_id.slice(0,8)}...`);
                    }
                }

                // MIGRATE: Move recommendations pointing to the duplicate
                const { data: staleRecs } = await supabase
                    .from('recommendations')
                    .select('id, user_id')
                    .eq('media_item_id', deleteId);

                for (const rec of (staleRecs || [])) {
                    const { error: recErr } = await supabase
                        .from('recommendations')
                        .update({ media_item_id: group.keepId })
                        .eq('id', rec.id);

                    if (recErr) log(`    ⚠️ Failed to migrate recommendation: ${recErr.message}`);
                    else log(`    💡 Migrated recommendation ${rec.id.slice(0,8)}...`);
                }

                // DELETE the duplicate (remaining orphan data will CASCADE)
                const { error: delErr } = await supabase
                    .from('media_items')
                    .delete()
                    .eq('id', deleteId);

                if (delErr) log(`    ❌ Failed to delete ${deleteId}: ${delErr.message}`);
                else log(`    🗑️ Deleted duplicate: ${deleteId}`);
            }
        }

        // ==========================================
        // STEP 3: RECALCULATE aggregated_scores for kept items
        // ==========================================
        log('\n=== 📈 RECALCULATING AGGREGATED SCORES ===');

        const KEEP_IDS = MERGE_GROUPS.map(g => g.keepId);
        for (const keepId of KEEP_IDS) {
            const { data: scores } = await supabase
                .from('sources_scores')
                .select('score_normalized')
                .eq('media_item_id', keepId);

            if (scores && scores.length > 0) {
                const avg = scores.reduce((sum, s) => sum + Number(s.score_normalized), 0) / scores.length;
                const finalScore = Math.round(avg * 10) / 10;

                const { error: upsertErr } = await supabase
                    .from('aggregated_scores')
                    .upsert({
                        media_item_id: keepId,
                        final_score: finalScore,
                        ranking_type: 'recent',
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'media_item_id' });

                if (upsertErr) log(`  ⚠️ Failed to recalc ${keepId}: ${upsertErr.message}`);
                else log(`  ✅ ${keepId}: ${scores.length} sources → final_score = ${finalScore}`);
            }
        }

        // ==========================================
        // FINAL SUMMARY
        // ==========================================
        const { count } = await supabase.from('media_items').select('*', { count: 'exact', head: true });
        log(`\n🎉 CLEANUP COMPLETE. Remaining media items: ${count}`);

        return new Response(JSON.stringify({
            success: true,
            remaining_items: count,
            logs,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Cleanup error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
