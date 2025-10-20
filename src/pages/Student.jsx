import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, doc, getDocs, setDoc, serverTimestamp, query, orderBy, getDoc } from 'firebase/firestore'; 

const GOOGLE_PROVIDER = new GoogleAuthProvider();
const PROVA_DURATION_MS = 6 * 60 * 60 * 1000;
const URGENT_TIME_MS = 30 * 60 * 1000; 

function formatTime(ms) {
  if (ms <= 0) return "00:00:00";
  let totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  totalSeconds %= 3600;
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export default function Student() {
  const [user, setUser] = useState(null);
  const [provas, setProvas] = useState([]);
  const [selectedProva, setSelectedProva] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);

  const [endTime, setEndTime] = useState(null); 
  const [timeLeftMs, setTimeLeftMs] = useState(0); 
  const [isTimerMinimized, setIsTimerMinimized] = useState(true); 

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(u => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return; 
    async function fetchProvas() {
      const snap = await getDocs(collection(db, 'provas'));
      setProvas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    fetchProvas();
  }, [user]);

  async function handleLogin() {
    try {
      const result = await signInWithPopup(auth, GOOGLE_PROVIDER);
      setUser(result.user);
    } catch (error) {
      console.error("Erro no login:", error);
    }
  }

  async function startProva(prova) {
    if (!user) return; 
    
    setSelectedProva(prova);
    
    const resDocRef = doc(db, 'results', `${user.uid}-${prova.id}`);
    let examStartTime; 

    try {
      const resSnap = await getDoc(resDocRef);

      if (resSnap.exists()) {
        const data = resSnap.data();
        if (data.finishedAt) {
          setFinished(true);
          setAnswers(data.answers || {});
        } else {
          examStartTime = data.startedAt.toDate();
          setAnswers(data.answers || {});
          setIsTimerMinimized(false); 
        }
      } else {
        examStartTime = new Date(); 
        setIsTimerMinimized(true); 
        
        await setDoc(resDocRef, {
          name: user.displayName,
          email: user.email,
          provaId: prova.id,
          provaName: prova.name,
          provaDay: prova.day,
          answers: {},
          score: 0,
          total: 0,
          startedAt: serverTimestamp(), 
        });
      }

      if (examStartTime && !finished) {
        const calculatedEndTime = new Date(examStartTime.getTime() + PROVA_DURATION_MS);
        setEndTime(calculatedEndTime);
      }

    } catch (error) {
      console.error("Erro ao iniciar prova:", error);
      alert("Não foi possível iniciar a prova.");
      setSelectedProva(null);
      return;
    }

    const qColRef = collection(db, `exams/${prova.name}/days/${prova.day}/questions`);
    const qQuery = query(qColRef, orderBy('createdAt', 'asc'));
    const snap = await getDocs(qQuery);
    const sortedQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setQuestions(sortedQuestions);
  }

  function handleAnswer(option) {
    if (!user) return; 
    const qid = questions[currentIndex].id;
    setAnswers(prev => ({ ...prev, [qid]: option }));
    
    const resDocRef = doc(db, 'results', `${user.uid}-${selectedProva.id}`);
    setDoc(resDocRef, { answers: { [qid]: option } }, { merge: true });
  }

  async function finishExam() {
    if (finished || !user || !selectedProva) return;
    setFinished(true); 
    setEndTime(null); 
    let score = 0;
    questions.forEach(q => { if (answers[q.id] === q.correct) score++; });
    
    const resultRef = doc(db, 'results', `${user.uid}-${selectedProva.id}`);
    await setDoc(resultRef, {
      answers,
      score,
      total: questions.length,
      finishedAt: serverTimestamp(),
    }, { merge: true });
  }
  
  useEffect(() => {
    if (!endTime || finished) {
      setTimeLeftMs(0);
      return;
    }
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const remaining = endTime.getTime() - now;
      if (remaining <= 0) {
        setTimeLeftMs(0);
        clearInterval(interval);
        alert("O tempo da prova acabou! Enviando suas respostas...");
        finishExam(); 
      } else {
        setTimeLeftMs(remaining);
      }
    }, 1000); 
    return () => clearInterval(interval);
  }, [endTime, finished]);

  function toggleTimerDisplay() {
    setIsTimerMinimized(prev => !prev);
  }

  function handleReturnToSelection() {
    setSelectedProva(null);
    setFinished(false);
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setEndTime(null);
    setTimeLeftMs(0);
    setIsTimerMinimized(true); 
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="p-8 bg-white shadow-xl rounded-lg text-center max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-ogum-green mb-2">Semente de Ogum</h1>
          <h2 className="text-xl font-semibold text-slate-700 mb-6">Bem-vindo(a)</h2>
          <p className="text-slate-600 mb-8">Faça login com o Google para iniciar sua prova.</p>
          <button 
            className="bg-ogum-green text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-opacity-80 transition-all cursor-pointer" 
            onClick={handleLogin}
          >
            Login com Google
          </button>
        </div>
      </div>
    );
  }

  if (!selectedProva) {
    return (
      <div className="p-6 max-w-2xl mx-auto min-h-screen">
        <h1 className="text-3xl font-bold text-ogum-green mb-8 mt-4 text-center">Minhas Provas</h1>
        <div className="space-y-3">
          {provas.length === 0 && <p className="text-center text-slate-500">Nenhuma prova disponível no momento.</p>}
          {provas.map(p => (
            <button 
              key={p.id} 
              className="block w-full text-left p-6 border rounded-lg bg-white shadow-sm hover:shadow-lg hover:border-ogum-green transition-all duration-200 cursor-pointer"
              onClick={() => startProva(p)}>
              <span className="text-xl font-semibold text-slate-800">{p.name} - {p.day}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (finished) {
    const score = questions.filter(q => answers[q.id] === q.correct).length;
    return (
      <div className="p-6 max-w-2xl mx-auto my-10">
        <div className="bg-white shadow-xl rounded-lg p-8 text-center">
          <h2 className="text-3xl font-bold text-ogum-green mb-4">Prova concluída!</h2>
          <p className="text-center text-2xl mb-8">Pontuação: <span className="font-bold text-secondary-blue">{score} / {questions.length}</span></p>
        </div>
        
        <div className="mt-8">
          <h3 className="text-2xl font-semibold mb-4 text-slate-800 border-b pb-2">Seu Gabarito</h3>
          <ul className="space-y-4">
            {questions.map((q, index) => {
              const userAnswer = answers[q.id];
              const isCorrect = userAnswer === q.correct;
              return (
                <li key={q.id} className={`p-4 rounded-lg border-l-4 ${isCorrect ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                  <p className="font-semibold text-slate-800">{index + 1}. {q.text}</p>
                  <p className="mt-2">Sua resposta: <span className="font-bold">{userAnswer || '(Em branco)'}</span></p>
                  <p>Resposta correta: <span className="font-bold">{q.correct}</span></p>
                </li>
              );
            })}
          </ul>
        </div>
        <button 
          onClick={handleReturnToSelection} 
          className="w-full bg-ogum-green text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-opacity-80 transition-all cursor-pointer mt-10"
        >
          Voltar para Seleção de Provas
        </button>
      </div>
    );
  }

  const q = questions[currentIndex];
  const isUrgent = timeLeftMs > 0 && timeLeftMs <= URGENT_TIME_MS;

  return (
    <div className="p-6 max-w-3xl mx-auto pb-24"> 
      <div className="flex justify-between items-center mb-6 sticky top-0 bg-white/80 backdrop-blur-sm py-4 z-10">
        <h2 className="text-2xl font-bold text-ogum-green">{selectedProva.name} - {selectedProva.day}</h2>
        <span className="text-lg font-semibold text-slate-600 px-3 py-1 bg-slate-100 rounded-full">{currentIndex + 1} / {questions.length}</span>
      </div>

      {q ? (
        <div className="mb-6 bg-white shadow-xl rounded-lg p-6">
          <p className="font-semibold mb-5 text-lg text-slate-800 whitespace-pre-wrap">{q.text}</p>
          {q.imageBase64 && <img src={q.imageBase64} alt="Contexto da questão" className="my-4 max-w-full md:max-w-md rounded-lg" />}
          
          <div className="flex flex-col gap-3">
            {['A','B','C','D','E'].map(l => (
              <button 
                key={l} 
                className={`border-2 p-4 rounded-lg text-left transition-all duration-200 cursor-pointer
                            ${answers[q.id] === l 
                              ? 'bg-blue-50 border-secondary-blue ring-2 ring-secondary-blue/30' 
                              : 'bg-white border-slate-200 hover:border-secondary-blue'}`}
                onClick={() => handleAnswer(l)}
              >
                <span className="font-bold mr-3 text-secondary-blue">{l})</span> 
                <span className="text-slate-700">{q.options[l]}</span>
              </button>
            ))}
          </div>
          
          <div className="mt-8 flex justify-between items-center border-t pt-6">
            <button 
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} 
              disabled={currentIndex === 0} 
              className="bg-slate-200 text-slate-700 px-5 py-2 rounded-lg font-medium hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Anterior
            </button>
            
            {currentIndex === questions.length - 1 ? (
              <button 
                onClick={finishExam} 
                className="bg-ogum-green text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-opacity-80 transition-all cursor-pointer"
              >
                Concluir Prova
              </button>
            ) : (
              <button 
                onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))} 
                disabled={currentIndex === questions.length - 1}
                className="bg-secondary-blue text-white px-5 py-2 rounded-lg font-medium shadow-lg hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Próxima
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-center text-slate-500 mt-10">Carregando questões...</p>
      )}

      {endTime && (
        <div 
          onClick={toggleTimerDisplay}
          className={`fixed bottom-0 right-0 m-4 rounded-lg shadow-xl font-mono cursor-pointer transition-all duration-300 z-30
                      ${isUrgent ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}
                      ${isTimerMinimized ? 'p-3' : 'p-4 text-xl'} `}
          title={isTimerMinimized ? "Mostrar cronômetro" : "Ocultar cronômetro"}
        >
          {isTimerMinimized ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          ) : (
            <span>
              Tempo Restante: {formatTime(timeLeftMs)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}