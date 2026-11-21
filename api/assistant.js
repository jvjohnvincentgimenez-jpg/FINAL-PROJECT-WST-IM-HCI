const systemPrompt = `You are the friendly support assistant for Nexus Security, a cybersecurity portfolio studio.
Only answer questions about using this product. Help users understand the workspace, builder sections, profile details, education and certifications, skills, projects, experience, links, design templates, saving drafts, previewing, publishing, and account access.
The app has three profile designs: Simple, Modern, and Creative. Users can save drafts in the builder. Publishing and online portfolio management require the app's Supabase connection and an authenticated account. A published profile is viewable from its public link.
Do not write or generate portfolio content; this assistant is for product support only. Do not claim to access accounts, edit profiles, publish content, or perform actions. Never ask users to share passwords, API keys, or other secrets. For unrelated questions, politely explain that you can only help with Nexus Security. Keep replies concise, practical, and kind.`

function sendJson(response, status, body) {
  if (typeof response.status === 'function') response.status(status)
  else response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

async function getRequestBody(request) {
  if (request.body !== undefined) return request.body

  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 32 * 1024) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return sendJson(response, 405, { error: 'Use POST to send a support question.' })
  }

  const origin = request.headers.origin
  const host = request.headers.host
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return sendJson(response, 403, { error: 'This request is not allowed.' })
    } catch {
      return sendJson(response, 403, { error: 'This request is not allowed.' })
    }
  }

  let body
  try {
    body = await getRequestBody(request)
  } catch {
    return sendJson(response, 400, { error: 'Your message could not be processed. Please try again.' })
  }

  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 12) {
    return sendJson(response, 400, { error: 'Your message could not be processed. Please try again.' })
  }

  const validMessages = messages.every((message) =>
    message
    && (message.role === 'user' || message.role === 'assistant')
    && typeof message.content === 'string'
    && message.content.trim().length > 0
    && message.content.length <= 1500
  )
  if (!validMessages || messages[messages.length - 1].role !== 'user') {
    return sendJson(response, 400, { error: 'Your message could not be processed. Please try again.' })
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(response, 503, { error: 'AI support is not configured yet. Please contact the site administrator.' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const result = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 350,
        temperature: 0.4,
      }),
      signal: controller.signal,
    })

    if (!result.ok) {
      console.error(`OpenAI support request failed with status ${result.status}`)
      return sendJson(response, 502, { error: 'AI support is temporarily unavailable. Please try again in a moment.' })
    }

    const data = await result.json()
    const reply = data.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) {
      console.error('OpenAI support request returned no assistant message')
      return sendJson(response, 502, { error: 'AI support returned an empty reply. Please try again.' })
    }

    return sendJson(response, 200, { reply: reply.trim() })
  } catch (error) {
    console.error('OpenAI support request could not be completed', error.name === 'AbortError' ? 'timed out' : error.message)
    return sendJson(response, 502, { error: 'Could not reach AI support. Please try again in a moment.' })
  } finally {
    clearTimeout(timeout)
  }
}
