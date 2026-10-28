import { useEffect, useRef } from 'react'

export default function WelcomeExperience({ onContinue }) {
  const continueButtonRef = useRef(null)

  useEffect(() => {
    continueButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onContinue()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onContinue])

  return (
    <div className="welcome-overlay">
      <section
        className="welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        aria-describedby="welcome-description"
      >
        <div className="welcome-dialog-mark" aria-hidden="true">B</div>
        <span className="welcome-eyebrow">A SPACE MADE WITH CARE</span>
        <h1 id="welcome-title">You belong here.</h1>
        <p id="welcome-description" className="welcome-introduction">
          Boitekanelo Space was created to make it a little easier to pause, check in with yourself,
          and feel less alone. It’s a gentle place to share what’s on your mind, notice how you’re
          feeling, and find understanding in a caring community.
        </p>

        <div className="welcome-values">
          <div>
            <span aria-hidden="true">♡</span>
            <p><strong>Share at your pace</strong><br />There’s no pressure to say more than you want.</p>
          </div>
          <div>
            <span aria-hidden="true">☼</span>
            <p><strong>Make space for you</strong><br />Check in, track your mood, or simply look around.</p>
          </div>
          <div>
            <span aria-hidden="true">✧</span>
            <p><strong>Care, together</strong><br />Offer kindness and find support through shared experiences.</p>
          </div>
        </div>

        <p className="welcome-boundary">
          This community is here for connection and encouragement; it isn’t a replacement for professional or emergency care.
        </p>
        <button ref={continueButtonRef} className="welcome-continue" type="button" onClick={onContinue}>
          Continue to my space <span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  )
}
