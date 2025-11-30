/**
 * FFmpeg WASM utilities for video processing with audio sync
 * Utilisé pour appliquer trim + speed tout en gardant l'audio synchronisé
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let loaded = false

/**
 * Charge FFmpeg WASM (une seule fois)
 */
export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && loaded) return ffmpeg

  ffmpeg = new FFmpeg()

  // Charger les fichiers core depuis un CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  loaded = true
  console.log('[FFmpeg] Loaded successfully')
  return ffmpeg
}

export interface ProcessVideoOptions {
  videoUrl: string
  trimStart?: number  // Secondes
  trimEnd?: number    // Secondes
  speed?: number      // 0.8 à 1.2
  onProgress?: (progress: number) => void
}

/**
 * Applique trim et speed à une vidéo avec audio synchronisé
 * Utilise FFmpeg WASM (côté client, gratuit)
 */
export async function processVideoWithSync(
  options: ProcessVideoOptions
): Promise<Blob> {
  const { videoUrl, trimStart = 0, trimEnd, speed = 1.0, onProgress } = options

  console.log('[FFmpeg] Processing video:', { videoUrl: videoUrl.slice(0, 50), trimStart, trimEnd, speed })

  const ffmpegInstance = await loadFFmpeg()

  // Progress callback
  if (onProgress) {
    ffmpegInstance.on('progress', ({ progress }) => {
      onProgress(Math.round(progress * 100))
    })
  }

  // Télécharger la vidéo source
  console.log('[FFmpeg] Fetching video...')
  const videoData = await fetchFile(videoUrl)
  await ffmpegInstance.writeFile('input.mp4', videoData)

  // Construire les filtres FFmpeg
  const filters: string[] = []
  const audioFilters: string[] = []

  // Trim (start)
  const inputArgs: string[] = ['-i', 'input.mp4']
  if (trimStart > 0) {
    inputArgs.unshift('-ss', trimStart.toString())
  }

  // Trim (end) - calculer la durée
  if (trimEnd !== undefined) {
    const duration = trimEnd - trimStart
    inputArgs.push('-t', duration.toString())
  }

  // Speed - setpts pour vidéo, atempo pour audio
  if (speed !== 1.0) {
    // Video: setpts=PTS/speed (accélérer = diviser, ralentir = multiplier)
    filters.push(`setpts=PTS/${speed}`)
    
    // Audio: atempo (supporte 0.5 à 2.0)
    // Pour des valeurs hors range, on chaîne plusieurs atempo
    if (speed >= 0.5 && speed <= 2.0) {
      audioFilters.push(`atempo=${speed}`)
    } else if (speed < 0.5) {
      // Chaîner pour vitesses très lentes
      audioFilters.push(`atempo=0.5,atempo=${speed / 0.5}`)
    } else {
      // Chaîner pour vitesses très rapides
      audioFilters.push(`atempo=2.0,atempo=${speed / 2.0}`)
    }
  }

  // Construire la commande FFmpeg
  const args = [...inputArgs]

  if (filters.length > 0 || audioFilters.length > 0) {
    if (filters.length > 0 && audioFilters.length > 0) {
      args.push('-filter_complex', `[0:v]${filters.join(',')}[v];[0:a]${audioFilters.join(',')}[a]`)
      args.push('-map', '[v]', '-map', '[a]')
    } else if (filters.length > 0) {
      args.push('-vf', filters.join(','))
    } else if (audioFilters.length > 0) {
      args.push('-af', audioFilters.join(','))
    }
  }

  // Output settings
  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    'output.mp4'
  )

  console.log('[FFmpeg] Running command:', args.join(' '))
  await ffmpegInstance.exec(args)

  // Lire le résultat
  const data = await ffmpegInstance.readFile('output.mp4')
  const blob = new Blob([data], { type: 'video/mp4' })

  // Cleanup
  await ffmpegInstance.deleteFile('input.mp4')
  await ffmpegInstance.deleteFile('output.mp4')

  console.log('[FFmpeg] Processing complete, output size:', blob.size)
  return blob
}

/**
 * Vérifie si FFmpeg WASM est supporté dans ce navigateur
 */
export function isFFmpegSupported(): boolean {
  return typeof SharedArrayBuffer !== 'undefined'
}

