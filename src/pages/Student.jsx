import React, { useEffect, useState, useRef } from 'react'
import { collection, getDocs, doc, setDoc, getDoc, addDoc } from 'firebase/firestore'
import { db, serverTimestamp } from '../firebase'
import { auth } from '../firebase'

const EXAM_DURATION_MS = 6 * 60 * 60 * 1000 // 6 horas

export default function Student(){
  const [questions, setQuestions] = useState([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [startedAt, setStartedAt] = useState(null)
  const [finished, setFinished] = useState(false)
  const [score, setScore] = useState(null)
  const timerRef = useRef(null)
  const [remaining, setRemaining] = useState(EXAM_DURATION_MS)

  useEffect(() => { loadQuestions() }, [])

  async function loadQuestions(){
    const snap = await getDocs(collection(db, 'questions'))
    const qs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    setQuestions(qs)

    const uid = auth.currentUser.uid
    const resultRef = doc(db, 'results', uid)
    const resSnap = await getDoc(resultRef)
    if (resSnap.exists()){
      const data = resSnap.data()
      if (data.startedAt) {
        setStartedAt(data.startedAt)
        if (data.finishedAt) {
          setFinished(true)
          setAnswers(data.answers || {})
          setScore(data.score ?? null)
        } else {
          // calcular remaining
          const elapsed = Date.now() - new Date(data.startedAt).getTime()
          const rem = Math.max(EXAM_DURATION_MS - elapsed, 0)
          setRemaining(rem)
          startTimer(rem)
        }
      }
    }
  }

  function startTimer(ms){
    setRemaining(ms)
    const end = Date.now() + ms
    timerRef.current = setInterval(() => {
      const rem = Math.max(end - Date.now(), 0)
      setRemaining(rem)
      if (rem <= 0) {
        clearInterval(timerRef.current)
        handleSubmit(true)
      }
    }, 1000)
  }

  async function handleStart(){
    const uid = auth.currentUser.uid
    const userDocRef = doc(db, 'results', uid)
    const now = new Date().toISOString()
    await setDoc(userDocRef, { studentId: uid, studentEmail: auth.currentUser.email, startedAt: now }, { merge: true })
    setStartedAt(now)
    startTimer(EXAM_DURATION_MS)
  }

  function handleSelect(qid, option){
    setAnswers(a => ({ ...a, [qid]: option }))
  }

  function goto(i){ if (i>=0 && i<questions.length) setCurrent(i) }

  async function handleSubmit(auto=false){
    if (finished) return
    // calcula pontuação
    let correctCount = 0
    questions.forEach(q => {
      const chosen = answers[q.id]
      if (chosen && chosen === q.correct) correctCount++
    })
    const sc = correctCount
    setScore(sc)
    setFinished(true)
    clearInterval(timerRef.current)
    const uid = auth.currentUser.uid
    const resultRef = doc(db, 'results', uid)
    const now = new Date().toISOString()
    await setDoc(resultRef, { answers, score: sc, finishedAt: now }, { merge: true })
  }

  if (!questions.length) return <div>Carregando questões...</div>

  if (!startedAt && !finished) {
    return (
      <div className='max-w-3xl mx-auto'>
        <h2 className='text-xl font-bold mb-4'>Prova ENEM — 6 horas</h2>
        <p className='mb-4'>Você tem 6 horas para concluir a prova. Ao iniciar, o tempo começa a contar e é salvo no servidor.</p>
        <button className='px-4 py-2 bg-blue-600 text-white rounded' onClick={handleStart}>Iniciar prova</button>
      </div>
    )
  }

  if (finished) {
    return (
      <div className='max-w-3xl mx-auto'>
        <h2 className='text-xl font-bold mb-4'>Resultado</h2>
        <div className='mb-4'>Pontuação: <span className='font-bold'>{score}</span></div>
        <div className='space-y-4'>
          {questions.map((q, idx) => {
            const chosen = answers[q.id]
            return (
              <div key={q.id} className='p-3 bg-white rounded shadow'>
                <div className='font-semibold'>Q{idx+1}. {q.text}</div>
                <div className='mt-2 space-y-1'>
                  {['A','B','C','D','E'].map(k => {
                    const isCorrect = q.correct === k
                    const isChosen = chosen === k
                    const base = 'p-2 rounded'
                    const cls = isCorrect ? 'bg-green-100 border-l-4 border-green-600' : (isChosen && !isCorrect ? 'bg-red-100 border-l-4 border-red-600' : 'bg-gray-50')
                    return (
                      <div key={k} className={`${base} ${cls}`}>
                        <strong>{k}.</strong> {q.options?.[k]}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const q = questions[current]
  const remHours = Math.floor(remaining / (1000*60*60))
  const remMinutes = Math.floor((remaining % (1000*60*60))/(1000*60))
  const remSeconds = Math.floor((remaining % (1000*60))/(1000))

  return (
    <div className='max-w-4xl mx-auto'>
      <div className='flex justify-between items-center mb-4'>
        <h2 className='text-xl font-bold'>Prova em andamento</h2>
        <div className='text-right'>Tempo restante:<div className='font-mono text-lg'>{`${String(remHours).padStart(2,'0')}:${String(remMinutes).padStart(2,'0')}:${String(remSeconds).padStart(2,'0')}`}</div></div>
      </div>

      <div className='bg-white p-4 rounded shadow'>
        <div className='font-semibold mb-2'>Questão {current+1} de {questions.length}</div>
        <div className='mb-4'>{q.text}</div>
        <div className='space-y-2'>
          {['A','B','C','D','E'].map(k => (
            <label key={k} className={`block p-2 border rounded cursor-pointer ${answers[q.id]===k ? 'bg-gray-100' : ''}`}>
              <input type='radio' name={q.id} checked={answers[q.id]===k} onChange={() => handleSelect(q.id, k)} className='mr-2' />
              <strong>{k}.</strong> {q.options?.[k]}
            </label>
          ))}
        </div>

        <div className='mt-4 flex gap-2'>
          <button onClick={() => goto(current-1)} disabled={current===0} className='px-3 py-1 border rounded disabled:opacity-50'>Anterior</button>
          <button onClick={() => goto(current+1)} disabled={current===questions.length-1} className='px-3 py-1 border rounded disabled:opacity-50'>Próxima</button>
          <div className='flex-1' />
          <button onClick={() => handleSubmit(false)} className='px-4 py-2 bg-green-600 text-white rounded'>Concluir prova</button>
        </div>
      </div>

      <div className='mt-4'>
        <h4 className='font-semibold'>Navegação rápida</h4>
        <div className='flex gap-2 flex-wrap mt-2'>
          {questions.map((_, i) => (
            <button key={i} onClick={() => goto(i)} className={`w-10 h-10 rounded ${i===current ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{i+1}</button>
          ))}
        </div>
      </div>
    </div>
  )
}