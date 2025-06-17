
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Starting map image analysis...');
    
    const { mapId } = await req.json();
    
    if (!mapId) {
      throw new Error('Map ID is required');
    }

    console.log(`📍 Analyzing map with ID: ${mapId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('CGPTkey');

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the map details
    const { data: map, error: mapError } = await supabase
      .from('maps')
      .select('*')
      .eq('id', mapId)
      .single();

    if (mapError || !map) {
      throw new Error(`Map not found: ${mapError?.message}`);
    }

    console.log(`🗺️ Found map: ${map.name}`);

    // Clear existing analysis for this map
    const { error: deleteError } = await supabase
      .from('map_areas')
      .delete()
      .eq('map_id', mapId);

    if (deleteError) {
      console.error('⚠️ Error clearing existing analysis:', deleteError);
    }

    // Analyze the image using OpenAI Vision API
    console.log('🤖 Calling OpenAI Vision API...');
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are analyzing a fantasy map image. Please identify and categorize different areas, landmarks, and terrain features. 

Return your analysis as a JSON array where each object represents a distinct area or feature with this structure:
{
  "area_name": "descriptive name",
  "area_type": "terrain|landmark|region|settlement|water|mountain|forest|desert|other",
  "description": "detailed description of the area",
  "terrain_features": ["forest", "mountains", "river"], // array of terrain types present
  "landmarks": ["castle", "bridge", "tower"], // array of notable landmarks
  "general_location": "northwest|northeast|center|southwest|southeast|north|south|east|west",
  "confidence_score": 0.85 // confidence level from 0.0 to 1.0
}

Focus on identifying:
1. Major terrain types (forests, mountains, deserts, water bodies)
2. Settlements and cities
3. Notable landmarks (castles, towers, bridges)
4. Geographic regions
5. Political or named areas if visible

Provide between 5-15 distinct areas depending on map complexity. Make sure each area has a unique name and clear boundaries.`
              },
              {
                type: "image_url",
                image_url: {
                  url: map.image_url
                }
              }
            ]
          }
        ],
        max_tokens: 2000
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('✅ OpenAI analysis complete');

    // Parse the response
    const analysisText = openaiData.choices[0].message.content;
    console.log('📄 Raw analysis:', analysisText);

    // Extract JSON from the response
    let analysisResults;
    try {
      // Try to find JSON array in the response
      const jsonMatch = analysisText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        analysisResults = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseError) {
      console.error('❌ Error parsing OpenAI response:', parseError);
      throw new Error('Failed to parse analysis results');
    }

    console.log(`📊 Parsed ${analysisResults.length} areas from analysis`);

    // Store the analysis results in the database
    const areasToInsert = analysisResults.map((area: any) => ({
      map_id: mapId,
      area_name: area.area_name || 'Unknown Area',
      area_type: area.area_type || 'other',
      description: area.description,
      terrain_features: area.terrain_features || [],
      landmarks: area.landmarks || [],
      general_location: area.general_location,
      confidence_score: area.confidence_score || 0.5,
      analysis_metadata: {
        analyzed_at: new Date().toISOString(),
        model_used: 'gpt-4o',
        original_analysis: area
      }
    }));

    const { data: insertedAreas, error: insertError } = await supabase
      .from('map_areas')
      .insert(areasToInsert)
      .select();

    if (insertError) {
      console.error('❌ Error inserting analysis results:', insertError);
      throw new Error(`Failed to store analysis: ${insertError.message}`);
    }

    console.log(`✅ Successfully stored ${insertedAreas.length} map areas`);

    return new Response(
      JSON.stringify({
        success: true,
        map_id: mapId,
        map_name: map.name,
        areas_analyzed: insertedAreas.length,
        areas: insertedAreas,
        message: `Successfully analyzed map "${map.name}" and identified ${insertedAreas.length} distinct areas`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('💥 Analysis error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Check the function logs for more information'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
