
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { baseUrl } = await req.json()
    
    if (!baseUrl) {
      throw new Error('Base URL is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`Starting to scrape wiki from: ${baseUrl}`)

    // Get OpenAI API key using your existing key name
    const openaiApiKey = Deno.env.get('CGPTkey')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Function to extract content from a webpage
    const scrapePage = async (url: string) => {
      try {
        const response = await fetch(url)
        if (!response.ok) return null
        
        const html = await response.text()
        
        // Basic HTML parsing to extract text content
        // Remove script and style elements
        const cleanHtml = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        // Extract title
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
        const title = titleMatch ? titleMatch[1].trim() : 'Untitled'

        return {
          url,
          title,
          content: cleanHtml.substring(0, 8000), // Limit content length
          contentHash: await generateHash(cleanHtml),
          rawHtml: html
        }
      } catch (error) {
        console.error(`Error scraping ${url}:`, error)
        return null
      }
    }

    // Function to extract links from HTML
    const extractLinks = (html: string, baseUrl: string) => {
      const links = new Set<string>()
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
      let match

      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1]
        
        // Skip external links, anchors, and non-wiki content
        if (href.startsWith('http') && !href.includes(baseUrl)) continue
        if (href.startsWith('#')) continue
        if (href.startsWith('mailto:')) continue
        if (href.includes('edit') || href.includes('action=')) continue
        
        // Handle relative URLs
        if (href.startsWith('/')) {
          href = baseUrl + href
        } else if (!href.startsWith('http')) {
          href = baseUrl + '/' + href
        }
        
        // Clean up the URL
        href = href.split('#')[0] // Remove anchors
        href = href.split('?')[0] // Remove query parameters
        
        links.add(href)
      }
      
      return Array.from(links)
    }

    // Function to generate content hash
    const generateHash = async (content: string) => {
      const encoder = new TextEncoder()
      const data = encoder.encode(content)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }

    // Function to generate embeddings using OpenAI
    const generateEmbedding = async (text: string) => {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: text,
            model: 'text-embedding-ada-002'
          })
        })

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.statusText}`)
        }

        const data = await response.json()
        return data.data[0].embedding
      } catch (error) {
        console.error('Error generating embedding:', error)
        return null
      }
    }

    // Start with the base URL and some common entry points
    const discoveredUrls = new Set([baseUrl])
    const processedUrls = new Set<string>()
    const maxPages = 100 // Increased limit for better discovery
    let pagesScraped = 0

    // Initial seed URLs to start discovery
    const seedUrls = [
      `${baseUrl}`,
      `${baseUrl}/Published`,
      `${baseUrl}/Home`,
      `${baseUrl}/index`,
      `${baseUrl}/Main_Page`,
    ]

    seedUrls.forEach(url => discoveredUrls.add(url))

    // Process URLs in batches to discover more links
    while (discoveredUrls.size > 0 && pagesScraped < maxPages) {
      const urlsToProcess = Array.from(discoveredUrls).slice(0, 10) // Process 10 at a time
      urlsToProcess.forEach(url => {
        discoveredUrls.delete(url)
        processedUrls.add(url)
      })

      for (const url of urlsToProcess) {
        if (pagesScraped >= maxPages) break
        
        console.log(`Scraping: ${url}`)
        
        const pageData = await scrapePage(url)
        if (!pageData) continue

        // Extract links from this page for future discovery
        if (discoveredUrls.size < maxPages) {
          const newLinks = extractLinks(pageData.rawHtml, baseUrl)
          newLinks.forEach(link => {
            if (!processedUrls.has(link) && !discoveredUrls.has(link)) {
              discoveredUrls.add(link)
            }
          })
        }

        // Check if this content already exists (by hash)
        const { data: existing } = await supabase
          .from('wiki_content')
          .select('id')
          .eq('content_hash', pageData.contentHash)
          .single()

        if (existing) {
          console.log(`Skipping ${url} - content already exists`)
          continue
        }

        // Skip pages with very little content (likely navigation pages)
        if (pageData.content.length < 200) {
          console.log(`Skipping ${url} - content too short`)
          continue
        }

        // Generate embedding for the content
        const embedding = await generateEmbedding(pageData.content)
        if (!embedding) {
          console.log(`Skipping ${url} - failed to generate embedding`)
          continue
        }

        // Insert or update the content
        const { error } = await supabase
          .from('wiki_content')
          .upsert({
            url: pageData.url,
            title: pageData.title,
            content: pageData.content,
            content_hash: pageData.contentHash,
            embedding: embedding,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'url'
          })

        if (error) {
          console.error(`Error saving ${url}:`, error)
          continue
        }

        pagesScraped++
        console.log(`Successfully processed: ${url}`)

        // Add a small delay to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pagesScraped,
        totalDiscovered: processedUrls.size,
        message: `Successfully scraped and processed ${pagesScraped} pages from ${processedUrls.size} discovered URLs` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Wiki scraping error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
