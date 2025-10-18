import React, { useEffect, useState } from 'react'
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

export default function Admin(){
  const [questao, setQuestao] = useState('')
  const [options, setOptions] = useState({ A: '', B: '', C: '', D: '', E: '' })
  const [correct, setCorrect] = useState('A')
  const [results, setResults] = useState([])
  const [questions, setQuestions] = useState([])

  useEffect(() => { fetchResults(); fetchQuestions() }, [])

  async function fetchResults(){
    const q = query(collection(db, 'results'), orderBy('finishedAt', 'desc'))
    const snap = await getDocs(q)
    setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  async function fetchQuestions(){
    const q = query(collection(db, 'questions'), orderBy('createdAt', 'asc'))
    const snap = await getDocs(q)
    setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  async function handleAdd(e){
    e.preventDefault()
    if (!questao.trim()) return
    const payload = {
      text: questao,
      options,
      correct,
      createdAt: new Date().toISOString()
    }
    await addDoc(collection(db, 'questions'), payload)
    setQuestao('')
    setOptions({ A: '', B: '', C: '', D: '', E: '' })
    setCorrect('A')
    fetchQuestions()
  }

  return (
    <div className='space-y-6'>
      <h2 className='text-xl font-bold'>Painel do Admin</h2>

      <form onSubmit={handleAdd} className='bg-white shadow p-4 rounded space-y-3'>
        <label className='block'>
          <div className='font-semibold'>Texto da questão</div>
          <textarea value={questao} onChange={e => setQuestao(e.target.value)} className='w-full border rounded p-2' rows={3}></textarea>
        </label>

        {['A','B','C','D','E'].map(k => (
          <label key={k} className='block'>
            <div className='font-semibold'>Opção {k}</div>
            <input value={options[k]} onChange={e => setOptions(s => ({...s, [k]: e.target.value}))} className='w-full border rounded p-2' />
          </label>
        ))}

        <label className='block'>
          <div className='font-semibold'>Resposta correta</div>
          <select value={correct} onChange={e => setCorrect(e.target.value)} className='border rounded p-2'>
            {['A','B','C','D','E'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>

        <div className='flex gap-2'>
          <button className='px-4 py-2 bg-green-600 text-white rounded'>Adicionar questão</button>
        </div>
      </form>

      <section>
        <h3 className='font-bold mb-2'>Questões cadastradas</h3>
        <div className='space-y-2'>
          {questions.map(q => (
            <div key={q.id} className='p-3 bg-white rounded shadow'>
              <div className='font-semibold'>{q.text}</div>
              <div className='text-sm mt-2'>
                {Object.entries(q.options || {}).map(([k,v]) => (
                  <div key={k}><span className='font-bold'>{k}.</span> {v} {q.correct===k && <span className='text-green-600 font-semibold'> (correta)</span>}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className='font-bold mb-2'>Resultados dos alunos</h3>
        <div className='space-y-2'>
          {results.map(r => (
            <div key={r.id} className='p-3 bg-white rounded shadow'>
              <div className='flex justify-between'>
                <div><strong>{r.studentEmail || r.studentId}</strong></div>
                <div>{r.score ?? '--'} pontos</div>
              </div>
              <div className='text-sm text-gray-600'>Iniciado: {r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'} — Finalizado: {r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '—'}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}