import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

// Configuration Cloudinary (côté serveur uniquement)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    
    let uploadSource: string
    let folder = 'ugc-clips'
    
    // Support FormData (fichier blob) ou JSON (URL)
    if (contentType.includes('multipart/form-data')) {
      // Upload de fichier blob
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const folderParam = formData.get('folder') as string | null
      
      if (!file) {
        return NextResponse.json(
          { error: 'file est requis dans FormData' },
          { status: 400 }
        )
      }
      
      if (folderParam) folder = folderParam
      
      // Convertir le fichier en base64 data URI
      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const mimeType = file.type || 'video/mp4'
      uploadSource = `data:${mimeType};base64,${base64}`
      
      console.log('[Cloudinary Upload] Uploading blob file:', file.name, 'size:', file.size)
    } else {
      // Upload via URL
      const body = await request.json()
      const { videoUrl, folder: folderParam } = body as {
        videoUrl: string
        folder?: string
      }

      if (!videoUrl) {
        return NextResponse.json(
          { error: 'videoUrl est requis' },
          { status: 400 }
        )
      }
      
      if (folderParam) folder = folderParam
      uploadSource = videoUrl
      
      console.log('[Cloudinary Upload] Uploading from URL:', videoUrl.slice(0, 50))
    }

    const result = await cloudinary.uploader.upload(uploadSource, {
      resource_type: 'video',
      folder,
      public_id: `clip_${Date.now()}`,
    })

    console.log('[Cloudinary] Video uploaded:', result.public_id)

    return NextResponse.json({
      publicId: result.public_id,
      url: result.secure_url,
    })
  } catch (error) {
    console.error('[Cloudinary Upload] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur upload' },
      { status: 500 }
    )
  }
}

