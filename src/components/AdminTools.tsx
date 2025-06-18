
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Settings, Database, Bot, Globe, Trash2, Download, Upload, RefreshCw, Clock, Zap, Search, AlertTriangle, MapPin, Eye, CheckCircle, XCircle, Activity, BarChart3, TrendingUp, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ScrapeProgress from '@/components/ScrapeProgress';

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

interface EnhancedProgressState {
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
  
  // Enhanced statistics
  statistics?: {
    discovery?: {
      totalInGoogleDrive: number;
      totalInDatabase: number;
      newFilesFound: number;
      missingFilesFound?: number;
      unchangedFilesSkipped: number;
    };
    processing?: {
      filesAttempted: number;
      filesSuccessful: number;
      filesFailed: number;
      actuallyNew: number;
      actuallyUpdated: number;
      actuallyUnchanged: number;
    };
    completion?: {
      progressPercentage: number;
      filesRemaining: number;
      isComplete: boolean;
    };
  };
  
  // API usage stats
  apiRequestsMade?: number;
  maxApiRequests?: number;
  rateLimitErrors?: number;
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

// Enhanced Progress Component
const DetailedProgress: React.FC<EnhancedProgressState> = ({
  isActive,
  totalFiles,
  processedFiles,
  skippedFiles,
  currentFile,
  stage,
  errors,
  mode,
  filesProcessedThisRun,
  hasMoreFiles,
  statistics,
  apiRequestsMade,
  maxApiRequests,
  rateLimitErrors
}) => {
  const getModeIcon = () => {
    switch (mode) {
      case 'missing': return <Search className="h-5 w-5" />;
      case 'incremental': return <Zap className="h-5 w-5" />;
      default: return <Globe className="h-5 w-5" />;
    }
  };

  const getModeDescription = () => {
    switch (mode) {
      case 'missing': return 'Processing missing files only';
      case 'incremental': return 'Processing recent files (last 7 days)';
      default: return 'Processing all markdown files';
    }
  };

  const progressPercentage = totalFiles > 0 ? ((processedFiles + skippedFiles) / totalFiles) * 100 : 0;
  const successRate = (processedFiles + skippedFiles) > 0 ? (processedFiles / (processedFiles + skippedFiles)) * 100 : 0;

  if (!isActive && totalFiles === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-blue-900 flex items-center text-lg">
          <Clock className="h-5 w-5 mr-2" />
          Enhanced Processing Progress
          {stage && <span className="ml-2 text-sm font-normal text-blue-700">({stage})</span>}
        </CardTitle>
        <CardDescription className="text-blue-700 flex items-center">
          {getModeIcon()}
          <span className="ml-2">{getModeDescription()}</span>
          {hasMoreFiles && !isActive && (
            <span className="ml-2 bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-medium">
              Chunked Processing
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-blue-900">Progress</span>
            <span className="text-blue-700">
              {processedFiles + skippedFiles} / {totalFiles} files
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          <div className="flex justify-between text-xs text-blue-600">
            <span>{progressPercentage.toFixed(1)}% complete</span>
            {hasMoreFiles && (
              <span className="flex items-center">
                <RefreshCw className="h-3 w-3 mr-1" />
                More files available
              </span>
            )}
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg p-3 border border-blue-200">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-lg font-semibold text-green-700">{processedFiles}</div>
                <div className="text-xs text-green-600">Processed</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 border border-blue-200">
            <div className="flex items-center space-x-2">
              <XCircle className="h-4 w-4 text-gray-500" />
              <div>
                <div className="text-lg font-semibold text-gray-600">{skippedFiles}</div>
                <div className="text-xs text-gray-500">Skipped</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 border border-blue-200">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-lg font-semibold text-blue-700">{totalFiles}</div>
                <div className="text-xs text-blue-600">
                  {hasMoreFiles ? 'Discovered' : 'Total'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Statistics */}
        {statistics && (
          <div className="space-y-3">
            {statistics.discovery && (
              <div className="bg-white rounded-lg p-3 border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                  <Search className="h-4 w-4 mr-1" />
                  Discovery Statistics
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Google Drive: {statistics.discovery.totalInGoogleDrive}</div>
                  <div>Database: {statistics.discovery.totalInDatabase}</div>
                  <div>New Found: {statistics.discovery.newFilesFound}</div>
                  <div>Unchanged: {statistics.discovery.unchangedFilesSkipped}</div>
                </div>
              </div>
            )}

            {statistics.processing && (
              <div className="bg-white rounded-lg p-3 border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                  <Activity className="h-4 w-4 mr-1" />
                  Processing Statistics
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Attempted: {statistics.processing.filesAttempted}</div>
                  <div>Successful: {statistics.processing.filesSuccessful}</div>
                  <div>Failed: {statistics.processing.filesFailed}</div>
                  <div>Actually New: {statistics.processing.actuallyNew}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* API Usage Stats */}
        {apiRequestsMade && maxApiRequests && (
          <div className="bg-white rounded-lg p-3 border border-blue-200">
            <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
              <BarChart3 className="h-4 w-4 mr-1" />
              API Usage
            </h4>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Requests Made:</span>
                <span>{apiRequestsMade} / {maxApiRequests}</span>
              </div>
              <Progress 
                value={(apiRequestsMade / maxApiRequests) * 100} 
                className="h-2"
              />
              {rateLimitErrors && rateLimitErrors > 0 && (
                <div className="text-xs text-red-600">
                  Rate Limit Errors: {rateLimitErrors}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Current File */}
        {currentFile && isActive && (
          <div className="bg-white rounded-lg p-3 border border-blue-200">
            <div className="text-sm font-medium text-blue-900 mb-1">Currently Processing:</div>
            <div className="text-sm text-blue-700 truncate">{currentFile}</div>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-900">
                Errors ({errors.length})
              </span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {errors.slice(0, 5).map((error, index) => (
                <div key={index} className="text-xs text-red-700 bg-red-100 rounded px-2 py-1 truncate">
                  • {error}
                </div>
              ))}
              {errors.length > 5 && (
                <div className="text-xs text-red-600 italic">
                  ... and {errors.length - 5} more errors
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success Rate */}
        {(processedFiles + skippedFiles) > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-blue-900">Success Rate</span>
              <span className="text-blue-700">{successRate.toFixed(1)}%</span>
            </div>
            <Progress value={successRate} className="h-2" />
          </div>
        )}

        {/* Completion Message */}
        {!isActive && totalFiles > 0 && (
          <div className={`border rounded-lg p-3 ${errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center space-x-2">
              {errors.length > 0 ? (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              <span className={`text-sm font-medium ${errors.length > 0 ? 'text-yellow-900' : 'text-green-900'}`}>
                {hasMoreFiles ? (
                  `Batch completed: Processed ${processedFiles} out of ${filesProcessedThisRun || totalFiles} files in this run`
                ) : errors.length > 0 ? (
                  `Processing completed with issues: ${processedFiles} successful, ${errors.length} errors`
                ) : (
                  `Processing completed successfully! Processed ${processedFiles} out of ${totalFiles} files.`
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AdminTools: React.FC<AdminToolsProps> = ({ onBack }) => {
  const { toast } = useToast();
  const [progressState, setProgressState] = useState<EnhancedProgressState>({
    isActive: false,
    totalFiles: 0,
    processedFiles: 0,
    skippedFiles: 0,
    errors: []
  });
  const [scrapingStatus, setScrapingStatus] = useState<ScrapingStatus>({});
  const [mapData, setMapData] = useState<MapData[]>([]);
  const [mapAreas, setMapAreas] = useState<MapArea[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadMapData();
    loadMapAreas();
  }, []);

  const loadMapData = async () => {
    try {
      const { data, error } = await supabase
        .from('maps')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMapData(data || []);
    } catch (error) {
      console.error('Error loading map data:', error);
      toast({
        title: "Error",
        description: "Failed to load map data",
        variant: "destructive",
      });
    }
  };

  const loadMapAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('map_areas')
        .select('*')
        .order('area_name');

      if (error) throw error;
      setMapAreas(data || []);
    } catch (error) {
      console.error('Error loading map areas:', error);
      toast({
        title: "Error",
        description: "Failed to load map areas",
        variant: "destructive",
      });
    }
  };

  const startScraping = async (mode: string = 'full') => {
    try {
      setIsLoading(true);
      setProgressState({
        isActive: true,
        totalFiles: 0,
        processedFiles: 0,
        skippedFiles: 0,
        errors: [],
        mode,
        stage: 'Initializing...'
      });

      const { data, error } = await supabase.functions.invoke('scrape-wiki', {
        body: { mode }
      });

      if (error) throw error;

      toast({
        title: "Scraping Started",
        description: `${mode} scraping has been initiated`,
      });

      // Poll for progress updates
      pollProgress();
    } catch (error) {
      console.error('Error starting scraping:', error);
      toast({
        title: "Error",
        description: "Failed to start scraping",
        variant: "destructive",
      });
      setProgressState(prev => ({ ...prev, isActive: false }));
    } finally {
      setIsLoading(false);
    }
  };

  const pollProgress = () => {
    const interval = setInterval(async () => {
      try {
        // This would need to be implemented to fetch actual progress
        // For now, this is a placeholder
        const mockProgress = {
          isActive: Math.random() > 0.8, // Randomly complete
          totalFiles: 100,
          processedFiles: Math.floor(Math.random() * 50),
          skippedFiles: Math.floor(Math.random() * 20),
          errors: [],
          currentFile: 'example-file.md',
          stage: 'Processing files...'
        };

        setProgressState(mockProgress);

        if (!mockProgress.isActive) {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Error polling progress:', error);
        clearInterval(interval);
      }
    }, 2000);
  };

  const clearDatabase = async () => {
    if (!confirm('Are you sure you want to clear all scraped data? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('scraped_content')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (error) throw error;

      toast({
        title: "Database Cleared",
        description: "All scraped content has been removed",
      });
    } catch (error) {
      console.error('Error clearing database:', error);
      toast({
        title: "Error",
        description: "Failed to clear database",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={onBack}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Tools</h1>
              <p className="text-gray-600">Manage system data and operations</p>
            </div>
          </div>
        </div>

        {/* Progress Display */}
        <DetailedProgress {...progressState} />

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Database Operations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Database Operations</span>
              </CardTitle>
              <CardDescription>
                Manage scraped content and database operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => startScraping('full')}
                disabled={isLoading || progressState.isActive}
                className="w-full"
              >
                <Globe className="h-4 w-4 mr-2" />
                Full Scrape
              </Button>
              <Button
                onClick={() => startScraping('incremental')}
                disabled={isLoading || progressState.isActive}
                variant="outline"
                className="w-full"
              >
                <Zap className="h-4 w-4 mr-2" />
                Incremental Scrape
              </Button>
              <Button
                onClick={() => startScraping('missing')}
                disabled={isLoading || progressState.isActive}
                variant="outline"
                className="w-full"
              >
                <Search className="h-4 w-4 mr-2" />
                Missing Files Only
              </Button>
              <Button
                onClick={clearDatabase}
                disabled={isLoading}
                variant="destructive"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Database
              </Button>
            </CardContent>
          </Card>

          {/* Map Data Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Map Data</span>
              </CardTitle>
              <CardDescription>
                Overview of uploaded maps and analyzed areas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Maps:</span>
                  <span className="font-semibold">{mapData.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Analyzed Areas:</span>
                  <span className="font-semibold">{mapAreas.length}</span>
                </div>
                <Button
                  onClick={loadMapData}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>System Status</span>
              </CardTitle>
              <CardDescription>
                Current system performance and health
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Scraping Status:</span>
                  <span className={`text-sm font-medium ${progressState.isActive ? 'text-blue-600' : 'text-green-600'}`}>
                    {progressState.isActive ? 'Active' : 'Idle'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Error Count:</span>
                  <span className="text-sm font-medium text-red-600">
                    {progressState.errors.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Update:</span>
                  <span className="text-sm text-gray-500">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Maps */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Maps</CardTitle>
              <CardDescription>
                Recently uploaded map files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Dimensions</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapData.slice(0, 5).map((map) => (
                    <TableRow key={map.id}>
                      <TableCell className="font-medium">{map.name}</TableCell>
                      <TableCell>{map.width} × {map.height}</TableCell>
                      <TableCell>{new Date(map.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent Map Areas */}
          <Card>
            <CardHeader>
              <CardTitle>Map Areas</CardTitle>
              <CardDescription>
                AI-analyzed map regions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Area Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapAreas.slice(0, 5).map((area) => (
                    <TableRow key={area.id}>
                      <TableCell className="font-medium">{area.area_name}</TableCell>
                      <TableCell>{area.area_type}</TableCell>
                      <TableCell>
                        {area.confidence_score ? `${(area.confidence_score * 100).toFixed(1)}%` : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminTools;
