
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, FileText, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

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

  if (!isActive && totalFiles === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-blue-900 flex items-center text-lg">
          <Clock className="h-5 w-5 mr-2" />
          Scraping Progress
          {stage && <span className="ml-2 text-sm font-normal text-blue-700">({stage})</span>}
        </CardTitle>
        <CardDescription className="text-blue-700">
          {mode === 'missing' ? 'Processing missing files' : 
           mode === 'incremental' ? 'Processing recent files (last 7 days)' : 
           'Processing all markdown files'}
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

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-900">
                Errors ({errors.length})
              </span>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {errors.slice(0, 3).map((error, index) => (
                <div key={index} className="text-xs text-red-700 truncate">
                  • {error}
                </div>
              ))}
              {errors.length > 3 && (
                <div className="text-xs text-red-600">
                  ... and {errors.length - 3} more errors
                </div>
              )}
            </div>
          </div>
        )}

        {/* Completion Message */}
        {!isActive && totalFiles > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">
                Scraping completed! Processed {processedFiles} out of {totalFiles} files.
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScrapeProgress;
