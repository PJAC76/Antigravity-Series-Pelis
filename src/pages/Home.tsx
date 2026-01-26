import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { MediaCard } from '../components/MediaCard';
import { GenreFilter } from '../components/GenreFilter';
import { mediaService } from '../services/mediaService';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Film, Tv } from 'lucide-react';

export const Home = () => {
    const navigate = useNavigate();
    const [rankingType, setRankingType] = useState<'historical' | 'recent'>(() => {
        return (localStorage.getItem('rankingType') as 'historical' | 'recent') || 'recent';
    });
    const [selectedGenres, setSelectedGenres] = useState<string[]>(() => {
        const saved = localStorage.getItem('selectedGenres');
        return saved ? JSON.parse(saved) : [];
    });
    const [movies, setMovies] = useState<any[]>([]);
    const [series, setSeries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchFavorites = async () => {
        if (!user) return;
        try {
            const favs = await mediaService.getUserFavorites(user.id);
            setFavoriteIds(favs.map(f => f.id));
        } catch (err) {
            console.error("Error fetching favorites:", err);
        }
    };

    useEffect(() => {
        fetchFavorites();
    }, [user]);

    useEffect(() => {
        const fetchRankings = async () => {
            setLoading(true);
            try {
                // Save to localStorage
                localStorage.setItem('rankingType', rankingType);
                localStorage.setItem('selectedGenres', JSON.stringify(selectedGenres));

                const data = await mediaService.getTopRankings(rankingType, selectedGenres);
                // Separate movies and series
                const movieItems = (data || []).filter((r: any) => r.media_items.type === 'movie');
                const seriesItems = (data || []).filter((r: any) => r.media_items.type === 'series');
                setMovies(movieItems);
                setSeries(seriesItems);
            } catch (err) {
                console.error("Error fetching rankings:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchRankings();
    }, [rankingType, selectedGenres]);

    const toggleGenre = (genre: string | string[]) => {
        const genresToToggle = Array.isArray(genre) ? genre : [genre];
        
        setSelectedGenres(prev => {
            // Logic: If ANY of the input genres are currently selected, we assume the user wants to specificially Deselect that group.
            // (Matches the UI logic where the button appears active)
            const isAnySelected = genresToToggle.some(g => prev.includes(g));
            
            if (isAnySelected) {
                // Remove ALL associated values from selection
                return prev.filter(g => !genresToToggle.includes(g));
            } else {
                // Add ALL associated values
                return [...prev, ...genresToToggle];
            }
        });
    };

    const handleToggleFavorite = async (id: string) => {
        if (!user) {
            alert("Por favor, inicia sesión para guardar favoritas.");
            return;
        }
        try {
            const isAdded = await mediaService.toggleFavorite(user.id, id);
            setFavoriteIds(prev => 
                isAdded ? [...prev, id] : prev.filter(favId => favId !== id)
            );
        } catch (err) {
            console.error("Error toggling favorite:", err);
        }
    };

    const renderMediaGrid = (items: any[], emptyMessage: string) => {
        if (loading) {
            return (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 animate-pulse">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="aspect-[2/3] bg-secondary/30 rounded-2xl" />
                    ))}
                </div>
            );
        }

        if (items.length === 0) {
            return (
                <div className="text-center py-12 bg-secondary/10 rounded-2xl border border-dashed border-white/5">
                    <p className="text-foreground/40">{emptyMessage}</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {items.map((rank) => (
                    <MediaCard
                        key={rank.media_items.id}
                        id={rank.media_items.id}
                        title={rank.media_items.title}
                        year={rank.media_items.year}
                        genres={rank.media_items.genres || []}
                        score={rank.final_score}
                        type={rank.media_items.type}
                        synopsis={rank.media_items.synopsis_short}
                        posterUrl={rank.media_items.poster_url}
                        isFavorite={favoriteIds.includes(rank.media_items.id)}
                        onToggleFavorite={handleToggleFavorite}
                        onClick={(id) => navigate(`/detail/${id}`)}
                    />
                ))}
            </div>
        );
    };

    return (
        <Layout>
            <div className="space-y-10">
                {/* Header */}
                <section>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight mb-2 text-white">Rankings Premium</h1>
                            <p className="text-foreground/50">La selección definitiva de Forocoches, FilmAffinity y Reddit.</p>
                        </div>

                        <div className="flex gap-2 p-1.5 bg-secondary/50 rounded-2xl border border-white/5 backdrop-blur-sm self-start md:self-center">
                            <button
                                onClick={() => setRankingType('recent')}
                                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${rankingType === 'recent' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-foreground/60 hover:text-white'}`}
                            >
                                Último Año
                            </button>
                            <button
                                onClick={() => setRankingType('historical')}
                                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${rankingType === 'historical' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-foreground/60 hover:text-white'}`}
                            >
                                Histórico
                            </button>
                        </div>
                    </div>

                    <GenreFilter
                        selectedGenres={selectedGenres}
                        onToggleGenre={toggleGenre}
                    />
                </section>

                {/* Movies Section */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-500/10 rounded-xl">
                            <Film className="text-blue-500" size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Películas</h2>
                            <p className="text-xs text-foreground/40 uppercase tracking-widest">Top {rankingType === 'recent' ? 'del último año' : 'histórico'}</p>
                        </div>
                        {movies.length > 0 && (
                            <span className="ml-auto text-sm bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full font-bold">
                                {movies.length} títulos
                            </span>
                        )}
                    </div>
                    {renderMediaGrid(movies, "No hay películas que coincidan con tus filtros.")}
                </section>

                {/* Series Section */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-purple-500/10 rounded-xl">
                            <Tv className="text-purple-500" size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Series</h2>
                            <p className="text-xs text-foreground/40 uppercase tracking-widest">Top {rankingType === 'recent' ? 'del último año' : 'histórico'}</p>
                        </div>
                        {series.length > 0 && (
                            <span className="ml-auto text-sm bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full font-bold">
                                {series.length} títulos
                            </span>
                        )}
                    </div>
                    {renderMediaGrid(series, "No hay series que coincidan con tus filtros.")}
                </section>

                {/* Clear filters */}
                {selectedGenres.length > 0 && (movies.length === 0 && series.length === 0) && (
                    <div className="text-center">
                        <button
                            onClick={() => setSelectedGenres([])}
                            className="text-primary font-bold hover:underline"
                        >
                            Limpiar todos los filtros
                        </button>
                    </div>
                )}
            </div>
        </Layout>
    );
};
