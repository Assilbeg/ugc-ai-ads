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
    const body = await request.json()
    const { videoUrl, folder } = body as {
      videoUrl: string
      folder?: string
    }

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'videoUrl est requis' },
        { status: 400 }
      )
    }

    console.log('[Cloudinary Upload] Starting upload:', videoUrl.slice(0, 50))

    const result = await cloudinary.uploader.upload(videoUrl, {
      resource_type: 'video',
      folder: folder || 'ugc-clips',
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

