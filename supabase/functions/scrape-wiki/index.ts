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
    const { incremental = false, getMissing = false, streaming = false, maxFiles = 25 } = await req.json()
    
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

    // Much more conservative rate limiting settings
    let requestDelay = getMissing ? 3000 : 2000 // Start with longer delays
    const maxDelay = getMissing ? 60000 : 30000 // Much longer max delays
    const delayMultiplier = 3.0 // More aggressive backoff
    let consecutiveErrors = 0
    let successfulRequests = 0
    let totalRequestsMade = 0
    const maxTotalRequests = getMissing ? 100 : 200 // Much lower request limits

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // Function to make API calls with much more conservative retry logic
    const makeApiCall = async (url: string, retries = 3): Promise<Response> => {
      // Check if we've made too many requests
      if (totalRequestsMade >= maxTotalRequests) {
        throw new Error(`Request limit reached (${maxTotalRequests}) to prevent timeout and rate limiting`)
      }

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          totalRequestsMade++
          console.log(`🌐 API Call ${totalRequestsMade}/${maxTotalRequests} attempt ${attempt}/${retries}`)
          
          // Much longer base delay with larger jitter
          const jitter = Math.random() * 2000
          const waitTime = requestDelay + jitter
          console.log(`⏰ Waiting ${waitTime}ms before API call...`)
          await sleep(waitTime)
          
          const response = await fetch(url)
          
          if (response.status === 403) {
            const errorText = await response.text()
            if (errorText.includes('automated queries') || errorText.includes('rate limit') || errorText.includes('quota')) {
              console.log(`⚠️  Rate limit/quota detected on attempt ${attempt}, implementing aggressive backoff...`)
              consecutiveErrors++
              
              // Much more aggressive exponential backoff
              const backoffDelay = Math.min(requestDelay * Math.pow(delayMultiplier, attempt + consecutiveErrors), maxDelay)
              requestDelay = Math.min(backoffDelay, maxDelay)
              
              if (attempt < retries) {
                const waitTime = backoffDelay * (attempt + 3) + Math.random() * 10000
                console.log(`⏰ Rate limited! Waiting ${waitTime}ms before retry...`)
                await sleep(waitTime)
                continue
              }
            }
            throw new Error(`Google API 403: ${errorText.substring(0, 200)}...`)
          }
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          // Success - very gradually reduce delay but keep it high
          consecutiveErrors = 0
          successfulRequests++
          
          // Only reduce delay after many successful requests and keep minimum very high
          const minDelay = getMissing ? 2500 : 1800
          if (successfulRequests > 10 && requestDelay > minDelay) {
            requestDelay = Math.max(minDelay, requestDelay * 0.98)
            console.log(`✅ Success streak! Slightly reducing delay to ${requestDelay}ms`)
            successfulRequests = 0 // Reset counter
          }
          
          return response
        } catch (error) {
          console.error(`💥 API call failed (attempt ${attempt}):`, error.message)
          if (attempt === retries) {
            throw error
          }
          // Much longer progressive delay between retries with large jitter
          const retryDelay = 10000 * attempt + Math.random() * 10000
          console.log(`⏰ Retrying in ${retryDelay}ms...`)
          await sleep(retryDelay)
        }
      }
      throw new Error('All retry attempts failed')
    }

    // Get existing files from database with detailed information
    let existingFiles: Map<string, { url: string, hash: string, updatedAt: string }> = new Map()
    let totalExistingFiles = 0
    
    console.log('🔍 Loading existing files from database...')
    const { data: existing, error: existingError } = await supabase
      .from('wiki_content')
      .select('url, content_hash, updated_at')
    
    if (existingError) {
      console.error('Error loading existing files:', existingError)
      throw existingError
    }
    
    totalExistingFiles = existing?.length || 0
    
    for (const item of existing || []) {
      // Extract file ID from various URL formats
      let fileId = ''
      if (item.url.startsWith('gdrive://')) {
        fileId = item.url.replace('gdrive://', '')
      } else {
        const match = item.url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/)
        fileId = match ? match[1] : item.url
      }
      
      existingFiles.set(fileId, {
        url: item.url,
        hash: item.content_hash || '',
        updatedAt: item.updated_at || ''
      })
    }
    
    console.log(`📋 Found ${totalExistingFiles} existing files in database`)

    // Get cutoff time for incremental scraping (last 7 days)
    const incrementalCutoff = incremental ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() : null

    // Enhanced tracking variables
    let totalDiscoveredFiles = 0
    let filesToProcessCount = 0
    let unchangedFilesCount = 0
    let newFilesCount = 0
    let updatedFilesCount = 0
    let missingFilesCount = 0

    // Function to recursively get all files from a Google Drive folder
    const getAllMarkdownFiles = async (folderId: string, path: string = '') => {
      console.log(`🔍 SCANNING FOLDER: ${folderId} (${path || 'root'})`)
      
      try {
        // Enhanced API call with fields for modification time
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents`)}&key=${googleApiKey}&fields=files(id,name,mimeType,parents,webViewLink,modifiedTime,size)&pageSize=50`
        
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
            // Recursively get files from subfolders with delay
            console.log(`📂 Entering subfolder: ${file.name}`)
            await sleep(1000) // Extra delay before subfolder scanning
            const subfolderFiles = await getAllMarkdownFiles(file.id, currentPath)
            allFiles.push(...subfolderFiles)
          } else if (file.name.endsWith('.md')) {
            totalDiscoveredFiles++
            
            const existingFile = existingFiles.get(file.id)
            const isExisting = !!existingFile
            
            // Determine file status
            let fileStatus = 'new'
            let shouldProcess = true
            
            if (isExisting) {
              // Check if file should be included in incremental scan
              if (incremental && incrementalCutoff && file.modifiedTime) {
                if (file.modifiedTime < incrementalCutoff) {
                  fileStatus = 'unchanged_old'
                  shouldProcess = false
                  unchangedFilesCount++
                } else {
                  fileStatus = 'potentially_updated'
                  updatedFilesCount++
                }
              } else if (getMissing) {
                fileStatus = 'existing_skip'
                shouldProcess = false
                unchangedFilesCount++
              } else {
                fileStatus = 'existing_check'
                // We'll check hash later to determine if it needs updating
              }
            } else {
              fileStatus = 'new'
              newFilesCount++
              if (getMissing) {
                missingFilesCount++
              }
            }
            
            if (!shouldProcess) {
              const statusText = fileStatus === 'unchanged_old' ? '(too old for incremental)' : 
                               fileStatus === 'existing_skip' ? '(already exists)' : '(skipping)'
              console.log(`⏭️  Skipping: ${currentPath} ${statusText}`)
              continue
            }
            
            filesToProcessCount++
            
            const statusText = fileStatus === 'new' ? '(NEW)' : 
                              fileStatus === 'potentially_updated' ? `(UPDATED: ${file.modifiedTime})` : 
                              fileStatus === 'existing_check' ? '(checking for changes)' : ''
            console.log(`📄 Found markdown file: ${currentPath} ${statusText}`)
            
            allFiles.push({
              id: file.id,
              name: file.name,
              path: currentPath,
              webViewLink: file.webViewLink,
              modifiedTime: file.modifiedTime,
              size: file.size || 0,
              status: fileStatus,
              existing: existingFile
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

    // Function to generate embeddings using OpenAI with retry logic
    const generateEmbedding = async (text: string) => {
      try {
        console.log(`🤖 GENERATING EMBEDDING: ${text.length} characters`)
        
        // Add delay before OpenAI calls to prevent rate limiting
        await sleep(500)
        
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
    
    // Much smaller batch sizes to prevent timeouts and rate limiting
    const filesToProcess = markdownFiles.slice(0, maxFiles)
    
    console.log(`\n📊 DISCOVERY SUMMARY:`)
    console.log(`   - Mode: ${mode}`)
    console.log(`   - Total .md files in Google Drive: ${totalDiscoveredFiles}`)
    console.log(`   - Files already in database: ${totalExistingFiles}`)
    console.log(`   - New files discovered: ${newFilesCount}`)
    console.log(`   - Files to process this run: ${filesToProcess.length}`)
    console.log(`   - Files that will be skipped (unchanged): ${unchangedFilesCount}`)
    
    if (getMissing) {
      console.log(`   - Missing files found: ${missingFilesCount}`)
    }
    if (incremental) {
      console.log(`   - Recently updated files: ${updatedFilesCount}`)
    }
    if (totalDiscoveredFiles > maxFiles) {
      console.log(`   - Remaining files for next run: ${totalDiscoveredFiles - maxFiles}`)
    }

    if (filesToProcess.length === 0) {
      const message = getMissing ? 'No missing files found - all files are up to date!' : 
                     incremental ? 'No recently changed files found.' :
                     'No markdown files found in the specified folder.'
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          pagesScraped: 0,
          pagesSkipped: unchangedFilesCount,
          totalDiscovered: totalDiscoveredFiles,
          totalInDatabase: totalExistingFiles,
          newFiles: newFilesCount,
          missingFiles: getMissing ? missingFilesCount : undefined,
          unchangedFiles: unchangedFilesCount,
          updatedFiles: updatedFilesCount,
          filesProcessedThisRun: 0,
          filesRemainingForNextRun: Math.max(0, totalDiscoveredFiles - maxFiles),
          incremental,
          getMissing,
          mode,
          progressPercentage: 100,
          apiRequestsMade: totalRequestsMade,
          maxApiRequests: maxTotalRequests,
          rateLimitErrors: 0,
          statistics: {
            discovery: {
              totalInGoogleDrive: totalDiscoveredFiles,
              totalInDatabase: totalExistingFiles,
              newFilesFound: newFilesCount,
              missingFilesFound: getMissing ? missingFilesCount : undefined,
              unchangedFilesSkipped: unchangedFilesCount
            },
            processing: {
              filesAttempted: 0,
              filesSuccessful: 0,
              filesFailed: 0,
              actuallyNew: 0,
              actuallyUpdated: 0,
              actuallyUnchanged: unchangedFilesCount
            },
            completion: {
              progressPercentage: 100,
              filesRemaining: Math.max(0, totalDiscoveredFiles - maxFiles),
              isComplete: totalDiscoveredFiles <= maxFiles
            }
          },
          message 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Process discovered files with much more conservative approach
    let pagesScraped = 0
    let pagesSkipped = 0
    let rateLimitErrors = 0
    let actuallyNewFiles = 0
    let actuallyUpdatedFiles = 0
    let actuallyUnchangedFiles = 0
    const processedFiles = []
    const errors = []

    for (const file of filesToProcess) {
      console.log(`\n📄 PROCESSING ${pagesScraped + pagesSkipped + 1}/${filesToProcess.length}: ${file.path}`)
      
      // Check if we're approaching limits (more conservative)
      if (totalRequestsMade >= maxTotalRequests * 0.8) {
        console.log(`⏰ Stopping processing early to prevent rate limiting (${totalRequestsMade} requests made)`)
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
        if (!getMissing && file.existing) {
          if (file.existing.hash === contentHash) {
            console.log(`⏭️  UNCHANGED: Content identical (hash match)`)
            pagesSkipped++
            actuallyUnchangedFiles++
            continue
          } else {
            console.log(`🔄 CHANGED: Content hash differs, updating...`)
            actuallyUpdatedFiles++
          }
        } else if (!file.existing) {
          actuallyNewFiles++
        }

        // Generate embedding with delay
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
        processedFiles.push({
          path: file.path,
          title: title,
          size: cleanedContent.length,
          status: file.existing ? 'updated' : 'new'
        })
        console.log(`✅ SAVED: ${title} (${cleanedContent.length} chars) - ${file.existing ? 'UPDATED' : 'NEW'}`)
        
        // Longer pause between successful operations
        await sleep(1000)
      } catch (error) {
        console.error(`💥 Error processing ${file.name}:`, error)
        pagesSkipped++
        errors.push(`Processing error for ${file.name}: ${error.message}`)
        
        // If we hit rate limits, add extra delay
        if (error.message.includes('403') || error.message.includes('rate limit')) {
          rateLimitErrors++
          console.log(`⏰ Rate limit detected, adding extra delay...`)
          await sleep(15000) // 15 second delay on rate limit
        }
      }
    }

    // Calculate final statistics
    const totalProcessedThisRun = pagesScraped + pagesSkipped
    const filesRemainingForNextRun = Math.max(0, totalDiscoveredFiles - totalProcessedThisRun)
    const progressPercentage = totalDiscoveredFiles > 0 ? Math.round((totalProcessedThisRun / totalDiscoveredFiles) * 100) : 100

    console.log(`\n🏁 GOOGLE DRIVE SCRAPING COMPLETE!`)
    console.log(`   📊 FINAL STATISTICS:`)
    console.log(`   - Mode: ${mode}`)
    console.log(`   - Total files in Google Drive: ${totalDiscoveredFiles}`)
    console.log(`   - Files in database before: ${totalExistingFiles}`)
    console.log(`   - Files processed this run: ${totalProcessedThisRun}`)
    console.log(`   - Files successfully scraped: ${pagesScraped}`)
    console.log(`   - Files skipped: ${pagesSkipped}`)
    console.log(`   - Actually new files: ${actuallyNewFiles}`)
    console.log(`   - Actually updated files: ${actuallyUpdatedFiles}`)
    console.log(`   - Actually unchanged files: ${actuallyUnchangedFiles}`)
    console.log(`   - Rate limit errors: ${rateLimitErrors}`)
    console.log(`   - Total API requests made: ${totalRequestsMade}`)
    console.log(`   - Files remaining for next run: ${filesRemainingForNextRun}`)
    console.log(`   - Progress: ${progressPercentage}%`)
    
    if (getMissing) {
      console.log(`   - Missing files found: ${missingFilesCount}`)
    }

    let message = getMissing 
      ? `Missing files scan complete: Found ${missingFilesCount} missing files, processed ${pagesScraped} successfully`
      : `Google Drive scraping complete: Found ${totalDiscoveredFiles} .md files, scraped ${pagesScraped} files${incremental ? ' (incremental mode)' : ''}`

    if (filesRemainingForNextRun > 0) {
      message += ` (${filesRemainingForNextRun} files remaining for next run)`
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pagesScraped,
        pagesSkipped,
        totalDiscovered: totalDiscoveredFiles,
        totalInDatabase: totalExistingFiles,
        newFiles: actuallyNewFiles,
        updatedFiles: actuallyUpdatedFiles,
        unchangedFiles: actuallyUnchangedFiles,
        filesProcessedThisRun: totalProcessedThisRun,
        filesRemainingForNextRun,
        progressPercentage,
        missingFiles: getMissing ? missingFilesCount : undefined,
        rateLimitErrors,
        incremental,
        getMissing,
        mode,
        processedFiles: processedFiles.slice(0, 50),
        errors: errors.slice(0, 10), // Include first 10 errors for debugging
        apiRequestsMade: totalRequestsMade,
        maxApiRequests: maxTotalRequests,
        statistics: {
          discovery: {
            totalInGoogleDrive: totalDiscoveredFiles,
            totalInDatabase: totalExistingFiles,
            newFilesFound: newFilesCount,
            missingFilesFound: getMissing ? missingFilesCount : undefined,
            unchangedFilesSkipped: unchangedFilesCount
          },
          processing: {
            filesAttempted: totalProcessedThisRun,
            filesSuccessful: pagesScraped,
            filesFailed: pagesSkipped,
            actuallyNew: actuallyNewFiles,
            actuallyUpdated: actuallyUpdatedFiles,
            actuallyUnchanged: actuallyUnchangedFiles
          },
          completion: {
            progressPercentage,
            filesRemaining: filesRemainingForNextRun,
            isComplete: filesRemainingForNextRun === 0
          }
        },
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