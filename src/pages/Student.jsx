import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, doc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';

const GOOGLE_PROVIDER = new GoogleAuthProvider();

export default function Student() {
  const [user, setUser] = useState(null);
  const [provas, setProvas] = useState([]);
  const [selectedProva, setSelectedProva] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);

  // Login automático se já autenticado
  useEffect(() => {
    auth.onAuthStateChanged(u => {
      if (u) setUser(u);
    });
  }, []);

  // Buscar provas criadas
  useEffect(() => {
    async function fetchProvas() {
      const snap = await getDocs(collection(db, 'provas'));
      setProvas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    fetchProvas();
  }, []);

  async function handleLogin() {
    const result = await signInWithPopup(auth, GOOGLE_PROVIDER);
    setUser(result.user);
  }

  async function startProva(prova) {
    setSelectedProva(prova);
    const snap = await getDocs(collection(db, `exams/${prova.name}/days/${prova.day}/questions`));
    const sorted = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                            .sort((a,b) => a.createdAt?.seconds - b.createdAt?.seconds);
    setQuestions(sorted);

    // Verificar se já fez a prova
    const resDoc = doc(db, 'results', `${auth.currentUser.uid}-${prova.id}`);
    const resSnap = await resDoc.get?.();
    if (resSnap?.exists) {
      setFinished(true);
      setAnswers(resSnap.data().answers);
    }
  }

  function handleAnswer(option) {
    const qid = questions[currentIndex].id;
    setAnswers(prev => ({ ...prev, [qid]: option }));
  }

  async function finishExam() {
    if (!user || !selectedProva) return;
    let score = 0;
    questions.forEach(q => { if (answers[q.id] === q.correct) score++; });

    const resultRef = doc(db, 'results', `${user.uid}-${selectedProva.id}`);
    await setDoc(resultRef, {
      name: user.displayName,
      email: user.email,
      provaId: selectedProva.id,
      answers,
      score,
      total: questions.length,
      startedAt: serverTimestamp(),
      finishedAt: serverTimestamp(),
    });

    setFinished(true);
  }

  if (!user) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <h2 className="text-xl font-bold mb-4">Login com Google para iniciar</h2>
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={handleLogin}>Login com Google</button>
      </div>
    );
  }

  if (!selectedProva) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-4">Selecione a prova</h2>
        {provas.map(p => (
          <button key={p.id} className="block w-full mb-2 p-2 border rounded bg-gray-200"
            onClick={() => startProva(p)}>
            {p.name} - {p.day} {p.finished ? '(Concluída)' : ''}
          </button>
        ))}
      </div>
    );
  }

  if (finished) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <h2 className="text-xl font-bold mb-4">Prova concluída!</h2>
        <p>Pontuação: {Object.keys(answers).filter(id => questions.find(q => q.id===id && answers[id]===q.correct)).length} / {questions.length}</p>
        <p>Solicite ao professor caso queira refazer a prova.</p>
      </div>
    );
  }

  const q = questions[currentIndex];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="font-bold mb-2">{selectedProva.name} - {selectedProva.day}</h2>
      {q && (
        <div className="mb-6 border p-4 rounded">
          <p className="font-semibold mb-2">{currentIndex + 1}. {q.text}</p>
          {q.imageBase64 && <img src={q.imageBase64} className="my-2 max-w-xs rounded" />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {['A','B','C','D','E'].map(l => (
              <button key={l} className={`border p-2 rounded ${answers[q.id]===l?'bg-blue-200':'bg-gray-100'}`}
                      onClick={() => handleAnswer(l)}>
                {l}: {q.options[l]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between">
            <button onClick={()=>setCurrentIndex(i=>Math.max(0,i-1))} disabled={currentIndex===0} className="bg-gray-300 px-3 py-1 rounded">Anterior</button>
            <button onClick={()=>setCurrentIndex(i=>Math.min(questions.length-1,i+1))} disabled={currentIndex===questions.length-1} className="bg-gray-300 px-3 py-1 rounded">Próxima</button>
            <button onClick={finishExam} className="bg-green-500 text-white px-3 py-1 rounded">Concluir Prova</button>
          </div>
        </div>
      )}
    </div>
  );
}
