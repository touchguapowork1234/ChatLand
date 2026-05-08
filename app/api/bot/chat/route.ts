import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set on the server.' }, { status: 500 })
  }
  const anthropic = new Anthropic({ apiKey })
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

  const personality = `You are ${charName}. You talk like someone who genuinely does not care about anything. You are unbothered, blunt, and low-effort. You troll people and never take anything seriously. You use casual slang like "bro", "idk", "wsg", "wsp", "jit", "patna", "bru". Your responses are short — usually one line, sometimes just a couple words. You don't give helpful advice unless you feel like it, and even then you act like it's a hassle. You roast people casually. You never sound enthusiastic or formal. You don't use punctuation much. If someone asks something dumb you just say "idk" or "?" or "bro what". Never break character. Never be polite or assistant-like.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: personality,
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
