import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Palette } from 'lucide-react';
import { RegionType } from './types';

interface RegionTypeManagerProps {
  regionTypes: RegionType[];
  onAddRegionType: (name: string, color: string) => void;
  onUpdateRegionType: (id: string, updates: Partial<RegionType>) => void;
  onDeleteRegionType: (id: string) => void;
  userRole: string;
}

const RegionTypeManager: React.FC<RegionTypeManagerProps> = ({
  regionTypes,
  onAddRegionType,
  onUpdateRegionType,
  onDeleteRegionType,
  userRole
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#3b82f6');
  const [editForm, setEditForm] = useState<Partial<RegionType>>({});

  const handleAddSubmit = () => {
    if (newTypeName.trim()) {
      onAddRegionType(newTypeName.trim(), newTypeColor);
      setNewTypeName('');
      setNewTypeColor('#3b82f6');
      setShowAddForm(false);
    }
  };

  const handleEditStart = (type: RegionType) => {
    setEditingType(type.id);
    setEditForm({ name: type.name, color: type.color });
  };

  const handleEditSave = () => {
    if (editingType) {
      onUpdateRegionType(editingType, editForm);
      setEditingType(null);
      setEditForm({});
    }
  };

  const handleEditCancel = () => {
    setEditingType(null);
    setEditForm({});
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-amber-900">Region Types</CardTitle>
          {userRole === 'dm' && (
            <Button
              onClick={() => setShowAddForm(true)}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Type
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new type form */}
        {showAddForm && userRole === 'dm' && (
          <div className="border border-amber-200 rounded-lg p-3 space-y-3 bg-amber-50">
            <h4 className="font-medium text-amber-900">Add New Region Type</h4>
            <div className="space-y-2">
              <input
                type="text"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="Type name"
                className="w-full text-sm border border-gray-300 rounded px-3 py-2"
              />
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Color:</label>
                <input
                  type="color"
                  value={newTypeColor}
                  onChange={(e) => setNewTypeColor(e.target.value)}
                  className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                />
                <div
                  className="w-6 h-6 rounded border border-gray-300"
                  style={{ backgroundColor: newTypeColor }}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button size="sm" onClick={handleAddSubmit}>
                Add Type
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setShowAddForm(false);
                  setNewTypeName('');
                  setNewTypeColor('#3b82f6');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Existing region types */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {regionTypes.map((type) => (
            <div
              key={type.id}
              className="flex items-center justify-between p-2 border border-amber-200 rounded-lg"
            >
              {editingType === type.id ? (
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                  />
                  <div className="flex items-center space-x-2">
                    <label className="text-xs font-medium">Color:</label>
                    <input
                      type="color"
                      value={editForm.color || type.color}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                      className="w-6 h-6 border border-gray-300 rounded cursor-pointer"
                    />
                  </div>
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
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: type.color }}
                    />
                    <Badge className="text-xs" style={{ backgroundColor: type.color + '20', color: type.color }}>
                      {type.name}
                    </Badge>
                  </div>
                  {userRole === 'dm' && (
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditStart(type)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteRegionType(type.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RegionTypeManager;
