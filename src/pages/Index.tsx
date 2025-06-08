
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Dashboard from '../components/Dashboard';
import { Link } from 'react-router-dom';

const Index = () => {
  const {
    user,
    isLoading
  } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-amber-700">Loading...</div>
      </div>;
  }

  if (user) {
    return <Dashboard />;
  }

  return <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 relative overflow-hidden">
      {/* Parchment texture overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23D4A574%22%20fill-opacity%3D%220.08%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-70"></div>
      
      {/* Parchment aging spots */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-8 h-8 bg-amber-200 rounded-full opacity-20 blur-sm"></div>
        <div className="absolute top-1/3 right-1/3 w-4 h-4 bg-yellow-300 rounded-full opacity-15 blur-sm"></div>
        <div className="absolute bottom-1/4 left-1/3 w-6 h-6 bg-amber-300 rounded-full opacity-25 blur-sm"></div>
        <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-yellow-200 rounded-full opacity-20 blur-sm"></div>
        <div className="absolute bottom-1/3 right-1/2 w-5 h-5 bg-amber-200 rounded-full opacity-15 blur-sm"></div>
      </div>

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-4xl mx-auto">
          {/* Portal with Map Image */}
          <div className="relative">
            <Link to="/auth" className="block">
              <div className="w-80 h-80 mx-auto relative group cursor-pointer rounded-lg">
                {/* Outer stone ring with texture */}
                <div className="absolute inset-0 border-8 border-stone-400 rounded-full group-hover:border-stone-300 transition-colors duration-300 shadow-[inset_0_4px_8px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.2)] bg-gradient-to-br from-stone-300 via-stone-400 to-stone-600"></div>
                {/* Inner stone ring with deeper shadow */}
                <div className="absolute inset-2 border-6 border-stone-500 rounded-full group-hover:border-stone-400 transition-colors duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.3)] bg-gradient-to-br from-stone-400 via-stone-500 to-stone-700"></div>
                
                {/* Circular Map Portal */}
                <div className="absolute inset-6 rounded-full overflow-hidden shadow-2xl group-hover:shadow-amber-500/30 transition-all duration-300 border-2 border-stone-600">
                  <img src="/lovable-uploads/70382beb-0456-4b0e-b550-a587cc615789.png" alt="D&D World Map Portal" className="w-full h-full object-cover transition-all duration-500 group-hover:blur-sm group-hover:scale-110" />
                  {/* Magical overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-yellow-600/10 group-hover:from-amber-500/20 group-hover:to-yellow-600/20 transition-all duration-300"></div>
                </div>
                
                {/* Stone texture glow effect */}
                <div className="absolute inset-0 rounded-full opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-300 bg-amber-100"></div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>;
};

export default Index;
