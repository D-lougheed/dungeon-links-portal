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
    const { incremental = false, getMissing = false, streaming = false, maxFiles = 50 } = await req.json()
    
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

    const mode = getMissing ? 'MISSING FILES SCAN' : (incremental ? 'INCREMENTAL (Recent changes only)' : 'FULL SCAN')
    console.log(`🚀 GOOGLE DRIVE SCRAPER STARTED: ${folderId}`)
    console.log(`📊 MODE: ${mode}`)
    console.log(`📊 CONFIGURATION:`)
    console.log(`   - Folder ID: ${folderId}`)
    console.log(`   - API Key: ${googleApiKey.substring(0, 10)}...`)
    console.log(`   - Max Files per Run: ${maxFiles}`)
    console.log(`   - Target: All .md files in folder and subfolders`)

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('CGPTkey')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Enhanced rate limiting with more conservative settings for missing files scan
    let requestDelay = getMissing ? 1500 : 800 // Longer delay for missing files
    const maxDelay = getMissing ? 30000 : 15000 // Longer max delay for missing files
    const delayMultiplier = 2.0 // More aggressive backoff
    let consecutiveErrors = 0
    let successfulRequests = 0
    let totalRequestsMade = 0
    const maxTotalRequests = getMissing ? 200 : 500 // Limit total requests to prevent timeouts

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // Function to make API calls with improved retry logic and timeout protection
    const makeApiCall = async (url: string, retries = 2): Promise<Response> => {
      // Check if we've made too many requests
      if (totalRequestsMade >= maxTotalRequests) {
        throw new Error(`Request limit reached (${maxTotalRequests}) to prevent timeout`)
      }

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          totalRequestsMade++
          console.log(`🌐 API Call ${totalRequestsMade}/${maxTotalRequests} attempt ${attempt}/${retries}`)
          
          // Add random jitter to prevent synchronized requests
          const jitter = Math.random() * 500
          await sleep(requestDelay + jitter)
          
          const response = await fetch(url)
          
          if (response.status === 403) {
            const errorText = await response.text()
            if (errorText.includes('automated queries') || errorText.includes('rate limit')) {
              console.log(`⚠️  Rate limit detected on attempt ${attempt}, increasing delay...`)
              consecutiveErrors++
              
              // More aggressive exponential backoff for missing files
              const backoffDelay = Math.min(requestDelay * Math.pow(delayMultiplier, attempt), maxDelay)
              requestDelay = Math.min(backoffDelay, maxDelay)
              
              if (attempt < retries) {
                const waitTime = backoffDelay * (attempt + 2) + Math.random() * 3000
                console.log(`⏰ Waiting ${waitTime}ms before retry...`)
                await sleep(waitTime)
                continue
              }
            }
            throw new Error(`Google API 403: ${errorText.substring(0, 200)}...`)
          }
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          // Success - gradually reduce delay but keep it reasonable
          consecutiveErrors = 0
          successfulRequests++
          
          // Only reduce delay after several successful requests and keep minimum higher for missing files
          const minDelay = getMissing ? 1200 : 800
          if (successfulRequests > 5 && requestDelay > minDelay) {
            requestDelay = Math.max(minDelay, requestDelay * 0.95)
            console.log(`✅ Success streak! Reducing delay to ${requestDelay}ms`)
            successfulRequests = 0 // Reset counter
          }
          
          return response
        } catch (error) {
          console.error(`💥 API call failed (attempt ${attempt}):`, error.message)
          if (attempt === retries) {
            throw error
          }
          // Progressive delay between retries with jitter
          const retryDelay = 5000 * attempt + Math.random() * 3000
          await sleep(retryDelay)
        }
      }
      throw new Error('All retry attempts failed')
    }

    // Get existing files from database if we're doing a missing files scan
    let existingFiles: Set<string> = new Set()
    if (getMissing) {
      console.log('🔍 Loading existing files from database...')
      const { data: existing, error } = await supabase
        .from('wiki_content')
        .select('url')
      
      if (error) {
        console.error('Error loading existing files:', error)
        throw error
      }
      
      existingFiles = new Set(existing?.map(item => {
        // Extract file ID from various URL formats
        if (item.url.startsWith('gdrive://')) {
          return item.url.replace('gdrive://', '')
        }
        const match = item.url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/)
        return match ? match[1] : item.url
      }) || [])
      
      console.log(`📋 Found ${existingFiles.size} existing files in database`)
    }

    // Get cutoff time for incremental scraping (last 7 days)
    const incrementalCutoff = incremental ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() : null

    // Function to recursively get all files from a Google Drive folder
    const getAllMarkdownFiles = async (folderId: string, path: string = '') => {
      console.log(`🔍 SCANNING FOLDER: ${folderId} (${path || 'root'})`)
      
      try {
        // Enhanced API call with fields for modification time
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents`)}&key=${googleApiKey}&fields=files(id,name,mimeType,parents,webViewLink,modifiedTime)&pageSize=100`
        
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
            // For missing files scan, check if file already exists
            if (getMissing && existingFiles.has(file.id)) {
              console.log(`⏭️  Skipping existing file: ${currentPath}`)
              continue
            }
            
            // Check if file should be included in incremental scan
            if (incremental && incrementalCutoff && file.modifiedTime) {
              if (file.modifiedTime < incrementalCutoff) {
                console.log(`⏭️  Skipping old file: ${currentPath} (modified: ${file.modifiedTime})`)
                continue
              }
            }
            
            const scanType = getMissing ? '(missing)' : (incremental ? `(modified: ${file.modifiedTime})` : '')
            console.log(`📄 Found markdown file: ${currentPath} ${scanType}`)
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
    
    // Limit files to process to prevent timeouts
    const filesToProcess = markdownFiles.slice(0, maxFiles)
    const missingFiles = getMissing ? filesToProcess.length : 0
    
    console.log(`\n📊 DISCOVERY SUMMARY:`)
    console.log(`   - Mode: ${mode}`)
    console.log(`   - Total .md files discovered: ${markdownFiles.length}`)
    console.log(`   - Files to process this run: ${filesToProcess.length}`)
    if (getMissing) {
      console.log(`   - Missing files to process: ${missingFiles}`)
    }
    if (markdownFiles.length > maxFiles) {
      console.log(`   - Remaining files for next run: ${markdownFiles.length - maxFiles}`)
    }

    if (filesToProcess.length === 0) {
      const message = getMissing ? 'No missing files found - all files are up to date!' : 'No markdown files found in the specified folder or timeframe.'
      return new Response(
        JSON.stringify({ 
          success: true, 
          pagesScraped: 0,
          pagesSkipped: 0,
          totalDiscovered: markdownFiles.length,
          missingFiles: 0,
          incremental,
          getMissing,
          message 
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
    const errors = []

    for (const file of filesToProcess) {
      console.log(`\n📄 PROCESSING ${pagesScraped + pagesSkipped + 1}/${filesToProcess.length}: ${file.path}`)
      
      // Check if we're approaching timeout (leave some buffer time)
      const timeElapsed = Date.now() - Date.now()
      if (totalRequestsMade >= maxTotalRequests) {
        console.log(`⏰ Stopping processing to prevent timeout (${totalRequestsMade} requests made)`)
        break
      }
      
      try {
        const content = await downloadFileContent(file.id, file.name)
        if (!content) {
          console.log(`⏭️  SKIPPED: Could not download content`)
          pagesSkipped++
          
          // Check if this was a rate limit error
          if (consecutiveErrors > 0) {
            rateLimitErrors++
            errors.push(`Rate limit error downloading ${file.name}`)
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
        
        // Check if content exists and is unchanged (unless we're specifically looking for missing files)
        if (!getMissing) {
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
        }

        // Generate embedding
        const embedding = await generateEmbedding(cleanedContent)
        if (!embedding) {
          console.log(`❌ EMBEDDING FAILED`)
          pagesSkipped++
          errors.push(`Embedding generation failed for ${file.name}`)
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
          errors.push(`Database error for ${file.name}: ${error.message}`)
          continue
        }

        pagesScraped++
        processedFiles.push(file.path)
        console.log(`✅ SAVED: ${title} (${cleanedContent.length} chars)`)
        
        // Brief pause between successful operations
        await sleep(200)
      } catch (error) {
        console.error(`💥 Error processing ${file.name}:`, error)
        pagesSkipped++
        errors.push(`Processing error for ${file.name}: ${error.message}`)
      }
    }

    console.log(`\n🏁 GOOGLE DRIVE SCRAPING COMPLETE!`)
    console.log(`   📊 FINAL STATISTICS:`)
    console.log(`   - Mode: ${mode}`)
    console.log(`   - Files discovered: ${markdownFiles.length}`)
    console.log(`   - Files processed this run: ${filesToProcess.length}`)
    console.log(`   - Files successfully scraped: ${pagesScraped}`)
    console.log(`   - Files skipped: ${pagesSkipped}`)
    console.log(`   - Rate limit errors: ${rateLimitErrors}`)
    console.log(`   - Total API requests made: ${totalRequestsMade}`)
    if (getMissing) {
      console.log(`   - Missing files found: ${missingFiles}`)
    }

    let message = getMissing 
      ? `Missing files scan complete: Found ${missingFiles} missing files, processed ${pagesScraped} successfully`
      : `Google Drive scraping complete: Found ${markdownFiles.length} .md files, scraped ${pagesScraped} files${incremental ? ' (incremental mode)' : ''}`

    if (markdownFiles.length > maxFiles) {
      message += ` (${markdownFiles.length - maxFiles} files remaining for next run)`
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pagesScraped,
        pagesSkipped,
        totalDiscovered: markdownFiles.length,
        filesProcessedThisRun: filesToProcess.length,
        missingFiles: getMissing ? missingFiles : undefined,
        rateLimitErrors,
        incremental,
        getMissing,
        processedFiles: processedFiles.slice(0, 50),
        errors: errors.slice(0, 10), // Include first 10 errors for debugging
        message 
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
