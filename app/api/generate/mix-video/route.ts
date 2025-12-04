import { NextRequest, NextResponse } from 'next/server'
import { Transloadit } from 'transloadit'

// Transloadit credentials
const TRANSLOADIT_KEY = process.env.TRANSLOADIT_KEY
const TRANSLOADIT_SECRET = process.env.TRANSLOADIT_SECRET

interface MixVideoInput {
  videoUrl: string           // URL de la vidéo brute (Veo)
  voiceUrl?: string          // URL de la voiceover (speech-to-speech)
  ambientUrl?: string        // URL de l'ambiance (ElevenLabs)
  voiceVolume?: number       // Volume voix (0-100, défaut 100)
  ambientVolume?: number     // Volume ambiance (0-100, défaut 20)
  duration: number           // Durée en secondes
}

/**
 * Mixe une vidéo avec voiceover et ambiance
 * Utilise Transloadit /video/encode avec FFmpeg filters pour combiner les pistes audio
 * 
 * Doc: https://transloadit.com/docs/robots/video-encode/
 * Doc FFmpeg filters: https://ffmpeg.org/ffmpeg-filters.html
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      videoUrl, 
      voiceUrl, 
      ambientUrl, 
      voiceVolume = 100, 
      ambientVolume = 20,
      duration 
    } = body as MixVideoInput

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'videoUrl est requis' },
        { status: 400 }
      )
    }

    // Si pas d'audio à mixer, retourner la vidéo originale
    if (!voiceUrl && !ambientUrl) {
      console.log('[Mix] No audio to mix, returning original video')
      return NextResponse.json({ 
        videoUrl,
        mixed: false 
      })
    }

    if (!TRANSLOADIT_KEY || !TRANSLOADIT_SECRET) {
      console.error('[Mix] Transloadit credentials missing')
      return NextResponse.json(
        { error: 'TRANSLOADIT_KEY/SECRET non configurés' },
        { status: 500 }
      )
    }

    console.log('[Mix] Starting video mix with Transloadit:', {
      videoUrl: videoUrl.slice(0, 50),
      voiceUrl: voiceUrl?.slice(0, 50),
      ambientUrl: ambientUrl?.slice(0, 50),
      voiceVolume,
      ambientVolume,
      duration
    })

    // Initialiser le client Transloadit
    const transloadit = new Transloadit({
      authKey: TRANSLOADIT_KEY,
      authSecret: TRANSLOADIT_SECRET,
    })

    // Construire les steps Transloadit
    const steps: Record<string, unknown> = {}
    
    // Step 1: Importer la vidéo
    steps['import_video'] = {
      robot: '/http/import',
      url: videoUrl
    }

    // Convertir volumes 0-100 en facteur 0.0-1.0
    const voiceVol = (voiceVolume / 100).toFixed(2)
    const ambientVol = (ambientVolume / 100).toFixed(2)

    // Cas 1: Voix seulement - REMPLACE l'audio original par la voix clonée
    if (voiceUrl && !ambientUrl) {
      steps['import_voice'] = {
        robot: '/http/import',
        url: voiceUrl
      }
      
      // Remplacer l'audio de la vidéo par la voix clonée (avec volume ajusté)
      steps['mixed'] = {
        robot: '/video/encode',
        use: {
          steps: [
            { name: 'import_video', as: 'video' },
            { name: 'import_voice', as: 'audio' }
          ]
        },
        result: true,
        preset: 'empty',
        ffmpeg_stack: 'v6.0.0',
        ffmpeg: {
          // REMPLACER l'audio original : on prend uniquement la voix (1:a)
          // On n'utilise PAS l'audio original (0:a) car c'est la voix IA qu'on veut remplacer
          'filter_complex': `[1:a]volume=${voiceVol},apad=pad_dur=${duration}[aout]`,
          'map': ['0:v', '[aout]'],
          'c:v': 'libx264',
          'preset': 'fast',
          'crf': 23,
          'c:a': 'aac',
          'b:a': '128k',
          'ar': 48000,
          'ac': 2,
          'movflags': '+faststart',
          't': duration
        }
      }
    }
    // Cas 2: Ambiance seulement - MIXE l'audio original avec l'ambiance (garde la voix IA)
    else if (!voiceUrl && ambientUrl) {
      steps['import_ambient'] = {
        robot: '/http/import',
        url: ambientUrl
      }
      
      // Ici on garde l'audio original (voix IA) et on ajoute l'ambiance
      steps['mixed'] = {
        robot: '/video/encode',
        use: {
          steps: [
            { name: 'import_video', as: 'video' },
            { name: 'import_ambient', as: 'audio' }
          ]
        },
        result: true,
        preset: 'empty',
        ffmpeg_stack: 'v6.0.0',
        ffmpeg: {
          // Mixer l'audio original (0:a) avec l'ambiance (1:a)
          'filter_complex': `[0:a]volume=1.0[orig];[1:a]volume=${ambientVol},apad=pad_dur=${duration}[ambient];[orig][ambient]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
          'map': ['0:v', '[aout]'],
          'c:v': 'libx264',
          'preset': 'fast',
          'crf': 23,
          'c:a': 'aac',
          'b:a': '128k',
          'ar': 48000,
          'ac': 2,
          'movflags': '+faststart',
          't': duration
        }
      }
    }
    // Cas 3: Voix + Ambiance (le plus courant) - REMPLACE l'audio original par voix clonée + ambiance
    else if (voiceUrl && ambientUrl) {
      steps['import_voice'] = {
        robot: '/http/import',
        url: voiceUrl
      }
      steps['import_ambient'] = {
        robot: '/http/import',
        url: ambientUrl
      }
      
      // REMPLACER l'audio original par voix clonée + ambiance
      // On n'utilise PAS l'audio original (0:a) - la voix IA est remplacée par la voix clonée
      steps['mixed'] = {
        robot: '/video/encode',
        use: {
          steps: [
            { name: 'import_video', as: 'video' },
            { name: 'import_voice', as: 'audio1' },
            { name: 'import_ambient', as: 'audio2' }
          ]
        },
        result: true,
        preset: 'empty',
        ffmpeg_stack: 'v6.0.0',
        ffmpeg: {
          // Mixer voix clonée + ambiance (ignorer l'audio original)
          // apad assure que les pistes audio sont paddées à la bonne durée
          'filter_complex': `[1:a]volume=${voiceVol},apad=pad_dur=${duration}[voice];[2:a]volume=${ambientVol},apad=pad_dur=${duration}[ambient];[voice][ambient]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
          'map': ['0:v', '[aout]'],
          'c:v': 'libx264',
          'preset': 'fast',
          'crf': 23,
          'c:a': 'aac',
          'b:a': '128k',
          'ar': 48000,
          'ac': 2,
          'movflags': '+faststart',
          't': duration
        }
      }
    }

    console.log('[Mix] Transloadit steps:', Object.keys(steps))

    // Créer et attendre l'assemblage
    const result = await transloadit.createAssembly({
      params: { steps } as any,
      waitForCompletion: true,
    })

    console.log('[Mix] Assembly result:', result.ok, result.assembly_id)

    if (result.ok !== 'ASSEMBLY_COMPLETED') {
      console.error('[Mix] Assembly failed:', result.error, result.message)
      throw new Error(result.message || 'Assembly failed')
    }

    // Récupérer l'URL de sortie
    const outputUrl = result.results?.mixed?.[0]?.ssl_url

    if (!outputUrl) {
      console.error('[Mix] No output URL in result:', result.results)
      throw new Error('No output video URL')
    }

    console.log('[Mix] ✓ Video mixed successfully:', outputUrl.slice(0, 60))

    return NextResponse.json({
      videoUrl: outputUrl,
      mixed: true,
      method: 'transloadit',
      assemblyId: result.assembly_id
    })

  } catch (error) {
    console.error('[Mix] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur mixage vidéo' },
      { status: 500 }
    )
  }
}
