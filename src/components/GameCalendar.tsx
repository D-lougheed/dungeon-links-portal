
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar } from 'lucide-react';

interface GameCalendarProps {
  onBack: () => void;
}

const GameCalendar = ({ onBack }: GameCalendarProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <header className="bg-gradient-to-r from-amber-800 to-orange-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button 
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-amber-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">Game Calendar</h1>
              <p className="text-amber-100 text-sm">Campaign Schedule & Events</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="border-2 border-amber-200 bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="text-amber-900 flex items-center space-x-2">
              <Calendar className="h-6 w-6" />
              <span>Campaign Calendar</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-hidden">
              <iframe 
                src="https://calendar.google.com/calendar/embed?src=b7c93baf874de91bee1a96e24a94de82cfbd9cd06eb94e91d9e9706bacea1deb%40group.calendar.google.com&ctz=America%2FNew_York" 
                style={{ border: 0 }} 
                width="100%" 
                height="600" 
                frameBorder="0" 
                scrolling="no"
                title="Game Calendar"
                className="rounded-b-lg"
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default GameCalendar;
