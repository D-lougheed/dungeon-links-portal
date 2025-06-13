
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Map as MapIcon, Calendar, Users } from 'lucide-react';
import { Map } from './types';

interface MapSelectorProps {
  maps: Map[];
  onMapSelect: (map: Map) => void;
  onUploadClick: () => void;
  userRole: string;
}

const MapSelector: React.FC<MapSelectorProps> = ({
  maps,
  onMapSelect,
  onUploadClick,
  userRole
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Select a Map
        </h2>
        <p className="text-gray-600">
          Choose an existing map or upload a new one to get started
        </p>
      </div>

      {/* Upload New Map Button (DM Only) */}
      {userRole === 'dm' && (
        <div className="text-center">
          <Button 
            onClick={onUploadClick}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Upload className="h-5 w-5 mr-2" />
            Upload New Map
          </Button>
        </div>
      )}

      {/* Maps Grid */}
      {maps.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <MapIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Maps Available
            </h3>
            <p className="text-gray-600 mb-4">
              {userRole === 'dm' 
                ? 'Upload your first map to get started with interactive mapping.'
                : 'Ask your DM to upload maps for the campaign.'}
            </p>
            {userRole === 'dm' && (
              <Button onClick={onUploadClick}>
                <Upload className="h-4 w-4 mr-2" />
                Upload First Map
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {maps.map((map) => (
            <Card 
              key={map.id}
              className="cursor-pointer hover:shadow-lg transition-shadow duration-200 group"
              onClick={() => onMapSelect(map)}
            >
              <div className="aspect-video bg-gray-200 rounded-t-lg overflow-hidden">
                <img
                  src={map.thumbnail_url || map.image_url}
                  alt={map.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg truncate">{map.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {map.description || 'No description available'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(map.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {map.width} × {map.height}
                    </span>
                  </div>
                </div>
                {map.scale_factor && (
                  <div className="mt-2 text-xs text-gray-600">
                    Scale: 1px = {map.scale_factor} {map.scale_unit}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapSelector;
