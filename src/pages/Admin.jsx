import React, { useState, useEffect } from 'react';
import { db, serverTimestamp } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  setDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';

export default function Admin() {
  // --- Estados de UI ---
  const [currentExam, setCurrentExam] = useState(null); 
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' | 'results' | 'resultDetails'

  // --- Estados do Formulário (para criar/editar) ---
  const [text, setText] = useState('');
  const [options, setOptions] = useState({A:'',B:'',C:'',D:'',E:''});
  const [correct, setCorrect] = useState('A');
  const [tema, setTema] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [previewURL, setPreviewURL] = useState('');
  
  // --- Estados do Formulário (para criar nova prova) ---
  const [newExamName, setNewExamName] = useState('');
  const [newExamDay, setNewExamDay] = useState('');

  // --- Estados de Dados ---
  const [questions, setQuestions] = useState([]); 
  const [provas, setProvas] = useState([]); 
  const [resultsList, setResultsList] = useState([]); 
  
  const [selectedResults, setSelectedResults] = useState([]); 
  const [detailedResult, setDetailedResult] = useState(null); 
  const [currentExamQuestions, setCurrentExamQuestions] = useState([]); 

  const THEMES = ["Linguagens","Ciências Humanas","Ciências da Natureza","Matemática"];
  const SUGGESTED_QUESTIONS_BY_DAY = {
    "Dia 1": { "Linguagens": 45, "Ciências Humanas": 45 },
    "Dia 2": { "Ciências da Natureza": 45, "Matemática": 45 }
  };

  // --- Efeitos (Hooks) ---

  useEffect(() => {
    async function fetchProvas() {
      const snap = await getDocs(collection(db, 'provas'));
      setProvas(snap.docs.map(d=>({id:d.id,...d.data()})));
    }
    async function fetchResults() {
      const q = query(collection(db, 'results'), orderBy('finishedAt', 'desc'));
      const snap = await getDocs(q);
      setResultsList(snap.docs.map(d=>({id:d.id,...d.data()})));
    }
    fetchProvas();
    fetchResults();
  }, []);

  useEffect(() => {
    if (!currentExam) {
      setQuestions([]); 
      return;
    }

    async function fetchQuestions() {
      try {
        const { name, day } = currentExam;
        const colRef = collection(db, 'exams', name, 'days', day, 'questions');
        const q = query(colRef, orderBy('createdAt', 'asc')); 
        const snap = await getDocs(q);
        setQuestions(snap.docs.map(d=>({id:d.id,...d.data()})));
      } catch (err) {
        console.error("Erro fetchQuestions:", err);
      }
    }
    fetchQuestions();
  }, [currentExam]); 

  
  // --- Funções de CRUD (Questões) ---

  const countByTema = questions.reduce((acc,q)=>{
    acc[q.tema] = (acc[q.tema]||0)+1;
    return acc;
  }, {});

  function handleImageChange(e) {
    const file = e.target.files[0];
    if(!file){ setImageBase64(''); setPreviewURL(''); return; }
    const reader = new FileReader();
    reader.onloadend = ()=>{ setImageBase64(reader.result); setPreviewURL(reader.result); };
    reader.readAsDataURL(file);
  }

  async function handleAddQuestion(){
    if(!text || !tema) return alert("Preencha todos os campos");
    if(!currentExam) return alert("Nenhuma prova selecionada");

    try {
      const { name, day } = currentExam;
      const colRef = collection(db, 'exams', name, 'days', day, 'questions');
      
      const docRef = await addDoc(colRef,{
        text,
        options,
        correct,
        tema,
        imageBase64: imageBase64||null,
        createdAt: serverTimestamp()
      });

      setText('');
      setOptions({A:'',B:'',C:'',D:'',E:''});
      setCorrect('A');
      setImageBase64('');
      setPreviewURL('');
      setTema('');
      
      setQuestions(prev => [...prev, {
        id: docRef.id, 
        text, options, correct, tema, imageBase64: imageBase64||null, 
        createdAt: { seconds: Date.now()/1000 } 
      }]);

    } catch(err){
      console.error(err);
      alert("Erro ao adicionar questão.");
    }
  }

  async function handleDeleteQuestion(questionId){
    if(!confirm("Deseja realmente deletar esta questão?")) return;
    if(!currentExam) return alert("Nenhuma prova selecionada");
    
    try {
      const { name, day } = currentExam;
      await deleteDoc(doc(db, 'exams', name, 'days', day, 'questions', questionId));
      setQuestions(prev=>prev.filter(q=>q.id!==questionId)); 
    } catch(err){
      console.error(err);
      alert("Erro ao deletar questão.");
    }
  }

  // --- Funções de Gerenciamento (Provas) ---

  async function handlePublishProva() {
    if(!currentExam) return alert("Nenhuma prova selecionada");
    if(questions.length === 0) return alert("Adicione questões antes de publicar");

    try {
      const { name, day } = currentExam;
      const existingProva = provas.find(p => p.name === name && p.day === day);
      const provaRef = existingProva 
        ? doc(db, 'provas', existingProva.id) 
        : doc(collection(db, 'provas')); 

      await setDoc(provaRef, {
        name,
        day,
        questionCount: questions.length,
        updatedAt: serverTimestamp()
      }, { merge: true }); 

      alert("Prova publicada/atualizada com sucesso!");
      
      if (!existingProva) {
        setProvas(prev => [...prev, { id: provaRef.id, name, day, questionCount: questions.length }]);
      }
      
      setCurrentExam(null);
    } catch(err){
      console.error(err);
      alert("Erro ao publicar a prova.");
    }
  }

  async function handleDeleteProva(provaId) {
    if(!confirm("Deseja realmente despublicar esta prova? (As questões NÃO serão apagadas).")) return;
    try {
      await deleteDoc(doc(db, 'provas', provaId));
      setProvas(prev => prev.filter(p => p.id !== provaId));
      alert("Prova despublicada.");
    } catch (err) {
      console.error(err);
      alert("Erro ao despublicar prova.");
    }
  }

  // --- Funções de Resultados ---

  async function handleShowResults(provaId) {
    const prova = provas.find(p => p.id === provaId);
    if (!prova) return alert("Prova não encontrada.");

    const results = resultsList.filter(r => r.provaId === provaId);
    setSelectedResults(results);

    try {
      const colRef = collection(db, 'exams', prova.name, 'days', prova.day, 'questions');
      const q = query(colRef, orderBy('createdAt', 'asc')); 
      const snap = await getDocs(q);
      const fetchedQuestions = snap.docs.map(d=>({id:d.id,...d.data()}));
      setCurrentExamQuestions(fetchedQuestions);
    } catch (err) {
      console.error("Erro ao buscar questões da prova:", err);
      setCurrentExamQuestions([]);
    }
    setViewMode('results');
  }

  function showResultDetails(result) {
    setDetailedResult(result);
    setViewMode('resultDetails');
  }

  // --- NOVA FUNÇÃO DE RESET ---
  async function handleResetProvaAluno() {
    if (!detailedResult) return alert("Nenhum resultado de aluno selecionado.");

    const resultId = detailedResult.id;
    const alunoName = detailedResult.name;

    if (!confirm(`Deseja realmente resetar a prova de ${alunoName}? O aluno poderá refazer a prova.`)) return;

    try {
      // 1. Deletar o documento do resultado
      await deleteDoc(doc(db, 'results', resultId));

      // 2. Atualizar os estados locais para refletir a mudança
      setResultsList(prev => prev.filter(r => r.id !== resultId));
      setSelectedResults(prev => prev.filter(r => r.id !== resultId));

      // 3. Voltar para a tela de lista de resultados
      setViewMode('results');
      setDetailedResult(null); // Limpar o resultado detalhado

      alert(`Prova de ${alunoName} resetada com sucesso.`);
    } catch (err) {
      console.error("Erro ao resetar prova:", err);
      alert("Erro ao resetar prova. Verifique o console.");
    }
  }

  // --- RENDERIZAÇÃO ---

  // 1. Tela de Resultados
  if (viewMode === 'results') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button onClick={() => setViewMode('dashboard')} className="mb-4 bg-gray-500 text-white px-4 py-2 rounded">
          &larr; Voltar ao Dashboard
        </button>
        <h2 className="text-xl font-bold mb-4">Resultados da Prova</h2>
        {selectedResults.length === 0 ? (
          <p>Nenhum aluno concluiu esta prova ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {selectedResults.map(r => (
              <li key={r.id} className="py-3 flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                  <p className="font-semibold">{r.name} ({r.email})</p>
                  <p>Pontuação: <span className="font-bold">{r.score} / {r.total}</span></p>
                  {r.finishedAt && <p className="text-sm text-gray-600">Data: {new Date(r.finishedAt.seconds * 1000).toLocaleString()}</p>}
                </div>
                <button 
                  onClick={() => showResultDetails(r)}
                  className="mt-2 md:mt-0 bg-blue-500 text-white px-3 py-1 rounded text-sm"
                >
                  Ver Detalhes
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // 1.5. TELA DE DETALHES (Modificada)
  if (viewMode === 'resultDetails') {
    if (!detailedResult || !currentExamQuestions) {
      return <div className="p-6">Carregando...</div>;
    }

    return (
      <div className="p-6 max-w-lg mx-auto">
        <button onClick={() => setViewMode('results')} className="mb-4 bg-gray-500 text-white px-4 py-2 rounded">
          &larr; Voltar para Resultados
        </button>
        <h2 className="text-2xl font-bold mb-2">Detalhes de {detailedResult.name}</h2>
        <p className="text-xl mb-4">Pontuação: <span className="font-bold">{detailedResult.score} / {detailedResult.total}</span></p>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 border-b pb-2">Gabarito do Aluno</h3>
          <ul className="divide-y divide-gray-200">
            {currentExamQuestions.map((q, index) => {
              const userAnswer = detailedResult.answers[q.id];
              const isCorrect = userAnswer === q.correct;
              return (
                <li key={q.id} className={`p-3 ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="font-semibold">{index + 1}. {q.text}</p>
                  <p>Resposta do Aluno: <span className="font-bold">{userAnswer || '(Em branco)'}</span></p>
                  <p>Resposta Correta: <span className="font-bold">{q.correct}</span></p>
                </li>
              );
            })}
          </ul>
        </div>

        {/* --- NOVO BOTÃO DE RESET --- */}
        <div className="mt-8 border-t-2 border-red-300 pt-4">
          <button
            onClick={handleResetProvaAluno}
            className="w-full bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-700"
          >
            Resetar Prova deste Aluno
          </button>
          <p className="text-sm text-gray-600 mt-2 text-center">
            Isso excluirá o resultado e permitirá que o aluno refaça a prova.
          </p>
        </div>
        
      </div>
    );
  }


  // 2. Tela de Edição/Criação de Questões
  if (currentExam) {
    const { name, day } = currentExam;
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <button onClick={() => setCurrentExam(null)} className="mb-4 bg-gray-500 text-white px-4 py-2 rounded">
          &larr; Voltar ao Dashboard
        </button>
        <h1 className="text-2xl font-bold mb-2">{name} - {day}</h1>

        <p className="mb-4 font-semibold">Sugestão de criação de questões:</p>
        {Object.entries(SUGGESTED_QUESTIONS_BY_DAY[day] || {}).map(([t,count])=>{
          const current = countByTema[t]||0;
          return <p key={t} className={current > count ? 'text-red-500' : ''}>
            {current} / {count} Questões {t}
          </p>
        })}

        {/* Formulário de Adicionar Questão */}
        <div className="my-6 p-4 border rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-3">Adicionar Nova Questão</h3>
          <textarea className="border p-2 w-full mb-2" placeholder="Digite a questão" value={text} onChange={e=>setText(e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            {['A','B','C','D','E'].map(l=>(<input key={l} className="border p-2" placeholder={`Opção ${l}`} value={options[l]} onChange={e=>setOptions({...options,[l]:e.target.value})}/>))}
          </div>
          <div className="flex flex-wrap gap-4 mb-2">
            <div>
              <label className="mr-2">Tema:</label>
              <select value={tema} onChange={e=>setTema(e.target.value)} className="border p-1">
                <option value="">Selecione o tema</option>
                {THEMES.map(t=> <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mr-2">Resposta correta:</label>
              <select value={correct} onChange={e=>setCorrect(e.target.value)} className="border p-1">
                {['A','B','C','D','E'].map(l=><option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-2">
            <label>Imagem (opcional): </label>
            <input type="file" accept="image/*" onChange={handleImageChange} />
            {previewURL && <img src={previewURL} alt="Preview" className="my-2 max-w-xs rounded" />}
          </div>
          <button onClick={handleAddQuestion} className="bg-blue-500 text-white px-4 py-2 rounded">Adicionar questão</button>
        </div>

        {/* Botão de Publicar */}
        <div className="my-6 text-center">
            <button onClick={handlePublishProva} className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold">
              Publicar / Atualizar Prova
            </button>
            <p className="text-sm text-gray-600 mt-2">Isso tornará a prova visível (ou a atualizará) para os alunos.</p>
        </div>

        {/* Lista de Questões Cadastradas */}
        <h2 className="text-xl font-bold mb-2">Questões cadastradas ({questions.length})</h2>
        <ul className="divide-y divide-gray-200">
          {questions.map(q=>(
            <li key={q.id} className="py-4">
              <p className="font-semibold whitespace-pre-wrap">{q.text}</p>
              <p className="text-sm text-gray-600">Tema: {q.tema}</p>
              {q.imageBase64 && <img src={q.imageBase64} alt="Questão" className="my-2 max-w-xs rounded" />}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 my-2">
                {['A','B','C','D','E'].map(k=>{
                  const v = q.options[k];
                  return <div key={k} className={`p-1 text-sm ${q.correct===k?'bg-green-100 border-green-300':'bg-gray-50'}`}>{k}: {v}</div>
                })}
              </div>
              <button onClick={()=>handleDeleteQuestion(q.id)} className="bg-red-500 text-white px-2 py-1 rounded text-xs">Deletar</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // 3. Tela Principal (Dashboard)
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Painel do Administrador</h1>

      {/* Seção de Criar/Editar Nova Prova */}
      <div className="mb-8 p-4 border rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Criar ou Editar Prova</h2>
        <p className="text-sm text-gray-600 mb-2">Digite o nome e o dia da prova que deseja criar ou editar as questões.</p>
        <div className="flex flex-col md:flex-row gap-2">
          <input 
            className="border p-2 w-full md:w-1/2" 
            placeholder="Nome da Prova (Ex: Enem 2024)" 
            value={newExamName} 
            onChange={e=>setNewExamName(e.target.value)} 
          />
          <select 
            className="border p-2 w-full md:w-1/4" 
            value={newExamDay} 
            onChange={e=>setNewExamDay(e.target.value)}
          >
            <option value="">Selecione o dia</option>
            <option value="Dia 1">Dia 1</option>
            <option value="Dia 2">Dia 2</option>
          </select>
          <button 
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={() => {
              if (!newExamName || !newExamDay) return alert("Preencha o nome e o dia.");
              setCurrentExam({ name: newExamName, day: newExamDay });
              setNewExamName('');
              setNewExamDay('');
            }}
          >
            Criar / Editar Questões
          </button>
        </div>
      </div>

      {/* Seção de Provas Publicadas */}
      <div>
        <h2 className="text-xl font-bold mb-4">Provas Publicadas (Visíveis aos Alunos)</h2>
        {provas.length === 0 ? (
          <p>Nenhuma prova foi publicada ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {provas.map(p => (
              <li key={p.id} className="py-3 flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                  <p className="text-lg font-semibold">{p.name} - {p.day}</p>
                  <p className="text-sm text-gray-500">Questões: {p.questionCount || 'N/A'}</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                  <button 
                    onClick={() => setCurrentExam({ name: p.name, day: p.day })} 
                    className="bg-yellow-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Editar Questões
                  </button>
                  <button 
                    onClick={() => handleShowResults(p.id)}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Ver Resultados
                  </button>
                  <button 
                    onClick={() => handleDeleteProva(p.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Despublicar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}