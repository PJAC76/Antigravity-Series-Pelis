import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { MediaCard } from '../components/MediaCard';
import { mediaService } from '../services/mediaService';
import { supabase } from '../lib/supabase';
import { Heart, Loader2, Film, Tv } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FavoritesPage = () => {
    const navigate = useNavigate();
    const [favorites, setFavorites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });
    }, []);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        const fetchFavorites = async () => {
            setLoading(true);
            try {
                const data = await mediaService.getUserFavorites(user.id);
                setFavorites(data || []);
            } catch (err) {
                console.error("Error fetching favorites:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchFavorites();
    }, [user]);

    // Separate movies and series
    const favoriteMovies = favorites.filter(f => f.type === 'movie');
    const favoriteSeries = favorites.filter(f => f.type === 'series');

    const handleToggleFavorite = async (id: string) => {
        if (!user) return;
        try {
            await mediaService.toggleFavorite(user.id, id);
            // Remove from local state immediately
            setFavorites(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            console.error("Error toggling favorite:", err);
        }
    };

    const renderMediaGrid = (items: any[], emptyMessage: string) => {
        if (items.length === 0) {
            return (
                <div className="text-center py-12 bg-secondary/10 rounded-2xl border border-dashed border-white/5">
                    <p className="text-foreground/40 text-sm">{emptyMessage}</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {items.map((item) => (
                    <MediaCard
                        key={item.id}
                        id={item.id}
                        title={item.title}
                        year={item.year}
                        genres={item.genres || []}
                        score={item.aggregated_scores?.final_score || 0}
                        type={item.type}
                        synopsis={item.synopsis_short}
                        posterUrl={item.poster_url}
                        isFavorite={true}
                        onToggleFavorite={handleToggleFavorite}
                        onClick={(id) => navigate(`/detail/${id}`)}
                    />
                ))}
            </div>
        );
    };

    if (!user && !loading) return (
        <Layout>
            <div className="text-center py-32 space-y-6">
                <div className="inline-flex p-6 bg-secondary/50 rounded-full text-foreground/20">
                    <Heart size={48} />
                </div>
                <h2 className="text-3xl font-black tracking-tight">Inicia sesión para ver tus favoritas</h2>
                <p className="text-foreground/40 max-w-sm mx-auto">
                    Crea una cuenta para guardar películas y series y recibir recomendaciones personalizadas.
                </p>
            </div>
        </Layout>
    );

    return (
        <Layout>
            <div className="space-y-12">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-2xl text-red-500">
                        <Heart size={32} fill="currentColor" />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black tracking-tight">Mis Favoritas</h2>
                        <p className="text-foreground/50">Tu selección personal mejor valorada</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="animate-spin text-primary" size={48} />
                    </div>
                ) : favorites.length === 0 ? (
                    <div className="text-center py-32 bg-secondary/10 rounded-[2rem] border-2 border-dashed border-white/5">
                        <p className="text-xl font-medium text-foreground/40 italic">Aún no has guardado favoritos.</p>
                        <button onClick={() => navigate('/')} className="mt-6 primary-gradient px-8 py-3 rounded-xl font-bold text-white shadow-xl shadow-primary/20 hover:scale-105 transition-all">
                            Explorar Ranking
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Movies Section */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-blue-500/10 rounded-xl">
                                    <Film className="text-blue-500" size={20} />
                                </div>
                                <h3 className="text-xl font-bold text-white">Películas Favoritas</h3>
                                {favoriteMovies.length > 0 && (
                                    <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                                        {favoriteMovies.length}
                                    </span>
                                )}
                            </div>
                            {renderMediaGrid(favoriteMovies, "No tienes películas en favoritos.")}
                        </section>

                        {/* Series Section */}
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-purple-500/10 rounded-xl">
                                    <Tv className="text-purple-500" size={20} />
                                </div>
                                <h3 className="text-xl font-bold text-white">Series Favoritas</h3>
                                {favoriteSeries.length > 0 && (
                                    <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full font-bold">
                                        {favoriteSeries.length}
                                    </span>
                                )}
                            </div>
                            {renderMediaGrid(favoriteSeries, "No tienes series en favoritos.")}
                        </section>
                    </>
                )}
            </div>
        </Layout>
    );
};
