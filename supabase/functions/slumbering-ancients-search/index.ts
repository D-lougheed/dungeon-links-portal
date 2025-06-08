
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
    const { message } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔍 SEARCHING FOR: ${message}`);

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

    // Enhanced system prompt that handles both database content and creative requests
    const systemPrompt = `You are the Slumbering Ancients AI assistant, a wise and knowledgeable guide specializing in ancient lore, mysteries, and D&D campaign knowledge. You have access to campaign materials that have been gathered from sacred texts and chronicles.

CORE CAPABILITIES:
1. **Primary Knowledge**: Answer questions based on the provided campaign materials below
2. **Creative Expansion**: When asked about topics not directly covered in the materials, you can:
   - Draw logical connections and expand on related themes from the existing lore
   - Create new content that fits the established world and tone
   - Suggest how new elements might connect to existing campaign materials
   - Generate ideas that complement the existing narrative

GUIDELINES:
- Always prioritize information from the provided campaign materials when available
- When creating new content, clearly indicate it's an expansion or creative interpretation
- Maintain consistency with the established tone, themes, and world-building
- If asked about something completely unrelated to the campaign, politely redirect to campaign-relevant topics
- Be detailed and immersive in your responses, drawing connections between different pieces of lore when relevant

${contextText ? `CAMPAIGN MATERIALS CONTEXT:
${contextText}

` : 'No specific campaign materials found for this query, but you can still provide creative content that fits the Slumbering Ancients theme and world.'}

Remember: You can both reference existing materials AND create new content that enhances the campaign world. Be creative while staying true to the established lore and atmosphere.`;

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
        temperature: 0.8, // Increased for more creative responses
        max_tokens: 1500, // Increased for more detailed responses
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
