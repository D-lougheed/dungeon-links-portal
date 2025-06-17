
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff } from 'lucide-react';
import { MapArea, RegionType } from './types';

interface VisibilityControlsProps {
  mapAreas: MapArea[];
  regionTypes: RegionType[];
  hiddenTypes: Set<string>;
  onToggleAreaVisibility: (areaId: string) => void;
  onToggleTypeVisibility: (typeName: string) => void;
  onToggleAllVisibility: () => void;
  getAreaColor: (areaType: string) => string;
}

const VisibilityControls: React.FC<VisibilityControlsProps> = ({
  mapAreas,
  regionTypes,
  hiddenTypes,
  onToggleAreaVisibility,
  onToggleTypeVisibility,
  onToggleAllVisibility,
  getAreaColor
}) => {
  // Get unique area types from current areas
  const uniqueTypes = Array.from(new Set(mapAreas.map(area => area.area_type)));
  
  // Count visible areas by type
  const getVisibleCount = (typeName: string) => {
    return mapAreas.filter(area => 
      area.area_type === typeName && 
      area.is_visible !== false && 
      !hiddenTypes.has(typeName)
    ).length;
  };

  const getTotalCount = (typeName: string) => {
    return mapAreas.filter(area => area.area_type === typeName).length;
  };

  const allVisible = mapAreas.every(area => area.is_visible !== false) && hiddenTypes.size === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-amber-900">Visibility Controls</CardTitle>
          <Button
            onClick={onToggleAllVisibility}
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            {allVisible ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide All
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Show All
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type-based visibility controls */}
        {uniqueTypes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-amber-900">By Type</h4>
            <div className="space-y-2">
              {uniqueTypes.map((typeName) => {
                const isHidden = hiddenTypes.has(typeName);
                const visibleCount = getVisibleCount(typeName);
                const totalCount = getTotalCount(typeName);
                const color = getAreaColor(typeName);

                return (
                  <div
                    key={typeName}
                    className="flex items-center justify-between p-2 border border-amber-200 rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded border border-gray-300"
                        style={{ backgroundColor: color }}
                      />
                      <Badge className="text-xs" style={{ backgroundColor: color + '20', color: color }}>
                        {typeName}
                      </Badge>
                      <span className="text-xs text-gray-600">
                        ({visibleCount}/{totalCount})
                      </span>
                    </div>
                    <Button
                      onClick={() => onToggleTypeVisibility(typeName)}
                      size="sm"
                      variant="ghost"
                      className={`h-8 w-8 p-0 ${isHidden ? 'text-gray-400' : 'text-amber-800'}`}
                    >
                      {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Individual area visibility controls */}
        {mapAreas.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-amber-900">Individual Areas</h4>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {mapAreas.map((area) => {
                const isVisible = area.is_visible !== false && !hiddenTypes.has(area.area_type);
                const color = getAreaColor(area.area_type);

                return (
                  <div
                    key={area.id}
                    className="flex items-center justify-between p-2 border border-amber-200 rounded text-xs"
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <div
                        className="w-2 h-2 rounded border border-gray-300 flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{area.area_name}</span>
                    </div>
                    <Button
                      onClick={() => onToggleAreaVisibility(area.id)}
                      size="sm"
                      variant="ghost"
                      className={`h-6 w-6 p-0 flex-shrink-0 ${
                        area.is_visible === false ? 'text-gray-400' : 'text-amber-800'
                      }`}
                      disabled={hiddenTypes.has(area.area_type)}
                    >
                      {area.is_visible === false ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VisibilityControls;
