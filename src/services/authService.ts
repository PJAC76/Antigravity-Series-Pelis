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
