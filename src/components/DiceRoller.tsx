
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Dice6 } from 'lucide-react';

interface DiceRollerProps {
  onBack: () => void;
}

interface DiceRoll {
  id: string;
  diceType: string;
  result: number;
  timestamp: Date;
}

const DiceRoller = ({ onBack }: DiceRollerProps) => {
  const [recentRolls, setRecentRolls] = useState<DiceRoll[]>([]);

  const rollDice = (sides: number, diceType: string) => {
    const result = Math.floor(Math.random() * sides) + 1;
    const newRoll: DiceRoll = {
      id: Date.now().toString(),
      diceType,
      result,
      timestamp: new Date()
    };

    setRecentRolls(prev => [newRoll, ...prev.slice(0, 9)]); // Keep last 10 rolls
  };

  const diceTypes = [
    { sides: 4, name: 'D4', color: 'bg-red-500 hover:bg-red-600' },
    { sides: 6, name: 'D6', color: 'bg-blue-500 hover:bg-blue-600' },
    { sides: 10, name: 'D10', color: 'bg-green-500 hover:bg-green-600' },
    { sides: 12, name: 'D12', color: 'bg-purple-500 hover:bg-purple-600' },
    { sides: 20, name: 'D20', color: 'bg-orange-500 hover:bg-orange-600' },
    { sides: 100, name: 'D100', color: 'bg-pink-500 hover:bg-pink-600' }
  ];

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
            <Dice6 className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">Dice Roller</h1>
              <p className="text-amber-100 text-sm">Digital Dice for Your Adventures</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Dice Rolling Section */}
          <Card className="border-2 border-amber-200 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center space-x-2">
                <Dice6 className="h-6 w-6" />
                <span>Roll the Dice</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {diceTypes.map((dice) => (
                  <Button
                    key={dice.name}
                    onClick={() => rollDice(dice.sides, dice.name)}
                    className={`${dice.color} text-white font-bold py-6 px-4 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg flex flex-col items-center space-y-2`}
                  >
                    <Dice6 className="h-8 w-8" />
                    <span className="text-lg">{dice.name}</span>
                  </Button>
                ))}
              </div>
              
              {/* Random Dice Roller */}
              <div className="mt-8 pt-6 border-t border-amber-200">
                <h3 className="text-lg font-semibold text-amber-900 mb-4">Random Dice Roll</h3>
                <Button
                  onClick={() => {
                    const randomDice = diceTypes[Math.floor(Math.random() * diceTypes.length)];
                    rollDice(randomDice.sides, randomDice.name);
                  }}
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                >
                  <Dice6 className="h-6 w-6" />
                  <span className="text-lg">Roll Random Dice!</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recently Rolled Section */}
          <Card className="border-2 border-amber-200 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Dice6 className="h-6 w-6" />
                  <span>Recent Rolls</span>
                </div>
                {recentRolls.length > 0 && (
                  <Button
                    onClick={() => setRecentRolls([])}
                    variant="outline"
                    size="sm"
                    className="text-amber-700 border-amber-300 hover:bg-amber-50"
                  >
                    Clear History
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentRolls.length === 0 ? (
                <div className="text-center py-8 text-amber-600">
                  <Dice6 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No dice rolled yet. Start rolling to see your results here!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentRolls.map((roll) => (
                    <div
                      key={roll.id}
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-amber-600 text-white rounded-full font-bold">
                          {roll.result}
                        </div>
                        <div>
                          <div className="font-semibold text-amber-900">{roll.diceType}</div>
                          <div className="text-sm text-amber-600">
                            {roll.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <Dice6 className="h-5 w-5 text-amber-500" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default DiceRoller;
