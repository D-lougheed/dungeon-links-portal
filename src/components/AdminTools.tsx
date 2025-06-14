import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Settings, Database, Bot, Globe, Trash2, Download, Upload, RefreshCw, Clock, Zap, Search, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ScrapeProgress from './ScrapeProgress';

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

interface ProgressState {
  isActive: boolean;
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  currentFile?: string;
  stage?: string;
  errors: string[];
  mode?: string;
  filesProcessedThisRun?: number;
  hasMoreFiles?: boolean;
}

const AdminTools: React.FC<AdminToolsProps> = ({ onBack }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isIncrementalLoading, setIsIncrementalLoading] = useState(false);
  const [isMissingLoading, setIsMissingLoading] = useState(false);
  const [scraperStatus, setScraperStatus] = useState('');
  const [scrapingDetails, setScrapingDetails] = useState<ScrapingStatus>({});
  const [wikiStats, setWikiStats] = useState({ totalPages: 0, lastUpdate: null });
  const [wikiPages, setWikiPages] = useState<any[]>([]);
  const [progressState, setProgressState] = useState<ProgressState>({
    isActive: false,
    totalFiles: 0,
    processedFiles: 0,
    skippedFiles: 0,
    errors: [],
  });
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
    const mode = incremental ? 'incremental' : 'full';
    
    console.log(`🚀 Starting ${mode} Google Drive scraping...`);
    
    setLoadingState(true);
    setScraperStatus(`Starting ${mode} Google Drive scraping...`);
    setScrapingDetails({});
    
    // Reset and activate progress state
    setProgressState({
      isActive: true,
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      errors: [],
      mode,
      stage: 'Initializing...'
    });
    
    try {
      console.log(`📡 Invoking scrape-wiki edge function with incremental=${incremental}`);
      
      // Update progress to show we're calling the function
      setProgressState(prev => ({
        ...prev,
        stage: 'Calling edge function...'
      }));
      
      const startTime = Date.now();
      
      const { data, error } = await supabase.functions.invoke('scrape-wiki', {
        body: { incremental, maxFiles: 50 }
      });

      const duration = Date.now() - startTime;
      console.log(`⏱️ Edge function completed in ${duration}ms`);
      console.log('📊 Edge function response:', { data, error });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw error;
      }

      if (!data) {
        console.error('❌ Edge function returned no data');
        throw new Error('Edge function returned no data');
      }

      console.log('✅ Edge function completed successfully:', {
        totalDiscovered: data.totalDiscovered,
        filesProcessedThisRun: data.filesProcessedThisRun,
        pagesScraped: data.pagesScraped,
        pagesSkipped: data.pagesSkipped,
        rateLimitErrors: data.rateLimitErrors,
        success: data.success
      });

      // Check if there are more files to process
      const hasMoreFiles = data.totalDiscovered > (data.filesProcessedThisRun || 0);

      // Update progress state with final results
      setProgressState(prev => ({
        ...prev,
        isActive: false,
        totalFiles: data.totalDiscovered || 0,
        processedFiles: data.pagesScraped || 0,
        skippedFiles: data.pagesSkipped || 0,
        filesProcessedThisRun: data.filesProcessedThisRun || 0,
        hasMoreFiles,
        stage: 'Complete',
        errors: [
          ...(data.rateLimitErrors > 0 ? [`${data.rateLimitErrors} files failed due to rate limiting`] : []),
          ...(data.errors || [])
        ]
      }));

      const modeText = incremental ? 'incremental (recent changes only)' : 'full';
      let statusMessage = `Successfully completed ${modeText} scraping: ${data.pagesScraped || 0} files processed`;
      
      if (hasMoreFiles) {
        statusMessage += ` (${data.totalDiscovered - (data.filesProcessedThisRun || 0)} files remaining for next run)`;
      }
      
      setScraperStatus(statusMessage);
      
      setScrapingDetails({
        pagesProcessed: data.pagesScraped || 0,
        pagesSkipped: data.pagesSkipped || 0,
        stage: 'Complete',
        errors: [
          ...(data.rateLimitErrors > 0 ? [`${data.rateLimitErrors} files failed due to rate limiting`] : []),
          ...(data.errors || [])
        ]
      });
      
      await loadWikiStats();
      await loadWikiPages();
      
      let toastDescription = `Successfully processed ${data.pagesScraped || 0} markdown files`;
      if (hasMoreFiles) {
        toastDescription += `. ${data.totalDiscovered - (data.filesProcessedThisRun || 0)} files remaining for next run.`;
      }
      if ((data.rateLimitErrors || 0) > 0) {
        toastDescription += ` Note: ${data.rateLimitErrors} files failed due to rate limiting.`;
      }
      
      toast({
        title: `${incremental ? 'Incremental' : 'Full'} Google Drive Scraping Complete`,
        description: toastDescription,
      });
    } catch (error) {
      console.error('💥 Scraping error:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      console.error('💥 Error details:', {
        message: errorMessage,
        stack: error.stack,
        name: error.name
      });
      
      setScraperStatus(`Error occurred during ${mode} scraping: ${errorMessage}`);
      setScrapingDetails({
        stage: 'Error',
        errors: [errorMessage]
      });
      
      // Update progress state with error
      setProgressState(prev => ({
        ...prev,
        isActive: false,
        errors: [errorMessage],
        stage: 'Error'
      }));
      
      toast({
        title: "Scraping Failed",
        description: `There was an error scraping Google Drive: ${errorMessage}. Check the console for more details.`,
        variant: "destructive",
      });
    } finally {
      console.log(`🏁 ${mode} scraping process finished`);
      setLoadingState(false);
    }
  };

  const handleGetMissing = async () => {
    console.log('🔍 Starting missing files scan...');
    
    setIsMissingLoading(true);
    setScraperStatus('Starting missing files scan...');
    setScrapingDetails({});
    
    // Reset and activate progress state
    setProgressState({
      isActive: true,
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      errors: [],
      mode: 'missing',
      stage: 'Initializing missing files scan...'
    });
    
    try {
      console.log('📡 Invoking scrape-wiki edge function with getMissing=true');
      
      // Update progress to show we're calling the function
      setProgressState(prev => ({
        ...prev,
        stage: 'Calling edge function...'
      }));
      
      const startTime = Date.now();
      
      // Use smaller batch size for missing files to prevent timeouts
      const { data, error } = await supabase.functions.invoke('scrape-wiki', {
        body: { getMissing: true, maxFiles: 25 }
      });

      const duration = Date.now() - startTime;
      console.log(`⏱️ Missing files scan completed in ${duration}ms`);
      console.log('📊 Missing files scan response:', { data, error });

      if (error) {
        console.error('❌ Missing files scan error:', error);
        throw error;
      }

      if (!data) {
        console.error('❌ Missing files scan returned no data');
        throw new Error('Missing files scan returned no data');
      }

      console.log('✅ Missing files scan completed successfully:', {
        totalDiscovered: data.totalDiscovered,
        missingFiles: data.missingFiles,
        filesProcessedThisRun: data.filesProcessedThisRun,
        pagesScraped: data.pagesScraped,
        pagesSkipped: data.pagesSkipped,
        rateLimitErrors: data.rateLimitErrors,
        success: data.success
      });

      // Check if there are more files to process
      const hasMoreFiles = data.totalDiscovered > (data.filesProcessedThisRun || 0);

      // Update progress state with final results
      setProgressState(prev => ({
        ...prev,
        isActive: false,
        totalFiles: data.totalDiscovered || 0,
        processedFiles: data.pagesScraped || 0,
        skippedFiles: data.pagesSkipped || 0,
        filesProcessedThisRun: data.filesProcessedThisRun || 0,
        hasMoreFiles,
        stage: 'Complete',
        errors: [
          ...(data.rateLimitErrors > 0 ? [`${data.rateLimitErrors} files failed due to rate limiting`] : []),
          ...(data.errors || [])
        ]
      }));

      let statusMessage = `Missing files scan complete: Found ${data.missingFiles || 0} missing files, successfully processed ${data.pagesScraped || 0}`;
      
      if (hasMoreFiles) {
        statusMessage += ` (${data.totalDiscovered - (data.filesProcessedThisRun || 0)} files remaining for next run)`;
      }
      
      setScraperStatus(statusMessage);
      
      setScrapingDetails({
        pagesProcessed: data.pagesScraped || 0,
        pagesSkipped: data.pagesSkipped || 0,
        stage: 'Complete',
        errors: [
          ...(data.rateLimitErrors > 0 ? [`${data.rateLimitErrors} files failed due to rate limiting`] : []),
          ...(data.errors || [])
        ]
      });
      
      await loadWikiStats();
      await loadWikiPages();
      
      let toastDescription = `Found and processed ${data.pagesScraped || 0} missing files`;
      if (hasMoreFiles) {
        toastDescription += `. ${data.totalDiscovered - (data.filesProcessedThisRun || 0)} files remaining for next run.`;
      }
      if ((data.rateLimitErrors || 0) > 0) {
        toastDescription += ` Note: ${data.rateLimitErrors} files failed due to rate limiting.`;
      }
      
      toast({
        title: "Missing Files Scan Complete",
        description: toastDescription,
      });
    } catch (error) {
      console.error('💥 Missing files scan error:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      console.error('💥 Error details:', {
        message: errorMessage,
        stack: error.stack,
        name: error.name
      });
      
      setScraperStatus('Error occurred during missing files scan: ' + errorMessage);
      setScrapingDetails({
        stage: 'Error',
        errors: [errorMessage]
      });
      
      // Update progress state with error
      setProgressState(prev => ({
        ...prev,
        isActive: false,
        errors: [errorMessage],
        stage: 'Error'
      }));
      
      toast({
        title: "Missing Files Scan Failed",
        description: `There was an error scanning for missing files: ${errorMessage}. Check the console for more details.`,
        variant: "destructive",
      });
    } finally {
      console.log('🏁 Missing files scan process finished');
      setIsMissingLoading(false);
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
        {/* Progress Bar - Show when scraping is active or has results */}
        {(progressState.isActive || progressState.totalFiles > 0) && (
          <div className="mb-6">
            <ScrapeProgress
              isActive={progressState.isActive}
              totalFiles={progressState.totalFiles}
              processedFiles={progressState.processedFiles}
              skippedFiles={progressState.skippedFiles}
              currentFile={progressState.currentFile}
              stage={progressState.stage}
              errors={progressState.errors}
              mode={progressState.mode}
              filesProcessedThisRun={progressState.filesProcessedThisRun}
              hasMoreFiles={progressState.hasMoreFiles}
            />
          </div>
        )}

        {/* Show continuation notice if there are more files */}
        {progressState.hasMoreFiles && !progressState.isActive && (
          <Card className="border-amber-200 bg-amber-50 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-amber-900 flex items-center text-lg">
                <AlertTriangle className="h-5 w-5 mr-2" />
                More Files Available
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-amber-800 mb-3">
                There are {progressState.totalFiles - (progressState.filesProcessedThisRun || 0)} more files that can be processed. 
                The scraper processes files in chunks to prevent timeouts and rate limiting issues.
              </p>
              <Button 
                onClick={progressState.mode === 'missing' ? handleGetMissing : () => handleScrapeGoogleDrive(progressState.mode === 'incremental')}
                disabled={isLoading || isIncrementalLoading || isMissingLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Continue Processing Remaining Files
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Debug Information */}
        {(isLoading || isIncrementalLoading || isMissingLoading || progressState.isActive) && (
          <Card className="border-blue-200 bg-blue-50 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-blue-900 flex items-center text-lg">
                🔧 Debug Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white border border-blue-200 p-3 rounded-lg">
                <div className="text-sm text-blue-800 space-y-1">
                  <div>• Loading States: Full={isLoading ? 'true' : 'false'}, Incremental={isIncrementalLoading ? 'true' : 'false'}, Missing={isMissingLoading ? 'true' : 'false'}</div>
                  <div>• Progress Active: {progressState.isActive ? 'true' : 'false'}</div>
                  <div>• Current Stage: {progressState.stage || 'None'}</div>
                  <div>• Mode: {progressState.mode || 'None'}</div>
                  <div>• Files: {progressState.processedFiles}/{progressState.totalFiles} (Skipped: {progressState.skippedFiles})</div>
                  <div>• This Run: {progressState.filesProcessedThisRun || 0} files processed</div>
                  <div>• More Files: {progressState.hasMoreFiles ? 'Yes' : 'No'}</div>
                  <div>• Errors: {progressState.errors.length}</div>
                  <div className="text-xs text-blue-600 mt-2">Check browser console (F12) for detailed logs.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Google Drive Scraping Section */}
        <Card className="border-slate-200 mb-6">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Google Drive Content Scraper
            </CardTitle>
            <CardDescription>
              Automatically scan the configured Google Drive folder for .md files and update the knowledge base. 
              Files are processed in chunks to prevent timeouts and rate limiting issues.
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
                  <li>• Processing: Chunked (50 files per run for full/incremental, 25 for missing)</li>
                  <li>• Rate Limiting: Enhanced with conservative delays and timeout protection</li>
                  <li>• Incremental Mode: Available (scans last 7 days)</li>
                  <li>• Missing Files Mode: Available (targets missing files only)</li>
                </ul>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => handleScrapeGoogleDrive(false)}
                  disabled={isLoading || isIncrementalLoading || isMissingLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  {isLoading ? 'Full Scraping...' : 'Full Scrape'}
                </Button>
                
                <Button 
                  onClick={() => handleScrapeGoogleDrive(true)}
                  disabled={isLoading || isIncrementalLoading || isMissingLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isIncrementalLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                  {isIncrementalLoading ? 'Quick Scraping...' : 'Quick Scrape (Recent)'}
                </Button>

                <Button 
                  onClick={handleGetMissing}
                  disabled={isLoading || isIncrementalLoading || isMissingLoading}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isMissingLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  {isMissingLoading ? 'Scanning Missing...' : 'Get Missing Files'}
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
                  <li>• <strong>Chunked Processing:</strong> Files are processed in batches to prevent timeouts</li>
                  <li>• <strong>Continue Processing:</strong> If more files remain, use the "Continue" button that appears</li>
                  <li>• <strong>Quick Scrape:</strong> Only scans files modified in the last 7 days</li>
                  <li>• <strong>Get Missing Files:</strong> Processes files not yet in the database (smaller batches)</li>
                  <li>• <strong>Rate Limiting:</strong> Conservative delays prevent Google API issues</li>
                  <li>• <strong>Error Recovery:</strong> Failed files are reported for manual investigation</li>
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
                <li>• Update frequency: Manual via scraper (chunked processing)</li>
                <li>• Source: Google Drive .md files (configured folder)</li>
                <li>• Recursive folder scanning: Enabled</li>
                <li>• Content deduplication: Hash-based change detection</li>
                <li>• Rate limiting: Conservative with timeout protection</li>
                <li>• Chunk size: 50 files (full/incremental), 25 files (missing)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminTools;
