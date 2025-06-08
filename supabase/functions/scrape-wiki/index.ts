
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

    console.log(`🚀 SCRAPER STARTED: ${baseUrl}`)
    console.log(`📊 CONFIGURATION:`)
    console.log(`   - Base URL: ${baseUrl}`)
    console.log(`   - Target path: /Published/`)
    console.log(`   - Max pages: 100`)

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('CGPTkey')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Function to extract content from a webpage with detailed logging
    const scrapePage = async (url: string) => {
      try {
        console.log(`\n🔍 PROCESSING: ${url}`)
        const response = await fetch(url)
        if (!response.ok) {
          console.log(`❌ FETCH FAILED: ${url} - Status: ${response.status}`)
          return null
        }
        
        const html = await response.text()
        console.log(`📄 HTML LENGTH: ${html.length} characters`)
        
        // Extract title
        let title = 'Untitled'
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
        if (titleMatch) {
          title = titleMatch[1].replace(/\s+/g, ' ').trim()
          console.log(`📝 TITLE EXTRACTED: "${title}"`)
        } else {
          console.log(`⚠️  NO TITLE FOUND`)
        }
        
        // Extract content with detailed logging
        let extractedContent = ''
        
        // Log HTML structure sample
        const htmlSample = html.substring(0, 500)
        console.log(`🔬 HTML SAMPLE:`, htmlSample.replace(/\n/g, ' ').substring(0, 200) + '...')
        
        // Try multiple content extraction strategies
        const strategies = [
          { name: 'Main content areas', pattern: /<main[^>]*>([\s\S]*?)<\/main>/gi },
          { name: 'Article tags', pattern: /<article[^>]*>([\s\S]*?)<\/article>/gi },
          { name: 'Content divs', pattern: /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi },
          { name: 'Paragraphs', pattern: /<p[^>]*>(.*?)<\/p>/gi },
          { name: 'Headings', pattern: /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi }
        ]
        
        let contentParts = []
        
        for (const strategy of strategies) {
          const matches = html.matchAll(strategy.pattern)
          const strategyContent = []
          
          for (const match of matches) {
            if (match[1] && match[1].trim().length > 10) {
              strategyContent.push(match[1].trim())
            }
          }
          
          console.log(`📋 ${strategy.name}: Found ${strategyContent.length} matches`)
          if (strategyContent.length > 0) {
            contentParts.push(...strategyContent)
          }
        }
        
        if (contentParts.length === 0) {
          console.log(`🔄 FALLBACK: Using aggressive text extraction`)
          // Fallback: remove scripts/styles and extract all text
          let cleanHtml = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
          
          const textNodes = cleanHtml.replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          
          if (textNodes.length > 50) {
            extractedContent = textNodes
            console.log(`✅ FALLBACK SUCCESS: Extracted ${textNodes.length} characters`)
          }
        } else {
          extractedContent = contentParts.join(' ')
          console.log(`✅ STRATEGY SUCCESS: Extracted ${extractedContent.length} characters from ${contentParts.length} parts`)
        }
        
        // Clean the content
        let cleanContent = extractedContent
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .trim()

        console.log(`🧹 CLEANED CONTENT: ${cleanContent.length} characters`)
        console.log(`📖 PREVIEW: "${cleanContent.substring(0, 150)}..."`)

        if (cleanContent.length < 20) {
          console.log(`❌ CONTENT TOO SHORT: Only ${cleanContent.length} characters - SKIPPING`)
          return null
        }

        const result = {
          url,
          title,
          content: cleanContent.substring(0, 8000), // Limit content length
          contentHash: await generateHash(cleanContent),
          rawHtml: html
        }
        
        console.log(`✅ PAGE PROCESSED SUCCESSFULLY: ${url}`)
        console.log(`   - Title: ${title}`)
        console.log(`   - Content length: ${result.content.length}`)
        console.log(`   - Hash: ${result.contentHash.substring(0, 16)}...`)
        
        return result
      } catch (error) {
        console.error(`💥 ERROR PROCESSING: ${url}`, error)
        return null
      }
    }

    // Enhanced function to extract links with detailed logging
    const extractLinks = (html: string, baseUrl: string) => {
      console.log(`\n🔗 EXTRACTING LINKS FROM PAGE`)
      const links = new Set<string>()
      
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
      let match
      let totalLinksFound = 0
      let publishedLinksFound = 0
      let skippedLinks = 0

      while ((match = linkRegex.exec(html)) !== null) {
        totalLinksFound++
        let href = match[1]
        
        // Skip anchors, email, and other non-content links
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          skippedLinks++
          continue
        }
        
        // Skip common non-content pages
        if (href.includes('edit') || href.includes('action=') || href.includes('Special:') || 
            href.includes('login') || href.includes('register') || href.includes('admin')) {
          skippedLinks++
          continue
        }
        
        try {
          const fullUrl = new URL(href, baseUrl).href
          const cleanUrl = fullUrl.split('#')[0].split('?')[0]
          
          const baseUrlObj = new URL(baseUrl)
          const linkUrlObj = new URL(cleanUrl)
          
          // Only include links from the same domain that contain /Published/
          if (linkUrlObj.hostname === baseUrlObj.hostname && cleanUrl.includes('/Published/')) {
            links.add(cleanUrl)
            publishedLinksFound++
            console.log(`  ✅ FOUND PUBLISHED LINK: ${cleanUrl}`)
          } else {
            skippedLinks++
          }
        } catch (e) {
          skippedLinks++
          continue
        }
      }
      
      console.log(`🔗 LINK EXTRACTION SUMMARY:`)
      console.log(`   - Total links found: ${totalLinksFound}`)
      console.log(`   - Published links: ${publishedLinksFound}`)
      console.log(`   - Skipped links: ${skippedLinks}`)
      console.log(`   - Unique published links: ${links.size}`)
      
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
          const errorText = await response.text()
          throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        console.log(`✅ EMBEDDING GENERATED SUCCESSFULLY`)
        return data.data[0].embedding
      } catch (error) {
        console.error('💥 EMBEDDING ERROR:', error)
        return null
      }
    }

    console.log(`\n🌐 INITIALIZING URL DISCOVERY`)
    const discoveredUrls = new Set<string>()
    const processedUrls = new Set<string>()
    const maxPages = 100
    let pagesScraped = 0
    let pagesSkipped = 0

    // Add comprehensive seed URLs for discovery
    const baseUrlObj = new URL(baseUrl)
    const seedUrls = [
      baseUrl,
      `${baseUrlObj.origin}/Published/`,
      `${baseUrlObj.origin}/Published/Common+Lore/`,
      `${baseUrlObj.origin}/Published/Common+Lore/The+Whispering+Gyre/`,
      `${baseUrlObj.origin}/Published/Common+Lore/The+Whispering+Gyre`,
      `${baseUrlObj.origin}/Published`,
      `${baseUrlObj.origin}/`,
    ]

    seedUrls.forEach(url => {
      try {
        const normalizedUrl = new URL(url).href
        discoveredUrls.add(normalizedUrl)
        console.log(`🌱 SEED URL ADDED: ${normalizedUrl}`)
      } catch (e) {
        console.log(`❌ INVALID SEED URL: ${url}`)
      }
    })

    console.log(`\n📊 DISCOVERY PHASE COMPLETE`)
    console.log(`   - Starting with ${discoveredUrls.size} seed URLs`)
    console.log(`   - Max pages to process: ${maxPages}`)

    // Process URLs in batches with detailed logging
    let batchNumber = 0
    while (discoveredUrls.size > 0 && pagesScraped < maxPages) {
      batchNumber++
      const urlsToProcess = Array.from(discoveredUrls).slice(0, 3)
      urlsToProcess.forEach(url => {
        discoveredUrls.delete(url)
        processedUrls.add(url)
      })

      console.log(`\n🎯 BATCH ${batchNumber}: Processing ${urlsToProcess.length} URLs`)
      console.log(`   - Remaining in queue: ${discoveredUrls.size}`)
      console.log(`   - URLs to process:`)
      urlsToProcess.forEach((url, index) => {
        console.log(`     ${index + 1}. ${url}`)
      })

      for (const url of urlsToProcess) {
        if (pagesScraped >= maxPages) {
          console.log(`🛑 MAX PAGES REACHED: ${maxPages}`)
          break
        }
        
        console.log(`\n📄 PROCESSING URL ${pagesScraped + 1}/${maxPages}: ${url}`)
        
        const pageData = await scrapePage(url)
        if (!pageData) {
          console.log(`⏭️  SKIPPED: ${url} - No valid content extracted`)
          pagesSkipped++
          continue
        }

        // Extract links for future discovery
        if (discoveredUrls.size < maxPages * 3) {
          console.log(`🔍 DISCOVERING NEW LINKS FROM: ${url}`)
          const newLinks = extractLinks(pageData.rawHtml, baseUrl)
          let newLinksAdded = 0
          newLinks.forEach(link => {
            if (!processedUrls.has(link) && !discoveredUrls.has(link)) {
              discoveredUrls.add(link)
              newLinksAdded++
            }
          })
          console.log(`➕ ADDED ${newLinksAdded} NEW URLS TO QUEUE`)
        }

        // Check if this content already exists
        console.log(`🔍 CHECKING FOR EXISTING CONTENT: ${pageData.contentHash.substring(0, 16)}...`)
        const { data: existing } = await supabase
          .from('wiki_content')
          .select('id, url')
          .eq('content_hash', pageData.contentHash)
          .single()

        if (existing) {
          console.log(`⏭️  CONTENT ALREADY EXISTS: ${url} (matches ${existing.url})`)
          pagesSkipped++
          continue
        }

        // Generate embedding
        console.log(`🤖 GENERATING EMBEDDING FOR: ${url}`)
        const embedding = await generateEmbedding(pageData.content)
        if (!embedding) {
          console.log(`❌ EMBEDDING FAILED: ${url} - Skipping`)
          pagesSkipped++
          continue
        }

        // Save to database
        console.log(`💾 SAVING TO DATABASE: ${url}`)
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
          console.error(`💥 DATABASE ERROR: ${url}`, error)
          pagesSkipped++
          continue
        }

        pagesScraped++
        console.log(`\n🎉 SUCCESS! Page ${pagesScraped} saved: ${url}`)
        console.log(`   📝 Title: ${pageData.title}`)
        console.log(`   📄 Content: ${pageData.content.length} characters`)
        console.log(`   🆔 Hash: ${pageData.contentHash.substring(0, 16)}...`)

        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      console.log(`\n📊 BATCH ${batchNumber} COMPLETE`)
      console.log(`   - Pages scraped so far: ${pagesScraped}`)
      console.log(`   - Pages skipped: ${pagesSkipped}`)
      console.log(`   - URLs remaining: ${discoveredUrls.size}`)
    }

    const totalDiscovered = processedUrls.size
    console.log(`\n🏁 SCRAPING COMPLETE!`)
    console.log(`   📊 FINAL STATISTICS:`)
    console.log(`   - Total URLs discovered: ${totalDiscovered}`)
    console.log(`   - Total URLs processed: ${processedUrls.size}`)
    console.log(`   - Pages successfully scraped: ${pagesScraped}`)
    console.log(`   - Pages skipped: ${pagesSkipped}`)
    console.log(`   - URLs that had /Published/ path: ${Array.from(processedUrls).filter(url => url.includes('/Published/')).length}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        pagesScraped,
        pagesSkipped,
        totalDiscovered,
        publishedUrls: Array.from(processedUrls).filter(url => url.includes('/Published/')),
        message: `Successfully scraped ${pagesScraped} pages, skipped ${pagesSkipped} pages, from ${totalDiscovered} discovered URLs` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 SCRAPER ERROR:', error)
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
