
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ruler, Trash2 } from 'lucide-react';
import { DistanceMeasurement, Map } from './types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DistanceToolProps {
  distances: DistanceMeasurement[];
  map: Map;
  userRole: string;
  activeMode: string;
}

const DistanceTool: React.FC<DistanceToolProps> = ({
  distances,
  map,
  userRole,
  activeMode
}) => {
  const { toast } = useToast();

  const handleDeleteDistance = async (distanceId: string) => {
    if (!confirm('Are you sure you want to delete this measurement?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('distance_measurements')
        .delete()
        .eq('id', distanceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Distance measurement deleted",
      });

      // The parent component will handle reloading the data
      window.location.reload();
    } catch (error) {
      console.error('Error deleting distance:', error);
      toast({
        title: "Error",
        description: "Failed to delete distance measurement",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <Ruler className="h-5 w-5 mr-2" />
          Distance Measurements ({distances.length})
        </CardTitle>
        {activeMode === 'distance' && userRole === 'dm' && (
          <CardDescription>
            Click points on the map to measure distances. Double-click to finish.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {distances.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            No distance measurements yet
            {userRole === 'dm' && (
              <span className="block mt-1">
                Use the measure tool to add some
              </span>
            )}
          </p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {distances.map((distance) => (
              <div
                key={distance.id}
                className="border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{distance.name}</div>
                    <div className="text-sm text-gray-600">
                      {distance.total_distance?.toFixed(2)} {distance.unit}
                    </div>
                    <div className="text-xs text-gray-500">
                      {distance.points.length} points
                    </div>
                  </div>
                  
                  {userRole === 'dm' && (
                    <Button
                      onClick={() => handleDeleteDistance(distance.id)}
                      variant="ghost"
                      size="sm"
                      className="p-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DistanceTool;
