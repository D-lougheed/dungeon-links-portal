
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Bot, Settings, Shield, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AIWorldAssistant from './AIWorldAssistant';
import GeneralAIAssistant from './GeneralAIAssistant';
import SlumberingAncientsAI from './SlumberingAncientsAI';
import AdminTools from './AdminTools';

const Dashboard = () => {
  const { user, userRole, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'world-ai' | 'general-ai' | 'slumbering-ai' | 'admin'>('dashboard');

  const handleSignOut = async () => {
    await signOut();
  };

  // Render different views based on current selection
  if (currentView === 'world-ai') {
    return <AIWorldAssistant onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'general-ai') {
    return <GeneralAIAssistant onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'slumbering-ai') {
    return <SlumberingAncientsAI onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'admin') {
    return <AdminTools onBack={() => setCurrentView('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 relative overflow-hidden">
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

      <header className="relative z-10 bg-gradient-to-r from-amber-800 to-orange-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">D&D Campaign Dashboard</h1>
            <p className="text-amber-100 text-sm">
              Welcome back, {user?.email} {userRole && `(${userRole})`}
            </p>
          </div>
          <Button 
            onClick={handleSignOut}
            variant="outline"
            className="border-amber-200 text-amber-100 hover:bg-amber-700 hover:text-white"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* AI Assistants Section */}
          <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center">
                <Bot className="h-5 w-5 mr-2" />
                World Knowledge AI
              </CardTitle>
              <CardDescription>
                Ask questions about your campaign world using your uploaded documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setCurrentView('world-ai')}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                Open World Assistant
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center">
                <Bot className="h-5 w-5 mr-2" />
                General AI Assistant
              </CardTitle>
              <CardDescription>
                Get help with general D&D questions, rules, and campaign ideas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setCurrentView('general-ai')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Open General Assistant
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center">
                <Bot className="h-5 w-5 mr-2" />
                Slumbering Ancients AI
              </CardTitle>
              <CardDescription>
                Specialized assistant for Slumbering Ancients campaign knowledge
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setCurrentView('slumbering-ai')}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                Open Slumbering Assistant
              </Button>
            </CardContent>
          </Card>

          {/* Admin/DM Only Sections */}
          {userRole === 'dm' && (
            <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-amber-900 flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Admin Tools
                </CardTitle>
                <CardDescription>
                  Manage Google Drive scraping and AI configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => setCurrentView('admin')}
                  className="w-full bg-slate-600 hover:bg-slate-700 text-white"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Open Admin Panel
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Role Display Card */}
          <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Your Role
              </CardTitle>
              <CardDescription>
                Current access level and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-800 mb-2">
                  {userRole === 'dm' ? 'Dungeon Master' : 'Player'}
                </div>
                <p className="text-sm text-amber-600">
                  {userRole === 'dm' 
                    ? 'You have full access to all features including admin tools' 
                    : 'You can access AI assistants and campaign resources'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
