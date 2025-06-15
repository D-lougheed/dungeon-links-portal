import React, { useState } from 'react';
import { MapPin, Edit2, Trash2, Eye, EyeOff, Save, X } from 'lucide-react';
import { Pin, PinType } from './types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PinManagerProps {
  pins: Pin[];
  pinTypes: PinType[];
  mapId: string;
  onPinsUpdate: () => void;
}

const PinManager: React.FC<PinManagerProps> = ({ pins, pinTypes, mapId, onPinsUpdate }) => {
  const { toast } = useToast();
  const [editingPin, setEditingPin] = useState<Pin | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    pin_type_id: ''
  });

  const startEdit = (pin: Pin) => {
    setEditingPin(pin);
    setEditForm({
      name: pin.name,
      description: pin.description || '',
      pin_type_id: pin.pin_type_id || ''
    });
  };

  const cancelEdit = () => {
    setEditingPin(null);
    setEditForm({ name: '', description: '', pin_type_id: '' });
  };

  const saveEdit = async () => {
    if (!editingPin) return;

    try {
      const { error } = await supabase
        .from('pins')
        .update({
          name: editForm.name,
          description: editForm.description,
          pin_type_id: editForm.pin_type_id
        })
        .eq('id', editingPin.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pin updated successfully",
      });

      onPinsUpdate();
      cancelEdit();
    } catch (error) {
      console.error('Error updating pin:', error);
      toast({
        title: "Error",
        description: "Failed to update pin",
        variant: "destructive",
      });
    }
  };

  const toggleVisibility = async (pin: Pin) => {
    try {
      const { error } = await supabase
        .from('pins')
        .update({ is_visible: !pin.is_visible })
        .eq('id', pin.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Pin ${pin.is_visible ? 'hidden' : 'shown'} successfully`,
      });

      onPinsUpdate();
    } catch (error) {
      console.error('Error toggling pin visibility:', error);
      toast({
        title: "Error",
        description: "Failed to update pin visibility",
        variant: "destructive",
      });
    }
  };

  const deletePin = async (pinId: string) => {
    if (!confirm('Are you sure you want to delete this pin?')) return;

    try {
      const { error } = await supabase
        .from('pins')
        .delete()
        .eq('id', pinId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pin deleted successfully",
      });

      onPinsUpdate();
    } catch (error) {
      console.error('Error deleting pin:', error);
      toast({
        title: "Error",
        description: "Failed to delete pin",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Pin Manager</h3>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {pins.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No pins on this map yet</p>
        ) : (
          pins.map((pin) => {
            const pinType = pinTypes.find(pt => pt.id === pin.pin_type_id);
            
            if (editingPin?.id === pin.id) {
              return (
                <div key={pin.id} className="border rounded-lg p-3 bg-gray-50">
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="Pin name"
                    />
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="Description (optional)"
                      rows={2}
                    />
                    <select
                      value={editForm.pin_type_id}
                      onChange={(e) => setEditForm(prev => ({ ...prev, pin_type_id: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="">Select pin type</option>
                      {pinTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name} ({type.category})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="flex-1 bg-blue-600 text-white py-1 rounded text-sm hover:bg-blue-700"
                      >
                        <Save size={14} className="inline mr-1" />
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 bg-gray-300 text-gray-700 py-1 rounded text-sm hover:bg-gray-400"
                      >
                        <X size={14} className="inline mr-1" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
            
            return (
              <div key={pin.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-2 flex-1">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: pinType?.color || '#FF0000' }}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{pin.name}</div>
                    {pin.description && (
                      <div className="text-xs text-gray-500">{pin.description}</div>
                    )}
                    <div className="text-xs text-gray-400">{pinType?.name || 'Unknown Type'}</div>
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleVisibility(pin)}
                    className="p-1 hover:bg-gray-200 rounded"
                    title={pin.is_visible ? "Hide pin" : "Show pin"}
                  >
                    {pin.is_visible ? (
                      <Eye size={16} className="text-gray-600" />
                    ) : (
                      <EyeOff size={16} className="text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(pin)}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Edit pin"
                  >
                    <Edit2 size={16} className="text-blue-600" />
                  </button>
                  <button
                    onClick={() => deletePin(pin.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Delete pin"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PinManager;
