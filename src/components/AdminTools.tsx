
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Settings, Database, Bot, Globe, Trash2, Download, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminToolsProps {
  onBack: () => void;
}

const AdminTools: React.FC<AdminToolsProps> = ({ onBack }) => {
  const [wikiUrl, setWikiUrl] = useState('https://wiki.the-guild.io');
  const [isLoading, setIsLoading] = useState(false);
  const [scraperStatus, setScraperStatus] = useState('');
  const [wikiStats, setWikiStats] = useState({ totalPages: 0, lastUpdate: null });
  const { toast } = useToast();

  useEffect(() => {
    loadWikiStats();
  }, []);

  const loadWikiStats = async () => {
    try {
      const { data, error } = await supabase
        .from('wiki_content')
        .select('*', { count: 'exact' });
      
      if (error) throw error;
      
      setWikiStats({
        totalPages: data?.length || 0,
        lastUpdate: data && data.length > 0 ? data[0].updated_at : null
      });
    } catch (error) {
      console.error('Error loading wiki stats:', error);
    }
  };

  const handleScrapeWiki = async () => {
    setIsLoading(true);
    setScraperStatus('Starting wiki scraping...');
    
    try {
      // Call the edge function to scrape the wiki
      const { data, error } = await supabase.functions.invoke('scrape-wiki', {
        body: { baseUrl: wikiUrl }
      });

      if (error) throw error;

      setScraperStatus(`Successfully scraped ${data.pagesScraped} pages`);
      await loadWikiStats();
      
      toast({
        title: "Wiki Scraping Complete",
        description: `Successfully processed ${data.pagesScraped} pages from your wiki.`,
      });
    } catch (error) {
      console.error('Scraping error:', error);
      setScraperStatus('Error occurred during scraping');
      toast({
        title: "Scraping Failed",
        description: "There was an error scraping the wiki. Please check the URL and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm('Are you sure you want to clear all wiki data? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('wiki_content')
        .delete()
        .neq('id', ''); // Delete all rows

      if (error) throw error;

      await loadWikiStats();
      toast({
        title: "Database Cleared",
        description: "All wiki content has been removed from the database.",
      });
    } catch (error) {
      console.error('Error clearing database:', error);
      toast({
        title: "Clear Failed",
        description: "There was an error clearing the database.",
        variant: "destructive",
      });
    }
  };

  const handleExportData = async () => {
    try {
      const { data, error } = await supabase
        .from('wiki_content')
        .select('*');

      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wiki-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: "Wiki data has been exported successfully.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting the data.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <header className="bg-gradient-to-r from-slate-800 to-gray-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button 
            onClick={onBack}
            variant="outline"
            className="border-slate-200 text-slate-100 hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center space-x-3">
            <Settings className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">Admin Tools</h1>
              <p className="text-slate-100 text-sm">Wiki Management & AI Configuration</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Wiki Scraping Section */}
        <Card className="border-slate-200 mb-6">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Wiki Content Scraper
            </CardTitle>
            <CardDescription>
              Scrape content from your wiki to build the knowledge base for the AI assistant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label htmlFor="wiki-url" className="block text-sm font-medium text-slate-700 mb-2">
                  Wiki Base URL
                </label>
                <Input
                  id="wiki-url"
                  type="url"
                  value={wikiUrl}
                  onChange={(e) => setWikiUrl(e.target.value)}
                  placeholder="https://wiki.the-guild.io"
                  className="w-full"
                />
              </div>
              
              <div className="flex space-x-3">
                <Button 
                  onClick={handleScrapeWiki}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isLoading ? 'Scraping...' : 'Start Scraping'}
                </Button>
                <Button 
                  onClick={handleExportData}
                  variant="outline"
                  disabled={wikiStats.totalPages === 0}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
              </div>

              {scraperStatus && (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <p className="text-slate-700">{scraperStatus}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Database Stats Section */}
        <Card className="border-slate-200 mb-6">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center">
              <Database className="h-5 w-5 mr-2" />
              Knowledge Base Statistics
            </CardTitle>
            <CardDescription>
              Current status of your wiki content database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Total Pages</h3>
                <p className="text-2xl font-bold text-blue-600">{wikiStats.totalPages}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Last Updated</h3>
                <p className="text-slate-600">
                  {wikiStats.lastUpdate 
                    ? new Date(wikiStats.lastUpdate).toLocaleDateString()
                    : 'Never'
                  }
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <Button 
                onClick={handleClearDatabase}
                variant="destructive"
                disabled={wikiStats.totalPages === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI Configuration Section */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center">
              <Bot className="h-5 w-5 mr-2" />
              AI Assistant Configuration
            </CardTitle>
            <CardDescription>
              Configure how the AI processes and responds using your wiki content.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-2">Current Configuration</h3>
              <ul className="text-slate-700 space-y-1">
                <li>• Vector embedding dimensions: 1536 (OpenAI compatible)</li>
                <li>• Similarity search algorithm: Cosine similarity</li>
                <li>• Content processing: Automatic chunking and embedding</li>
                <li>• Update frequency: Manual via scraper</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminTools;
