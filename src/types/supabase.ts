export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    email: string
                    role: 'user' | 'admin'
                    created_at: string
                }
                Insert: {
                    id: string
                    email: string
                    role?: 'user' | 'admin'
                    created_at?: string
                }
                Update: {
                    id?: string
                    email?: string
                    role?: 'user' | 'admin'
                    created_at?: string
                }
            }
            media_items: {
                Row: {
                    id: string
                    type: 'movie' | 'series'
                    title: string
                    year: number
                    genres: string[]
                    poster_url: string | null
                    synopsis_short: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    type: 'movie' | 'series'
                    title: string
                    year: number
                    genres?: string[]
                    poster_url?: string | null
                    synopsis_short?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    type?: 'movie' | 'series'
                    title?: string
                    year?: number
                    genres?: string[]
                    poster_url?: string | null
                    synopsis_short?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            sources_scores: {
                Row: {
                    id: string
                    media_item_id: string
                    source: 'forocoches' | 'filmaffinity' | 'reddit'
                    score_normalized: number
                    votes_count: number
                    scraped_at: string
                }
                Insert: {
                    id?: string
                    media_item_id: string
                    source: 'forocoches' | 'filmaffinity' | 'reddit'
                    score_normalized: number
                    votes_count?: number
                    scraped_at?: string
                }
                Update: {
                    id?: string
                    media_item_id?: string
                    source?: 'forocoches' | 'filmaffinity' | 'reddit'
                    score_normalized?: number
                    votes_count?: number
                    scraped_at?: string
                }
            }
            aggregated_scores: {
                Row: {
                    media_item_id: string
                    final_score: number
                    ranking_type: 'historical' | 'recent'
                    updated_at: string
                }
                Insert: {
                    media_item_id: string
                    final_score: number
                    ranking_type: 'historical' | 'recent'
                    updated_at?: string
                }
                Update: {
                    media_item_id?: string
                    final_score?: number
                    ranking_type?: 'historical' | 'recent'
                    updated_at?: string
                }
            }
            user_favorites: {
                Row: {
                    user_id: string
                    media_item_id: string
                    created_at: string
                }
                Insert: {
                    user_id: string
                    media_item_id: string
                    created_at?: string
                }
                Update: {
                    user_id?: string
                    media_item_id?: string
                    created_at?: string
                }
            }
            recommendations: {
                Row: {
                    id: string
                    user_id: string
                    media_item_id: string
                    reason_text: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    media_item_id: string
                    reason_text: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    media_item_id?: string
                    reason_text?: string
                    created_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
