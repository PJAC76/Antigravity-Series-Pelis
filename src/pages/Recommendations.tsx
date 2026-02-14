import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { mediaService } from '../services/mediaService';
import { Sparkles, Loader2, Wand2, Film, Tv } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cleanMediaList } from '../utils/deduplication';

export const RecommendationsPage = ({ userId }: { userId: string }) => {
    const navigate = useNavigate();
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const fetchRecs = async () => {
        setLoading(true);
        try {
            const data = await mediaService.getRecommendations(userId);
            setRecommendations(data || []);
        } catch (err) {
            console.error("Error fetching recommendations:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecs();
    }, [userId]);

    const handleGenerateRecommendations = async () => {
        setGenerating(true);
        try {
            // Get Supabase URL and anon key from environment
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            if (!supabaseUrl || !supabaseAnonKey) {
                throw new Error('Configuración de Supabase no encontrada. Verifica las variables de entorno.');
            }

            // Call Edge Function directly with fetch to avoid CORS issues with SDK custom headers
            const response = await fetch(`${supabaseUrl}/functions/v1/generate-recommendations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data && data.error) {
                console.error("Error returned in data:", data.error);
                alert(`Error IA (Procesamiento): ${data.error}`);
            } else {
                console.log("Recommendations generated:", data);
                await fetchRecs();
            }
        } catch (err: any) {
            console.error("Error generating recommendations:", err);
            const errorMessage = err?.message || 'Error desconocido';
            alert(`Error IA: ${errorMessage}\n\nRevisa la consola para más detalles.`);
        } finally {
            setGenerating(false);
        }
    };

    // Separate movies and series, then deduplicate and filter blacklisted
    const allMovieRecs = recommendations.filter(r => r.media_items?.type === 'movie');
    const allSeriesRecs = recommendations.filter(r => r.media_items?.type === 'series');
    const movieRecs = cleanMediaList(
        allMovieRecs,
        (r: any) => r.media_items?.title ?? '',
        (r: any) => r.reason_text?.length ?? 0
    );
    const seriesRecs = cleanMediaList(
        allSeriesRecs,
        (r: any) => r.media_items?.title ?? '',
        (r: any) => r.reason_text?.length ?? 0
    );

    const renderRecCard = (rec: any, i: number) => (
        <div
            key={i}
            onClick={() => navigate(`/detail/${rec.media_items.id}`)}
            className="glass-card flex flex-col md:flex-row gap-6 p-6 group cursor-pointer hover:border-primary/30 transition-all duration-500"
        >
            <div className="w-full md:w-32 shrink-0 aspect-[2/3] rounded-xl overflow-hidden bg-secondary shadow-xl relative">
                {rec.media_items.poster_url ? (
                    <img src={rec.media_items.poster_url} alt={rec.media_items.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-foreground/10 text-[8px] font-black uppercase tracking-widest">No Poster</div>
                )}
            </div>
            <div className="flex-1 flex flex-col justify-center space-y-4">
                <div>
                    <h3 className="text-xl font-black text-white group-hover:text-primary transition-colors leading-tight mb-1">
                        {rec.media_items.title}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">
                        {rec.media_items.year} • {rec.media_items.type === 'movie' ? 'Película' : 'Serie'}
                    </p>
                </div>

                <div className="bg-secondary/20 border border-white/5 p-4 rounded-xl relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <h4 className="text-[9px] font-black text-primary uppercase tracking-[0.3em] mb-2">Veredicto AI</h4>
                    <p className="text-sm leading-relaxed text-foreground/70 italic font-medium">
                        "{rec.reason_text}"
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {rec.media_items.genres?.map((g: string) => (
                        <span key={g} className="text-[9px] px-2 py-0.5 bg-white/5 rounded-lg border border-white/5 font-black uppercase tracking-widest text-foreground/40">
                            {g}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderSection = (items: any[], title: string, icon: React.ReactNode, colorClass: string, emptyMsg: string) => (
        <section className="space-y-6">
            <div className="flex items-center gap-3">
                <div className={`p-2 ${colorClass} rounded-xl`}>
                    {icon}
                </div>
                <h3 className="text-xl font-bold text-white">{title}</h3>
                {items.length > 0 && (
                    <span className={`text-xs ${colorClass} px-2 py-0.5 rounded-full font-bold`}>
                        {items.length}
                    </span>
                )}
            </div>
            {items.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {items.map((rec, i) => renderRecCard(rec, i))}
                </div>
            ) : (
                <div className="text-center py-8 bg-secondary/10 rounded-2xl border border-dashed border-white/5">
                    <p className="text-foreground/40 text-sm">{emptyMsg}</p>
                </div>
            )}
        </section>
    );

    return (
        <Layout>
            <div className="space-y-10">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-primary/10 rounded-[1.5rem] shadow-inner">
                            <Sparkles className="text-primary" size={32} />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black tracking-tight">AI Insights</h2>
                            <p className="text-foreground/50 font-medium">Recomendaciones generadas por algoritmos de comunidad</p>
                        </div>
                    </div>
                    <button
                        onClick={handleGenerateRecommendations}
                        disabled={generating}
                        className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-primary text-white font-bold text-sm uppercase tracking-widest rounded-2xl shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {generating ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <Wand2 size={20} />
                        )}
                        {generating ? 'Generando...' : 'Generar IA'}
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="animate-spin text-primary" size={48} />
                    </div>
                ) : recommendations.length > 0 ? (
                    <div className="space-y-12">
                        {renderSection(
                            movieRecs, 
                            "Películas Recomendadas", 
                            <Film className="text-blue-500" size={20} />,
                            "bg-blue-500/10 text-blue-400",
                            "No hay recomendaciones de películas."
                        )}
                        {renderSection(
                            seriesRecs, 
                            "Series Recomendadas", 
                            <Tv className="text-purple-500" size={20} />,
                            "bg-purple-500/10 text-purple-400",
                            "No hay recomendaciones de series."
                        )}
                    </div>
                ) : (
                    <div className="text-center py-32 bg-secondary/10 rounded-[2.5rem] border-2 border-dashed border-white/5">
                        <p className="text-xl font-medium text-foreground/30 italic max-w-sm mx-auto">
                            "Los grandes gustos requieren grandes datos."
                        </p>
                        <p className="text-sm text-foreground/20 mt-4 uppercase tracking-[0.2em] font-black">
                            Añade favoritos y pulsa "Generar IA" para ver recomendaciones.
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-8 px-10 py-4 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary/30 hover:scale-105 transition-all"
                        >
                            Explorar Ranking
                        </button>
                    </div>
                )}
            </div>
        </Layout>
    );
};
