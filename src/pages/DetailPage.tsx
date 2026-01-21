import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { mediaService } from "../services/mediaService";
import { supabase } from "../lib/supabase";
import {
  Star,
  ArrowLeft,
  BarChart3,
  MessageSquare,
  Quote,
  Heart,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";

interface MediaSourceScore {
  source: string;
  score_normalized: number;
  votes_count: number;
}

interface MediaItem {
  id: string;
  title: string;
  year: number;
  type: "movie" | "series";
  poster_url: string;
  synopsis_short: string;
  synopsis: string;
  genres: string[];
  providers: { id: number; name: string; logo_path: string }[];
  sources_scores: MediaSourceScore[];
}

export const DetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [userFavorites, setUserFavorites] = useState<MediaItem[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!id) return;
    
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const [details, favorites] = await Promise.all([
          mediaService.getMediaItemDetails(id),
          user ? mediaService.getUserFavorites(user.id) : Promise.resolve([])
        ]);

        setItem(details);
        if (user) {
          setUserFavorites(favorites || []);
          setIsFavorite(favorites.some((f: any) => f.id === id));
        }
      } catch (err) {
        console.error("Error fetching media details:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDetails();
  }, [id, user]);

  const handleToggleFavorite = async () => {
    if (!user || !id) return;
    try {
      const added = await mediaService.toggleFavorite(user.id, id);
      setIsFavorite(added);
      
      // Refresh local favorites list for AI analysis sync
      const favorites = await mediaService.getUserFavorites(user.id);
      setUserFavorites(favorites || []);
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  const getAlgorithmAnalysis = (media: MediaItem, favorites: MediaItem[] = []) => {
    const scores = media.sources_scores || [];
    const avgScore =
      scores.reduce((acc: number, s: MediaSourceScore) => acc + s.score_normalized, 0) /
      (scores.length || 1);
    
    const reddit = scores.find((s: MediaSourceScore) => s.source === "reddit");
    const filmaffinity = scores.find((s: MediaSourceScore) => s.source === "filmaffinity");
    const forocoches = scores.find((s: MediaSourceScore) => s.source === "forocoches");

    const isRecent = media.year >= 2024;
    const hasProviders = media.providers && media.providers.length > 0;

    // 0. Personalized match (High Priority)
    const favoriteGenres = Array.from(new Set(favorites.flatMap(f => f.genres || [])));
    const matchingGenres = media.genres?.filter((g: string) => favoriteGenres.includes(g)) || [];

    // Analyze disparity (Polarization)
    const forocochesScore = forocoches?.score_normalized ?? 0;
    

    // 1. Personalized + High Quality
    if (matchingGenres.length > 0 && avgScore > 7.5) {
      const genre = matchingGenres[0];
      const templates = [
        `Match Directo: Tu afinidad por el género ${genre} cruza perfectamente con este título de alta valoración (${avgScore.toFixed(1)} de media). Una integración de narrativa y estilo visual que encaja con tu historial.`,
        `Recomendación Personal: Analizando tus favoritos, el sistema predice una alta probabilidad de satisfacción con '${media.title}'. Destaca por su ejecución en ${genre}, superior a la media del sector.`,
        `Alineación de Perfil: Este título resuena con tus preferencias en ${genre}. La data sugiere que es una de esas obras que refuerzan tu criterio cinematográfico.`
      ];
      return {
        text: templates[Math.floor(Math.random() * templates.length)],
        variant: "purple"
      };
    }

    // 2. Universal Masterpiece
    if (avgScore > 8.5) {
      return {
        text: `Consenso Crítico: Con una media global de ${avgScore.toFixed(1)}, '${media.title}' trasciende los gustos subjetivos. Es una pieza de ingeniería narrativa validada unánimemente por todas las fuentes de datos.`,
        variant: "gold"
      };
    }

    // 3. Reddit Cult vs FA reserved
    if ((reddit?.score_normalized ?? 0) > 8.2 && (filmaffinity?.score_normalized ?? 0) < 7.0 && filmaffinity) {
      return {
        text: `Fenómeno de Nicho: La disparidad entre crítica tradicional y Reddit revela una obra de culto. '${media.title}' ofrece una propuesta arriesgada que conecta profundamente con audiencias específicas, ignorando las convenciones académicas.`,
        variant: "blue"
      };
    }

    // 4. Forocoches "Recommended" (Humor/Action/Niche)
    if (forocochesScore > 8.5) {
      return {
        text: `Alto Impacto: El algoritmo de Forocoches destaca '${media.title}' por su ritmo y capacidad de entretenimiento puro. Una opción optimizada para sesiones donde se busca eficacia narrativa sin relleno.`,
        variant: "red"
      };
    }

    // 5. Streaming availability + Recent
    if (isRecent && hasProviders) {
      const platform = media.providers[0].name;
      const templates = [
        `Oportunidad de Visionado: Disponible ya en ${platform} y lanzada en ${media.year}, esta producción ofrece valores de producción modernos y relevancia cultural inmediata. Un blockbuster competente ideal para mantenerse actualizado.`,
        `Análisis de Estreno: Su presencia en ${platform} la convierte en una opción accesible de alto perfil. Aunque reciente, los primeros datos indican una acogida sólida en comunidades digitales.`,
        `Radar de Novedades: '${media.title}' combina frescura (${media.year}) con accesibilidad (${platform}). El algoritmo la sugiere como una visualización eficiente para evaluar el estado actual del género.`
      ];
      return {
        text: templates[Math.floor(Math.random() * templates.length)],
        variant: "green"
      };
    }

    // 6. Classic Reliability
    if (media.year < 2015 && avgScore > 7.5) {
      return {
        text: `Valor Histórico: '${media.title}' ha resistido la prueba del tiempo. Su puntuación sostenida a lo largo de los años indica una calidad estructural que supera a las producciones efímeras actuales.`,
        variant: "purple"
      };
    }

    // 7. General smart pick
    const generalTemplates = [
      `Validación Estadística: '${media.title}' presenta métricas sólidas en todos los frentes. Una elección racional basada en la consistencia de guion y dirección.`,
      `Perfil Equilibrado: Sin estridencias pero sin fallos. El análisis de datos sitúa a esta obra en el percentil superior de fiabilidad. Cine sólido.`,
      `Recomendación Algorítmica: Cruzando variables de género y recepción, este título emerge como una opción segura para tu perfil de visionado.`
    ];

    return {
      text: generalTemplates[Math.floor(Math.random() * generalTemplates.length)],
      variant: "default"
    };
  };

  if (loading)
    return (
      <Layout>
        <div className="animate-pulse space-y-8">
          <div className="h-64 bg-secondary/30 rounded-3xl" />
          <div className="h-32 bg-secondary/30 rounded-xl" />
        </div>
      </Layout>
    );

  if (!item)
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-foreground/40 italic">
            No se encontró el título solicitado.
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-primary font-bold underline mt-4"
          >
            Volver al inicio
          </button>
        </div>
      </Layout>
    );

  const analysis = getAlgorithmAnalysis(item, userFavorites);
  const variantStyles: Record<string, string> = {
    gold: "border-yellow-500/30 bg-yellow-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    red: "border-red-500/30 bg-red-500/5",
    green: "border-green-500/30 bg-green-500/5",
    purple: "border-purple-500/30 bg-purple-500/5",
    default: "border-white/5 bg-secondary/20",
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between gap-6 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-foreground/40 hover:text-white transition-colors group"
          >
            <div className="p-2 bg-secondary/50 rounded-lg group-hover:bg-primary/20 group-hover:text-primary transition-all">
              <ArrowLeft size={18} />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">
              Volver
            </span>
          </button>

          <button
            onClick={user ? handleToggleFavorite : () => navigate("/auth")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl border transition-all font-black text-xs uppercase tracking-widest ${
              !user
                ? 'bg-secondary/20 border-white/5 text-foreground/40 hover:text-white hover:border-primary/30'
                : isFavorite
                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                : 'bg-secondary/50 border-white/5 text-foreground/60 hover:text-white hover:bg-secondary/80'
            }`}
          >
            <Heart size={16} className={isFavorite ? 'fill-current' : ''} />
            {!user ? 'Inicia sesión para guardar' : isFavorite ? 'En tus favoritas' : 'Añadir a favoritas'}
          </button>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Poster & Quick Info */}
          <div className="lg:col-span-4 space-y-8">
            <div className="glass-card overflow-hidden aspect-[2/3] shadow-2xl relative group">
              {item.poster_url ? (
                <img
                  src={item.poster_url}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-secondary/50 flex flex-col items-center justify-center text-foreground/10 gap-4">
                  <BarChart3 size={64} />
                  <span className="text-xs font-bold uppercase tracking-widest text-foreground/20">
                    Sin Imagen
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-primary/20 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/20 p-5 rounded-2xl border border-white/5 text-center">
                <span className="block text-[10px] font-black text-foreground/30 uppercase tracking-widest mb-1">
                  Estreno
                </span>
                <span className="text-xl font-black text-white">
                  {item.year}
                </span>
              </div>
              <div className="bg-secondary/20 p-5 rounded-2xl border border-white/5 text-center">
                <span className="block text-[10px] font-black text-foreground/30 uppercase tracking-widest mb-1">
                  Categoría
                </span>
                <span className="text-xl font-black text-primary uppercase">
                  {item.type === "movie" ? "Cine" : "Serie"}
                </span>
              </div>
            </div>

            {/* Streaming Providers */}
            {item.providers && item.providers.length > 0 && (
              <div className="bg-secondary/20 p-6 rounded-2xl border border-white/5">
                <span className="block text-[10px] font-black text-foreground/30 uppercase tracking-widest mb-4">
                  Dónde ver
                </span>
                <div className="flex flex-wrap gap-4 justify-center">
                  {item.providers.map((provider: any) => (
                    <div
                      key={provider.id}
                      className="group relative"
                      title={provider.name}
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 shadow-lg group-hover:scale-110 transition-transform bg-white">
                        <img
                          src={provider.logo_path}
                          alt={provider.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Details & Scores */}
          <div className="lg:col-span-8 space-y-12">
            <div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-[0.9] text-white">
                {item.title}
              </h1>
              <div className="flex flex-wrap gap-2 mb-8">
                {(item.genres || []).map((g: string) => (
                  <span
                    key={g}
                    className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-[0.15em]"
                  >
                    {g}
                  </span>
                ))}
              </div>
              <div className="w-full">
                <p className="text-xl text-foreground/70 leading-[1.6] font-medium max-w-3xl whitespace-pre-wrap">
                  {item.synopsis_short ||
                    "Este título ha sido rigurosamente analizado y seleccionado por su consistencia en las puntuaciones de las tres fuentes principales de la comunidad. Una joya recomendada por el algoritmo de PremiumRank."}
                </p>
              </div>
            </div>

            {/* Source Breakdown */}
            <div className="space-y-6">
              <h2 className="text-xs font-black text-foreground/20 uppercase tracking-[0.3em] flex items-center gap-4">
                <div className="w-12 h-[2px] bg-primary/30" />
                Métricas por Fuente
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {item.sources_scores?.map((s: any) => (
                  <div
                    key={s.source}
                    className="glass-card p-8 border-l border-l-primary/30 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      {s.source === "reddit" ? (
                        <MessageSquare size={40} />
                      ) : s.source === "filmaffinity" ? (
                        <Star size={40} />
                      ) : (
                        <BarChart3 size={40} />
                      )}
                    </div>
                    <div className="flex flex-col gap-4">
                      <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                        {s.source}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black text-white">
                          {s.score_normalized.toFixed(1)}
                        </span>
                        <span className="text-sm font-bold text-foreground/30">
                          / 10
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${s.score_normalized * 10}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest">
                        {s.votes_count ? s.votes_count.toLocaleString() : 0} interacciones
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Recommendation Explanation */}
            <div className={`relative p-10 rounded-[2rem] overflow-hidden border transition-all duration-500 group ${variantStyles[analysis.variant]}`}>
              <div className="absolute top-0 right-0 w-64 h-64 primary-gradient opacity-10 blur-[100px] -mr-32 -mt-32" />
              <div className="relative flex gap-6">
                <div className="shrink-0">
                  <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                    <Quote size={32} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">
                      Análisis del Algoritmo
                    </h3>
                    {analysis.variant !== 'default' && (
                        <span className="px-2 py-0.5 bg-primary/20 text-primary text-[8px] font-black uppercase rounded-full">
                            {analysis.variant === 'purple' ? 'Sugerencia Personalizada' : `${analysis.variant.toUpperCase()} DETECTADA`}
                        </span>
                    )}
                  </div>
                  <p className="text-xl font-black italic text-foreground leading-relaxed font-serif">
                    "{analysis.text}"
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
};
