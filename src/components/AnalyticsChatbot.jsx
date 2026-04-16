import { useMemo, useState } from 'react'
import { Bot, MessageCircle, Send, X } from 'lucide-react'
import { getChatbotReply } from '../services/chatService'

export function AnalyticsChatbot({ context }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'I can explain this analytics view and suggest what parents should monitor. Ask me about crying day patterns, wet-related crying, comparisons, or current filters.',
    },
  ])

  const quickPrompts = useMemo(
    () => [
      'Which day has the highest crying?',
      'What changed compared to previous period?',
      'What should parents monitor more closely?',
    ],
    [],
  )

  async function sendMessage(text) {
    const content = text.trim()
    if (!content || loading) return

    const nextUser = { role: 'user', text: content }
    setMessages((prev) => [...prev, nextUser])
    setInput('')
    setLoading(true)

    try {
      const reply = await getChatbotReply({ message: content, context })
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `I could not complete that request (${e.message}).` },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-cyan-600 dark:border-cyan-500/40 dark:bg-cyan-500 dark:hover:bg-cyan-400"
      >
        {open ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        Analytics Assistant
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[460px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1e293b]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <Bot className="h-4 w-4 text-cyan-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Analytics Chatbot</p>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-auto bg-cyan-500 text-white'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="max-w-[92%] rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Thinking...
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 px-3 py-2 dark:border-slate-700">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendMessage(input)
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about current analytics..."
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500 text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

