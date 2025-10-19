import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, doc, getDocs, setDoc, serverTimestamp, query, orderBy, getDoc } from 'firebase/firestore'; // Importe getDoc e query/orderBy

const GOOGLE_PROVIDER = new GoogleAuthProvider();

export default function Student() {
  const [user, setUser] = useState(null);
  const [provas, setProvas] = useState([]);
  const [selectedProva, setSelectedProva] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);

  // Login automático
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(u => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Buscar provas criadas (apenas se logado)
  useEffect(() => {
    if (!user) return; // Não busca provas se não estiver logado
    async function fetchProvas() {
      const snap = await getDocs(collection(db, 'provas'));
      setProvas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    fetchProvas();
  }, [user]); // Depende do user

  async function handleLogin() {
    try {
      const result = await signInWithPopup(auth, GOOGLE_PROVIDER);
      setUser(result.user);
    } catch (error) {
      console.error("Erro no login:", error);
    }
  }

  async function startProva(prova) {
    setSelectedProva(prova);

    // 1. Buscar as questões da prova
    const qColRef = collection(db, `exams/${prova.name}/days/${prova.day}/questions`);
    const qQuery = query(qColRef, orderBy('createdAt', 'asc')); // Ordena pela criação
    const snap = await getDocs(qQuery);
    const sortedQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setQuestions(sortedQuestions);

    // 2. Verificar se já fez a prova
    const resDocRef = doc(db, 'results', `${auth.currentUser.uid}-${prova.id}`);
    const resSnap = await getDoc(resDocRef); // Use getDoc para um único documento
    
    if (resSnap.exists()) {
      setFinished(true);
      setAnswers(resSnap.data().answers);
    } else {
      // Reseta o estado caso seja uma nova prova
      setFinished(false);
      setAnswers({});
      setCurrentIndex(0);
    }
  }

  function handleAnswer(option) {
    const qid = questions[currentIndex].id;
    setAnswers(prev => ({ ...prev, [qid]: option }));
  }

  async function finishExam() {
    if (!user || !selectedProva || Object.keys(answers).length === 0) return alert("Responda pelo menos uma questão para concluir.");
    
    let score = 0;
    questions.forEach(q => { if (answers[q.id] === q.correct) score++; });

    const resultRef = doc(db, 'results', `${user.uid}-${selectedProva.id}`);
    await setDoc(resultRef, {
      name: user.displayName,
      email: user.email,
      provaId: selectedProva.id,
      provaName: selectedProva.name, // Adiciona nome da prova para facilitar no admin
      provaDay: selectedProva.day,   // Adiciona dia da prova
      answers,
      score,
      total: questions.length,
      finishedAt: serverTimestamp(),
    });

    setFinished(true);
  }

  // Função para voltar à tela de seleção
  function handleReturnToSelection() {
    setSelectedProva(null);
    setFinished(false);
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
  }

  // --- RENDERIZAÇÃO ---

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
        {provas.length === 0 && <p>Nenhuma prova disponível no momento.</p>}
        {provas.map(p => (
          <button key={p.id} className="block w-full text-left mb-2 p-3 border rounded bg-gray-100 hover:bg-gray-200"
            onClick={() => startProva(p)}>
            {p.name} - {p.day}
          </button>
        ))}
      </div>
    );
  }

  // --- NOVA TELA DE PROVA CONCLUÍDA ---
  if (finished) {
    // Calcula a pontuação (de forma mais segura)
    const score = questions.filter(q => answers[q.id] === q.correct).length;

    return (
      <div className="p-6 max-w-lg mx-auto">
        <h2 className="text-2xl font-bold mb-4 text-center">Prova concluída!</h2>
        <p className="text-center text-xl mb-6">Pontuação: <span className="font-bold">{score} / {questions.length}</span></p>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 border-b pb-2">Seu Gabarito</h3>
          <ul className="divide-y divide-gray-200">
            {questions.map((q, index) => {
              const userAnswer = answers[q.id];
              const isCorrect = userAnswer === q.correct;
              return (
                <li key={q.id} className={`p-3 ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="font-semibold">{index + 1}. {q.text}</p>
                  <p>Sua resposta: <span className="font-bold">{userAnswer || '(Em branco)'}</span></p>
                  <p>Resposta correta: <span className="font-bold">{q.correct}</span></p>
                </li>
              );
            })}
          </ul>
        </div>
        
        <button 
          onClick={handleReturnToSelection} 
          className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Voltar para Seleção de Provas
        </button>
      </div>
    );
  }
  // --- FIM DA NOVA TELA ---


  const q = questions[currentIndex];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{selectedProva.name} - {selectedProva.day}</h2>
        <span className="text-lg font-semibold">{currentIndex + 1} / {questions.length}</span>
      </div>

      {q ? (
        <div className="mb-6 border p-4 rounded shadow-lg">
          <p className="font-semibold mb-4 text-lg whitespace-pre-wrap">{q.text}</p>
          {q.imageBase64 && <img src={q.imageBase64} alt="Contexto da questão" className="my-3 max-w-full md:max-w-md rounded" />}
          
          {/* Opções de Resposta */}
          <div className="flex flex-col gap-2">
            {['A','B','C','D','E'].map(l => (
              <button 
                key={l} 
                className={`border p-3 rounded text-left ${answers[q.id] === l ? 'bg-blue-200 border-blue-400' : 'bg-gray-50 hover:bg-gray-100'}`}
                onClick={() => handleAnswer(l)}
              >
                <span className="font-bold mr-2">{l})</span> {q.options[l]}
              </button>
            ))}
          </div>
          
          {/* Navegação e Conclusão */}
          <div className="mt-6 flex justify-between items-center">
            <button 
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} 
              disabled={currentIndex === 0} 
              className="bg-gray-300 px-4 py-2 rounded disabled:opacity-50"
            >
              Anterior
            </button>
            
            {currentIndex === questions.length - 1 ? (
              <button 
                onClick={finishExam} 
                className="bg-green-500 text-white px-6 py-2 rounded font-bold"
              >
                Concluir Prova
              </button>
            ) : (
              <button 
                onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))} 
                disabled={currentIndex === questions.length - 1}
                className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                Próxima
              </button>
            )}
          </div>
        </div>
      ) : (
        <p>Carregando questões...</p>
      )}
    </div>
  );
}