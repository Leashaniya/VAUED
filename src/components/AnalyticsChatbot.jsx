import { useMemo, useState } from 'react'
import { Bot, MessageCircle, Send, X } from 'lucide-react'
import { getChatbotReply } from '../services/chatService'

const DEFAULT_INTRO =
  'I help interpret this screen using the app context sent with each message — charts, filters, live cards, or gentle next steps. I stay within Smart Baby Monitor (not medical advice).'

const DEFAULT_QUICK_PROMPTS = [
  'Which day has the highest crying?',
  'What changed compared to previous period?',
  'What should parents monitor more closely?',
]

/**
 * Shared floating assistant for Dashboard (live) and Analytics (historical).
 * Same UI shell; parent passes `context` from `buildDashboardChatbotContext` or `buildAnalyticsChatbotContext`.
 */
export function AnalyticsChatbot({
  context,
  launcherLabel = 'Monitor assistant',
  panelTitle = 'Monitor assistant',
  introMessage,
  quickPrompts,
  inputPlaceholder = 'Ask about this view…',
}) {
  const resolvedIntro = introMessage || DEFAULT_INTRO
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistant', text: resolvedIntro }])

  const prompts = useMemo(() => quickPrompts ?? DEFAULT_QUICK_PROMPTS, [quickPrompts])

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
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 dark:border-white/20"
        style={{
          backgroundColor: 'var(--sbm-accent)',
          borderColor: 'color-mix(in srgb, var(--sbm-accent) 45%, white)',
        }}
      >
        {open ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        {launcherLabel}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[460px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1e293b]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <Bot className="h-4 w-4" style={{ color: 'var(--sbm-accent)' }} />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{panelTitle}</p>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-auto text-white'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
                style={m.role === 'user' ? { backgroundColor: 'var(--sbm-accent)' } : undefined}
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
              {prompts.map((q) => (
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
                placeholder={inputPlaceholder}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--sbm-accent)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: 'var(--sbm-accent)' }}
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
