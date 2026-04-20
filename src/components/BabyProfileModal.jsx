import { useState } from 'react'

/**
 * First-time onboarding: when isFirstSetup, show a short guided message (see App.jsx condition).
 */
export function BabyProfileModal({ open, onClose, onSave, isFirstSetup = false }) {
  const [name, setName] = useState('')
  const [gender, setGender] = useState('boy')
  const [dob, setDob] = useState('')
  const [twinLabel, setTwinLabel] = useState('')

  if (!open) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !dob) return
    onSave?.({ name, gender, dob, twinLabel })
    setName('')
    setGender('boy')
    setDob('')
    setTwinLabel('')
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-[#1e293b]">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Add Baby Profile</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Create a profile to personalize dashboard accents and tracking context.
        </p>
        {isFirstSetup && (
          <p className="mt-3 rounded-xl border border-cyan-200/60 bg-cyan-50/80 px-3 py-2 text-xs leading-relaxed text-cyan-900 dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-100">
            Let&apos;s set up your first baby profile to start monitoring.
          </p>
        )}
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Baby Name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter baby name"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Gender</span>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-1 dark:border-slate-600">
              <button
                type="button"
                onClick={() => setGender('boy')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  gender === 'boy'
                    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Boy
              </button>
              <button
                type="button"
                onClick={() => setGender('girl')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  gender === 'girl'
                    ? 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Girl
              </button>
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Date of Birth</span>
            <input
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
          <select
            value={twinLabel}
            onChange={(e) => setTwinLabel(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="">No Twin Label</option>
            <option value="Twin A">Twin A</option>
            <option value="Twin B">Twin B</option>
          </select>
          <p
            className={`rounded-xl px-3 py-2 text-xs ${
              gender === 'girl'
                ? 'bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-300'
                : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300'
            }`}
          >
            Theme preview: this profile will use a {gender === 'girl' ? 'soft pink' : 'blue/cyan'} accent.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-white">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
