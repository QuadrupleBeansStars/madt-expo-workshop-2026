import type { LeaderboardEntry } from '@/lib/room-store'
import { KPI_LABELS, UI } from '@/content/room-labels'
import { Bilingual } from '@/components/deck/Bilingual'
import './stages.css'

type LeaderboardProps = {
  entries: LeaderboardEntry[]
  /** How many rows fit on the projector. The rest of the room still has a shop; it is just not
   *  on screen. Defaults to eight — beyond that the type has to shrink below readable. */
  limit?: number
}

const baht = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/**
 * The board. Ranked, stable, and readable from the back of the room.
 *
 * Ranks come from the server (`getLeaderboard`) rather than the row index, because equal scores
 * share a rank there — recomputing position here would silently break that tie handling and put
 * two identical shops at 1 and 2.
 *
 * `waste` is shown with its own "lower is better" label: it subtracts from the score
 * (`shopValue`), and a bare number beside three bigger-is-better ones reads as a shop doing
 * badly when it is doing well.
 */
export function Leaderboard({ entries, limit = 8 }: LeaderboardProps) {
  const rows = entries.slice(0, limit)

  return (
    <section className="room-board" data-testid="leaderboard">
      <Bilingual text={UI.leaderboard} as="label" className="room-board__title" />

      {rows.length === 0 ? (
        <Bilingual text={UI.noShopsYet} as="body" className="room-board__empty" />
      ) : (
        <ol className="room-board__list">
          {rows.map((entry) => (
            <li className="room-board__row" key={entry.playerId} data-rank={entry.rank}>
              <span className="room-board__rank" data-testid={`board-rank-${entry.playerId}`}>
                {entry.rank}
              </span>
              <span className="room-board__name">{entry.name}</span>
              <span className="room-board__kpis">
                <span className="room-board__kpi">
                  <span className="room-board__kpi-k" lang="en">{KPI_LABELS.profit.en}</span>
                  <span className="room-board__kpi-th" lang="th">{KPI_LABELS.profit.th}</span>
                  <b>฿{baht.format(entry.kpi.profit)}</b>
                </span>
                <span className="room-board__kpi">
                  <span className="room-board__kpi-k" lang="en">{KPI_LABELS.satisfaction.en}</span>
                  <span className="room-board__kpi-th" lang="th">{KPI_LABELS.satisfaction.th}</span>
                  <b>{baht.format(entry.kpi.satisfaction)}</b>
                </span>
                <span className="room-board__kpi">
                  <span className="room-board__kpi-k" lang="en">{KPI_LABELS.waste.en}</span>
                  <span className="room-board__kpi-th" lang="th">{KPI_LABELS.waste.th}</span>
                  <b>฿{baht.format(entry.kpi.waste)}</b>
                </span>
              </span>
              <span className="room-board__score">
                <b>{baht.format(Math.round(entry.score))}</b>
                <span className="room-board__score-k" lang="en">{UI.score.en}</span>
                <span className="room-board__score-th" lang="th">{UI.score.th}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
