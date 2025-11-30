import { NextRequest, NextResponse } from 'next/server'
import { uploadVideoToCloudinary } from '@/lib/api/cloudinary'

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

    const result = await uploadVideoToCloudinary(videoUrl, folder || 'ugc-clips')

    return NextResponse.json({
      publicId: result.publicId,
      url: result.url,
    })
  } catch (error) {
    console.error('[Cloudinary Upload] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur upload' },
      { status: 500 }
    )
  }
}

