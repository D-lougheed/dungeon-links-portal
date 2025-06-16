
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LogOut, 
  Users, 
  BookOpen, 
  Dice6, 
  Scroll,
  Sword,
  Crown,
  Compass,
  Bot,
  Sparkles,
  Settings,
  User,
  Map
} from 'lucide-react';
import { useState } from 'react';
import GeneralAIAssistant from './GeneralAIAssistant';
import SlumberingAncientsAI from './SlumberingAncientsAI';
import AdminTools from './AdminTools';
import InteractiveMap from './InteractiveMap';

const Dashboard = () => {
  const { signOut, user, userRole } = useAuth();
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  const features = [
    {
      id: "admin-tools",
      title: "Admin Tools",
      description: "Wiki scraping, database management, and AI configuration",
      icon: Settings,
      status: "Available",
      dmOnly: true
    },
    {
      id: "interactive-map",
      title: "Admin Interactive Maps",
      description: "View and manage campaign world locations with an interactive map",
      icon: Map,
      status: "Available",
      dmOnly: true
    },
    {
      id: "general-ai-assistant",
      title: "General AI Assistant",
      description: "Get AI help with world building, NPCs, and campaign ideas",
      icon: Bot,
      status: "Available",
      dmOnly: false
    },
    {
      id: "slumbering-ancients-ai",
      title: "Slumbering Ancients AI Assistant",
      description: "Specialized AI assistant for ancient lore and mysteries",
      icon: Sparkles,
      status: "Available",
      dmOnly: false
    },
    {
      id: "character-management",
      title: "Character Management",
      description: "Track player characters, stats, and progression",
      icon: Users,
      status: "Coming Soon",
      dmOnly: false
    },
    {
      id: "campaign-notes",
      title: "Campaign Notes",
      description: "Session notes, plot hooks, and story tracking",
      icon: BookOpen,
      status: "Coming Soon",
      dmOnly: true
    },
    {
      id: "npcs-factions",
      title: "NPCs & Factions",
      description: "Non-player characters and faction relationships",
      icon: Crown,
      status: "Coming Soon",
      dmOnly: true
    },
    {
      id: "items-equipment",
      title: "Items & Equipment",
      description: "Magic items, weapons, and treasure tracking",
      icon: Sword,
      status: "Coming Soon",
      dmOnly: false
    },
    {
      id: "quick-references",
      title: "Quick References",
      description: "Rules, tables, and useful D&D references",
      icon: Scroll,
      status: "Coming Soon",
      dmOnly: false
    },
    {
      id: "dice-roller",
      title: "Dice Roller",
      description: "Digital dice for quick rolls during sessions",
      icon: Dice6,
      status: "Coming Soon",
      dmOnly: false
    },
    {
      id: "quest-tracker",
      title: "Quest Tracker",
      description: "Active quests, objectives, and rewards",
      icon: Compass,
      status: "Coming Soon",
      dmOnly: false
    }
  ];

  // Filter features based on user role
  const availableFeatures = features.filter(feature => 
    !feature.dmOnly || userRole === 'dm'
  );

  const handleFeatureClick = (featureId: string, status: string) => {
    if (status === "Available") {
      setActiveFeature(featureId);
    }
  };

  if (activeFeature === "admin-tools") {
    return <AdminTools onBack={() => setActiveFeature(null)} />;
  }

  if (activeFeature === "interactive-map") {
    return <InteractiveMap onBack={() => setActiveFeature(null)} />;
  }

  if (activeFeature === "general-ai-assistant") {
    return <GeneralAIAssistant onBack={() => setActiveFeature(null)} />;
  }

  if (activeFeature === "slumbering-ancients-ai") {
    return <SlumberingAncientsAI onBack={() => setActiveFeature(null)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <header className="bg-gradient-to-r from-amber-800 to-orange-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Scroll className="h-8 w-8" />
              <Dice6 className="h-4 w-4 absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">D&D Campaign Portal</h1>
              <p className="text-amber-100 text-sm">Adventure Management Hub</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-amber-700 px-3 py-1 rounded-full">
              <User className="h-4 w-4" />
              <span className="text-sm">
                {userRole === 'dm' ? 'Dungeon Master' : 'Player'}
              </span>
            </div>
            <Button 
              onClick={signOut}
              variant="outline"
              className="border-amber-200 text-amber-100 hover:bg-amber-700 hover:text-white"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-amber-900 mb-2">
            Welcome, {userRole === 'dm' ? 'Dungeon Master' : 'Adventurer'}!
          </h2>
          <p className="text-amber-700">
            {user?.email && `Signed in as ${user.email} • `}
            Your campaign management tools are ready. Select a feature below to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {availableFeatures.map((feature, index) => {
            const IconComponent = feature.icon;
            const isAvailable = feature.status === "Available";
            return (
              <Card 
                key={index} 
                className={`border-2 border-amber-200 hover:border-amber-400 transition-all duration-200 hover:shadow-lg bg-gradient-to-br from-white to-amber-50 group ${
                  isAvailable ? 'cursor-pointer' : 'cursor-default'
                }`}
                onClick={() => handleFeatureClick(feature.id, feature.status)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <IconComponent className={`h-8 w-8 ${
                      isAvailable 
                        ? 'text-amber-700 group-hover:text-amber-800' 
                        : 'text-amber-600'
                    } transition-colors`} />
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isAvailable 
                          ? 'text-green-700 bg-green-100' 
                          : 'text-amber-600 bg-amber-100'
                      }`}>
                        {feature.status}
                      </span>
                      {feature.dmOnly && (
                        <span className="text-xs px-2 py-1 rounded-full text-purple-700 bg-purple-100">
                          DM Only
                        </span>
                      )}
                    </div>
                  </div>
                  <CardTitle className={`text-lg ${
                    isAvailable 
                      ? 'text-amber-900 group-hover:text-amber-800' 
                      : 'text-amber-900'
                  } transition-colors`}>
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-amber-700">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-amber-100 to-orange-100 border-amber-300">
            <CardContent className="pt-6">
              <h3 className="text-xl font-semibold text-amber-900 mb-2">
                Ready to Begin Your Adventure?
              </h3>
              <p className="text-amber-700">
                {userRole === 'dm' 
                  ? 'As a Dungeon Master, you have access to all campaign management tools.'
                  : 'As a Player, you can access character management and collaborative features.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
