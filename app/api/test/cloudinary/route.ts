import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

// Test URL (petite vidéo de test)
const TEST_VIDEO_URL = 'https://res.cloudinary.com/demo/video/upload/dog.mp4'

export async function GET() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  // Vérifier les credentials
  const credentialsCheck = {
    hasCloudName: !!cloudName,
    hasApiKey: !!apiKey,
    hasApiSecret: !!apiSecret,
    cloudName: cloudName || 'MISSING',
    apiKeyPreview: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : 'MISSING',
    apiSecretPreview: apiSecret ? `${apiSecret.slice(0, 4)}...${apiSecret.slice(-4)}` : 'MISSING',
  }

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({
      success: false,
      error: 'Missing Cloudinary credentials',
      credentials: credentialsCheck,
    })
  }

  // Configurer Cloudinary
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  })

  // Tester l'upload
  try {
    console.log('[Test Cloudinary] Attempting upload...')
    const result = await cloudinary.uploader.upload(TEST_VIDEO_URL, {
      resource_type: 'video',
      folder: 'test-uploads',
      public_id: `test-${Date.now()}`,
    })

    return NextResponse.json({
      success: true,
      message: 'Cloudinary upload works!',
      credentials: credentialsCheck,
      uploadResult: {
        public_id: result.public_id,
        url: result.secure_url,
        format: result.format,
        duration: result.duration,
      },
    })
  } catch (err: unknown) {
    const error = err as Error & { http_code?: number; message?: string }
    console.error('[Test Cloudinary] Upload failed:', error)

    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      httpCode: error.http_code,
      credentials: credentialsCheck,
    })
  }
}


