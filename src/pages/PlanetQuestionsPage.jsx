import { useMemo, useState } from 'react'
import { formatMeasurement } from '../components/data/formatMeasurement.js'
import { scienceValue } from '../contracts/planet.js'
import { assessHabitability } from '../science/habitability.js'
import { useCelestria } from '../store/useCelestria.js'
import SearchableSelect from '../components/ui/SearchableSelect.jsx'
import './PlanetQuestionsPage.css'

const QUESTIONS = [
  { id: 'larger', label: 'Which planet is larger?', field: 'radiusEarth', unit: 'R⊕', direction: 'higher', noun: 'radius' },
  { id: 'heavier', label: 'Which planet is more massive?', field: 'massEarth', unit: 'M⊕', direction: 'higher', noun: 'mass' },
  { id: 'hotter', label: 'Which planet is hotter?', field: 'eqTempK', unit: 'K', direction: 'higher', noun: 'equilibrium temperature' },
  { id: 'longer-year', label: 'Which planet has a longer year?', field: 'periodDays', unit: 'days', direction: 'higher', noun: 'orbital period' },
  { id: 'more-flux', label: 'Which planet receives more stellar flux?', field: 'insolationEarth', unit: 'S⊕', direction: 'higher', noun: 'stellar flux' },
  { id: 'screening', label: 'Which has the stronger habitability screening match?', direction: 'higher' },
]

function valueFor(planet, question) {
  if (question.id === 'screening') return assessHabitability(planet).score
  return scienceValue(planet[question.field])
}

function displayValue(value, question) {
  if (value == null) return 'Unavailable'
  if (question.id === 'screening') return `${(value * 100).toFixed(0)}% screening match`
  return `${formatMeasurement(value).value} ${question.unit}`
}

function compare(planets, question) {
  const [first, second] = planets
  const firstValue = valueFor(first, question)
  const secondValue = valueFor(second, question)
  if (firstValue == null || secondValue == null) {
    return {
      headline: 'Not enough data to compare these planets.',
      detail: 'The required NASA value is unavailable for at least one selection.',
      firstValue,
      secondValue,
    }
  }
  if (firstValue === secondValue) {
    return { headline: 'They are equal for this comparison.', detail: 'Both selected values are the same.', firstValue, secondValue }
  }
  const winner = firstValue > secondValue ? first : second
  return {
    headline: `${winner.name} has the higher ${question.noun ?? 'screening match'}.`,
    detail: `${first.name}: ${displayValue(firstValue, question)} · ${second.name}: ${displayValue(secondValue, question)}`,
    firstValue,
    secondValue,
  }
}

export default function PlanetQuestionsPage() {
  const status = useCelestria((state) => state.catalogStatus)
  const planets = useCelestria((state) => state.planets)
  const [firstId, setFirstId] = useState('')
  const [secondId, setSecondId] = useState('')
  const [questionId, setQuestionId] = useState(QUESTIONS[0].id)

  const selections = useMemo(() => {
    const first = planets.find((planet) => planet.id === firstId) ?? planets[0]
    const second = planets.find((planet) => planet.id === secondId) ?? planets[1]
    return first && second ? [first, second] : []
  }, [firstId, secondId, planets])
  const question = QUESTIONS.find((item) => item.id === questionId) ?? QUESTIONS[0]
  const result = selections.length === 2 ? compare(selections, question) : null
  const planetOptions = useMemo(
    () => planets.map((planet) => ({ value: planet.id, label: `${planet.name} — ${planet.host}`, searchText: `${planet.name} ${planet.host}` })),
    [planets],
  )

  if (status !== 'ready') {
    return (
      <section className="planet-questions">
        <p className="planet-questions__eyebrow">RULE-BASED EXPLORER</p>
        <h1>Ask about two planets</h1>
        <p>{status === 'error' ? 'The planet catalog could not be loaded.' : 'Loading the planet catalog…'}</p>
      </section>
    )
  }

  return (
    <section className="planet-questions">
      <p className="planet-questions__eyebrow">RULE-BASED EXPLORER</p>
      <h1>Ask about two planets</h1>
      <p className="planet-questions__intro">
        Choose two catalog planets and a question. CELESTRIA compares only the selected NASA values and reports when a comparison
        cannot be made.
      </p>

      <div className="planet-questions__form">
        <SearchableSelect label="Planet one" value={selections[0]?.id ?? ''} options={planetOptions} onChange={setFirstId} />
        <SearchableSelect label="Planet two" value={selections[1]?.id ?? ''} options={planetOptions} onChange={setSecondId} />
        <label className="planet-questions__question">
          <span>Question</span>
          <select value={question.id} onChange={(event) => setQuestionId(event.target.value)}>
            {QUESTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {result && (
        <article className="planet-questions__result" aria-live="polite">
          <p className="planet-questions__result-label">{question.label}</p>
          <h2>{result.headline}</h2>
          <p>{result.detail}</p>
          <div className="planet-questions__values">
            {selections.map((planet, index) => (
              <div key={planet.id}>
                <span>{planet.name}</span>
                <strong>{displayValue(index === 0 ? result.firstValue : result.secondValue, question)}</strong>
              </div>
            ))}
          </div>
          <p className="planet-questions__basis">
            Rule-based comparison only. Missing values are not estimated. The habitability option is a screening index, not a
            probability of life.
          </p>
        </article>
      )}
    </section>
  )
}
