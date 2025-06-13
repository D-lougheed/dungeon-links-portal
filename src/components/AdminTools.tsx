
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Database, Download, Upload, Settings, Map, Users, FileText } from 'lucide-react';
import ScrapeProgress from './ScrapeProgress';
import AdminMapEditor from './AdminMapEditor';

interface AdminToolsProps {
  onBack: () => void;
}

const AdminTools: React.FC<AdminToolsProps> = ({ onBack }) => {
  const [currentView, setCurrentView] = useState<'main' | 'scrape' | 'map'>('main');

  if (currentView === 'scrape') {
    return <ScrapeProgress onBack={() => setCurrentView('main')} />;
  }

  if (currentView === 'map') {
    return <AdminMapEditor onBack={() => setCurrentView('main')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            onClick={onBack}
            variant="outline"
            className="border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-amber-900 mb-2">Admin Tools</h1>
          <p className="text-amber-700">Manage campaign data, content, and system settings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Map Editor */}
          <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center">
                <Map className="h-5 w-5 mr-2" />
                Map Editor
              </CardTitle>
              <CardDescription>
                Create and manage interactive map pins for your campaign world
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setCurrentView('map')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Open Map Editor
              </Button>
            </CardContent>
          </Card>

          {/* Content Scraping */}
          <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center">
                <Download className="h-5 w-5 mr-2" />
                Content Scraping
              </CardTitle>
              <CardDescription>
                Import wiki content and documentation for the AI assistants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setCurrentView('scrape')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Manage Content
              </Button>
            </CardContent>
          </Card>

          {/* Database Management */}
          <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Database
              </CardTitle>
              <CardDescription>
                View and manage campaign data, users, and system tables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                disabled
              >
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage user roles, permissions, and campaign access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled
              >
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* Content Export */}
          <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center">
                <Upload className="h-5 w-5 mr-2" />
                Content Export
              </CardTitle>
              <CardDescription>
                Export campaign data, maps, and content for backup or sharing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled
              >
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* System Settings */}
          <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                System Settings
              </CardTitle>
              <CardDescription>
                Configure AI settings, API keys, and system preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                disabled
              >
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Common administrative tasks and shortcuts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100">
                  View Logs
                </Button>
                <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100">
                  Clear Cache
                </Button>
                <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100">
                  Backup Data
                </Button>
                <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100">
                  System Status
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminTools;
