
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Dashboard from '../components/Dashboard';
import { Link } from 'react-router-dom';

const Index = () => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-amber-700">Loading...</div>
      </div>
    );
  }
  
  if (user) {
    return <Dashboard />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Magical background effects */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.1%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50"></div>
      
      {/* Floating particles */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-yellow-300 rounded-full opacity-60"></div>
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-blue-300 rounded-full opacity-70"></div>
        <div className="absolute bottom-1/4 left-1/3 w-3 h-3 bg-purple-300 rounded-full opacity-50"></div>
        <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-green-300 rounded-full opacity-60"></div>
        <div className="absolute bottom-1/3 right-1/2 w-2 h-2 bg-pink-300 rounded-full opacity-40"></div>
      </div>

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-4xl mx-auto">
          {/* Portal with Map Image */}
          <div className="relative">
            <Link to="/auth" className="block">
              <div className="w-80 h-80 mx-auto relative group cursor-pointer">
                {/* Outer ring with rotation animation */}
                <div className="absolute inset-0 border-4 border-purple-400 rounded-full animate-spin opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>
                {/* Middle ring with reverse rotation */}
                <div className="absolute inset-2 border-3 border-blue-400 rounded-full animate-reverse-spin opacity-80 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                {/* Circular Map Portal */}
                <div className="absolute inset-4 rounded-full overflow-hidden shadow-2xl group-hover:shadow-purple-500/50 transition-all duration-300">
                  <img 
                    src="/lovable-uploads/70382beb-0456-4b0e-b550-a587cc615789.png" 
                    alt="D&D World Map Portal"
                    className="w-full h-full object-cover transition-all duration-500 group-hover:blur-sm group-hover:scale-110"
                  />
                  {/* Magical overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-600/20 group-hover:from-purple-500/40 group-hover:to-blue-600/40 transition-all duration-300"></div>
                </div>
                
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-full bg-purple-500 opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-300"></div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
