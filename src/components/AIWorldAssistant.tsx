
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  Bot, 
  Send, 
  Sparkles, 
  Users, 
  MapPin, 
  Scroll,
  Crown,
  Swords
} from 'lucide-react';

interface AIWorldAssistantProps {
  onBack: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AIWorldAssistant: React.FC<AIWorldAssistantProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hello, Dungeon Master! I'm your AI World Assistant. I can help you with world building, creating NPCs, developing plot hooks, generating locations, and answering D&D rules questions. What would you like to work on today?",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const quickPrompts = [
    {
      icon: Users,
      title: "Create an NPC",
      prompt: "Create a detailed NPC for my campaign including their background, personality, and motivations."
    },
    {
      icon: MapPin,
      title: "Generate Location",
      prompt: "Generate an interesting location for my campaign with a detailed description and potential plot hooks."
    },
    {
      icon: Scroll,
      title: "Plot Hook",
      prompt: "Give me an engaging plot hook that could lead to an adventure for my party."
    },
    {
      icon: Crown,
      title: "Random Encounter",
      prompt: "Create a random encounter appropriate for a mid-level party in a fantasy setting."
    },
    {
      icon: Swords,
      title: "Magic Item",
      prompt: "Design a unique magic item with an interesting backstory and balanced mechanics."
    }
  ];

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    if (!apiKey.trim()) {
      alert('Please enter your Perplexity API key first.');
      return;
    }

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
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are an expert D&D Dungeon Master assistant. Help with world building, NPCs, plot hooks, locations, rules questions, and campaign management. Be creative, detailed, and provide practical advice for running D&D campaigns. Format your responses clearly and include specific details that a DM can use directly in their game.'
            },
            {
              role: 'user',
              content: inputMessage
            }
          ],
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 1000,
          frequency_penalty: 1,
          presence_penalty: 0
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.choices[0].message.content,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: "I apologize, but I'm having trouble connecting right now. Please check your API key and try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputMessage(prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
              <p className="text-amber-100 text-sm">Your intelligent D&D companion</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* API Key Input */}
        <Card className="mb-6 border-amber-200">
          <CardHeader>
            <CardTitle className="text-amber-900 flex items-center">
              <Sparkles className="h-5 w-5 mr-2" />
              Setup Required
            </CardTitle>
            <CardDescription>
              Enter your Perplexity API key to enable AI assistance. Get one at{' '}
              <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer" className="text-amber-700 underline">
                perplexity.ai/settings/api
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-amber-800">Perplexity API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Perplexity API key..."
                className="border-amber-300 focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Prompts */}
          <div className="lg:col-span-1">
            <Card className="border-amber-200 h-fit">
              <CardHeader>
                <CardTitle className="text-amber-900">Quick Prompts</CardTitle>
                <CardDescription>Click to use these common requests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickPrompts.map((prompt, index) => {
                  const IconComponent = prompt.icon;
                  return (
                    <Button
                      key={index}
                      onClick={() => handleQuickPrompt(prompt.prompt)}
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
