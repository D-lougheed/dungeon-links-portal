
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LogOut, 
  Users, 
  Map, 
  BookOpen, 
  Dice6, 
  Scroll,
  Sword,
  Crown,
  Compass
} from 'lucide-react';

const Dashboard = () => {
  const { logout } = useAuth();

  const features = [
    {
      title: "Character Management",
      description: "Track player characters, stats, and progression",
      icon: Users,
      status: "Coming Soon"
    },
    {
      title: "Campaign Notes",
      description: "Session notes, plot hooks, and story tracking",
      icon: BookOpen,
      status: "Coming Soon"
    },
    {
      title: "Maps & Locations",
      description: "World maps, dungeons, and important locations",
      icon: Map,
      status: "Coming Soon"
    },
    {
      title: "NPCs & Factions",
      description: "Non-player characters and faction relationships",
      icon: Crown,
      status: "Coming Soon"
    },
    {
      title: "Items & Equipment",
      description: "Magic items, weapons, and treasure tracking",
      icon: Sword,
      status: "Coming Soon"
    },
    {
      title: "Quick References",
      description: "Rules, tables, and useful D&D references",
      icon: Scroll,
      status: "Coming Soon"
    },
    {
      title: "Dice Roller",
      description: "Digital dice for quick rolls during sessions",
      icon: Dice6,
      status: "Coming Soon"
    },
    {
      title: "Quest Tracker",
      description: "Active quests, objectives, and rewards",
      icon: Compass,
      status: "Coming Soon"
    }
  ];

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
          <Button 
            onClick={logout}
            variant="outline"
            className="border-amber-200 text-amber-100 hover:bg-amber-700 hover:text-white"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-amber-900 mb-2">Welcome, Dungeon Master!</h2>
          <p className="text-amber-700">
            Your campaign management tools are ready. Select a feature below to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card 
                key={index} 
                className="border-2 border-amber-200 hover:border-amber-400 transition-all duration-200 hover:shadow-lg bg-gradient-to-br from-white to-amber-50 cursor-pointer group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <IconComponent className="h-8 w-8 text-amber-700 group-hover:text-amber-800 transition-colors" />
                    <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                      {feature.status}
                    </span>
                  </div>
                  <CardTitle className="text-lg text-amber-900 group-hover:text-amber-800 transition-colors">
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
                Each feature will be built out as you need them. Click on any card above to start developing that tool!
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
