import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { MediaCard } from '../components/MediaCard';
import { mediaService } from '../services/mediaService';
import { supabase } from '../lib/supabase';
import { Heart, Loader2, Film, Tv, Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FavoritesPage = () => {
    const navigate = useNavigate();
    const [favorites, setFavorites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    
    // Add media states
    const [showAddForm, setShowAddForm] = useState(false);
    const [addType, setAddType] = useState<'movie' | 'series' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [yearInput, setYearInput] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [addMessage, setAddMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

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

    const handleAddMedia = async () => {
        if (!user || !addType || !searchQuery.trim()) return;
        
        setIsAdding(true);
        setAddMessage(null);
        
        try {
            const { data, error } = await supabase.functions.invoke('search-and-add-media', {
                body: { 
                    title: searchQuery.trim(), 
                    type: addType,
                    year: yearInput ? parseInt(yearInput) : undefined
                }
            });
            
            if (error) throw error;
            
            if (data.error) {
                setAddMessage({ type: 'error', text: data.error });
            } else {
                // Auto-add to favorites
                await mediaService.toggleFavorite(user.id, data.mediaItemId);
                
                // Refresh favorites
                const updatedFavorites = await mediaService.getUserFavorites(user.id);
                setFavorites(updatedFavorites || []);
                
                setAddMessage({ type: 'success', text: data.message });
                setSearchQuery('');
                setYearInput('');
                setAddType(null);
                
                // Auto-close after 2 seconds
                setTimeout(() => {
                    setShowAddForm(false);
                    setAddMessage(null);
                }, 2000);
            }
        } catch (err: any) {
            console.error('Error adding media:', err);
            setAddMessage({ type: 'error', text: err.message || 'Error al procesar la solicitud' });
        } finally {
            setIsAdding(false);
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
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-500/10 rounded-2xl text-red-500">
                            <Heart size={32} fill="currentColor" />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black tracking-tight">Mis Favoritas</h2>
                            <p className="text-foreground/50">Tu selección personal mejor valorada</p>
                        </div>
                    </div>
                    
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-all font-bold"
                    >
                        <Plus size={20} />
                        Añadir Favorito
                    </button>
                </div>

                {/* Add Media Form */}
                {showAddForm && (
                    <div className="glass-card p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black">Buscar y Añadir</h3>
                            <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-white/5 rounded-lg transition-colors" title="Cerrar">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Type Selector */}
                        <div className="flex gap-4">
                            <button
                                onClick={() => setAddType('movie')}
                                className={`flex-1 py-4 px-6 rounded-xl border-2 transition-all font-bold ${
                                    addType === 'movie'
                                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                        : 'border-white/5 bg-secondary/20 text-foreground/40 hover:text-white'
                                }`}
                            >
                                <Film className="inline mr-2" size={20} />
                                Película
                            </button>
                            <button
                                onClick={() => setAddType('series')}
                                className={`flex-1 py-4 px-6 rounded-xl border-2 transition-all font-bold ${
                                    addType === 'series'
                                        ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                                        : 'border-white/5 bg-secondary/20 text-foreground/40 hover:text-white'
                                }`}
                            >
                                <Tv className="inline mr-2" size={20} />
                                Serie
                            </button>
                        </div>

                        {/* Search Input */}
                        {addType && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddMedia()}
                                        placeholder={`Escribe el nombre en español o inglés...`}
                                        className="w-full px-5 py-4 bg-secondary/50 border border-white/10 rounded-xl text-white placeholder:text-foreground/30 focus:outline-none focus:border-primary/50"
                                        disabled={isAdding}
                                    />
                                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/30" size={20} />
                                </div>

                                <input
                                    type="number"
                                    value={yearInput}
                                    onChange={(e) => setYearInput(e.target.value)}
                                    placeholder="Año (opcional)"
                                    className="w-full px-5 py-3 bg-secondary/50 border border-white/10 rounded-xl text-white placeholder:text-foreground/30 focus:outline-none focus:border-primary/50 text-sm"
                                    disabled={isAdding}
                                    min="1900"
                                    max={new Date().getFullYear() + 2}
                                />

                                <button
                                    onClick={handleAddMedia}
                                    disabled={!searchQuery.trim() || isAdding}
                                    className="w-full py-4 px-6 rounded-xl bg-primary text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/80 transition-all flex items-center justify-center gap-2"
                                >
                                    {isAdding ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            Buscando...
                                        </>
                                    ) : (
                                        <>
                                            <Search size={20} />
                                            Buscar y Añadir
                                        </>
                                    )}
                                </button>

                                {/* Message */}
                                {addMessage && (
                                    <div className={`p-4 rounded-xl border ${
                                        addMessage.type === 'success'
                                            ? 'bg-green-500/10 border-green-500/30 text-green-500'
                                            : 'bg-red-500/10 border-red-500/30 text-red-500'
                                    }`}>
                                        {addMessage.text}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

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
