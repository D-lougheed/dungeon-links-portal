

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

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('CGPTkey')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Function to extract content from a webpage with better HTML parsing
    const scrapePage = async (url: string) => {
      try {
        console.log(`Fetching: ${url}`)
        const response = await fetch(url)
        if (!response.ok) {
          console.log(`Failed to fetch ${url}: ${response.status}`)
          return null
        }
        
        const html = await response.text()
        console.log(`HTML length for ${url}: ${html.length}`)
        
        // Extract title with multiple fallbacks
        let title = 'Untitled'
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
        if (titleMatch) {
          title = titleMatch[1].replace(/\s+/g, ' ').trim()
        }
        
        // Look for common content containers in wikis
        const contentSelectors = [
          /<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/gis,
          /<div[^>]*id="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/gis,
          /<main[^>]*>(.*?)<\/main>/gis,
          /<article[^>]*>(.*?)<\/article>/gis,
          /<div[^>]*class="[^"]*page[^"]*"[^>]*>(.*?)<\/div>/gis,
          /<div[^>]*class="[^"]*wiki[^"]*"[^>]*>(.*?)<\/div>/gis,
          /<body[^>]*>(.*?)<\/body>/gis
        ]
        
        let extractedContent = ''
        
        // Try each selector until we find meaningful content
        for (const selector of contentSelectors) {
          const matches = html.match(selector)
          if (matches && matches[1]) {
            extractedContent = matches[1]
            console.log(`Found content using selector for ${url}, length: ${extractedContent.length}`)
            break
          }
        }
        
        // If no specific content area found, use the whole body
        if (!extractedContent) {
          const bodyMatch = html.match(/<body[^>]*>(.*?)<\/body>/gis)
          if (bodyMatch) {
            extractedContent = bodyMatch[1] || ''
          } else {
            extractedContent = html
          }
        }
        
        // Clean the content more carefully
        let cleanContent = extractedContent
          // Remove script and style elements
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          // Remove navigation elements
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          // Remove common non-content elements
          .replace(/<div[^>]*class="[^"]*nav[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
          .replace(/<div[^>]*class="[^"]*menu[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
          .replace(/<div[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
          // Remove HTML tags but preserve some structure
          .replace(/<\/?(p|br|div|h[1-6])[^>]*>/gi, '\n')
          .replace(/<[^>]*>/g, ' ')
          // Clean up whitespace
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .trim()

        console.log(`Clean content length for ${url}: ${cleanContent.length}`)
        console.log(`Content preview: ${cleanContent.substring(0, 200)}...`)

        // More lenient content length check - accept pages with at least 50 characters of meaningful content
        if (cleanContent.length < 50) {
          console.log(`Skipping ${url} - content too short: ${cleanContent.length} chars`)
          return null
        }

        return {
          url,
          title,
          content: cleanContent.substring(0, 8000), // Limit content length
          contentHash: await generateHash(cleanContent),
          rawHtml: html
        }
      } catch (error) {
        console.error(`Error scraping ${url}:`, error)
        return null
      }
    }

    // Enhanced function to extract links from HTML
    const extractLinks = (html: string, baseUrl: string) => {
      const links = new Set<string>()
      
      // More comprehensive link extraction
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
      let match

      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1]
        
        // Skip external links (but allow same domain)
        if (href.startsWith('http') && !href.includes(new URL(baseUrl).hostname)) {
          continue
        }
        
        // Skip anchors, email, and other non-content links
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          continue
        }
        
        // Skip common non-content pages
        if (href.includes('edit') || href.includes('action=') || href.includes('Special:') || 
            href.includes('login') || href.includes('register') || href.includes('admin')) {
          continue
        }
        
        // Handle relative URLs
        try {
          const fullUrl = new URL(href, baseUrl).href
          // Remove fragments and query parameters for consistency
          const cleanUrl = fullUrl.split('#')[0].split('?')[0]
          links.add(cleanUrl)
        } catch (e) {
          // Invalid URL, skip
          continue
        }
      }
      
      console.log(`Extracted ${links.size} links from page`)
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
          const errorText = await response.text()
          throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        return data.data[0].embedding
      } catch (error) {
        console.error('Error generating embedding:', error)
        return null
      }
    }

    // Start with the base URL and some common wiki entry points
    const discoveredUrls = new Set([baseUrl])
    const processedUrls = new Set<string>()
    const maxPages = 150 // Increased limit
    let pagesScraped = 0

    // Add more comprehensive seed URLs for wiki discovery
    const baseUrlObj = new URL(baseUrl)
    const seedUrls = [
      `${baseUrl}`,
      `${baseUrl}/`,
      `${baseUrl}/index.html`,
      `${baseUrl}/index.php`,
      `${baseUrl}/Main_Page`,
      `${baseUrl}/Home`,
      `${baseUrl}/Published`,
      `${baseUrl}/wiki`,
      `${baseUrl}/pages`,
      `${baseUrl}/content`,
      // Try common wiki patterns
      `${baseUrlObj.origin}/wiki/Main_Page`,
      `${baseUrlObj.origin}/w/index.php`,
    ]

    seedUrls.forEach(url => {
      try {
        const normalizedUrl = new URL(url).href
        discoveredUrls.add(normalizedUrl)
      } catch (e) {
        // Invalid URL, skip
      }
    })

    console.log(`Starting with ${discoveredUrls.size} seed URLs`)

    // Process URLs in batches with better discovery
    while (discoveredUrls.size > 0 && pagesScraped < maxPages) {
      const urlsToProcess = Array.from(discoveredUrls).slice(0, 5) // Smaller batches for better debugging
      urlsToProcess.forEach(url => {
        discoveredUrls.delete(url)
        processedUrls.add(url)
      })

      console.log(`Processing batch of ${urlsToProcess.length} URLs. Remaining: ${discoveredUrls.size}`)

      for (const url of urlsToProcess) {
        if (pagesScraped >= maxPages) break
        
        console.log(`Processing: ${url}`)
        
        const pageData = await scrapePage(url)
        if (!pageData) {
          console.log(`Skipped ${url} - no valid content extracted`)
          continue
        }

        // Extract links from this page for future discovery (but only if we haven't hit our limit)
        if (discoveredUrls.size < maxPages * 2) { // Allow more URL discovery
          const newLinks = extractLinks(pageData.rawHtml, baseUrl)
          let newLinksAdded = 0
          newLinks.forEach(link => {
            if (!processedUrls.has(link) && !discoveredUrls.has(link)) {
              discoveredUrls.add(link)
              newLinksAdded++
            }
          })
          console.log(`Added ${newLinksAdded} new links to discovery queue`)
        }

        // Check if this content already exists (by hash)
        const { data: existing } = await supabase
          .from('wiki_content')
          .select('id')
          .eq('content_hash', pageData.contentHash)
          .single()

        if (existing) {
          console.log(`Skipping ${url} - content already exists (hash match)`)
          continue
        }

        // Generate embedding for the content
        console.log(`Generating embedding for ${url}`)
        const embedding = await generateEmbedding(pageData.content)
        if (!embedding) {
          console.log(`Skipping ${url} - failed to generate embedding`)
          continue
        }

        // Insert the content
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
        console.log(`✅ Successfully processed ${pagesScraped}: ${url}`)
        console.log(`   Title: ${pageData.title}`)
        console.log(`   Content length: ${pageData.content.length}`)

        // Add a small delay to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      console.log(`Batch complete. Pages scraped so far: ${pagesScraped}`)
    }

    const totalDiscovered = processedUrls.size
    console.log(`Scraping complete. Processed ${totalDiscovered} URLs, successfully scraped ${pagesScraped} pages`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        pagesScraped,
        totalDiscovered,
        message: `Successfully scraped and processed ${pagesScraped} pages from ${totalDiscovered} discovered URLs` 
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

