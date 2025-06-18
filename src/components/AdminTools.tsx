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
      case 'missing': return <Search className
