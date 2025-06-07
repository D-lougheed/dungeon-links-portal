
import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Sparkles } from 'lucide-react';

interface SlumberingAncientsAIProps {
  onBack: () => void;
}

const SlumberingAncientsAI: React.FC<SlumberingAncientsAIProps> = ({ onBack }) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let styleElement: HTMLLinkElement | null = null;
    let scriptElement: HTMLScriptElement | null = null;

    // Load the n8n chat widget
    const loadN8nChat = () => {
      try {
        // Create and load the CSS file
        styleElement = document.createElement('link');
        styleElement.rel = 'stylesheet';
        styleElement.href = 'https://unpkg.com/@n8n/chat/style.css';
        document.head.appendChild(styleElement);

        // Create and load the JavaScript file
        scriptElement = document.createElement('script');
        scriptElement.src = 'https://unpkg.com/@n8n/chat/dist/index.js';
        scriptElement.onload = () => {
          // Initialize the chat widget once the script is loaded
          if (window.n8nChat && chatContainerRef.current) {
            window.n8nChat.createChat({
              webhookUrl: 'https://n8n.the-guild.io/webhook/23c49d79-5abb-4f61-ae06-3d9d95962011/chat',
              target: chatContainerRef.current
            });
          }
        };
        scriptElement.onerror = () => {
          console.error('Failed to load n8n chat script');
        };
        document.body.appendChild(scriptElement);
      } catch (error) {
        console.error('Failed to load n8n chat widget:', error);
      }
    };

    loadN8nChat();

    // Cleanup when component unmounts
    return () => {
      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
      if (scriptElement && scriptElement.parentNode) {
        scriptElement.parentNode.removeChild(scriptElement);
      }
      // Remove any existing chat widgets
      const chatElements = document.querySelectorAll('.n8n-chat');
      chatElements.forEach(element => element.remove());
    };
  }, []);

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
              <p className="text-purple-100 text-sm">Ancient Lore & Mysteries</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="border-purple-200 mb-6">
          <CardHeader>
            <CardTitle className="text-purple-900 flex items-center">
              <Sparkles className="h-5 w-5 mr-2" />
              Welcome to the Slumbering Ancients
            </CardTitle>
            <CardDescription>
              Dive deep into ancient lore, forgotten civilizations, and mysterious artifacts. 
              This specialized AI assistant is trained to help you explore the deeper mysteries of your campaign world.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">What can this assistant help with?</h3>
              <ul className="text-purple-700 space-y-1">
                <li>• Ancient civilizations and their secrets</li>
                <li>• Mysterious artifacts and their origins</li>
                <li>• Forgotten languages and prophecies</li>
                <li>• Cosmic horrors and eldritch mysteries</li>
                <li>• Archaeological discoveries and ruins</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardContent className="p-0">
            <div ref={chatContainerRef} className="min-h-[600px] p-4">
              {/* The n8n chat widget will be injected here */}
              <div className="flex items-center justify-center h-64 text-purple-600">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 animate-pulse" />
                  <p>Loading Slumbering Ancients AI...</p>
                  <p className="text-sm text-purple-500 mt-2">The ancient knowledge is awakening...</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

// Extend the Window interface to include n8nChat
declare global {
  interface Window {
    n8nChat?: {
      createChat: (config: { webhookUrl: string; target?: HTMLElement }) => void;
    };
  }
}

export default SlumberingAncientsAI;
