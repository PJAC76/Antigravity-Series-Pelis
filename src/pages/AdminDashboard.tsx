import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { adminService, mediaService } from '../services/mediaService';
import { supabase } from '../lib/supabase';
import { Play, Activity, Database, Users, AlertCircle, CheckCircle2, Loader2, RefreshCw, Film, Tv, Image } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/');
                return;
            }
            try {
                const profile = await mediaService.getUserProfile(session.user.id) as any;
                if (profile.role !== 'admin') {
                    navigate('/');
                } else {
                    setIsAdmin(true);
                    fetchStats();
                }
            } catch (err) {
                navigate('/');
            }
        };
        checkAdmin();
    }, [navigate]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const data = await adminService.getStats();
            setStats(data);
        } catch (err) {
            console.error("Error fetching stats:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleRunScraper = async (name: string, label: string) => {
        setActionLoading(name);
        setMessage(null);
        try {
            await adminService.triggerScraper(name);
            setMessage({ type: 'success', text: `${label} ejecutado con éxito.` });
            fetchStats();
        } catch (err: any) {
            setMessage({ type: 'error', text: `Error en ${label}: ${err.message}` });
        } finally {
            setActionLoading(null);
        }
    };

    if (!isAdmin || loading) return (
        <Layout>
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="animate-spin text-primary" size={48} />
                <p className="text-foreground/40 font-bold uppercase tracking-widest text-xs">Cargando Panel de Control...</p>
            </div>
        </Layout>
    );

    const scraperGroups = [
        {
            title: "Scrapers de Películas",
            icon: <Film size={20} />,
            color: "text-blue-500",
            items: [
                { id: 'scrape-forocoches', label: 'Forocoches', color: 'bg-orange-500' },
                { id: 'scrape-filmaffinity-v2', label: 'FilmAffinity (V2)', color: 'bg-blue-600' },
                { id: 'scrape-reddit', label: 'Reddit', color: 'bg-red-500' },
            ]
        },
        {
            title: "Scrapers de Series",
            icon: <Tv size={20} />,
            color: "text-purple-500",
            items: [
                { id: 'scrape-forocoches', label: 'Forocoches', color: 'bg-orange-500' },
                { id: 'scrape-filmaffinity-v2', label: 'FilmAffinity (V2)', color: 'bg-blue-600' },
                { id: 'scrape-reddit', label: 'Reddit', color: 'bg-red-500' },
            ]
        },
        {
            title: "Procesos",
            icon: <Activity size={20} />,
            color: "text-primary",
            items: [
                { id: 'calculate-rankings', label: 'Calcular Rankings', color: 'bg-primary' },
                { id: 'fetch-posters', label: 'Cargar Pósters (TMDB)', color: 'bg-green-500' },
                { id: 'ping', label: 'Diagnóstico (Ping)', color: 'bg-gray-500' }
            ]
        }
    ];

    return (
        <Layout>
            <div className="space-y-10 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter mb-2">Panel de Administración</h1>
                        <p className="text-foreground/50">Gestión de datos, scrapers y métricas del sistema.</p>
                    </div>
                    <button
                        onClick={fetchStats}
                        className="p-3 bg-secondary/50 border border-white/5 rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                        title="Refrescar Estadísticas"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-8 flex items-center gap-6">
                        <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500">
                            <Database size={32} />
                        </div>
                        <div>
                            <span className="block text-[10px] font-black text-foreground/30 uppercase tracking-widest mb-1">Títulos Totales</span>
                            <span className="text-3xl font-black">{stats.media}</span>
                        </div>
                    </div>
                    <div className="glass-card p-8 flex items-center gap-6">
                        <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                            <Activity size={32} />
                        </div>
                        <div>
                            <span className="block text-[10px] font-black text-foreground/30 uppercase tracking-widest mb-1">Puntuaciones</span>
                            <span className="text-3xl font-black">{stats.scores}</span>
                        </div>
                    </div>
                    <div className="glass-card p-8 flex items-center gap-6">
                        <div className="p-4 bg-purple-500/10 rounded-2xl text-purple-500">
                            <Users size={32} />
                        </div>
                        <div>
                            <span className="block text-[10px] font-black text-foreground/30 uppercase tracking-widest mb-1">Usuarios</span>
                            <span className="text-3xl font-black">{stats.users}</span>
                        </div>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}>
                        {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        <span className="text-sm font-bold">{message.text}</span>
                    </div>
                )}

                {/* Scraper Groups */}
                {scraperGroups.map((group, gi) => (
                    <div key={gi} className="space-y-4">
                        <h2 className="text-xs font-black text-foreground/20 uppercase tracking-[0.3em] flex items-center gap-3">
                            <span className={group.color}>{group.icon}</span>
                            {group.title}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {group.items.map((scraper) => (
                                <div key={`${gi}-${scraper.id}`} className="glass-card p-5 flex flex-col justify-between group">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-black uppercase tracking-widest">{scraper.label}</span>
                                        <div className={`w-2 h-2 rounded-full ${scraper.color} shadow-lg shadow-current`} />
                                    </div>
                                    <button
                                        onClick={() => handleRunScraper(scraper.id, `${group.title} - ${scraper.label}`)}
                                        disabled={!!actionLoading}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-secondary/50 rounded-xl border border-white/5 hover:bg-white/5 transition-all text-xs font-black uppercase tracking-widest group-hover:border-primary/30 group-hover:text-primary disabled:opacity-50"
                                    >
                                        {actionLoading === scraper.id ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <>
                                                <Play size={12} className="fill-current" />
                                                Ejecutar
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Info */}
                <div className="bg-secondary/10 p-8 rounded-[2rem] border border-white/5 flex flex-col md:flex-row items-center gap-8">
                    <div className="p-5 bg-white/5 rounded-3xl text-foreground/20">
                        <AlertCircle size={48} />
                    </div>
                    <div className="flex-1 space-y-2">
                        <h3 className="text-lg font-bold">Información de Seguridad</h3>
                        <p className="text-sm text-foreground/40 leading-relaxed max-w-2xl">
                            Este panel solo es accesible para usuarios con el rol `admin` definido en la tabla `profiles`. La ejecución de scrapers consume recursos de Supabase Edge Functions. Se recomienda ejecutarlos en horas de baja carga.
                        </p>
                    </div>
                </div>
            </div>
        </Layout>
    );
};
