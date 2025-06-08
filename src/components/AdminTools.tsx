import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Settings, Database, Bot, Globe, Trash2, Download, Upload, RefreshCw, Clock, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AdminToolsProps {
  onBack: () => void;
}

interface ScrapingStatus {
  currentUrl?: string;
  stage?: string;
  pagesProcessed?: number;
  pagesSkipped?: number;
  errors?: string[];
  discoveredUrls?: string[];
}

const AdminTools: React.FC<AdminToolsProps> = ({ onBack }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isIncrementalLoading, setIsIncrementalLoading] = useState(false);
  const [scraperStatus, setScraperStatus] = useState('');
  const [scrapingDetails, setScrapingDetails] = useState<ScrapingStatus>({});
  const [wikiStats, setWikiStats] = useState({ totalPages: 0, lastUpdate: null });
  const [wikiPages, setWikiPages] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadWikiStats();
    loadWikiPages();
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

  const loadWikiPages = async () => {
    try {
      const { data, error } = await supabase
        .from('wiki_content')
        .select('id, url, title, content, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setWikiPages(data || []);
    } catch (error) {
      console.error('Error loading wiki pages:', error);
    }
  };

  const handleScrapeGoogleDrive = async (incremental = false) => {
    const setLoadingState = incremental ? setIsIncrementalLoading : setIsLoading;
    
    setLoadingState(true);
    setScraperStatus(`Starting ${incremental ? 'incremental' : 'full'} Google Drive scraping...`);
    setScrapingDetails({});
    
    try {
      console.log(`Starting ${incremental ? 'incremental' : 'full'} scrape with configured Google Drive folder`);
      
      const { data, error } = await supabase.functions.invoke('scrape-wiki', {
        body: { incremental }
      });

      console.log('Scrape response:', data, error);

      if (error) throw error;

      const modeText = incremental ? 'incremental (recent changes only)' : 'full';
      setScraperStatus(`Successfully completed ${modeText} scraping: ${data.pagesScraped} files out of ${data.totalDiscovered} discovered .md files`);
      
      setScrapingDetails({
        pagesProcessed: data.pagesScraped,
        pagesSkipped: data.pagesSkipped,
        stage: 'Complete'
      });
      
      await loadWikiStats();
      await loadWikiPages();
      
      toast({
        title: `${incremental ? 'Incremental' : 'Full'} Google Drive Scraping Complete`,
        description: `Successfully processed ${data.pagesScraped} markdown files from ${data.totalDiscovered} discovered files.${data.rateLimitErrors > 0 ? ` Note: ${data.rateLimitErrors} files failed due to rate limiting.` : ''}`,
      });
    } catch (error) {
      console.error('Scraping error:', error);
      setScraperStatus(`Error occurred during ${incremental ? 'incremental' : 'full'} scraping: ` + error.message);
      setScrapingDetails({
        stage: 'Error',
        errors: [error.message]
      });
      toast({
        title: "Scraping Failed",
        description: "There was an error scraping Google Drive. This may be due to rate limiting - try the incremental scan or wait a few minutes.",
        variant: "destructive",
      });
    } finally {
      setLoadingState(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm('Are you sure you want to clear all wiki data? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('Clearing all wiki content...');
      const { error } = await supabase
        .from('wiki_content')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      await loadWikiStats();
      await loadWikiPages();
      setScraperStatus('Database cleared successfully');
      
      toast({
        title: "Database Cleared",
        description: "All wiki content has been removed from the database.",
      });
    } catch (error) {
      console.error('Error clearing database:', error);
      toast({
        title: "Clear Failed",
        description: "There was an error clearing the database: " + error.message,
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
              <p className="text-slate-100 text-sm">Google Drive Scraping & AI Configuration</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Google Drive Scraping Section */}
        <Card className="border-slate-200 mb-6">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Google Drive Content Scraper
            </CardTitle>
            <CardDescription>
              Automatically scan the configured Google Drive folder for .md files and update the knowledge base. 
              Use incremental scan for recent changes only (last 7 days) to avoid rate limiting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                <h3 className="font-medium text-slate-900 mb-2">Configuration Status</h3>
                <ul className="text-sm text-slate-700 space-y-1">
                  <li>• Google Drive API Key: Configured</li>
                  <li>• Target Folder: Configured (via secrets)</li>
                  <li>• Scan Mode: Recursive (includes subfolders)</li>
                  <li>• File Types: .md (Markdown files only)</li>
                  <li>• Rate Limiting: Enhanced with exponential backoff</li>
                  <li>• Incremental Mode: Available (scans last 7 days)</li>
                </ul>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => handleScrapeGoogleDrive(false)}
                  disabled={isLoading || isIncrementalLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  {isLoading ? 'Full Scraping...' : 'Full Scrape'}
                </Button>
                
                <Button 
                  onClick={() => handleScrapeGoogleDrive(true)}
                  disabled={isLoading || isIncrementalLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isIncrementalLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                  {isIncrementalLoading ? 'Quick Scraping...' : 'Quick Scrape (Recent)'}
                </Button>
                
                <Button 
                  onClick={handleExportData}
                  variant="outline"
                  disabled={wikiStats.totalPages === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
                
                <Button 
                  onClick={handleClearDatabase}
                  variant="destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Database
                </Button>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                <h4 className="font-medium text-amber-900 mb-1">💡 Pro Tips</h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• Use <strong>Quick Scrape</strong> for daily updates - only scans files modified in the last 7 days</li>
                  <li>• Use <strong>Full Scrape</strong> for initial setup or after major changes</li>
                  <li>• If you see 403 errors, wait 5-10 minutes before trying again</li>
                  <li>• The scraper now has enhanced rate limiting to avoid Google's automated query detection</li>
                </ul>
              </div>

              {scraperStatus && (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <p className="text-slate-700 font-medium">Status: {scraperStatus}</p>
                  {scrapingDetails.stage && (
                    <p className="text-slate-600 text-sm">Stage: {scrapingDetails.stage}</p>
                  )}
                  {scrapingDetails.pagesProcessed !== undefined && (
                    <p className="text-slate-600 text-sm">Files Processed: {scrapingDetails.pagesProcessed}</p>
                  )}
                  {scrapingDetails.pagesSkipped !== undefined && (
                    <p className="text-slate-600 text-sm">Files Skipped: {scrapingDetails.pagesSkipped}</p>
                  )}
                  {scrapingDetails.errors && scrapingDetails.errors.length > 0 && (
                    <div className="text-red-600 text-sm mt-2">
                      <p className="font-medium">Errors:</p>
                      {scrapingDetails.errors.map((error, index) => (
                        <p key={index}>• {error}</p>
                      ))}
                    </div>
                  )}
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
              Current status of your markdown content database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Total Files</h3>
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

            {/* Recent Files Table */}
            {wikiPages.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Recent Files (Last 10)</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Content Preview</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wikiPages.map((page) => (
                        <TableRow key={page.id}>
                          <TableCell className="font-medium">{page.title}</TableCell>
                          <TableCell className="text-sm text-blue-600 max-w-xs truncate">
                            {page.url.startsWith('gdrive://') ? (
                              <span className="text-green-600">Google Drive</span>
                            ) : (
                              <a href={page.url} target="_blank" rel="noopener noreferrer">
                                {page.url}
                              </a>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 max-w-md truncate">
                            {page.content?.substring(0, 100)}...
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {new Date(page.updated_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
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
              Configure how the AI processes and responds using your Google Drive content.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-2">Current Configuration</h3>
              <ul className="text-slate-700 space-y-1">
                <li>• Vector embedding dimensions: 1536 (OpenAI compatible)</li>
                <li>• Similarity search algorithm: Cosine similarity</li>
                <li>• Content processing: Automatic markdown cleaning and embedding</li>
                <li>• Update frequency: Manual via scraper (full or incremental)</li>
                <li>• Source: Google Drive .md files (configured folder)</li>
                <li>• Recursive folder scanning: Enabled</li>
                <li>• Content deduplication: Hash-based change detection</li>
                <li>• Rate limiting: Enhanced with exponential backoff and retry logic</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminTools;
