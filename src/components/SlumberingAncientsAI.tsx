
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Sparkles, Send, User, Bot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SlumberingAncientsAIProps {
  onBack: () => void;
}

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

const SlumberingAncientsAI: React.FC<SlumberingAncientsAIProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Greetings, seeker of ancient knowledge. I am your guide through the mysteries and lore of this realm. I can only share what has been preserved in the sacred texts and chronicles that have been gathered. What ancient secrets do you wish to uncover?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('slumbering-ancients-search', {
        body: { message: inputMessage }
      });

      if (error) {
        throw error;
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "I apologize, but I encountered an issue while searching the ancient texts. Please try again.",
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I'm having trouble accessing the ancient knowledge at the moment. Please ensure the sacred texts have been properly gathered and try again.",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <header className="bg-gradient-to-r from-purple-800 to-indigo-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button 
            onClick={onBack}
            variant="outline"
            className="border-purple-200 text-purple-100 hover:bg-purple-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center space-x-3">
            <Sparkles className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">Slumbering Ancients AI Assistant</h1>
              <p className="text-purple-100 text-sm">Knowledge from the Sacred Chronicles</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="border-purple-200 mb-6">
          <CardHeader>
            <CardTitle className="text-purple-900 flex items-center">
              <Sparkles className="h-5 w-5 mr-2" />
              Ancient Knowledge Repository
            </CardTitle>
            <CardDescription>
              This AI assistant can only answer questions based on the campaign materials that have been 
              scraped from your Google Drive. Ask about ancient lore, mysteries, NPCs, locations, and 
              other campaign details that exist in your documented materials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">What this assistant knows:</h3>
              <ul className="text-purple-700 space-y-1">
                <li>• Information from your scraped markdown files</li>
                <li>• Campaign lore and world-building details</li>
                <li>• Character backgrounds and histories</li>
                <li>• Location descriptions and mysteries</li>
                <li>• Quest details and plot hooks from your materials</li>
              </ul>
              <p className="text-purple-600 text-sm mt-3 italic">
                Note: The assistant can only provide information that exists in your scraped campaign materials.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 h-[600px] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-purple-900">Chat with the Ancient Oracle</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start space-x-3 ${
                      message.isUser ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.isUser 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-indigo-600 text-white'
                    }`}>
                      {message.isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`flex-1 max-w-[80%] ${
                      message.isUser ? 'text-right' : ''
                    }`}>
                      <div className={`rounded-lg p-3 ${
                        message.isUser 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-100 rounded-lg p-3">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="border-t border-purple-200 p-4">
              <div className="flex space-x-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about the ancient lore and mysteries..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SlumberingAncientsAI;
