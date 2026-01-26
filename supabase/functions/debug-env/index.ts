
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const envVars = Deno.env.toObject();
  const keys = Object.keys(envVars);

  return new Response(JSON.stringify({ 
      keys,
      hasServiceKey: keys.includes('SUPABASE_SERVICE_ROLE_KEY'),
      hasUrl: keys.includes('SUPABASE_URL')
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
