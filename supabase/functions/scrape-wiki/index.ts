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
    console.log(`📊 CONFIGURATION:`)
    console.log(`   - Folder ID: ${folderId}`)
    console.log(`   - API Key: ${googleApiKey.substring(0, 10)}...`)
    console.log(`   - Target: All .md files in folder and subfolders`)

    // Get OpenAI API key (using the correct secret name)
    const openaiApiKey = Deno.env.get('CGPTkey')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Function to recursively get all files from a Google Drive folder
    const getAllMarkdownFiles = async (folderId: string, path: string = '') => {
      console.log(`🔍 SCANNING FOLDER: ${folderId} (${path || 'root'})`)
      
      // Updated API call format with proper encoding and fields
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents`)}&key=${googleApiKey}&fields=files(id,name,mimeType,parents,webViewLink)&pageSize=100`
      
      try {
        console.log(`🌐 API URL: ${url.replace(googleApiKey, 'API_KEY_HIDDEN')}`)
        const response = await fetch(url)
        console.log(`📡 API Response Status: ${response.status} ${response.statusText}`)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`💥 API Error Response Body: ${errorText}`)
          throw new Error(`Google Drive API error: ${response.status} ${response.statusText} - ${errorText}`)
        }
        
        const data = await response.json()
        const files = data.files || []
        console.log(`📁 Found ${files.length} items in folder`)
        
        if (files.length === 0) {
          console.log(`⚠️  No files found. This could mean:`)
          console.log(`   - The folder is empty`)
          console.log(`   - The API key doesn't have access to this folder`)
          console.log(`   - The folder ID is incorrect`)
          console.log(`   - The folder is not publicly accessible`)
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
            console.log(`📄 Found markdown file: ${currentPath}`)
            allFiles.push({
              id: file.id,
              name: file.name,
              path: currentPath,
              webViewLink: file.webViewLink
            })
          } else {
            console.log(`📄 Skipping non-markdown file: ${currentPath} (${file.mimeType})`)
          }
        }
        
        return allFiles
      } catch (error) {
        console.error(`💥 Error scanning folder ${folderId}:`, error)
        return []
      }
    }

    // Function to download file content from Google Drive
    const downloadFileContent = async (fileId: string, fileName: string) => {
      console.log(`⬇️  DOWNLOADING: ${fileName}`)
      
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${googleApiKey}`
      
      try {
        const response = await fetch(url)
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`💥 Download Error: ${response.status} ${response.statusText} - ${errorText}`)
          throw new Error(`Failed to download ${fileName}: ${response.status} - ${errorText}`)
        }
        
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
      // Try to find h1 header first
      const h1Match = content.match(/^#\s+(.+)$/m)
      if (h1Match) {
        return h1Match[1].trim()
      }
      
      // Fallback to filename without extension
      return fileName.replace(/\.md$/, '').replace(/[-_]/g, ' ')
    }

    // Function to clean markdown content for better embedding
    const cleanMarkdownContent = (content: string) => {
      return content
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '')
        // Remove inline code
        .replace(/`[^`]+`/g, '')
        // Remove markdown links but keep text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove markdown formatting
        .replace(/[#*_~`]/g, '')
        // Remove excessive whitespace
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
          message: 'No markdown files found in the specified folder. Check folder permissions and API key access.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Process discovered files
    let pagesScraped = 0
    let pagesSkipped = 0
    const processedFiles = []

    for (const file of markdownFiles) {
      console.log(`\n📄 PROCESSING ${pagesScraped + pagesSkipped + 1}/${markdownFiles.length}: ${file.path}`)
      
      const content = await downloadFileContent(file.id, file.name)
      if (!content) {
        console.log(`⏭️  SKIPPED: Could not download content`)
        pagesSkipped++
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
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`\n🏁 GOOGLE DRIVE SCRAPING COMPLETE!`)
    console.log(`   📊 FINAL STATISTICS:`)
    console.log(`   - Files discovered: ${markdownFiles.length}`)
    console.log(`   - Files successfully scraped: ${pagesScraped}`)
    console.log(`   - Files skipped: ${pagesSkipped}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        pagesScraped,
        pagesSkipped,
        totalDiscovered: markdownFiles.length,
        processedFiles: processedFiles.slice(0, 50), // Return first 50 for reference
        message: `Google Drive scraping complete: Found ${markdownFiles.length} .md files, scraped ${pagesScraped} files` 
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
