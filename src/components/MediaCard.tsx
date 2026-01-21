import React, { useState } from 'react';
import { Star, Calendar, Info, Heart } from 'lucide-react';

interface MediaCardProps {
    id: string;
    title: string;
    year: number;
    genres: string[];
    posterUrl?: string;
    score: number;
    synopsis?: string;
    recommendationReason?: string;
    type: 'movie' | 'series';
    isFavorite?: boolean;
    onToggleFavorite?: (id: string) => void;
    onClick?: (id: string) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
    id,
    title,
    year,
    genres,
    posterUrl,
    score,
    synopsis,
    recommendationReason,
    type,
    isFavorite = false,
    onToggleFavorite,
    onClick
}) => {
    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onToggleFavorite) onToggleFavorite(id);
    };

    return (
        <div
            onClick={() => onClick?.(id)}
            className="glass-card group hover:scale-[1.02] transition-all duration-300 relative cursor-pointer"
        >
            <div className="relative aspect-[2/3] overflow-hidden">
                {posterUrl ? (
                    <img
                        src={posterUrl}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full bg-secondary/50 flex flex-col items-center justify-center text-foreground/10 gap-2">
                        <Info size={40} />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Sin Póster</span>
                    </div>
                )}

                {/* Rating Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 shadow-xl">
                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-bold">{score.toFixed(1)}</span>
                </div>

                {/* Favorite Button */}
                <button
                    onClick={handleFavoriteClick}
                    className={`absolute top-3 right-3 p-2 rounded-lg backdrop-blur-md border transition-all z-10 ${isFavorite
                            ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                            : 'bg-black/40 border-white/10 text-white hover:bg-black/60'
                        }`}
                >
                    <Heart size={16} className={isFavorite ? 'fill-current' : ''} />
                </button>

                {/* Hover info overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-5">
                    <p className="text-xs line-clamp-4 mb-3 text-foreground/90 font-medium leading-relaxed">
                        {synopsis || 'Sin sinopsis disponible en este momento. Este título ha sido seleccionado por su impacto en la comunidad.'}
                    </p>
                    {recommendationReason && (
                        <div className="bg-primary/20 border border-primary/30 p-3 rounded-xl">
                            <p className="text-[10px] leading-tight text-white font-medium">{recommendationReason}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-5">
                <div className="mb-2">
                    <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors truncate mb-1">
                        {title}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-foreground/30 uppercase tracking-tighter">
                        <Calendar size={12} className="opacity-50" /> {year}
                        <span className="w-1 h-1 bg-foreground/10 rounded-full" />
                        <span>{type === 'movie' ? 'Película' : 'Serie'}</span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {genres.slice(0, 2).map(genre => (
                        <span key={genre} className="text-[9px] px-2 py-1 bg-white/5 rounded border border-white/5 font-bold uppercase tracking-tighter text-foreground/60">
                            {genre}
                        </span>
                    ))}
                    {genres.length > 2 && (
                        <span className="text-[9px] px-2 py-1 text-foreground/20 font-bold">+{genres.length - 2}</span>
                    )}
                </div>
            </div>
        </div>
    );
};
