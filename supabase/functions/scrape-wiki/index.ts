
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
    const { incremental = false } = await req.json()
    
    // Get configuration from environment variables
    const googleApiKey = Deno.env.get('GDrive_APIKey')
    const folderId = Deno.env.get('Google_FolderID')
    
    if (!googleApiKey) {
      throw new Error('Google Drive API key not configured')
    }
    
    if (!folderId) {
      throw new Error('Google Drive folder ID not configured')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`🚀 GOOGLE DRIVE SCRAPER STARTED: ${folderId}`)
    console.log(`📊 MODE: ${incremental ? 'INCREMENTAL (Recent changes only)' : 'FULL SCAN'}`)
    console.log(`📊 CONFIGURATION:`)
    console.log(`   - Folder ID: ${folderId}`)
    console.log(`   - API Key: ${googleApiKey.substring(0, 10)}...`)
    console.log(`   - Target: All .md files in folder and subfolders`)

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('CGPTkey')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Enhanced rate limiting with exponential backoff
    let requestDelay = 1000 // Start with 1 second delay
    const maxDelay = 10000 // Maximum 10 seconds
    const delayMultiplier = 1.5
    let consecutiveErrors = 0

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // Function to make API calls with retry logic
    const makeApiCall = async (url: string, retries = 3): Promise<Response> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          console.log(`🌐 API Call attempt ${attempt}/${retries}: ${url.replace(googleApiKey, 'API_KEY_HIDDEN')}`)
          
          const response = await fetch(url)
          
          if (response.status === 403) {
            const errorText = await response.text()
            if (errorText.includes('automated queries')) {
              console.log(`⚠️  Rate limit detected on attempt ${attempt}, increasing delay...`)
              requestDelay = Math.min(requestDelay * delayMultiplier, maxDelay)
              consecutiveErrors++
              
              if (attempt < retries) {
                const backoffDelay = requestDelay * (attempt * 2)
                console.log(`⏰ Waiting ${backoffDelay}ms before retry...`)
                await sleep(backoffDelay)
                continue
              }
            }
            throw new Error(`Google API 403: ${errorText.substring(0, 200)}...`)
          }
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          // Success - reset error tracking
          consecutiveErrors = 0
          if (requestDelay > 1000) {
            requestDelay = Math.max(1000, requestDelay / delayMultiplier)
            console.log(`✅ Success! Reducing delay to ${requestDelay}ms`)
          }
          
          return response
        } catch (error) {
          console.error(`💥 API call failed (attempt ${attempt}):`, error.message)
          if (attempt === retries) {
            throw error
          }
          await sleep(2000 * attempt) // Progressive delay between retries
        }
      }
      throw new Error('All retry attempts failed')
    }

    // Get cutoff time for incremental scraping (last 7 days)
    const incrementalCutoff = incremental ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() : null

    // Function to recursively get all files from a Google Drive folder
    const getAllMarkdownFiles = async (folderId: string, path: string = '') => {
      console.log(`🔍 SCANNING FOLDER: ${folderId} (${path || 'root'})`)
      
      // Enhanced API call with fields for modification time
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents`)}&key=${googleApiKey}&fields=files(id,name,mimeType,parents,webViewLink,modifiedTime)&pageSize=100`
      
      try {
        await sleep(requestDelay) // Rate limiting
        const response = await makeApiCall(url)
        
        const data = await response.json()
        const files = data.files || []
        console.log(`📁 Found ${files.length} items in folder`)
        
        if (files.length === 0) {
          console.log(`⚠️  No files found in folder`)
        }
        
        const allFiles = []
        
        for (const file of files) {
          const currentPath = path ? `${path}/${file.name}` : file.name
          
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            // Recursively get files from subfolders
            console.log(`📂 Entering subfolder: ${file.name}`)
            const subfolderFiles = await getAllMarkdownFiles(file.id, currentPath)
            allFiles.push(...subfolderFiles)
          } else if (file.name.endsWith('.md')) {
            // Check if file should be included in incremental scan
            if (incremental && incrementalCutoff && file.modifiedTime) {
              if (file.modifiedTime < incrementalCutoff) {
                console.log(`⏭️  Skipping old file: ${currentPath} (modified: ${file.modifiedTime})`)
                continue
              }
            }
            
            console.log(`📄 Found markdown file: ${currentPath} ${incremental ? `(modified: ${file.modifiedTime})` : ''}`)
            allFiles.push({
              id: file.id,
              name: file.name,
              path: currentPath,
              webViewLink: file.webViewLink,
              modifiedTime: file.modifiedTime
            })
          } else {
            console.log(`📄 Skipping non-markdown file: ${currentPath}`)
          }
        }
        
        return allFiles
      } catch (error) {
        console.error(`💥 Error scanning folder ${folderId}:`, error)
        return []
      }
    }

    // Function to download file content from Google Drive with retry logic
    const downloadFileContent = async (fileId: string, fileName: string) => {
      console.log(`⬇️  DOWNLOADING: ${fileName}`)
      
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${googleApiKey}`
      
      try {
        await sleep(requestDelay) // Rate limiting
        const response = await makeApiCall(url)
        
        const content = await response.text()
        console.log(`✅ Downloaded ${fileName}: ${content.length} characters`)
        return content
      } catch (error) {
        console.error(`💥 Error downloading ${fileName}:`, error)
        return null
      }
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
          console.error(`💥 OpenAI Error: ${response.status} ${response.statusText} - ${errorText}`)
          throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        return data.data[0].embedding
      } catch (error) {
        console.error('💥 EMBEDDING ERROR:', error)
        return null
      }
    }

    // Function to extract title from markdown content
    const extractTitle = (content: string, fileName: string) => {
      const h1Match = content.match(/^#\s+(.+)$/m)
      if (h1Match) {
        return h1Match[1].trim()
      }
      return fileName.replace(/\.md$/, '').replace(/[-_]/g, ' ')
    }

    // Function to clean markdown content for better embedding
    const cleanMarkdownContent = (content: string) => {
      return content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]+`/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[#*_~`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Start discovery and processing
    console.log(`\n🌐 STARTING GOOGLE DRIVE DISCOVERY`)
    const markdownFiles = await getAllMarkdownFiles(folderId)
    
    console.log(`\n📊 DISCOVERY SUMMARY:`)
    console.log(`   - Total .md files found: ${markdownFiles.length}`)

    if (markdownFiles.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          pagesScraped: 0,
          pagesSkipped: 0,
          totalDiscovered: 0,
          incremental,
          message: 'No markdown files found in the specified folder or timeframe.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Process discovered files
    let pagesScraped = 0
    let pagesSkipped = 0
    let rateLimitErrors = 0
    const processedFiles = []

    for (const file of markdownFiles) {
      console.log(`\n📄 PROCESSING ${pagesScraped + pagesSkipped + 1}/${markdownFiles.length}: ${file.path}`)
      
      const content = await downloadFileContent(file.id, file.name)
      if (!content) {
        console.log(`⏭️  SKIPPED: Could not download content`)
        pagesSkipped++
        
        // Check if this was a rate limit error
        if (consecutiveErrors > 0) {
          rateLimitErrors++
        }
        continue
      }

      // Extract title and clean content
      const title = extractTitle(content, file.name)
      const cleanedContent = cleanMarkdownContent(content)
      
      if (cleanedContent.length < 20) {
        console.log(`⏭️  SKIPPED: Content too short after cleaning`)
        pagesSkipped++
        continue
      }

      const contentHash = await generateHash(content)
      
      // Check if content exists and is unchanged
      const { data: existing } = await supabase
        .from('wiki_content')
        .select('id, content_hash')
        .eq('url', file.webViewLink || `gdrive://${file.id}`)
        .single()

      if (existing && existing.content_hash === contentHash) {
        console.log(`⏭️  UNCHANGED: Content identical`)
        pagesSkipped++
        continue
      }

      // Generate embedding
      const embedding = await generateEmbedding(cleanedContent)
      if (!embedding) {
        console.log(`❌ EMBEDDING FAILED`)
        pagesSkipped++
        continue
      }

      // Save to database
      const { error } = await supabase
        .from('wiki_content')
        .upsert({
          url: file.webViewLink || `gdrive://${file.id}`,
          title: title,
          content: cleanedContent.substring(0, 8000),
          content_hash: contentHash,
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
      processedFiles.push(file.path)
      console.log(`✅ SAVED: ${title} (${cleanedContent.length} chars)`)
      
      // Adaptive rate limiting based on success
      await sleep(requestDelay)
    }

    console.log(`\n🏁 GOOGLE DRIVE SCRAPING COMPLETE!`)
    console.log(`   📊 FINAL STATISTICS:`)
    console.log(`   - Mode: ${incremental ? 'INCREMENTAL' : 'FULL'}`)
    console.log(`   - Files discovered: ${markdownFiles.length}`)
    console.log(`   - Files successfully scraped: ${pagesScraped}`)
    console.log(`   - Files skipped: ${pagesSkipped}`)
    console.log(`   - Rate limit errors: ${rateLimitErrors}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        pagesScraped,
        pagesSkipped,
        totalDiscovered: markdownFiles.length,
        rateLimitErrors,
        incremental,
        processedFiles: processedFiles.slice(0, 50),
        message: `Google Drive scraping complete: Found ${markdownFiles.length} .md files, scraped ${pagesScraped} files${incremental ? ' (incremental mode)' : ''}` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 GOOGLE DRIVE SCRAPER ERROR:', error)
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
