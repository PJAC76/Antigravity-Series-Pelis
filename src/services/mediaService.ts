import { supabase } from '../lib/supabase';

export const authService = {
    // Get current session
    getSession: async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session;
    },

    // Sign out
    signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }
    // Signup and Login will be implemented with UI forms
};

export const mediaService = {
    // Fetch Top 10 rankings with optional genre filtering
    getTopRankings: async (type: 'historical' | 'recent', genres?: string[]) => {
        let query = supabase
            .from('aggregated_scores')
            .select(`
        final_score,
        ranking_type,
        media_items!inner (
          *
        )
      `)
            .eq('ranking_type', type)
            .order('final_score', { ascending: false })
            .limit(20);

        if (genres && genres.length > 0) {
            query = query.overlaps('media_items.genres', genres);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // Toggle favorite status
    toggleFavorite: async (userId: string, mediaItemId: string) => {
        const { data: existing } = await supabase
            .from('user_favorites')
            .select()
            .eq('user_id', userId)
            .eq('media_item_id', mediaItemId)
            .single();

        if (existing) {
            const { error } = await supabase
                .from('user_favorites')
                .delete()
                .eq('user_id', userId)
                .eq('media_item_id', mediaItemId);
            if (error) throw error;
            return false;
        } else {
            const { error } = await (supabase
                .from('user_favorites') as any)
                .insert({ user_id: userId, media_item_id: mediaItemId });
            if (error) throw error;
            return true;
        }
    },

    // Get user favorites
    getUserFavorites: async (userId: string) => {
        const { data, error } = await supabase
            .from('user_favorites')
            .select(`
        media_items (*)
      `)
            .eq('user_id', userId);

        if (error) throw error;
        return (data as any[]).map(f => f.media_items);
    },

    // Get details for a specific item including source scores
    getMediaItemDetails: async (id: string) => {
        const { data, error } = await supabase
            .from('media_items')
            .select(`
        *,
        sources_scores (
          source,
          score_normalized,
          votes_count
        )
      `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    // Get personalized recommendations
    getRecommendations: async (userId: string) => {
        const { data, error } = await supabase
            .from('recommendations')
            .select(`
        reason_text,
        media_items (*)
      `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Get user profile including role
    getUserProfile: async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
    }
};

export const adminService = {
    // Trigger an Edge Function
    triggerScraper: async (functionName: string) => {
        const { data, error } = await supabase.functions.invoke(functionName);
        if (error) throw error;
        return data;
    },

    // Get system stats
    getStats: async () => {
        const [mediaCount, scoresCount, usersCount] = await Promise.all([
            supabase.from('media_items').select('*', { count: 'exact', head: true }),
            supabase.from('sources_scores').select('*', { count: 'exact', head: true }),
            supabase.from('profiles').select('*', { count: 'exact', head: true })
        ]);

        return {
            media: mediaCount.count || 0,
            scores: scoresCount.count || 0,
            users: usersCount.count || 0
        };
    }
};
