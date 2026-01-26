import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check for Service Role Key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    // Connect directly to Postgres via Supabase RPC if available, or try standard client
    // Since we can't run RAW SQL via the JS Client easily without an RPC function,
    // we have to check if there's a stored procedure or if we can use the 'postgres' meta-connection?
    // Actually, Supabase JS client doesn't support raw SQL unless via RPC.
    
    // HOWEVER, we can query `information_schema` via the standard client!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 1. Check Column Type
    const { data: columns, error: colError } = await supabase
      .from('media_items')
      .select('synopsis_short')
      .limit(1);

      // Wait, standard select doesn't give metadata. 
      // Querying actual pg_catalog tables via PostgREST is usually blocked.
      
      // Let's assume the issue is a TRIGGER.
      // If we can't execute SQL, we are stuck IF the issue is DB-level.
      
      // BUT, maybe the issue is simpler?
      // Check if `synopsis_short` is literally defined as VARCHAR(200)?
      // The local schema says `text`.
      
      // Let's try to update ONE item using the Service Role Key from here to prove
      // if it's an RLS issue or a DB Constraint issue.
      // The Service Role BYPASSES RLS.
      // If it still truncates with Service Role, it is absolutely a DB Trigger or Constraint.

    const testId = 'b02a7fec-42d3-4b9d-934d-18142315ebf1'; // Spider-Man id
    const longText = "DEBUG_" + "X".repeat(500);

    const { error: updateError } = await supabase
        .from('media_items')
        .update({ synopsis_short: longText })
        .eq('id', testId);

    if (updateError) throw updateError;

    // Read back
    const { data: readBack } = await supabase
        .from('media_items')
        .select('synopsis_short')
        .eq('id', testId)
        .single();

    const isTruncated = readBack.synopsis_short.length <= 210; // Allow 210 for prefix

    return new Response(JSON.stringify({ 
      success: true,
      message: isTruncated ? "TRUNCATION PERSISTS (DB CONSTRAINT/TRIGGER CONFIRMED)" : "NO TRUNCATION (IT WAS AN RLS ISSUE)",
      length: readBack.synopsis_short.length,
      val: readBack.synopsis_short.substring(0, 20) + "..."
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
