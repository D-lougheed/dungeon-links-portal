
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, FileText, CheckCircle, XCircle, AlertTriangle, Info, Download, Globe, Zap } from 'lucide-react';

interface ScrapeProgressProps {
  isActive: boolean;
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  currentFile?: string;
  stage?: string;
  errors?: string[];
  mode?: string;
}

interface ErrorStats {
  rateLimit: number;
  permission: number;
  network: number;
  fileSize: number;
  apiQuota: number;
  other: number;
}

const ScrapeProgress: React.FC<ScrapeProgressProps> = ({
  isActive,
  totalFiles,
  processedFiles,
  skippedFiles,
  currentFile,
  stage,
  errors = [],
  mode = 'scraping'
}) => {
  const progressPercentage = totalFiles > 0 ? ((processedFiles + skippedFiles) / totalFiles) * 100 : 0;
  const successRate = (processedFiles + skippedFiles) > 0 ? (processedFiles / (processedFiles + skippedFiles)) * 100 : 0;

  // Categorize errors for better diagnostics
  const categorizeErrors = (errors: string[]): ErrorStats => {
    const stats: ErrorStats = {
      rateLimit: 0,
      permission: 0,
      network: 0,
      fileSize: 0,
      apiQuota: 0,
      other: 0
    };

    errors.forEach(error => {
      const errorLower = error.toLowerCase();
      if (errorLower.includes('rate limit') || errorLower.includes('403') || errorLower.includes('automated queries')) {
        stats.rateLimit++;
      } else if (errorLower.includes('permission') || errorLower.includes('unauthorized') || errorLower.includes('access denied')) {
        stats.permission++;
      } else if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('connection')) {
        stats.network++;
      } else if (errorLower.includes('file size') || errorLower.includes('too large') || errorLower.includes('quota exceeded')) {
        stats.fileSize++;
      } else if (errorLower.includes('api key') || errorLower.includes('quota') || errorLower.includes('billing')) {
        stats.apiQuota++;
      } else {
        stats.other++;
      }
    });

    return stats;
  };

  const errorStats = categorizeErrors(errors);
  const hasErrors = errors.length > 0;

  if (!isActive && totalFiles === 0) {
    return null;
  }

  const getModeIcon = () => {
    switch (mode) {
      case 'missing': return <Download className="h-5 w-5" />;
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

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-blue-900 flex items-center text-lg">
          <Clock className="h-5 w-5 mr-2" />
          Scraping Progress
          {stage && <span className="ml-2 text-sm font-normal text-blue-700">({stage})</span>}
        </CardTitle>
        <CardDescription className="text-blue-700 flex items-center">
          {getModeIcon()}
          <span className="ml-2">{getModeDescription()}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-blue-900">Overall Progress</span>
            <span className="text-blue-700">
              {processedFiles + skippedFiles} / {totalFiles} files
            </span>
          </div>
          <Progress 
            value={progressPercentage} 
            className="h-3"
          />
          <div className="text-xs text-blue-600 text-center">
            {progressPercentage.toFixed(1)}% complete
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
                <div className="text-xs text-blue-600">Total</div>
              </div>
            </div>
          </div>
        </div>

        {/* Success Rate */}
        {(processedFiles + skippedFiles) > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-blue-900">Success Rate</span>
              <span className="text-blue-700">{successRate.toFixed(1)}%</span>
            </div>
            <Progress 
              value={successRate} 
              className="h-2"
            />
          </div>
        )}

        {/* Current File */}
        {currentFile && isActive && (
          <div className="bg-white rounded-lg p-3 border border-blue-200">
            <div className="text-sm font-medium text-blue-900 mb-1">Currently Processing:</div>
            <div className="text-sm text-blue-700 truncate">{currentFile}</div>
          </div>
        )}

        {/* Enhanced Error Analysis */}
        {hasErrors && (
          <div className="space-y-3">
            {/* Error Summary */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-900">
                  Error Analysis ({errors.length} total errors)
                </span>
              </div>

              {/* Error Category Breakdown */}
              {(errorStats.rateLimit > 0 || errorStats.permission > 0 || errorStats.network > 0 || 
                errorStats.fileSize > 0 || errorStats.apiQuota > 0 || errorStats.other > 0) && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {errorStats.rateLimit > 0 && (
                    <div className="bg-orange-100 border border-orange-200 rounded p-2">
                      <div className="text-xs font-medium text-orange-900">Rate Limiting</div>
                      <div className="text-sm text-orange-800">{errorStats.rateLimit} files</div>
                    </div>
                  )}
                  {errorStats.permission > 0 && (
                    <div className="bg-red-100 border border-red-200 rounded p-2">
                      <div className="text-xs font-medium text-red-900">Permission Issues</div>
                      <div className="text-sm text-red-800">{errorStats.permission} files</div>
                    </div>
                  )}
                  {errorStats.network > 0 && (
                    <div className="bg-yellow-100 border border-yellow-200 rounded p-2">
                      <div className="text-xs font-medium text-yellow-900">Network Issues</div>
                      <div className="text-sm text-yellow-800">{errorStats.network} files</div>
                    </div>
                  )}
                  {errorStats.apiQuota > 0 && (
                    <div className="bg-purple-100 border border-purple-200 rounded p-2">
                      <div className="text-xs font-medium text-purple-900">API Quota</div>
                      <div className="text-sm text-purple-800">{errorStats.apiQuota} files</div>
                    </div>
                  )}
                  {errorStats.fileSize > 0 && (
                    <div className="bg-blue-100 border border-blue-200 rounded p-2">
                      <div className="text-xs font-medium text-blue-900">File Size Issues</div>
                      <div className="text-sm text-blue-800">{errorStats.fileSize} files</div>
                    </div>
                  )}
                  {errorStats.other > 0 && (
                    <div className="bg-gray-100 border border-gray-200 rounded p-2">
                      <div className="text-xs font-medium text-gray-900">Other Issues</div>
                      <div className="text-sm text-gray-800">{errorStats.other} files</div>
                    </div>
                  )}
                </div>
              )}

              {/* Recent Error Details */}
              <div className="space-y-1 max-h-32 overflow-y-auto">
                <div className="text-xs font-medium text-red-900 mb-1">Recent Error Details:</div>
                {errors.slice(0, 5).map((error, index) => (
                  <div key={index} className="text-xs text-red-700 bg-red-100 rounded px-2 py-1 truncate">
                    • {error}
                  </div>
                ))}
                {errors.length > 5 && (
                  <div className="text-xs text-red-600 italic">
                    ... and {errors.length - 5} more errors (check console for full details)
                  </div>
                )}
              </div>
            </div>

            {/* Troubleshooting Recommendations */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Info className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-900">Troubleshooting Recommendations</span>
              </div>
              <div className="text-xs text-amber-800 space-y-1">
                {errorStats.rateLimit > 0 && (
                  <div>• <strong>Rate Limiting:</strong> Try waiting 10-15 minutes before retrying, or use incremental scan</div>
                )}
                {errorStats.permission > 0 && (
                  <div>• <strong>Permissions:</strong> Verify Google Drive folder sharing settings and API key permissions</div>
                )}
                {errorStats.network > 0 && (
                  <div>• <strong>Network:</strong> Check internet connection and try again in a few minutes</div>
                )}
                {errorStats.apiQuota > 0 && (
                  <div>• <strong>API Quota:</strong> Check Google Cloud Console for API usage limits and billing status</div>
                )}
                {errorStats.fileSize > 0 && (
                  <div>• <strong>File Size:</strong> Some files may be too large - check individual file sizes</div>
                )}
                {skippedFiles > processedFiles && (
                  <div>• <strong>High Skip Rate:</strong> Many files are being skipped - check file permissions and formats</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Completion Message */}
        {!isActive && totalFiles > 0 && (
          <div className={`border rounded-lg p-3 ${hasErrors ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center space-x-2">
              {hasErrors ? (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              <span className={`text-sm font-medium ${hasErrors ? 'text-yellow-900' : 'text-green-900'}`}>
                {hasErrors ? (
                  `Scraping completed with issues: Processed ${processedFiles} out of ${totalFiles} files (${errors.length} errors encountered)`
                ) : (
                  `Scraping completed successfully! Processed ${processedFiles} out of ${totalFiles} files.`
                )}
              </span>
            </div>
            {hasErrors && (
              <div className="text-xs text-yellow-800 mt-1">
                Check the error analysis above and console logs for detailed troubleshooting information.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScrapeProgress;
