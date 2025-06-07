
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, 
  Bot, 
  Send, 
  Sparkles, 
  Users, 
  MapPin, 
  Scroll,
  Crown,
  Swords,
  Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AIWorldAssistantProps {
  onBack: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PromptCustomization {
  playerLevel: string | null;
  groupSize: string | null;
  sessionDifficulty: string | null;
  encounterDifficulty: string | null;
}

const AIWorldAssistant: React.FC<AIWorldAssistantProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hello, Dungeon Master! I'm your AI World Assistant powered by ChatGPT. I can help you with world building, creating NPCs, developing plot hooks, generating locations, and answering D&D rules questions. Customize the settings above to get more tailored suggestions, then choose a quick prompt or ask me anything!",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [customization, setCustomization] = useState<PromptCustomization>({
    playerLevel: null,
    groupSize: null,
    sessionDifficulty: null,
    encounterDifficulty: null
  });

  const quickPrompts = [
    {
      icon: Users,
      title: "Create an NPC",
      basePrompt: "Create a detailed NPC for my campaign including their background, personality, and motivations."
    },
    {
      icon: MapPin,
      title: "Generate Location",
      basePrompt: "Generate an interesting location for my campaign with a detailed description and potential plot hooks."
    },
    {
      icon: Scroll,
      title: "Plot Hook",
      basePrompt: "Give me an engaging plot hook that could lead to an adventure for my party."
    },
    {
      icon: Crown,
      title: "Random Encounter",
      basePrompt: "Create a random encounter appropriate for a mid-level party in a fantasy setting."
    },
    {
      icon: Swords,
      title: "Magic Item",
      basePrompt: "Design a unique magic item with an interesting backstory and balanced mechanics."
    }
  ];

  const buildCustomizedPrompt = (basePrompt: string): string => {
    let customizedPrompt = basePrompt;
    const context: string[] = [];

    if (customization.playerLevel) {
      context.push(`for a level ${customization.playerLevel} party`);
    }
    if (customization.groupSize) {
      context.push(`with ${customization.groupSize} players`);
    }
    if (customization.sessionDifficulty) {
      context.push(`session difficulty ${customization.sessionDifficulty}/10`);
    }
    if (customization.encounterDifficulty) {
      context.push(`encounter difficulty ${customization.encounterDifficulty}/10`);
    }

    if (context.length > 0) {
      customizedPrompt += ` Please tailor this ${context.join(', ')}.`;
    }

    return customizedPrompt;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat-gpt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: "I apologize, but I'm having trouble connecting right now. Please try again later.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (basePrompt: string) => {
    const customizedPrompt = buildCustomizedPrompt(basePrompt);
    setInputMessage(customizedPrompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const resetCustomization = () => {
    setCustomization({
      playerLevel: null,
      groupSize: null,
      sessionDifficulty: null,
      encounterDifficulty: null
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <header className="bg-gradient-to-r from-amber-800 to-orange-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button 
            onClick={onBack}
            variant="outline"
            className="border-amber-200 text-amber-100 hover:bg-amber-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center space-x-3">
            <Bot className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">AI World Assistant</h1>
              <p className="text-amber-100 text-sm">Powered by ChatGPT</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Customization Controls */}
        <Card className="mb-6 border-amber-200">
          <CardHeader>
            <CardTitle className="text-amber-900 flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Customize Your Prompts
            </CardTitle>
            <CardDescription>
              Set these values to get more tailored AI suggestions for your campaign
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="playerLevel" className="text-amber-800">Player Level</Label>
                <Select value={customization.playerLevel || ""} onValueChange={(value) => 
                  setCustomization(prev => ({ ...prev, playerLevel: value || null }))
                }>
                  <SelectTrigger className="border-amber-300 focus:border-amber-500">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(level => (
                      <SelectItem key={level} value={level.toString()}>
                        Level {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="groupSize" className="text-amber-800">Group Size</Label>
                <Select value={customization.groupSize || ""} onValueChange={(value) => 
                  setCustomization(prev => ({ ...prev, groupSize: value || null }))
                }>
                  <SelectTrigger className="border-amber-300 focus:border-amber-500">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(size => (
                      <SelectItem key={size} value={size.toString()}>
                        {size} Player{size > 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessionDifficulty" className="text-amber-800">Session Difficulty</Label>
                <Select value={customization.sessionDifficulty || ""} onValueChange={(value) => 
                  setCustomization(prev => ({ ...prev, sessionDifficulty: value || null }))
                }>
                  <SelectTrigger className="border-amber-300 focus:border-amber-500">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(difficulty => (
                      <SelectItem key={difficulty} value={difficulty.toString()}>
                        {difficulty}/10
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="encounterDifficulty" className="text-amber-800">Encounter Difficulty</Label>
                <Select value={customization.encounterDifficulty || ""} onValueChange={(value) => 
                  setCustomization(prev => ({ ...prev, encounterDifficulty: value || null }))
                }>
                  <SelectTrigger className="border-amber-300 focus:border-amber-500">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(difficulty => (
                      <SelectItem key={difficulty} value={difficulty.toString()}>
                        {difficulty}/10
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button 
              onClick={resetCustomization}
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              Reset All
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Prompts */}
          <div className="lg:col-span-1">
            <Card className="border-amber-200 h-fit">
              <CardHeader>
                <CardTitle className="text-amber-900">Quick Prompts</CardTitle>
                <CardDescription>Click to use these customized requests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickPrompts.map((prompt, index) => {
                  const IconComponent = prompt.icon;
                  return (
                    <Button
                      key={index}
                      onClick={() => handleQuickPrompt(prompt.basePrompt)}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 border-amber-300 hover:bg-amber-50"
                    >
                      <IconComponent className="h-4 w-4 mr-3 text-amber-700" />
                      <div>
                        <div className="font-medium text-amber-900">{prompt.title}</div>
                      </div>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <Card className="border-amber-200 h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle className="text-amber-900 flex items-center">
                  <Bot className="h-5 w-5 mr-2" />
                  AI Assistant Chat
                </CardTitle>
              </CardHeader>
              
              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-amber-700 text-white'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      <div className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-amber-200' : 'text-amber-600'
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-amber-50 text-amber-900 border border-amber-200 p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-700"></div>
                        <span>AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>

              {/* Input Area */}
              <div className="p-4 border-t border-amber-200">
                <div className="flex space-x-2">
                  <Textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about D&D, world building, NPCs, or campaign management..."
                    className="flex-1 min-h-[80px] border-amber-300 focus:border-amber-500 focus:ring-amber-500 resize-none"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    className="bg-amber-700 hover:bg-amber-800 text-white"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIWorldAssistant;
