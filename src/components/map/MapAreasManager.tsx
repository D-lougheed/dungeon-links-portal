
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Polygon } from 'lucide-react';
import { MapArea } from './types';

interface MapAreasManagerProps {
  mapAreas: MapArea[];
  onAreaUpdate: (areaId: string, updates: Partial<MapArea>) => void;
  onAreaDelete: (areaId: string) => void;
  userRole: string;
  activeMode: 'view' | 'area';
}

const MapAreasManager: React.FC<MapAreasManagerProps> = ({
  mapAreas,
  onAreaUpdate,
  onAreaDelete,
  userRole,
  activeMode
}) => {
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MapArea>>({});

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
    const colors: { [key: string]: string } = {
      'terrain': 'bg-green-100 text-green-800',
      'landmark': 'bg-blue-100 text-blue-800',
      'region': 'bg-amber-100 text-amber-800',
      'settlement': 'bg-purple-100 text-purple-800',
      'water': 'bg-cyan-100 text-cyan-800',
      'forest': 'bg-emerald-100 text-emerald-800',
      'mountain': 'bg-stone-100 text-stone-800',
      'desert': 'bg-yellow-100 text-yellow-800'
    };
    return colors[areaType] || 'bg-gray-100 text-gray-800';
  };

  const getAreaShape = (area: MapArea) => {
    if (area.polygon_coordinates && area.polygon_coordinates.length > 0) {
      return `Polygon (${area.polygon_coordinates.length} points)`;
    } else if (area.bounding_box) {
      return 'Rectangle (legacy)';
    }
    return 'Unknown shape';
  };

  return (
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
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {mapAreas.map((area) => (
              <div
                key={area.id}
                className="border border-amber-200 rounded-lg p-3 space-y-2"
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
                      <option value="terrain">Terrain</option>
                      <option value="landmark">Landmark</option>
                      <option value="region">Region</option>
                      <option value="settlement">Settlement</option>
                      <option value="water">Water</option>
                      <option value="forest">Forest</option>
                      <option value="mountain">Mountain</option>
                      <option value="desert">Desert</option>
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
                            <Polygon className="h-3 w-3 mr-1" />
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
            ))}
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
  );
};

export default MapAreasManager;
