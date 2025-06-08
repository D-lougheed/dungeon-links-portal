
import React from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import Dashboard from '../components/Dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Swords, Users, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';

const AppContent = () => {
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <header className="bg-gradient-to-r from-amber-800 to-orange-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6 text-center">
          <div className="flex justify-center items-center space-x-3 mb-4">
            <div className="relative">
              <Shield className="h-12 w-12" />
              <Swords className="h-6 w-6 absolute -top-1 -right-1" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2">D&D Campaign Portal</h1>
          <p className="text-amber-100 text-lg">Your Ultimate Dungeon Master's Toolkit</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold text-amber-900 mb-4">
            Welcome to Your Adventure Management Hub
          </h2>
          <p className="text-amber-700 text-lg mb-8">
            Streamline your D&D campaigns with powerful tools for character management, 
            world building, and session planning.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button className="bg-amber-700 hover:bg-amber-800 text-white px-8 py-3 text-lg">
                Get Started
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card className="border-2 border-amber-200 bg-gradient-to-br from-white to-amber-50">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Crown className="h-8 w-8 text-amber-700" />
                <div>
                  <CardTitle className="text-amber-900">For Dungeon Masters</CardTitle>
                  <CardDescription className="text-amber-700">
                    Complete campaign management tools
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-amber-800">
              <ul className="space-y-2">
                <li>• AI-powered world building assistance</li>
                <li>• Character and NPC management</li>
                <li>• Session planning and notes</li>
                <li>• Map and location tracking</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-200 bg-gradient-to-br from-white to-amber-50">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-amber-700" />
                <div>
                  <CardTitle className="text-amber-900">For Players</CardTitle>
                  <CardDescription className="text-amber-700">
                    Enhanced gameplay experience
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-amber-800">
              <ul className="space-y-2">
                <li>• Character sheet management</li>
                <li>• Campaign timeline access</li>
                <li>• Quest and objective tracking</li>
                <li>• Collaborative world exploration</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Card className="bg-gradient-to-r from-amber-100 to-orange-100 border-amber-300 inline-block">
            <CardContent className="pt-6">
              <h3 className="text-xl font-semibold text-amber-900 mb-2">
                Ready to Begin Your Adventure?
              </h3>
              <p className="text-amber-700 mb-4">
                Join thousands of adventurers already using our platform
              </p>
              <Link to="/auth">
                <Button className="bg-amber-700 hover:bg-amber-800 text-white">
                  Sign Up Now
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

const Index = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default Index;
