import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuthModal } from './AuthModal';
import { LogOut, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [session, setSession] = useState<any>(null);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-md">
                <div className="container mx-auto px-4 h-20 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="p-2 bg-primary rounded-lg shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
                            <Trophy className="text-white" size={24} />
                        </div>
                        <h1 className="text-xl font-black text-primary tracking-tighter uppercase md:text-2xl">
                            Premium<span className="text-white">Rank</span>
                        </h1>
                    </Link>

                    <nav className="hidden lg:flex items-center gap-10">
                        <Link to="/" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 hover:text-primary transition-colors">
                            Ranking
                        </Link>
                        <Link to="/favorites" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 hover:text-primary transition-colors">
                            Favoritas
                        </Link>
                        <Link to="/recommendations" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 hover:text-primary transition-colors">
                            Explorar AI
                        </Link>
                    </nav>

                    <div className="flex items-center gap-3">
                        {session ? (
                            <div className="flex items-center gap-4">
                                <div className="hidden md:flex flex-col items-end">
                                    <span className="text-[9px] font-black text-foreground/20 uppercase tracking-widest">Usuario</span>
                                    <span className="text-sm font-bold text-white">{session.user.email?.split('@')[0]}</span>
                                </div>
                                <button
                                    onClick={handleSignOut}
                                    className="p-3 bg-secondary/30 border border-white/5 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all text-foreground/40"
                                    title="Cerrar Sesión"
                                >
                                    <LogOut size={18} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsAuthModalOpen(true)}
                                className="primary-gradient text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-0.95"
                            >
                                Acceder
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
                {children}
            </main>

            <footer className="border-t border-white/5 py-16 bg-secondary/10 mt-32">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-12">
                        <div className="flex items-center gap-2 opacity-30 grayscale saturate-0">
                            <Trophy size={20} />
                            <span className="font-black tracking-tighter text-lg uppercase">PREMIUM RANK</span>
                        </div>
                        <div className="text-[10px] text-foreground/20 font-black uppercase tracking-[0.3em]">
                            © 2026 Developed for the most demanding aficionados.
                        </div>
                        <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-foreground/30">
                            <a href="#" className="hover:text-primary transition-colors">Legal</a>
                            <a href="#" className="hover:text-primary transition-colors">Data Privacy</a>
                        </div>
                    </div>
                </div>
            </footer>

            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        </div>
    );
};
