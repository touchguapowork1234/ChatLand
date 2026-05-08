import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('has_ai_access')
    .eq('id', user.id)
    .single()

  if (!profile?.has_ai_access) {
    return NextResponse.json({ error: 'No AI access.' }, { status: 403 })
  }

  const { messages } = await req.json()

  const { data: aiChar } = await supabase
    .from('ai_character')
    .select('name')
    .eq('id', 1)
    .single()

  const charName = aiChar?.name ?? 'AI Assistant'

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are ${charName}, a helpful and friendly AI assistant inside a chat app. Be concise and conversational.`,
      messages,
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response type.' }, { status: 500 })
    }

    return NextResponse.json({ message: content.text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[bot/chat]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
