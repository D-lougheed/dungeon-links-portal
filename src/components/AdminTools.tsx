import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Settings, Database, Bot, Globe, Trash2, Download, Upload, RefreshCw, Clock, Zap, Search, AlertTriangle, MapPin, Eye } from 'lucide-react';
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

interface MapData {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  image_url: string;
  created_at: string;
}

interface MapArea {
  id: string;
  area_name: string;
  area_type: string;
  description?: string;
  terrain_features: string[];
  landmarks: string[];
  general_location?: string;
  confidence_score?: number;
  bounding_box?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null;
}

const AdminTools: React.FC<AdminToolsProps> = ({ onBack }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isIncrementalLoading, setIsIncrementalLoading] = useState(false);
  const [isMissingLoading, setIsMissingLoading] = useState(false);
  const [isAnalyzingMap, setIsAnalyzingMap] = useState(false);
  const [scraperStatus, setScraperStatus] = useState('');
  const [scrapingDetails, setScrapingDetails] = useState<ScrapingStatus>({});
  const [wikiStats, setWikiStats] = useState({ totalPages: 0, lastUpdate: null });
  const [wikiPages, setWikiPages] = useState<any[]>([]);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [mapAreas, setMapAreas] = useState<MapArea[]>([]);
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
    loadMaps();
  }, []);

  const loadMaps = async () => {
    try {
      const { data, error } = await supabase
        .from('maps')
        .select('id, name, description, width, height, image_url, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMaps(data || []);
    } catch (error) {
      console.error('Error loading maps:', error);
    }
  };

  const loadMapAreas = async (mapId: string) => {
    try {
      const { data, error } = await supabase
        .from('map_areas')
        .select('*')
        .eq('map_id', mapId)
        .order('area_name');
      
      if (error) throw error;
      
      // Transform the data to match our MapArea interface
      const transformedAreas: MapArea[] = (data || []).map(area => ({
        id: area.id,
        area_name: area.area_name,
        area_type: area.area_type,
        description: area.description,
        terrain_features: Array.isArray(area.terrain_features) ? area.terrain_features.map(item => String(item)) : [],
        landmarks: Array.isArray(area.landmarks) ? area.landmarks.map(item => String(item)) : [],
        general_location: area.general_location,
        confidence_score: area.confidence_score,
        bounding_box: area.bounding_box
      }));
      
      setMapAreas(transformedAreas);
    } catch (error) {
      console.error('Error loading map areas:', error);
    }
  };

  const handleAnalyzeMap = async () => {
    if (!selectedMapId) {
      toast({
        title: "No Map Selected",
        description: "Please select a map to analyze.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzingMap(true);
    console.log('🔍 Starting map analysis for:', selectedMapId);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-map', {
        body: { mapId: selectedMapId }
      });

      if (error) {
        console.error('❌ Analysis error:', error);
        throw error;
      }

      console.log('✅ Analysis complete:', data);

      await loadMapAreas(selectedMapId);

      toast({
        title: "Map Analysis Complete",
        description: `Successfully analyzed "${data.map_name}" and identified ${data.areas_analyzed} distinct areas.`,
      });

    } catch (error) {
      console.error('💥 Map analysis error:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      
      toast({
        title: "Analysis Failed",
        description: `There was an error analyzing the map: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzingMap(false);
    }
  };

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
              <p className="text-slate-100 text-sm">Google Drive Scraping, Map Analysis & AI Configuration</p>
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

        {/* Map Image Analysis Section */}
        <Card className="border-slate-200 mb-6">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Map Image Analysis
            </CardTitle>
            <CardDescription>
              Analyze map images using AI to identify terrain features, landmarks, and regions with their coordinates automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                <h3 className="font-medium text-slate-900 mb-2">Available Maps</h3>
                {maps.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      className="w-full p-2 border border-slate-300 rounded-md"
                      value={selectedMapId}
                      onChange={(e) => {
                        setSelectedMapId(e.target.value);
                        if (e.target.value) {
                          loadMapAreas(e.target.value);
                        }
                      }}
                    >
                      <option value="">Select a map to analyze...</option>
                      {maps.map((map) => (
                        <option key={map.id} value={map.id}>
                          {map.name} ({map.width}x{map.height})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-slate-600">No maps available. Upload maps in the Interactive Maps section first.</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={handleAnalyzeMap}
                  disabled={!selectedMapId || isAnalyzingMap}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isAnalyzingMap ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                  {isAnalyzingMap ? 'Analyzing Map...' : 'Analyze Selected Map'}
                </Button>
              </div>

              {/* Map Analysis Results */}
              {selectedMapId && mapAreas.length > 0 && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-green-900">Analysis Results ({mapAreas.length} areas identified)</h4>
                    <div className="text-sm text-green-700">
                      {mapAreas.filter(area => area.bounding_box).length} areas have coordinates
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                    {mapAreas.map((area) => (
                      <div key={area.id} className="bg-white border border-green-200 p-3 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-semibold text-green-900">{area.area_name}</h5>
                          <div className="flex gap-1">
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              {area.area_type}
                            </span>
                            {area.bounding_box && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                📍 Mapped
                              </span>
                            )}
                          </div>
                        </div>
                        {area.description && (
                          <p className="text-sm text-green-700 mb-2">{area.description}</p>
                        )}
                        {area.general_location && (
                          <p className="text-xs text-green-600 mb-1">
                            <strong>Location:</strong> {area.general_location}
                          </p>
                        )}
                        {area.bounding_box && (
                          <p className="text-xs text-blue-600 mb-1">
                            <strong>Coordinates:</strong> ({area.bounding_box.x1.toFixed(3)}, {area.bounding_box.y1.toFixed(3)}) to ({area.bounding_box.x2.toFixed(3)}, {area.bounding_box.y2.toFixed(3)})
                          </p>
                        )}
                        {area.terrain_features.length > 0 && (
                          <p className="text-xs text-green-600 mb-1">
                            <strong>Terrain:</strong> {area.terrain_features.join(', ')}
                          </p>
                        )}
                        {area.landmarks.length > 0 && (
                          <p className="text-xs text-green-600 mb-1">
                            <strong>Landmarks:</strong> {area.landmarks.join(', ')}
                          </p>
                        )}
                        {area.confidence_score && (
                          <p className="text-xs text-green-600">
                            <strong>Confidence:</strong> {Math.round(area.confidence_score * 100)}%
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-1">💡 How It Works</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>AI Vision Analysis:</strong> Uses GPT-4 Vision to analyze map images</li>
                  <li>• <strong>Coordinate Detection:</strong> AI identifies bounding box coordinates for each area</li>
                  <li>• <strong>Automatic Detection:</strong> Identifies terrain, landmarks, regions, and settlements</li>
                  <li>• <strong>Structured Results:</strong> Stores analysis with coordinates in database</li>
                  <li>• <strong>Location Mapping:</strong> Provides both general location and precise coordinates</li>
                  <li>• <strong>Confidence Scoring:</strong> AI provides confidence levels for each identification</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

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
                <li>• Map analysis: AI-powered terrain and landmark identification</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminTools;
