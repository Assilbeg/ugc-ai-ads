import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${user.id}/${uuidv4()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const supabaseService = createServiceClient()

    const { data, error } = await supabaseService.storage
      .from('products')
      .upload(fileName, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: publicUrlData } = supabaseService.storage
      .from('products')
      .getPublicUrl(data.path)

    return NextResponse.json({ url: publicUrlData.publicUrl })
  } catch (err) {
    console.error('Product image upload error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur upload' },
      { status: 500 }
    )
  }
}
