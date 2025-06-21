
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { MapArea } from './types';

interface MapAreasToggleProps {
  mapAreas: MapArea[];
  showAreas: boolean;
  onToggleAreas: (show: boolean) => void;
  getAreaColor?: (areaType: string) => string;
}

const MapAreasToggle: React.FC<MapAreasToggleProps> = ({
  mapAreas,
  showAreas,
  onToggleAreas,
  getAreaColor
}) => {
  const playerViewableAreas = mapAreas.filter(area => area.player_viewable && area.is_visible);

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-amber-900">Map Areas</h3>
        <Switch
          checked={showAreas}
          onCheckedChange={onToggleAreas}
          disabled={playerViewableAreas.length === 0}
        />
      </div>
      
      {playerViewableAreas.length === 0 ? (
        <p className="text-sm text-gray-500">No player-visible areas available</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 mb-2">
            {showAreas ? 'Showing' : 'Available'} {playerViewableAreas.length} area{playerViewableAreas.length !== 1 ? 's' : ''}
          </p>
          
          {showAreas && (
            <div className="space-y-1">
              {playerViewableAreas.map(area => {
                // Use the passed getAreaColor function or fallback to default colors
                const areaColor = getAreaColor ? getAreaColor(area.area_type) :
                                 area.area_type === 'forest' ? '#22c55e' : 
                                 area.area_type === 'mountain' ? '#a3a3a3' : 
                                 area.area_type === 'water' ? '#3b82f6' : 
                                 area.area_type === 'desert' ? '#f59e0b' : '#6b7280';

                return (
                  <div key={area.id} className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: areaColor }}
                    />
                    <span className="text-sm text-gray-700">{area.area_name}</span>
                    <span className="text-xs text-gray-500 capitalize">({area.area_type})</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MapAreasToggle;
