
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

    console.log(`🚀 ENHANCED SCRAPER STARTED: ${baseUrl}`)
    console.log(`📊 CONFIGURATION:`)
    console.log(`   - Base URL: ${baseUrl}`)
    console.log(`   - Target path: /Published/`)
    console.log(`   - Max pages: 200`)
    console.log(`   - Enhanced URL discovery enabled`)

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('CGPTkey')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Function to extract content from a webpage with enhanced logging
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
        
        // Extract title with multiple strategies
        let title = 'Untitled'
        const titleStrategies = [
          /<title[^>]*>(.*?)<\/title>/i,
          /<h1[^>]*>(.*?)<\/h1>/i,
          /<h2[^>]*>(.*?)<\/h2>/i
        ]
        
        for (const strategy of titleStrategies) {
          const titleMatch = html.match(strategy)
          if (titleMatch && titleMatch[1].trim().length > 0) {
            title = titleMatch[1].replace(/\s+/g, ' ').trim()
            console.log(`📝 TITLE EXTRACTED: "${title}"`)
            break
          }
        }
        
        // Enhanced content extraction with multiple strategies
        let extractedContent = ''
        
        // Strategy 1: Look for common wiki content containers
        const contentSelectors = [
          /<div[^>]*(?:class="[^"]*(?:content|main|article|wiki|page)[^"]*")[^>]*>([\s\S]*?)<\/div>/gi,
          /<main[^>]*>([\s\S]*?)<\/main>/gi,
          /<article[^>]*>([\s\S]*?)<\/article>/gi,
          /<section[^>]*>([\s\S]*?)<\/section>/gi,
          /<div[^>]*(?:id="[^"]*(?:content|main|article|wiki|page)[^"]*")[^>]*>([\s\S]*?)<\/div>/gi
        ]
        
        let contentParts = []
        
        for (const selector of contentSelectors) {
          const matches = html.matchAll(selector)
          for (const match of matches) {
            if (match[1] && match[1].trim().length > 50) {
              contentParts.push(match[1].trim())
            }
          }
        }
        
        // Strategy 2: Extract all meaningful text elements
        if (contentParts.length === 0) {
          console.log(`🔄 FALLBACK: Using text element extraction`)
          const textElements = [
            /<p[^>]*>(.*?)<\/p>/gi,
            /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi,
            /<li[^>]*>(.*?)<\/li>/gi,
            /<td[^>]*>(.*?)<\/td>/gi,
            /<span[^>]*>(.*?)<\/span>/gi,
            /<div[^>]*>(.*?)<\/div>/gi
          ]
          
          for (const elementRegex of textElements) {
            const matches = html.matchAll(elementRegex)
            for (const match of matches) {
              if (match[1] && match[1].trim().length > 10) {
                const cleanText = match[1]
                  .replace(/<[^>]*>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                if (cleanText.length > 10 && !cleanText.match(/^(edit|delete|login|register|admin|home|back|next|previous)$/i)) {
                  contentParts.push(cleanText)
                }
              }
            }
          }
        }
        
        // Strategy 3: Aggressive fallback - get all text
        if (contentParts.length === 0) {
          console.log(`🔄 AGGRESSIVE FALLBACK: Extracting all text`)
          let cleanHtml = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          
          const textNodes = cleanHtml.replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          
          if (textNodes.length > 100) {
            extractedContent = textNodes
            console.log(`✅ AGGRESSIVE FALLBACK SUCCESS: Extracted ${textNodes.length} characters`)
          }
        } else {
          extractedContent = contentParts.join(' ')
          console.log(`✅ CONTENT EXTRACTION SUCCESS: ${extractedContent.length} characters from ${contentParts.length} parts`)
        }
        
        // Clean and validate content
        let cleanContent = extractedContent
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .trim()

        console.log(`🧹 FINAL CONTENT: ${cleanContent.length} characters`)
        console.log(`📖 PREVIEW: "${cleanContent.substring(0, 200)}..."`)

        if (cleanContent.length < 50) {
          console.log(`❌ CONTENT TOO SHORT: Only ${cleanContent.length} characters - SKIPPING`)
          return null
        }

        const result = {
          url,
          title,
          content: cleanContent.substring(0, 10000), // Increased limit
          contentHash: await generateHash(cleanContent),
          rawHtml: html
        }
        
        console.log(`✅ PAGE PROCESSED SUCCESSFULLY: ${url}`)
        return result
      } catch (error) {
        console.error(`💥 ERROR PROCESSING: ${url}`, error)
        return null
      }
    }

    // Enhanced link extraction with better handling of wiki URLs
    const extractLinks = (html: string, baseUrl: string) => {
      console.log(`\n🔗 ENHANCED LINK EXTRACTION`)
      const links = new Set<string>()
      
      // More comprehensive link regex patterns
      const linkPatterns = [
        /<a[^>]+href=["']([^"']+)["'][^>]*>/gi,
        /href=["']([^"']+)["']/gi,
        /url\(["']([^"']+)["']\)/gi
      ]
      
      let totalLinksFound = 0
      let validLinksFound = 0
      let skippedLinks = 0

      for (const linkRegex of linkPatterns) {
        let match
        while ((match = linkRegex.exec(html)) !== null) {
          totalLinksFound++
          let href = match[1]
          
          // Skip anchors, email, and other non-content links
          if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
            skippedLinks++
            continue
          }
          
          // Skip admin/system pages
          if (href.includes('edit') || href.includes('action=') || href.includes('Special:') || 
              href.includes('login') || href.includes('register') || href.includes('admin') ||
              href.includes('css') || href.includes('.js') || href.includes('.png') || 
              href.includes('.jpg') || href.includes('.gif') || href.includes('.pdf')) {
            skippedLinks++
            continue
          }
          
          try {
            const fullUrl = new URL(href, baseUrl).href
            const cleanUrl = fullUrl.split('#')[0].split('?')[0]
            
            const baseUrlObj = new URL(baseUrl)
            const linkUrlObj = new URL(cleanUrl)
            
            // Include links from the same domain that contain /Published/ OR look like wiki pages
            if (linkUrlObj.hostname === baseUrlObj.hostname) {
              const pathname = linkUrlObj.pathname
              const shouldInclude = 
                pathname.includes('/Published/') ||
                pathname.includes('/wiki/') ||
                pathname.includes('/page/') ||
                (pathname.includes('/') && pathname.length > 5 && !pathname.includes('.'))
              
              if (shouldInclude) {
                links.add(cleanUrl)
                validLinksFound++
                if (pathname.includes('/Published/')) {
                  console.log(`  ✅ PUBLISHED LINK: ${cleanUrl}`)
                } else {
                  console.log(`  📋 WIKI LINK: ${cleanUrl}`)
                }
              } else {
                skippedLinks++
              }
            } else {
              skippedLinks++
            }
          } catch (e) {
            skippedLinks++
            continue
          }
        }
      }
      
      console.log(`🔗 LINK EXTRACTION SUMMARY:`)
      console.log(`   - Total links found: ${totalLinksFound}`)
      console.log(`   - Valid wiki links: ${validLinksFound}`)
      console.log(`   - Skipped links: ${skippedLinks}`)
      console.log(`   - Unique valid links: ${links.size}`)
      
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

    console.log(`\n🌐 ENHANCED URL DISCOVERY STARTING`)
    const discoveredUrls = new Set<string>()
    const processedUrls = new Set<string>()
    const maxPages = 200 // Increased limit
    let pagesScraped = 0
    let pagesSkipped = 0

    // Enhanced seed URLs with more comprehensive coverage
    const baseUrlObj = new URL(baseUrl)
    const seedUrls = [
      baseUrl,
      `${baseUrlObj.origin}/Published/`,
      `${baseUrlObj.origin}/Published/Common+Lore/`,
      `${baseUrlObj.origin}/Published/Factions/`,
      `${baseUrlObj.origin}/Published/Race+Backround/`,
      `${baseUrlObj.origin}/Published/The+World+-+Map/`,
      `${baseUrlObj.origin}/Published/Factions/The+Blue+Guard`,
      `${baseUrlObj.origin}/Published/Race+Backround/Tribes+-+Races+-+Factions/Race/Owl+Folk`,
      `${baseUrlObj.origin}/Published/The+World+-+Map/Alanar+Empire/New+Alari`,
      `${baseUrlObj.origin}/`,
      `${baseUrlObj.origin}/wiki/`,
      `${baseUrlObj.origin}/index.php`,
      `${baseUrlObj.origin}/Main_Page`,
    ]

    // Add your specific URLs
    const specificUrls = [
      'https://wiki.the-guild.io/Published/Factions/The+Blue+Guard',
      'https://wiki.the-guild.io/Published/Race+Backround/Tribes+-+Races+-+Factions/Race/Owl+Folk',
      'https://wiki.the-guild.io/Published/The+World+-+Map/Alanar+Empire/New+Alari'
    ]

    seedUrls.push(...specificUrls)

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

    // Process URLs with enhanced discovery
    let batchNumber = 0
    while (discoveredUrls.size > 0 && pagesScraped < maxPages) {
      batchNumber++
      const urlsToProcess = Array.from(discoveredUrls).slice(0, 5) // Process more at once
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

        // Enhanced link discovery
        if (discoveredUrls.size < maxPages * 2) {
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

        // Check if content exists (using URL instead of hash for better duplicate detection)
        console.log(`🔍 CHECKING FOR EXISTING URL: ${pageData.url}`)
        const { data: existing } = await supabase
          .from('wiki_content')
          .select('id, url, content_hash')
          .eq('url', pageData.url)
          .single()

        if (existing) {
          // Check if content has changed
          if (existing.content_hash === pageData.contentHash) {
            console.log(`⏭️  CONTENT UNCHANGED: ${url} - Skipping`)
            pagesSkipped++
            continue
          } else {
            console.log(`🔄 CONTENT UPDATED: ${url} - Will update`)
          }
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

        // Reduced delay for faster processing
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      console.log(`\n📊 BATCH ${batchNumber} COMPLETE`)
      console.log(`   - Pages scraped so far: ${pagesScraped}`)
      console.log(`   - Pages skipped: ${pagesSkipped}`)
      console.log(`   - URLs remaining: ${discoveredUrls.size}`)
    }

    const totalDiscovered = processedUrls.size
    const publishedUrls = Array.from(processedUrls).filter(url => url.includes('/Published/'))
    
    console.log(`\n🏁 ENHANCED SCRAPING COMPLETE!`)
    console.log(`   📊 FINAL STATISTICS:`)
    console.log(`   - Total URLs discovered: ${totalDiscovered}`)
    console.log(`   - Total URLs processed: ${processedUrls.size}`)
    console.log(`   - Pages successfully scraped: ${pagesScraped}`)
    console.log(`   - Pages skipped: ${pagesSkipped}`)
    console.log(`   - Published URLs found: ${publishedUrls.length}`)
    console.log(`   - Specific target URLs processed:`)
    
    specificUrls.forEach(targetUrl => {
      const found = processedUrls.has(targetUrl)
      console.log(`     ${found ? '✅' : '❌'} ${targetUrl}`)
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        pagesScraped,
        pagesSkipped,
        totalDiscovered,
        publishedUrls,
        specificUrlsProcessed: specificUrls.filter(url => processedUrls.has(url)),
        allProcessedUrls: Array.from(processedUrls),
        message: `Enhanced scraping complete: ${pagesScraped} pages scraped, ${pagesSkipped} skipped, from ${totalDiscovered} discovered URLs. Found ${publishedUrls.length} Published URLs.` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 ENHANCED SCRAPER ERROR:', error)
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
