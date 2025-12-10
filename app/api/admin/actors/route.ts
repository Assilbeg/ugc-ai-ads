import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

type AdminResult =
  | { userId: string; error: null }
  | { userId: null; error: NextResponse }

function sanitizeActorPayload(payload: Record<string, any>) {
  const allowedFields = [
    'name',
    'soul_image_url',
    'thumbnail_video_url',
    'voice',
    'appearance',
    'intention_media',
    'is_custom',
    'user_id',
  ]

  const sanitized: Record<string, any> = {}
  for (const key of allowedFields) {
    if (payload[key] !== undefined) {
      sanitized[key] = payload[key]
    }
  }
  return sanitized
}

async function getAdminUser(): Promise<AdminResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  const user = data?.user
  if (error || !user || !isAdmin(user.email)) {
    return {
      userId: null,
      error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }),
    }
  }

  return { userId: user.id, error: null }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (admin.error) return admin.error

  const body = await request.json()
  const actor = body?.actor as Record<string, any> | undefined

  if (!actor?.name || !actor?.soul_image_url) {
    return NextResponse.json(
      { error: 'Paramètres manquants: actor (name, soul_image_url)' },
      { status: 400 }
    )
  }

  const payload = sanitizeActorPayload(actor)
  if (!payload.user_id) payload.user_id = admin.userId
  if (payload.is_custom === undefined) payload.is_custom = false

  const serviceSupabase = createServiceClient()
  const { data, error } = await (serviceSupabase.from('actors') as any)
    .insert(payload)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: `Erreur création acteur: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ actor: data })
}

export async function PUT(request: NextRequest) {
  const admin = await getAdminUser()
  if (admin.error) return admin.error

  const body = await request.json()
  const id = body?.id as string | undefined
  const updates = sanitizeActorPayload((body?.updates || {}) as Record<string, any>)

  if (!id) {
    return NextResponse.json({ error: 'actor id manquant' }, { status: 400 })
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune mise à jour fournie' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()
  const { data, error } = await (serviceSupabase.from('actors') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: `Erreur mise à jour acteur: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ actor: data })
}

export async function DELETE(request: NextRequest) {
  const admin = await getAdminUser()
  if (admin.error) return admin.error

  const body = await request.json()
  const id = body?.id as string | undefined

  if (!id) {
    return NextResponse.json({ error: 'actor id manquant' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()
  const { error } = await (serviceSupabase.from('actors') as any)
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json(
      { error: `Erreur suppression acteur: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
