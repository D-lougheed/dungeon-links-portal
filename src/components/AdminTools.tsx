// Key updates to the AdminTools component to handle enhanced statistics

// Updated interface for enhanced progress state
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

// Updated handleScrapeGoogleDrive function with enhanced data handling
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
      statistics: data.statistics,
      success: data.success
    });

    // Update progress state with enhanced results
    setProgressState(prev => ({
      ...prev,
      isActive: false,
      totalFiles: data.totalDiscovered || 0,
      processedFiles: data.pagesScraped || 0,
      skippedFiles: data.pagesSkipped || 0,
      filesProcessedThisRun: data.filesProcessedThisRun || 0,
      hasMoreFiles: data.filesRemainingForNextRun > 0,
      stage: 'Complete',
      statistics: data.statistics,
      apiRequestsMade: data.apiRequestsMade,
      maxApiRequests: data.maxApiRequests,
      rateLimitErrors: data.rateLimitErrors || 0,
      errors: [
        ...(data.rateLimitErrors > 0 ? [`${data.rateLimitErrors} files failed due to rate limiting`] : []),
        ...(data.errors || [])
      ]
    }));

    const modeText = incremental ? 'incremental (recent changes only)' : 'full';
    let statusMessage = `Successfully completed ${modeText} scraping: ${data.pagesScraped || 0} files processed`;
    
    if (data.filesRemainingForNextRun > 0) {
      statusMessage += ` (${data.filesRemainingForNextRun} files remaining for next run)`;
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
    
    // Enhanced toast with detailed statistics
    let toastDescription = `Successfully processed ${data.pagesScraped || 0} markdown files`;
    if (data.statistics?.processing) {
      const stats = data.statistics.processing;
      toastDescription += ` (${stats.actuallyNew} new, ${stats.actuallyUpdated} updated, ${stats.actuallyUnchanged} unchanged)`;
    }
    if (data.filesRemainingForNextRun > 0) {
      toastDescription += `. ${data.filesRemainingForNextRun} files remaining for next run.`;
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

// Updated handleGetMissing function with similar enhancements
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
    
    setProgressState(prev => ({
      ...prev,
      stage: 'Calling edge function...'
    }));
    
    const startTime = Date.now();
    
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

    // Update progress state with enhanced results
    setProgressState(prev => ({
      ...prev,
      isActive: false,
      totalFiles: data.totalDiscovered || 0,
      processedFiles: data.pagesScraped || 0,
      skippedFiles: data.pagesSkipped || 0,
      filesProcessedThisRun: data.filesProcessedThisRun || 0,
      hasMoreFiles: data.filesRemainingForNextRun > 0,
      stage: 'Complete',
      statistics: data.statistics,
      apiRequestsMade: data.apiRequestsMade,
      maxApiRequests: data.maxApiRequests,
      rateLimitErrors: data.rateLimitErrors || 0,
      errors: [
        ...(data.rateLimitErrors > 0 ? [`${data.rateLimitErrors} files failed due to rate limiting`] : []),
        ...(data.errors || [])
      ]
    }));

    let statusMessage = `Missing files scan complete: Found ${data.missingFiles || 0} missing files, successfully processed ${data.pagesScraped || 0}`;
    
    if (data.filesRemainingForNextRun > 0) {
      statusMessage += ` (${data.filesRemainingForNextRun} files remaining for next run)`;
    }
    
    setScraperStatus(statusMessage);
    
    await loadWikiStats();
    await loadWikiPages();
    
    // Enhanced toast with detailed missing files statistics
    let toastDescription = `Found and processed ${data.pagesScraped || 0} missing files`;
    if (data.statistics?.discovery?.missingFilesFound !== undefined) {
      toastDescription = `Found ${data.statistics.discovery.missingFilesFound} missing files, processed ${data.pagesScraped || 0} successfully`;
    }
    if (data.filesRemainingForNextRun > 0) {
      toastDescription += `. ${data.filesRemainingForNextRun} files remaining for next run.`;
    }
    
    toast({
      title: "Missing Files Scan Complete",
      description: toastDescription,
    });
  } catch (error) {
    console.error('💥 Missing files scan error:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    
    setScraperStatus('Error occurred during missing files scan: ' + errorMessage);
    setScrapingDetails({
      stage: 'Error',
      errors: [errorMessage]
    });
    
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

// Updated Progress Bar component usage
{(progressState.isActive || progressState.totalFiles > 0) && (
  <div className="mb-6">
    <DetailedProgress
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
      statistics={progressState.statistics}
      apiRequestsMade={progressState.apiRequestsMade}
      maxApiRequests={progressState.maxApiRequests}
      rateLimitErrors={progressState.rateLimitErrors}
    />
  </div>
)}

// Enhanced continuation notice with better statistics
{progressState.hasMoreFiles && !progressState.isActive && (
  <Card className="border-amber-200 bg-amber-50 mb-6">
    <CardHeader className="pb-3">
      <CardTitle className="text-amber-900 flex items-center text-lg">
        <AlertTriangle className="h-5 w-5 mr-2" />
        More Files Available - Continue Processing
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <div className="bg-white border border-amber-200 rounded-lg p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-amber-900">
                {progressState.statistics?.completion?.filesRemaining || 'Unknown'}
              </div>
              <div className="text-xs text-amber-700">Files Remaining</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {progressState.processedFiles}
              </div>
              <div className="text-xs text-amber-700">Successfully Processed</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600">
                {progressState.statistics?.completion?.progressPercentage || 0}%
              </div>
              <div className="text-xs text-amber-700">Overall Progress</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-600">
                {progressState.apiRequestsMade || 0}/{progressState.maxApiRequests || 0}
              </div>
              <div className="text-xs text-amber-700">API Requests Used</div>
            </div>
          </div>
        </div>
        
        <p className="text-amber-800">
          The scraper processes files in chunks to prevent timeouts and rate limiting issues. 
          {progressState.statistics?.completion?.filesRemaining 
            ? ` There are ${progressState.statistics.completion.filesRemaining} more files ready for processing.`
            : ' Continue processing the remaining files when ready.'
          }
        </p>
        
        <Button 
          onClick={progressState.mode === 'missing' ? handleGetMissing : () => handleScrapeGoogleDrive(progressState.mode === 'incremental')}
          disabled={isLoading || isIncrementalLoading || isMissingLoading}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          Continue Processing Remaining Files
        </Button>
      </div>
    </CardContent>
  </Card>
)}
