import { Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { DetailPage } from './pages/DetailPage';
import { FavoritesPage } from './pages/Favorites';
import { RecommendationsPage } from './pages/Recommendations';
import { AdminDashboard } from './pages/AdminDashboard';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

function App() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/detail/:id" element={<DetailPage />} />
      <Route path="/favorites" element={<FavoritesPage />} />
      <Route path="/recommendations" element={user ? <RecommendationsPage userId={user.id} /> : <Home />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
}

export default App;
