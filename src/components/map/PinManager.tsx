
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Eye, EyeOff, Edit, Trash2, Save, X } from 'lucide-react';
import { Pin, PinType } from './types';

interface PinManagerProps {
  pinTypes: PinType[];
  selectedPinType: string | null;
  onPinTypeSelect: (typeId: string) => void;
  pins: Pin[];
  onPinUpdate: (pinId: string, updates: Partial<Pin>) => void;
  onPinDelete: (pinId: string) => void;
  userRole: string;
  activeMode: string;
}

const PinManager: React.FC<PinManagerProps> = ({
  pinTypes,
  selectedPinType,
  onPinTypeSelect,
  pins,
  onPinUpdate,
  onPinDelete,
  userRole,
  activeMode
}) => {
  const [editingPin, setEditingPin] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; description: string }>({
    name: '',
    description: ''
  });

  const startEdit = (pin: Pin) => {
    setEditingPin(pin.id);
    setEditForm({
      name: pin.name,
      description: pin.description || ''
    });
  };

  const saveEdit = () => {
    if (!editingPin) return;
    
    onPinUpdate(editingPin, {
      name: editForm.name,
      description: editForm.description || null
    });
    
    setEditingPin(null);
  };

  const cancelEdit = () => {
    setEditingPin(null);
    setEditForm({ name: '', description: '' });
  };

  const togglePinVisibility = (pin: Pin) => {
    onPinUpdate(pin.id, { is_visible: !pin.is_visible });
  };

  return (
    <div className="space-y-4">
      {/* Pin Type Selector */}
      {activeMode === 'pin' && userRole === 'dm' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Pin Type</CardTitle>
            <CardDescription>
              Select the type of pin to place
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pinTypes.map((type) => (
              <Button
                key={type.id}
                onClick={() => onPinTypeSelect(type.id)}
                variant={selectedPinType === type.id ? 'default' : 'outline'}
                className="w-full justify-start text-left"
                size="sm"
              >
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: type.color }}
                />
                {type.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pins List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            Pins ({pins.length})
            {userRole === 'dm' && activeMode === 'view' && (
              <div className="text-sm font-normal text-gray-500">
                Click pins to edit
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pins.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No pins on this map yet
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {pins.map((pin) => (
                <div
                  key={pin.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  {editingPin === pin.id ? (
                    // Edit mode
                    <div className="space-y-2">
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Pin name"
                      />
                      <Textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Pin description"
                        rows={2}
                      />
                      <div className="flex space-x-2">
                        <Button onClick={saveEdit} size="sm">
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button onClick={cancelEdit} variant="outline" size="sm">
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: pin.pin_types?.color || '#ff0000' }}
                            />
                            <span className="font-medium">{pin.name}</span>
                            {pin.pin_types && (
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {pin.pin_types.name}
                              </span>
                            )}
                          </div>
                          {pin.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {pin.description}
                            </p>
                          )}
                        </div>
                        
                        {userRole === 'dm' && (
                          <div className="flex space-x-1 ml-2">
                            <Button
                              onClick={() => togglePinVisibility(pin)}
                              variant="ghost"
                              size="sm"
                              className="p-1"
                            >
                              {pin.is_visible ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              onClick={() => startEdit(pin)}
                              variant="ghost"
                              size="sm"
                              className="p-1"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this pin?')) {
                                  onPinDelete(pin.id);
                                }
                              }}
                              variant="ghost"
                              size="sm"
                              className="p-1 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PinManager;
