
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

    console.log(`🚀 AUTO-DISCOVERY SCRAPER STARTED: ${baseUrl}`)
    console.log(`📊 CONFIGURATION:`)
    console.log(`   - Base URL: ${baseUrl}`)
    console.log(`   - Auto-discovery enabled`)
    console.log(`   - Max pages: 500`)
    console.log(`   - Target: All discoverable wiki pages`)

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('CGPTkey')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Function to extract content from a webpage
    const scrapePage = async (url: string) => {
      try {
        console.log(`\n🔍 SCRAPING: ${url}`)
        const response = await fetch(url)
        if (!response.ok) {
          console.log(`❌ FETCH FAILED: ${url} - Status: ${response.status}`)
          return null
        }
        
        const html = await response.text()
        console.log(`📄 HTML SIZE: ${html.length} bytes`)
        
        // Extract title
        let title = 'Untitled'
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
        if (titleMatch) {
          title = titleMatch[1].replace(/\s+/g, ' ').trim()
          console.log(`📝 TITLE: "${title}"`)
        }
        
        // Enhanced content extraction - try multiple strategies
        let content = ''
        
        // Strategy 1: Remove scripts, styles, navigation
        let cleanHtml = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        
        // Strategy 2: Extract meaningful text elements
        const textElements = []
        const patterns = [
          /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi,
          /<p[^>]*>(.*?)<\/p>/gi,
          /<div[^>]*class="[^"]*(?:content|main|wiki|article|page)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
          /<td[^>]*>(.*?)<\/td>/gi,
          /<li[^>]*>(.*?)<\/li>/gi
        ]
        
        for (const pattern of patterns) {
          let match
          while ((match = pattern.exec(cleanHtml)) !== null) {
            const text = match[1]
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
            if (text.length > 5 && !text.match(/^(edit|delete|login|home|back|next)$/i)) {
              textElements.push(text)
            }
          }
        }
        
        // Strategy 3: Fallback - extract all text
        if (textElements.length === 0) {
          content = cleanHtml
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        } else {
          content = textElements.join(' ')
        }

        console.log(`📖 CONTENT: ${content.length} characters`)

        if (content.length < 20) {
          console.log(`❌ CONTENT TOO SHORT - SKIPPING`)
          return null
        }

        return {
          url,
          title,
          content: content.substring(0, 8000),
          contentHash: await generateHash(content),
          rawHtml: html
        }
      } catch (error) {
        console.error(`💥 SCRAPING ERROR: ${url}`, error)
        return null
      }
    }

    // Aggressive link discovery function
    const discoverAllLinks = async (startUrl: string) => {
      console.log(`🔍 DISCOVERING ALL LINKS FROM: ${startUrl}`)
      const discoveredUrls = new Set<string>()
      const processedUrls = new Set<string>()
      const urlQueue = [startUrl]
      const baseUrlObj = new URL(baseUrl)
      
      let discoveryRounds = 0
      const maxDiscoveryRounds = 10
      
      while (urlQueue.length > 0 && discoveryRounds < maxDiscoveryRounds) {
        discoveryRounds++
        const currentUrl = urlQueue.shift()!
        
        if (processedUrls.has(currentUrl)) continue
        processedUrls.add(currentUrl)
        
        console.log(`\n🌐 DISCOVERY ROUND ${discoveryRounds}: ${currentUrl}`)
        
        try {
          const response = await fetch(currentUrl)
          if (!response.ok) continue
          
          const html = await response.text()
          
          // Extract all possible link patterns
          const linkPatterns = [
            /href=["']([^"']+)["']/gi,
            /url\(["']([^"']+)["']\)/gi,
            /"(\/[^"]*(?:Published|wiki|page)[^"]*)"/gi
          ]
          
          let newLinksFound = 0
          
          for (const pattern of linkPatterns) {
            let match
            while ((match = pattern.exec(html)) !== null) {
              let href = match[1]
              
              // Skip non-content links
              if (href.startsWith('#') || href.startsWith('mailto:') || 
                  href.startsWith('tel:') || href.startsWith('javascript:') ||
                  href.includes('.css') || href.includes('.js') || 
                  href.includes('.png') || href.includes('.jpg') ||
                  href.includes('action=') || href.includes('edit') ||
                  href.includes('Special:') || href.includes('login')) {
                continue
              }
              
              try {
                // Handle relative and absolute URLs
                const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href
                const cleanUrl = fullUrl.split('#')[0].split('?')[0]
                const urlObj = new URL(cleanUrl)
                
                // Only include URLs from the same domain
                if (urlObj.hostname === baseUrlObj.hostname) {
                  const shouldInclude = 
                    urlObj.pathname.includes('/Published/') ||
                    urlObj.pathname.includes('/wiki/') ||
                    urlObj.pathname.includes('/page/') ||
                    (urlObj.pathname.length > 3 && !urlObj.pathname.includes('.'))
                  
                  if (shouldInclude && !discoveredUrls.has(cleanUrl) && !processedUrls.has(cleanUrl)) {
                    discoveredUrls.add(cleanUrl)
                    urlQueue.push(cleanUrl)
                    newLinksFound++
                    
                    if (urlObj.pathname.includes('/Published/')) {
                      console.log(`  ✅ PUBLISHED: ${cleanUrl}`)
                    } else {
                      console.log(`  📋 WIKI: ${cleanUrl}`)
                    }
                  }
                }
              } catch (e) {
                continue
              }
            }
          }
          
          console.log(`  📊 Found ${newLinksFound} new links`)
          
          // Rate limit discovery
          await new Promise(resolve => setTimeout(resolve, 200))
          
        } catch (error) {
          console.error(`💥 DISCOVERY ERROR: ${currentUrl}`, error)
        }
      }
      
      console.log(`\n🎯 DISCOVERY COMPLETE:`)
      console.log(`   - Discovery rounds: ${discoveryRounds}`)
      console.log(`   - URLs processed for discovery: ${processedUrls.size}`)
      console.log(`   - Total URLs discovered: ${discoveredUrls.size}`)
      console.log(`   - Published URLs: ${Array.from(discoveredUrls).filter(url => url.includes('/Published/')).length}`)
      
      return Array.from(discoveredUrls)
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
        console.log(`🤖 GENERATING EMBEDDING: ${text.length} characters`)
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
          throw new Error(`OpenAI API error: ${response.status}`)
        }

        const data = await response.json()
        return data.data[0].embedding
      } catch (error) {
        console.error('💥 EMBEDDING ERROR:', error)
        return null
      }
    }

    // Start auto-discovery from multiple entry points
    console.log(`\n🌐 STARTING AUTO-DISCOVERY`)
    const entryPoints = [
      baseUrl,
      `${new URL(baseUrl).origin}/Published/`,
      `${new URL(baseUrl).origin}/`,
      `${new URL(baseUrl).origin}/wiki/`,
      `${new URL(baseUrl).origin}/index.php`
    ]

    let allDiscoveredUrls = new Set<string>()
    
    for (const entryPoint of entryPoints) {
      console.log(`\n🚀 DISCOVERING FROM ENTRY POINT: ${entryPoint}`)
      try {
        const discoveredUrls = await discoverAllLinks(entryPoint)
        discoveredUrls.forEach(url => allDiscoveredUrls.add(url))
        console.log(`  ➕ Added ${discoveredUrls.length} URLs from ${entryPoint}`)
      } catch (error) {
        console.error(`💥 ENTRY POINT ERROR: ${entryPoint}`, error)
      }
    }

    const urlsToScrape = Array.from(allDiscoveredUrls)
    const maxPages = 500
    const publishedUrls = urlsToScrape.filter(url => url.includes('/Published/'))
    
    console.log(`\n📊 DISCOVERY SUMMARY:`)
    console.log(`   - Total URLs discovered: ${urlsToScrape.length}`)
    console.log(`   - Published URLs: ${publishedUrls.length}`)
    console.log(`   - Will process up to: ${Math.min(maxPages, urlsToScrape.length)} pages`)

    // Process discovered URLs
    let pagesScraped = 0
    let pagesSkipped = 0
    const processedUrls = new Set<string>()

    for (const url of urlsToScrape.slice(0, maxPages)) {
      console.log(`\n📄 PROCESSING ${pagesScraped + 1}/${Math.min(maxPages, urlsToScrape.length)}: ${url}`)
      
      const pageData = await scrapePage(url)
      if (!pageData) {
        console.log(`⏭️  SKIPPED: No content`)
        pagesSkipped++
        continue
      }

      // Check if content exists
      const { data: existing } = await supabase
        .from('wiki_content')
        .select('id, content_hash')
        .eq('url', pageData.url)
        .single()

      if (existing && existing.content_hash === pageData.contentHash) {
        console.log(`⏭️  UNCHANGED: Content identical`)
        pagesSkipped++
        continue
      }

      // Generate embedding
      const embedding = await generateEmbedding(pageData.content)
      if (!embedding) {
        console.log(`❌ EMBEDDING FAILED`)
        pagesSkipped++
        continue
      }

      // Save to database
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
        console.error(`💥 DATABASE ERROR:`, error)
        pagesSkipped++
        continue
      }

      pagesScraped++
      processedUrls.add(url)
      console.log(`✅ SAVED: ${pageData.title} (${pageData.content.length} chars)`)
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    console.log(`\n🏁 AUTO-DISCOVERY SCRAPING COMPLETE!`)
    console.log(`   📊 FINAL STATISTICS:`)
    console.log(`   - URLs discovered: ${urlsToScrape.length}`)
    console.log(`   - Published URLs found: ${publishedUrls.length}`)
    console.log(`   - Pages successfully scraped: ${pagesScraped}`)
    console.log(`   - Pages skipped: ${pagesSkipped}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        pagesScraped,
        pagesSkipped,
        totalDiscovered: urlsToScrape.length,
        publishedUrlsFound: publishedUrls.length,
        allDiscoveredUrls: urlsToScrape.slice(0, 50), // Return first 50 for reference
        message: `Auto-discovery complete: Found ${urlsToScrape.length} URLs, scraped ${pagesScraped} pages, ${publishedUrls.length} Published pages discovered` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 AUTO-DISCOVERY SCRAPER ERROR:', error)
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
