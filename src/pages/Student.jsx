import React, { useState, useEffect } from 'react';
import { db, auth, serverTimestamp } from '../firebase';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';

const EXAM_DURATION_MS = 6*60*60*1000; // 6 horas

export default function Student() {
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(EXAM_DURATION_MS);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState(null);

  // Fetch questions
  useEffect(() => {
    async function fetchQuestions() {
      const snap = await getDocs(collection(db, 'questions'));
      setQuestions(snap.docs.map(d => ({id:d.id, ...d.data()})));
    }
    fetchQuestions();
  }, []);

  // Start exam timer
  useEffect(() => {
    async function initTimer() {
      const uid = auth.currentUser.uid;
      const docRef = doc(db, 'results', uid);
      let snap = await getDoc(docRef);
      let startedAtMs;

      // Se já existe startedAt válido, usa ele
      if(snap.exists() && snap.data().startedAt && typeof snap.data().startedAt.toMillis === 'function'){
        startedAtMs = snap.data().startedAt.toMillis();
      } else {
        // Cria startedAt no servidor
        await setDoc(docRef, { studentId: uid, startedAt: serverTimestamp() }, { merge: true });
        snap = await getDoc(docRef);
        startedAtMs = snap.data().startedAt.toMillis();
      }

      const interval = setInterval(() => {
        const elapsed = Date.now() - startedAtMs;
        const rem = Math.max(EXAM_DURATION_MS - elapsed, 0);
        setRemaining(rem);
        if(rem <= 0){
          clearInterval(interval);
          handleFinish();
        }
      }, 1000);
    }
    initTimer();
  }, []);

  function formatTime(ms){
    const h = Math.floor(ms/3600000);
    const m = Math.floor((ms%3600000)/60000);
    const s = Math.floor((ms%60000)/1000);
    return `${h}h ${m}m ${s}s`;
  }

  function handleAnswer(option){
    setAnswers({...answers, [questions[current].id]: option});
  }

  function handleFinish(){
    const score = questions.reduce((acc,q)=>acc + (answers[q.id]===q.correct?1:0),0);
    setResults({score,total:questions.length, answers});
    setFinished(true);

    // Salva no Firestore
    setDoc(doc(db,'results',auth.currentUser.uid),{
      answers,
      finished:true,
      score,
      finishedAt: serverTimestamp()
    }, {merge:true});
  }

  if(questions.length===0) return <p>Carregando questões...</p>;

  if(finished){
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Resultado</h1>
        <p>Pontuação: {results.score} / {results.total}</p>
        <h2 className="text-xl font-semibold mt-4">Gabarito</h2>
        <ul>
          {questions.map(q=>{
            const userAns = results.answers[q.id];
            return (
              <li key={q.id} className="mb-2 border p-2 rounded">
                <p>{q.text}</p>
                {q.imageBase64 && <img src={q.imageBase64} className="my-2 max-w-xs rounded" />}
                {['A','B','C','D','E'].map(k=>{
                  const v = q.options[k];
                  const isCorrect = q.correct===k;
                  const isUser = userAns===k;
                  let color='bg-gray-100';
                  if(isCorrect) color='bg-green-200';
                  if(isUser && !isCorrect) color='bg-red-200';
                  return <div key={k} className={`p-1 ${color}`}>{k}: {v}</div>
                })}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  const q = questions[current];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-2">Prova - Tempo restante: {formatTime(remaining)}</h1>
      <p className="mb-2">{current+1} / {questions.length}</p>
      <p className="mb-2">{q.text}</p>
      {q.imageBase64 && <img src={q.imageBase64} className="my-2 max-w-xs rounded" />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        {['A','B','C','D','E'].map(k=>{
          const v = q.options[k];
          return (
            <button 
              key={k} 
              onClick={()=>handleAnswer(k)}
              className={`border p-2 ${answers[q.id]===k?'bg-blue-200':''}`}
            >
              {k}: {v}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between">
        <button onClick={()=>setCurrent(c=>Math.max(c-1,0))} className="bg-gray-300 px-4 py-2 rounded">Anterior</button>
        {current<questions.length-1 
          ? <button onClick={()=>setCurrent(c=>c+1)} className="bg-gray-300 px-4 py-2 rounded">Próxima</button>
          : <button onClick={handleFinish} className="bg-green-500 text-white px-4 py-2 rounded">Concluir prova</button>
        }
      </div>
    </div>
  );
}
