
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

    // Search for similar content using vector similarity
    const { data: similarContent, error: searchError } = await supabase.rpc(
      'match_documents',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 5
      }
    );

    if (searchError) {
      console.error('Search error:', searchError);
      // Fallback to simple text search if vector search fails
      const { data: fallbackContent } = await supabase
        .from('wiki_content')
        .select('title, content, url')
        .textSearch('content', message.split(' ').join(' | '))
        .limit(3);
      
      if (!fallbackContent || fallbackContent.length === 0) {
        return new Response(JSON.stringify({ 
          response: "I apologize, but I couldn't find any relevant information in the scraped data about your question. Please try rephrasing your question or ask about topics that might be covered in the campaign materials." 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Use fallback content for context
      const contextText = fallbackContent.map(doc => `Title: ${doc.title}\nContent: ${doc.content}`).join('\n\n---\n\n');
      
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
              content: `You are the Slumbering Ancients AI assistant, specialized in ancient lore and mysteries from a D&D campaign. You can ONLY answer questions based on the provided campaign materials. If the information is not in the provided context, you must say so and suggest the user ask about topics that are covered in the materials.

Context from campaign materials:
${contextText}

Important: Only use information from the provided context. Do not make up or infer information that isn't explicitly stated in the materials.`
            },
            {
              role: 'user',
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      const data = await response.json();
      return new Response(JSON.stringify({ response: data.choices[0].message.content }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📚 Found ${similarContent?.length || 0} similar documents`);

    if (!similarContent || similarContent.length === 0) {
      return new Response(JSON.stringify({ 
        response: "I apologize, but I couldn't find any relevant information in the scraped campaign materials about your question. Please try asking about topics that are covered in the ancient lore and mysteries documentation." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare context from similar documents
    const contextText = similarContent
      .map(doc => `Title: ${doc.title}\nContent: ${doc.content}`)
      .join('\n\n---\n\n');

    console.log(`📖 Using context from ${similarContent.length} documents`);

    // Generate response using OpenAI with the context
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
            content: `You are the Slumbering Ancients AI assistant, specialized in ancient lore and mysteries from a D&D campaign. You can ONLY answer questions based on the provided campaign materials below. If the information is not in the provided context, you must say so and suggest the user ask about topics that are covered in the materials.

Be detailed and immersive in your responses, drawing connections between different pieces of lore when relevant. Always cite which documents or sources you're drawing from when possible.

Context from campaign materials:
${contextText}

Important: Only use information from the provided context. Do not make up or infer information that isn't explicitly stated in the materials.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
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
