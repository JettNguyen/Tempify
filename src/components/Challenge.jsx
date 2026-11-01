import { fmtPoints } from '../lib/points'
import './Challenge.css'

// A friend's score from a challenge link (see lib/challenge.js), shown two
// ways: running beside your own total while you play, and song by song once
// you're done.

// A username shows as it was typed. Only the stand-in for a link with no name
// changes case, to start a sentence.
const theirName = (challenge, start = false) => challenge.name || (start ? 'Your friend' : 'your friend')

/** The friend's score so far, for the progress row. Before the first song it's the score to beat. */
export function ChallengeTally({ challenge, played }) {
  if (!challenge) return null
  const name = theirName(challenge, true)
  if (played === 0) {
    return (
      <span className="challenge-tally">
        <span className="challenge-tally__name">{name}</span>: {fmtPoints(challenge.total)} to beat
      </span>
    )
  }
  const theirs = challenge.points.slice(0, played).reduce((a, b) => a + b, 0)
  return (
    <span className="challenge-tally">
      <span className="challenge-tally__name">{name}</span> {fmtPoints(theirs)}
    </span>
  )
}

/**
 * You against the friend who sent the link: who won, then each song's points
 * side by side when both days were played here in full.
 */
export function ChallengeResult({ challenge, mine, total, labels }) {
  const name = theirName(challenge)
  const diff = total - challenge.total
  const verdict = diff > 0
    ? `You beat ${name} by ${fmtPoints(diff)}`
    : diff < 0
      ? `${theirName(challenge, true)} won by ${fmtPoints(-diff)}`
      : `You tied ${name}`
  const bySong = mine.length === challenge.points.length && labels.length === mine.length

  return (
    <section className={`challenge-result challenge-result--${diff > 0 ? 'won' : diff < 0 ? 'lost' : 'tied'}`}>
      <p className="challenge-result__verdict">{verdict}</p>
      <div className="challenge-result__grid">
        <span />
        <span className="challenge-result__head">You</span>
        <span className="challenge-result__head challenge-result__head--them">{theirName(challenge, true)}</span>
        {bySong && labels.map((label, i) => {
          const a = mine[i]
          const b = challenge.points[i]
          return [
            <span key={`l${i}`} className="challenge-result__label">{label}</span>,
            <span key={`a${i}`} className={`challenge-result__points${a > b ? ' challenge-result__points--ahead' : ''}`}>{fmtPoints(a)}</span>,
            <span key={`b${i}`} className={`challenge-result__points${b > a ? ' challenge-result__points--ahead' : ''}`}>{fmtPoints(b)}</span>,
          ]
        })}
        <span className="challenge-result__label challenge-result__label--total">Total</span>
        <span className="challenge-result__points challenge-result__points--total">{fmtPoints(total)}</span>
        <span className="challenge-result__points challenge-result__points--total">{fmtPoints(challenge.total)}</span>
      </div>
    </section>
  )
}
