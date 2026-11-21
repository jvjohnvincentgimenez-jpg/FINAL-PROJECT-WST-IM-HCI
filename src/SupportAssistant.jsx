import { useEffect, useRef, useState } from 'react'
import { Bot, MessageCircle, Send, ShieldCheck, X } from 'lucide-react'

const suggestions = [
  'How do I publish my profile?',
  'What can I add to my profile?',
  'How do I choose a design?',
]

export default function SupportAssistant() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    }
  }, [open, messages, busy])

  async function sendMessage(message = draft, retry = false) {
    const text = message.trim()
    if (!text || busy) return

    const nextMessages = retry ? messages : [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setDraft('')
    setError('')
    setBusy(true)

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.slice(-12) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'The assistant could not respond. Please try again.')
      if (typeof result.reply !== 'string' || !result.reply.trim()) {
        throw new Error('The assistant returned an empty reply. Please try again.')
      }
      setMessages((current) => [...current, { role: 'assistant', content: result.reply }])
    } catch (requestError) {
      setError(requestError.message || 'Could not reach the assistant. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="support-assistant">
    {open && <section className="support-panel" aria-label="Nexus Security support assistant">
      <header className="support-header">
        <span className="support-avatar"><ShieldCheck size={18} /></span>
        <div><strong>Nexus support</strong><span>AI assistant · Here to help</span></div>
        <button className="support-close" type="button" aria-label="Close support chat" onClick={() => setOpen(false)}><X size={18} /></button>
      </header>
      <div className="support-messages" ref={listRef} aria-live="polite">
        <div className="support-message support-message-assistant">
          <span className="support-message-icon"><Bot size={15} /></span>
          <p>Hi! I can help you use Nexus Security, build your profile, and find your way around. What would you like to know?</p>
        </div>
        {messages.map((message, index) => <div className={`support-message support-message-${message.role}`} key={`${message.role}-${index}`}>
          {message.role === 'assistant' && <span className="support-message-icon"><Bot size={15} /></span>}
          <p>{message.content}</p>
        </div>)}
        {busy && <div className="support-typing" role="status"><span /><span /><span /> Thinking…</div>}
        {error && <div className="support-error" role="alert">{error}<button type="button" onClick={() => sendMessage(messages[messages.length - 1]?.content, true)} disabled={busy}>Try again</button></div>}
        {!messages.length && <div className="support-suggestions">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)} disabled={busy}>{suggestion}</button>)}</div>}
      </div>
      <form className="support-compose" onSubmit={(event) => { event.preventDefault(); sendMessage() }}>
        <label className="support-input-label" htmlFor="support-message">Ask a question</label>
        <input id="support-message" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type your question…" maxLength={1500} disabled={busy} />
        <button type="submit" aria-label="Send message" disabled={busy || !draft.trim()}><Send size={16} /></button>
      </form>
      <p className="support-disclaimer">Questions are sent to OpenAI. Don’t share passwords or private information.</p>
    </section>}
    <button className={`support-launcher ${open ? 'support-launcher-open' : ''}`} type="button" aria-label={open ? 'Close support assistant' : 'Open support assistant'} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {open ? <X size={21} /> : <><MessageCircle size={20} /><span>Ask support</span></>}
    </button>
  </div>
}
