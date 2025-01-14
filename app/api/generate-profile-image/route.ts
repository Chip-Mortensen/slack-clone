import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    // Get current user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single()

    if (!profile?.avatar_url) {
      return NextResponse.json(
        { error: 'No avatar found. Please upload an avatar first.' },
        { status: 400 }
      )
    }

    // Generate new image with DALL-E
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: "Create a single, centered friendly monster character in the style of Pixar's Monsters Inc, positioned like a profile picture. The monster should be shown from shoulders up, centered in frame. Make it colorful, whimsical, and charming with a welcoming smile. The character should fill most of the frame but with some breathing room around it.",
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural"
    })

    if (!response.data[0]?.url) {
      throw new Error('Failed to generate image')
    }

    // Download the generated image
    const imageResponse = await fetch(response.data[0].url)
    const imageBuffer = await imageResponse.arrayBuffer()

    // Upload to Supabase storage
    const fileName = `${userId}-pixar-${Date.now()}.png`
    const { error: uploadError, data: uploadData } = await supabase.storage
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
    console.error('Error generating profile image:', error)
    return NextResponse.json(
      { error: 'Failed to generate profile image' },
      { status: 500 }
    )
  }
} 