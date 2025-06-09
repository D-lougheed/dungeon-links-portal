
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface InteractiveMapProps {
  onBack: () => void;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <header className="bg-gradient-to-r from-amber-800 to-orange-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Button 
              onClick={onBack}
              variant="outline"
              className="border-amber-200 text-amber-100 hover:bg-amber-700 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Interactive World Map</h1>
              <p className="text-amber-100 text-sm">
                Currently under maintenance
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-amber-900 mb-4">
              Map Component Temporarily Disabled
            </h2>
            <p className="text-amber-700">
              This page has been cleared for troubleshooting. Please check back later.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InteractiveMap;
