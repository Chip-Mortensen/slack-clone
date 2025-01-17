import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { imageUrl, userId } = await request.json()

    if (!imageUrl || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Download the generated image
    const imageResponse = await fetch(imageUrl)
    const imageBuffer = await imageResponse.arrayBuffer()

    // Upload to Supabase storage
    const fileName = `${userId}-pixar-${Date.now()}.png`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, avatarUrl: publicUrl })

  } catch (error) {
    console.error('Error saving profile image:', error)
    return NextResponse.json(
      { error: 'Failed to save profile image' },
      { status: 500 }
    )
  }
} 