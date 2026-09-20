import { useMemo, useState } from 'react';
import { QUIZ } from '../content/quiz';

const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

export default function Quiz() {
  const [round, setRound] = useState(0);
  const order = useMemo(() => shuffle(QUIZ.map((_, i) => i)), [round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const finished = i >= order.length;
  const q = QUIZ[order[i]];

  const restart = () => {
    setRound((r) => r + 1);
    setI(0);
    setPicked(null);
    setScore(0);
  };

  return (
    <section className="tab-content fade-in">
      <div className="quiz-card">
        <div className="quiz-head">
          <h2 className="guide-title">🧠 Quiz des racines communes</h2>
          <span className="pill-badge">Score : {score} / {order.length}</span>
        </div>
        <p className="muted">Retrouvez comment vos expressions quotidiennes en Darija mènent au texte coranique.</p>

        {finished ? (
          <div className="quiz-end">
            <p className="quiz-end-score">{score} / {order.length}</p>
            <p>{score === order.length ? 'Parfait, mā shā’ Allāh !' : 'Bien joué, refaites le quiz pour progresser.'}</p>
            <button className="btn btn-primary" onClick={restart}>Recommencer</button>
          </div>
        ) : (
          <>
            <div className="quiz-question">{i + 1}. {q.question}</div>
            <div className="quiz-options">
              {q.options.map((o, idx) => {
                const cls = picked === null ? '' : idx === q.correct ? 'correct' : idx === picked ? 'wrong' : '';
                return (
                  <button key={idx} className={`quiz-opt-btn ${cls}`} disabled={picked !== null} onClick={() => { setPicked(idx); if (idx === q.correct) setScore((s) => s + 1); }}>
                    {o}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <div className={`quiz-feedback ${picked === q.correct ? 'ok' : 'ko'}`} role="status" aria-live="polite">
                <strong>{picked === q.correct ? 'Bravo, c’est exact.' : 'Pas tout à fait.'}</strong>
                <br />
                {q.explanation}
              </div>
            )}
            {picked !== null && (
              <div className="quiz-next">
                <button className="btn btn-primary" onClick={() => { setI((n) => n + 1); setPicked(null); }}>
                  {i + 1 === order.length ? 'Voir le résultat' : 'Question suivante →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
