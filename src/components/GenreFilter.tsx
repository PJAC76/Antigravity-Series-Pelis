import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface GenreFilterProps {
    selectedGenres: string[];
    onToggleGenre: (genre: string) => void;
}

export const GenreFilter: React.FC<GenreFilterProps> = ({ selectedGenres, onToggleGenre }) => {
    const [genres, setGenres] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGenres = async () => {
            try {
                // Fetch all unique genres from media_items
                const { data, error } = await supabase
                    .from('media_items')
                    .select('genres');

                if (error) throw error;

                // Extract and deduplicate genres
                const allGenres = new Set<string>();
                data?.forEach((item: any) => {
                    item.genres?.forEach((g: string) => allGenres.add(g));
                });

                // Sort alphabetically
                setGenres([...allGenres].sort());
            } catch (err) {
                console.error("Error fetching genres:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchGenres();
    }, []);

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

    if (genres.length === 0) {
        return null; // No genres available
    }

    return (
        <div className="flex flex-wrap gap-2 py-4 border-t border-b border-white/5 my-6">
            <span className="text-xs font-bold text-foreground/40 uppercase tracking-widest w-full mb-2">Filtrar por Género</span>
            {genres.map((genre) => {
                const isActive = selectedGenres.includes(genre);
                return (
                    <button
                        key={genre}
                        onClick={() => onToggleGenre(genre)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isActive
                                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                                : 'bg-secondary/50 border-white/5 text-foreground/60 hover:border-white/20'
                            }`}
                    >
                        {genre}
                    </button>
                );
            })}
            {selectedGenres.length > 0 && (
                <button
                    onClick={() => selectedGenres.forEach(g => onToggleGenre(g))}
                    className="px-3 py-1.5 rounded-full text-xs font-medium text-primary hover:underline ml-auto"
                >
                    Limpiar filtros
                </button>
            )}
        </div>
    );
};
