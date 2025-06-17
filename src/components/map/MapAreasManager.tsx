import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Square, Settings } from 'lucide-react';
import { MapArea, RegionType } from './types';
import RegionTypeManager from './RegionTypeManager';
import VisibilityControls from './VisibilityControls';

interface MapAreasManagerProps {
  mapAreas: MapArea[];
  onAreaUpdate: (areaId: string, updates: Partial<MapArea>) => void;
  onAreaDelete: (areaId: string) => void;
  userRole: string;
  activeMode: 'view' | 'area';
  regionTypes: RegionType[];
  onAddRegionType: (name: string, color: string) => void;
  onUpdateRegionType: (id: string, updates: Partial<RegionType>) => void;
  onDeleteRegionType: (id: string) => void;
  hiddenTypes: Set<string>;
  onToggleAreaVisibility: (areaId: string) => void;
  onToggleTypeVisibility: (typeName: string) => void;
  onToggleAllVisibility: () => void;
  getAreaColor: (areaType: string) => string;
}

const MapAreasManager: React.FC<MapAreasManagerProps> = ({
  mapAreas,
  onAreaUpdate,
  onAreaDelete,
  userRole,
  activeMode,
  regionTypes,
  onAddRegionType,
  onUpdateRegionType,
  onDeleteRegionType,
  hiddenTypes,
  onToggleAreaVisibility,
  onToggleTypeVisibility,
  onToggleAllVisibility,
  getAreaColor
}) => {
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MapArea>>({});
  const [showRegionTypes, setShowRegionTypes] = useState(false);

  const handleEditStart = (area: MapArea) => {
    setEditingArea(area.id);
    setEditForm({
      area_name: area.area_name,
      area_type: area.area_type,
      description: area.description
    });
  };

  const handleEditSave = () => {
    if (editingArea) {
      onAreaUpdate(editingArea, editForm);
      setEditingArea(null);
      setEditForm({});
    }
  };

  const handleEditCancel = () => {
    setEditingArea(null);
    setEditForm({});
  };

  const getAreaTypeColor = (areaType: string) => {
    return getAreaColor(areaType);
  };

  const getAreaShape = (area: MapArea) => {
    if (area.polygon_coordinates && area.polygon_coordinates.length > 0) {
      return `Polygon (${area.polygon_coordinates.length} points)`;
    } else if (area.bounding_box) {
      return 'Rectangle (legacy)';
    }
    return 'Unknown shape';
  };

  // Get available region types for dropdown
  const availableTypes = [
    // Default types
    { name: 'terrain', color: '#22c55e' },
    { name: 'landmark', color: '#3b82f6' },
    { name: 'region', color: '#f59e0b' },
    { name: 'settlement', color: '#8b5cf6' },
    { name: 'water', color: '#06b6d4' },
    { name: 'forest', color: '#16a34a' },
    { name: 'mountain', color: '#78716c' },
    { name: 'desert', color: '#eab308' },
    // Custom types
    ...regionTypes.map(type => ({ name: type.name, color: type.color }))
  ];

  return (
    <div className="space-y-4">
      {/* Visibility Controls */}
      <VisibilityControls
        mapAreas={mapAreas}
        regionTypes={regionTypes}
        hiddenTypes={hiddenTypes}
        onToggleAreaVisibility={onToggleAreaVisibility}
        onToggleTypeVisibility={onToggleTypeVisibility}
        onToggleAllVisibility={onToggleAllVisibility}
        getAreaColor={getAreaColor}
      />

      {/* Region Types Management */}
      {userRole === 'dm' && (
        <div className="space-y-2">
          <Button
            onClick={() => setShowRegionTypes(!showRegionTypes)}
            variant="outline"
            size="sm"
            className="w-full border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            <Settings className="h-4 w-4 mr-2" />
            {showRegionTypes ? 'Hide' : 'Manage'} Region Types
          </Button>
          
          {showRegionTypes && (
            <RegionTypeManager
              regionTypes={regionTypes}
              onAddRegionType={onAddRegionType}
              onUpdateRegionType={onUpdateRegionType}
              onDeleteRegionType={onDeleteRegionType}
              userRole={userRole}
            />
          )}
        </div>
      )}

      {/* Map Areas List */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg text-amber-900">Map Areas</CardTitle>
          {activeMode === 'area' && userRole === 'dm' && (
            <p className="text-sm text-amber-700">
              Click points on the map to create custom polygon areas
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {mapAreas.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No areas created yet
            </p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {mapAreas.map((area) => {
                const isVisible = area.is_visible !== false && !hiddenTypes.has(area.area_type);
                const areaOpacity = isVisible ? 1 : 0.5;

                return (
                  <div
                    key={area.id}
                    className="border border-amber-200 rounded-lg p-3 space-y-2"
                    style={{ opacity: areaOpacity }}
                  >
                    {editingArea === area.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editForm.area_name || ''}
                          onChange={(e) => setEditForm({ ...editForm, area_name: e.target.value })}
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                          placeholder="Area name"
                        />
                        <select
                          value={editForm.area_type || ''}
                          onChange={(e) => setEditForm({ ...editForm, area_type: e.target.value })}
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          {availableTypes.map(type => (
                            <option key={type.name} value={type.name}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                        <textarea
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                          placeholder="Description (optional)"
                          rows={2}
                        />
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={handleEditSave}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleEditCancel}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-amber-900">{area.area_name}</h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge className={`text-xs ${getAreaTypeColor(area.area_type)}`}>
                                {area.area_type}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Square className="h-3 w-3 mr-1" />
                                {getAreaShape(area)}
                              </Badge>
                            </div>
                          </div>
                          {userRole === 'dm' && (
                            <div className="flex space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditStart(area)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onAreaDelete(area.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {area.description && (
                          <p className="text-xs text-gray-600">{area.description}</p>
                        )}
                        {area.terrain_features && Array.isArray(area.terrain_features) && area.terrain_features.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-amber-800">Terrain Features:</p>
                            <div className="flex flex-wrap gap-1">
                              {area.terrain_features.map((feature, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {feature}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {area.landmarks && Array.isArray(area.landmarks) && area.landmarks.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-amber-800">Landmarks:</p>
                            <div className="space-y-1">
                              {area.landmarks.map((landmark, index) => (
                                <p key={index} className="text-xs text-gray-600">• {landmark}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        {area.general_location && (
                          <p className="text-xs text-gray-500">
                            Location: {area.general_location}
                          </p>
                        )}
                        {area.confidence_score && (
                          <p className="text-xs text-gray-500">
                            Confidence: {Math.round(area.confidence_score * 100)}%
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {userRole === 'dm' && activeMode === 'view' && (
            <div className="pt-4 border-t border-amber-200">
              <p className="text-xs text-amber-700 text-center">
                Switch to "Add Area" mode to create custom polygon areas
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MapAreasManager;
