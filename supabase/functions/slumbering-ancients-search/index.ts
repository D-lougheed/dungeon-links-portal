
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('CGPTkey');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, coordinates, mapId } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔍 SEARCHING FOR: ${message}`);
    
    // Use the specific map ID or default to the one mentioned
    const targetMapId = mapId || '101f235a-5305-40ab-bece-35283bfcecbb';

    // Generate embedding for the user's question
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: message,
        model: 'text-embedding-ada-002'
      })
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Failed to generate embedding: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log(`🤖 Generated embedding for query`);

    // Get map information
    let mapInfo = null;
    const { data: mapData, error: mapError } = await supabase
      .from('maps')
      .select('*')
      .eq('id', targetMapId)
      .single();

    if (!mapError && mapData) {
      mapInfo = mapData;
      console.log(`🗺️ Found map: ${mapInfo.name}`);
    }

    // Get map areas for the specific map
    let mapAreas = [];
    const { data: areasData, error: areasError } = await supabase
      .from('map_areas')
      .select('*')
      .eq('map_id', targetMapId)
      .eq('is_visible', true);

    if (!areasError && areasData) {
      mapAreas = areasData;
      console.log(`🏞️ Found ${mapAreas.length} map areas`);
    }

    // Get pins for the specific map
    let mapPins = [];
    const { data: pinsData, error: pinsError } = await supabase
      .from('pins')
      .select(`
        *,
        pin_types (
          name,
          description,
          color,
          category
        )
      `)
      .eq('map_id', targetMapId)
      .eq('is_visible', true);

    if (!pinsError && pinsData) {
      mapPins = pinsData;
      console.log(`📍 Found ${mapPins.length} pins`);
    }

    // If coordinates are provided, find nearby elements
    let nearbyContext = '';
    if (coordinates && mapInfo) {
      const { x, y } = coordinates;
      const proximityThreshold = 0.1; // Adjust based on map scale
      
      // Find nearby pins
      const nearbyPins = mapPins.filter(pin => {
        const distance = Math.sqrt(
          Math.pow(pin.x_normalized - x, 2) + Math.pow(pin.y_normalized - y, 2)
        );
        return distance <= proximityThreshold;
      });

      // Find relevant areas (check if coordinates are within polygon or bounding box)
      const relevantAreas = mapAreas.filter(area => {
        if (area.polygon_coordinates && Array.isArray(area.polygon_coordinates)) {
          // Simple point-in-polygon check (basic implementation)
          return isPointInPolygon(x, y, area.polygon_coordinates);
        } else if (area.bounding_box) {
          const bbox = area.bounding_box;
          return x >= bbox.x1 && x <= bbox.x2 && y >= bbox.y1 && y <= bbox.y2;
        }
        return false;
      });

      if (nearbyPins.length > 0 || relevantAreas.length > 0) {
        nearbyContext = `\n\nLOCATION CONTEXT (at coordinates ${x.toFixed(3)}, ${y.toFixed(3)}):`;
        
        if (relevantAreas.length > 0) {
          nearbyContext += '\nAREAS AT THIS LOCATION:\n';
          relevantAreas.forEach(area => {
            nearbyContext += `- ${area.area_name} (${area.area_type}): ${area.description || 'No description'}\n`;
            if (area.terrain_features && area.terrain_features.length > 0) {
              nearbyContext += `  Terrain: ${area.terrain_features.join(', ')}\n`;
            }
            if (area.landmarks && area.landmarks.length > 0) {
              nearbyContext += `  Landmarks: ${area.landmarks.join(', ')}\n`;
            }
          });
        }

        if (nearbyPins.length > 0) {
          nearbyContext += '\nNEARBY POINTS OF INTEREST:\n';
          nearbyPins.forEach(pin => {
            const pinType = pin.pin_types?.name || 'Unknown';
            nearbyContext += `- ${pin.name} (${pinType}): ${pin.description || 'No description'}\n`;
          });
        }
      }
    }

    let similarContent = [];
    let searchError = null;

    // Try vector search first
    try {
      const { data: vectorResults, error: vectorError } = await supabase.rpc(
        'match_documents',
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: 5
        }
      );

      if (vectorError) {
        throw vectorError;
      }

      similarContent = vectorResults || [];
    } catch (error) {
      console.error('Vector search error:', error);
      searchError = error;
      
      // Fallback to simple text search
      const { data: fallbackContent } = await supabase
        .from('wiki_content')
        .select('title, content, url')
        .textSearch('content', message.split(' ').join(' | '))
        .limit(5);
      
      similarContent = fallbackContent || [];
    }

    console.log(`📚 Found ${similarContent.length} similar documents`);

    // Prepare context from similar documents
    let contextText = '';
    if (similarContent.length > 0) {
      contextText = similarContent
        .map(doc => `Title: ${doc.title}\nContent: ${doc.content}`)
        .join('\n\n---\n\n');
    }

    // Prepare map context
    let mapContext = '';
    if (mapInfo) {
      mapContext = `\n\nMAP INFORMATION:
Map: ${mapInfo.name}
Description: ${mapInfo.description || 'No description'}
Dimensions: ${mapInfo.width}x${mapInfo.height} pixels
Scale: ${mapInfo.scale_factor || 'Unknown'} ${mapInfo.scale_unit || 'units'} per pixel

AREAS ON THIS MAP:
${mapAreas.map(area => 
  `- ${area.area_name} (${area.area_type}): ${area.description || 'No description'}`
).join('\n')}

POINTS OF INTEREST:
${mapPins.map(pin => 
  `- ${pin.name} (${pin.pin_types?.name || 'Unknown'}): ${pin.description || 'No description'}`
).join('\n')}`;
    }

    // Enhanced system prompt that handles map context and coordinates
    const systemPrompt = `You are the Slumbering Ancients AI assistant, a wise and knowledgeable guide specializing in ancient lore, mysteries, and D&D campaign knowledge. You have access to campaign materials and detailed map information.

CORE CAPABILITIES:
1. **Campaign Knowledge**: Answer questions based on the provided campaign materials
2. **Map Analysis**: Provide contextual information about specific locations on maps
3. **Spatial Reasoning**: Make logical connections between map coordinates, areas, and points of interest
4. **Creative Expansion**: Generate content that fits the established world when needed

SPATIAL CONTEXT GUIDELINES:
- When given coordinates, consider the scale and relative positions on the map
- Make logical connections between nearby areas, terrain features, and points of interest
- Consider how geography influences culture, trade routes, and historical events
- Use the map scale to estimate distances and travel times
- Think about how different areas might interact based on their proximity and features

RESPONSE GUIDELINES:
- Always prioritize information from the provided materials when available
- When creating new content, clearly indicate it's an expansion or interpretation
- Maintain consistency with the established tone, themes, and world-building
- For spatial queries, provide practical information about locations, distances, and relationships
- Make "logical leaps" that connect disparate elements in meaningful ways

${contextText ? `CAMPAIGN MATERIALS CONTEXT:
${contextText}

` : ''}${mapContext}${nearbyContext}

Remember: You excel at making logical connections between locations, understanding spatial relationships, and providing both factual information and creative expansions that enhance the campaign world.`;

    // Generate response using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.8,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API request failed: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    console.log(`✅ Generated response successfully`);

    return new Response(JSON.stringify({ response: assistantResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in slumbering-ancients-search function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function for point-in-polygon detection (basic implementation)
function isPointInPolygon(x: number, y: number, polygon: Array<{x: number, y: number}>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (((polygon[i].y > y) !== (polygon[j].y > y)) &&
        (x < (polygon[j].x - polygon[i].x) * (y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
      inside = !inside;
    }
  }
  return inside;
}
