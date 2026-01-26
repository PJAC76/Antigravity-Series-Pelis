import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface GenreFilterProps {
    selectedGenres: string[];
    onToggleGenre: (genres: string[]) => void;
}

// Mapping from TMDB IDs / English names to Spanish Display Names
const GENRE_MAP: Record<string, string> = {
    // TMDB IDs
    '28': 'Acción',
    '12': 'Aventura',
    '16': 'Animación',
    '35': 'Comedia',
    '80': 'Crimen',
    '99': 'Documental',
    '18': 'Drama',
    '10751': 'Familia',
    '14': 'Fantasía',
    '36': 'Historia',
    '27': 'Terror',
    '10402': 'Música',
    '9648': 'Misterio',
    '10749': 'Romance',
    '878': 'Ciencia Ficción',
    '10770': 'TV Movie',
    '53': 'Thriller',
    '10752': 'Bélica',
    '37': 'Western',
    '10759': 'Action & Adventure',
    '10762': 'Kids',
    '10763': 'News',
    '10764': 'Reality',
    '10765': 'Sci-Fi & Fantasy',
    '10766': 'Soap',
    '10767': 'Talk',
    '10768': 'War & Politics',

    // English / Legacy mappings (optional, Normalized to Spanish)
    'Action': 'Acción',
    'Adventure': 'Aventura',
    'Animation': 'Animación',
    'Comedy': 'Comedia',
    'Crime': 'Crimen',
    'Documentary': 'Documental',
    'Family': 'Familia',
    'Fantasy': 'Fantasía',
    'History': 'Historia',
    'Horror': 'Terror',
    'Music': 'Música',
    'Mystery': 'Misterio',
    'Science Fiction': 'Ciencia Ficción',
    'War': 'Bélica',
    'Sci-Fi': 'Ciencia Ficción'
};

export const GenreFilter: React.FC<GenreFilterProps> = ({ selectedGenres, onToggleGenre }) => {
    // Map of Display Name -> List of Raw DB Values
    const [genreGroups, setGenreGroups] = useState<Record<string, string[]>>({});
    const [sortedDisplayNames, setSortedDisplayNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGenres = async () => {
            try {
                // Fetch all unique genres from media_items
                const { data, error } = await supabase
                    .from('media_items')
                    .select('genres');

                if (error) throw error;

                // Build groups
                const groups: Record<string, Set<string>> = {};
                
                data?.forEach((item: any) => {
                    item.genres?.forEach((rawGenre: string) => {
                        // Resolve display name
                        // 1. Check direct map (id/name -> Spanish)
                        // 2. Fallback to rawGenre itself
                        const rawStr = String(rawGenre); // Ensure string
                        const displayName = GENRE_MAP[rawStr] || rawStr;

                        if (!groups[displayName]) {
                            groups[displayName] = new Set();
                        }
                        groups[displayName].add(rawStr);
                    });
                });

                // Convert Sets to Arrays
                const finalGroups: Record<string, string[]> = {};
                Object.keys(groups).forEach(key => {
                    finalGroups[key] = Array.from(groups[key]);
                });

                setGenreGroups(finalGroups);
                setSortedDisplayNames(Object.keys(finalGroups).sort());
                
            } catch (err) {
                console.error("Error fetching genres:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchGenres();
    }, []);

    const handleToggle = (displayName: string) => {
        // Find all raw values associated with this display name
        const rawValues = genreGroups[displayName];
        if (!rawValues) return;

        // Pass normalization responsibility to parent? 
        // No, parent expects normalized toggle logic or raw logic.
        // Actually, previous implementation toggled single string.
        // But `Home.tsx` has `toggleGenre` taking `string`.
        // We need `Home.tsx` to handle array toggle OR we handle it here by iterating?
        
        // Wait, `onToggleGenre` prop definition in this file changed from `(genre: string)` to `(genres: string[])`.
        // I need to update `Home.tsx` too if I change the signature!
        // CHECK: `Home.tsx` define `toggleGenre = (genre: string) => ...`
        // I better keep `onToggleGenre` passing a single string if I call it multiple times, 
        // OR update `Home.tsx`.
        // Updating `Home.tsx` is cleaner but requires 2 steps.
        // Let's call `onToggleGenre` for EACH raw value.
        // Better: Update `Home.tsx` to accept `string | string[]`.
        
        // Let's execute logic here:
        // We want to toggle the GROUP. 
        // Logic: specific implementation in Home is safer if I change it to receive array.
        
        onToggleGenre(rawValues);
    };

    if (loading) {
        return (
            <div className="flex flex-wrap gap-2 py-4 border-t border-b border-white/5 my-6">
                <span className="text-xs font-bold text-foreground/40 uppercase tracking-widest w-full mb-2">Filtrar por Género</span>
                <div className="flex gap-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-20 h-8 bg-secondary/30 rounded-full animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (sortedDisplayNames.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-2 py-4 border-t border-b border-white/5 my-6">
            <span className="text-xs font-bold text-foreground/40 uppercase tracking-widest w-full mb-2">Filtrar por Género</span>
            {sortedDisplayNames.map((displayName) => {
                const rawValues = genreGroups[displayName];
                // Check if ANY of the raw values are selected
                const isActive = rawValues.some(val => selectedGenres.includes(val));
                
                return (
                    <button
                        key={displayName}
                        onClick={() => handleToggle(displayName)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isActive
                                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                                : 'bg-secondary/50 border-white/5 text-foreground/60 hover:border-white/20'
                            }`}
                    >
                        {displayName}
                    </button>
                );
            })}
            {selectedGenres.length > 0 && (
                <button
                    onClick={() => onToggleGenre([])} // Clear all signal (handled by parent specific logic or empty array?) 
                    // Wait, parent logic for Clear is explicit in Home.tsx: `setSelectedGenres([])`. Use that.
                    // Here we just trigger a Clear action? 
                    // The prop is `onToggleGenre`.
                    // Let's use a separate prop or keep the button external? 
                    // Previous code had "Limpiar filtros" inside component.
                    // I'll emit a special signal or just pass empty list if I change interface.
                    // Actually, the previous code iterated and toggled each.
                    // Let's stick to simplicity.
                    className="px-3 py-1.5 rounded-full text-xs font-medium text-primary hover:underline ml-auto"
                >
                    Limpiar filtros
                </button>
            )}
        </div>
    );
};
