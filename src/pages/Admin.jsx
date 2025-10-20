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

import { useAdminAuth } from '../hooks/useAdminAuth';
import { ManageAdmins } from '../components/ManageAdmins';

export default function Admin() {
  const { user, isAdmin, loading } = useAdminAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [currentExam, setCurrentExam] = useState(null); 
  const [viewMode, setViewMode] = useState('dashboard');

  const [text, setText] = useState('');
  const [options, setOptions] = useState({A:'',B:'',C:'',D:'',E:''});
  const [correct, setCorrect] = useState('A');
  const [tema, setTema] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [previewURL, setPreviewURL] = useState('');
  
  const [newExamName, setNewExamName] = useState('');
  const [newExamDay, setNewExamDay] = useState('');

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
  
  useEffect(() => {
    if (!isAdmin) return; 
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
  }, [isAdmin]);

  useEffect(() => {
    if (!currentExam || !isAdmin) {
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
  }, [currentExam, isAdmin]); 

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
        text, options, correct, tema,
        imageBase64: imageBase64||null,
        createdAt: serverTimestamp()
      });
      setText(''); setOptions({A:'',B:'',C:'',D:'',E:''}); setCorrect('A');
      setImageBase64(''); setPreviewURL(''); setTema('');
      setQuestions(prev => [...prev, {
        id: docRef.id, text, options, correct, tema, imageBase64: imageBase64||null, 
        createdAt: { seconds: Date.now()/1000 } 
      }]);
    } catch(err){
      console.error(err); alert("Erro ao adicionar questão.");
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
      console.error(err); alert("Erro ao deletar questão.");
    }
  }

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
        name, day, questionCount: questions.length,
        updatedAt: serverTimestamp()
      }, { merge: true }); 
      alert("Prova publicada/atualizada com sucesso!");
      if (!existingProva) {
        setProvas(prev => [...prev, { id: provaRef.id, name, day, questionCount: questions.length }]);
      }
      setCurrentExam(null);
    } catch(err){
      console.error(err); alert("Erro ao publicar a prova.");
    }
  }

  async function handleDeleteProva(provaId) {
    if(!confirm("Deseja realmente despublicar esta prova?")) return;
    try {
      await deleteDoc(doc(db, 'provas', provaId));
      setProvas(prev => prev.filter(p => p.id !== provaId));
      alert("Prova despublicada.");
    } catch (err) {
      console.error(err); alert("Erro ao despublicar prova.");
    }
  }

  async function handleShowResults(provaId) {
    const prova = provas.find(p => p.id === provaId);
    if (!prova) return alert("Prova não encontrada.");
    const results = resultsList.filter(r => r.provaId === provaId);
    setSelectedResults(results);
    try {
      const colRef = collection(db, 'exams', prova.name, 'days', prova.day, 'questions');
      const q = query(colRef, orderBy('createdAt', 'asc')); 
      const snap = await getDocs(q);
      setCurrentExamQuestions(snap.docs.map(d=>({id:d.id,...d.data()})));
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

  async function handleResetProvaAluno() {
    if (!detailedResult) return alert("Nenhum resultado de aluno selecionado.");
    const resultId = detailedResult.id;
    const alunoName = detailedResult.name;
    if (!confirm(`Deseja realmente resetar a prova de ${alunoName}?`)) return;
    try {
      await deleteDoc(doc(db, 'results', resultId));
      setResultsList(prev => prev.filter(r => r.id !== resultId));
      setSelectedResults(prev => prev.filter(r => r.id !== resultId));
      setViewMode('results');
      setDetailedResult(null); 
      alert(`Prova de ${alunoName} resetada com sucesso.`);
    } catch (err){
      console.error("Erro ao resetar prova:", err);
      alert("Erro ao resetar prova.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-xl font-semibold text-ogum-blue">
          Carregando permissões...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="p-8 bg-white shadow-xl rounded-lg text-center max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h1>
          <p className="text-slate-700">Você não tem permissão de administrador.</p>
          <p className="text-sm text-slate-500 mt-2">
            Se você deveria ter acesso, peça a um administrador para adicionar seu UID.
          </p>
        </div>
      </div>
    );
  }

  if (viewMode === 'results') {
    return (
      <div className="p-6 max-w-5xl mx-auto min-h-screen bg-slate-100">
        <button onClick={() => setViewMode('dashboard')} className="mb-6 bg-slate-500 text-white px-5 py-2 rounded-lg font-medium hover:bg-slate-600 transition-colors cursor-pointer">
          &larr; Voltar ao Dashboard
        </button>
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-6 text-ogum-blue">Resultados da Prova</h2>
          {selectedResults.length === 0 ? ( <p>Nenhum aluno concluiu esta prova ainda.</p> ) : (
            <ul className="divide-y divide-slate-200">
              {selectedResults.map(r => (
                <li key={r.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center">
                  <div>
                    <p className="font-semibold text-slate-800">{r.name} ({r.email})</p>
                    <p>Pontuação: <span className="font-bold text-ogum-blue">{r.score} / {r.total}</span></p>
                    {r.finishedAt && <p className="text-sm text-slate-500">Data: {new Date(r.finishedAt.seconds * 1000).toLocaleString()}</p>}
                  </div>
                  <button 
                    onClick={() => showResultDetails(r)}
                    className="mt-2 md:mt-0 bg-ogum-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-opacity-80 transition-all cursor-pointer"
                  >
                    Ver Detalhes
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'resultDetails') {
    if (!detailedResult || !currentExamQuestions) { return <div className="p-6">Carregando...</div>; }
    return (
      <div className="p-6 max-w-2xl mx-auto min-h-screen bg-slate-100">
        <button onClick={() => setViewMode('results')} className="mb-6 bg-slate-500 text-white px-5 py-2 rounded-lg font-medium hover:bg-slate-600 transition-colors cursor-pointer">
          &larr; Voltar para Resultados
        </button>
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-2 text-ogum-blue">Detalhes de {detailedResult.name}</h2>
          <p className="text-xl mb-6">Pontuação: <span className="font-bold">{detailedResult.score} / {detailedResult.total}</span></p>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 border-b pb-2 text-slate-700">Gabarito do Aluno</h3>
            <ul className="space-y-3 mt-4">
              {currentExamQuestions.map((q, index) => {
                const userAnswer = detailedResult.answers[q.id];
                const isCorrect = userAnswer === q.correct;
                return (
                  <li key={q.id} className={`p-4 rounded-lg border-l-4 ${isCorrect ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                    <p className="font-semibold text-slate-800">{index + 1}. {q.text}</p>
                    <p className="mt-2">Resposta do Aluno: <span className="font-bold">{userAnswer || '(Em branco)'}</span></p>
                    <p>Resposta Correta: <span className="font-bold">{q.correct}</span></p>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="mt-8 border-t-2 border-red-200 pt-6">
            <button
              onClick={handleResetProvaAluno}
              className="w-full bg-red-600 text-white px-5 py-3 rounded-lg font-bold hover:bg-red-700 transition-colors cursor-pointer"
            >
              Resetar Prova deste Aluno
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentExam) {
    const { name, day } = currentExam;
    return (
      <div className="p-6 max-w-5xl mx-auto min-h-screen bg-slate-100">
        <button onClick={() => setCurrentExam(null)} className="mb-6 bg-slate-500 text-white px-5 py-2 rounded-lg font-medium hover:bg-slate-600 transition-colors cursor-pointer">
          &larr; Voltar ao Dashboard
        </button>
        
        <div className="bg-white p-8 rounded-lg shadow-lg mb-8">
          <h1 className="text-3xl font-bold mb-4 text-ogum-blue">{name} - {day}</h1>
          <p className="mb-4 font-semibold text-slate-700">Sugestão de criação de questões:</p>
          {Object.entries(SUGGESTED_QUESTIONS_BY_DAY[day] || {}).map(([t,count])=>{
            const current = countByTema[t]||0;
            return <p key={t} className={`${current > count ? 'text-red-500' : 'text-slate-600'} text-sm`}>
              {current} / {count} Questões {t}
            </p>
          })}
        </div>

        <div className="my-6 p-8 border rounded-lg shadow-lg bg-white">
          <h3 className="text-2xl font-semibold mb-5 text-ogum-blue">Adicionar Nova Questão</h3>
          <textarea className="border p-3 w-full mb-3 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-ogum-blue" placeholder="Digite a questão" value={text} onChange={e=>setText(e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            {['A','B','C','D','E'].map(l=>(<input key={l} className="border p-3 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-ogum-blue" placeholder={`Opção ${l}`} value={options[l]} onChange={e=>setOptions({...options,[l]:e.target.value})}/>))}
          </div>
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="mr-2 text-slate-600">Tema:</label>
              <select value={tema} onChange={e=>setTema(e.target.value)} className="border p-2 rounded-lg cursor-pointer">
                <option value="">Selecione o tema</option>
                {THEMES.map(t=> <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mr-2 text-slate-600">Resposta correta:</label>
              <select value={correct} onChange={e=>setCorrect(e.target.value)} className="border p-2 rounded-lg cursor-pointer">
                {['A','B','C','D','E'].map(l=><option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-slate-600">Imagem (opcional): </label>
            <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
            {previewURL && <img src={previewURL} alt="Preview" className="my-3 max-w-xs rounded-lg shadow-sm" />}
          </div>
          <button onClick={handleAddQuestion} className="bg-ogum-blue text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:bg-opacity-80 transition-all cursor-pointer">Adicionar questão</button>
        </div>

        <div className="my-8 text-center">
            <button onClick={handlePublishProva} className="bg-ogum-green text-white px-8 py-3 rounded-lg font-bold text-lg shadow-xl hover:bg-opacity-80 transition-all cursor-pointer">
              Publicar / Atualizar Prova
            </button>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-ogum-blue">Questões cadastradas ({questions.length})</h2>
          <ul className="divide-y divide-slate-200">
            {questions.map(q=>(
              <li key={q.id} className="py-5">
                <p className="font-semibold whitespace-pre-wrap text-slate-800">{q.text}</p>
                <p className="text-sm text-slate-500 mt-1">Tema: {q.tema}</p>
                {q.imageBase64 && <img src={q.imageBase64} alt="Questão" className="my-2 max-w-xs rounded-lg" />}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 my-2">
                  {['A','B','C','D','E'].map(k=>{
                    const v = q.options[k];
                    return <div key={k} className={`p-2 rounded text-sm ${q.correct===k?'bg-green-100 text-green-800':'bg-slate-50 text-slate-700'}`}>{k}: {v}</div>
                  })}
                </div>
                <button onClick={()=>handleDeleteQuestion(q.id)} className="bg-red-600 text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-red-700 transition-colors cursor-pointer mt-3">Deletar</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto min-h-screen bg-slate-100">
      <h1 className="text-4xl font-bold mb-8 text-center text-ogum-green mt-4">
        Painel Semente de Ogum
      </h1>

      <div className="mb-8 p-8 bg-white rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-5 text-ogum-blue">Criar ou Editar Prova</h2>
        <p className="text-sm text-slate-600 mb-4">Digite o nome e o dia da prova que deseja criar ou editar as questões.</p>
        <div className="flex flex-col md:flex-row gap-3">
          <input 
            className="border p-3 w-full md:w-1/2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-ogum-blue" 
            placeholder="Nome da Prova (Ex: Enem 2024)" 
            value={newExamName} 
            onChange={e=>setNewExamName(e.target.value)} 
          />
          <select 
            className="border p-3 w-full md:w-1/4 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-ogum-blue cursor-pointer bg-white" 
            value={newExamDay} 
            onChange={e=>setNewExamDay(e.target.value)}
          >
            <option value="">Selecione o dia</option>
            <option value="Dia 1">Dia 1</option>
            <option value="Dia 2">Dia 2</option>
          </select>
          <button 
            className="bg-ogum-blue text-white px-5 py-3 rounded-lg font-semibold shadow-lg hover:bg-opacity-80 transition-all cursor-pointer"
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

      <div className="mb-8 p-8 bg-white rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-5 text-ogum-blue">Provas Publicadas</h2>
        {provas.length === 0 ? (
          <p className="text-slate-500">Nenhuma prova foi publicada ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {provas.map(p => (
              <li key={p.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                  <p className="text-xl font-semibold text-slate-800">{p.name} - {p.day}</p>
                  <p className="text-sm text-slate-500">Questões: {p.questionCount || 'N/A'}</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-3 md:mt-0">
                  <button 
                    onClick={() => setCurrentExam({ name: p.name, day: p.day })} 
                    className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors cursor-pointer"
                  >
                    Editar Questões
                  </button>
                  <button 
                    onClick={() => handleShowResults(p.id)}
                    className="bg-ogum-green text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-opacity-80 transition-colors cursor-pointer"
                  >
                    Ver Resultados
                  </button>
                  <button 
                    onClick={() => handleDeleteProva(p.id)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    Despublicar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-8 p-8 bg-white rounded-lg shadow-xl border-t-4 border-ogum-green">
        <h2 className="text-2xl font-bold mb-5 text-ogum-green">Gerenciamento</h2>
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div>
            <p className="text-slate-700">Adicionar novos administradores ao sistema.</p>
            <p className="text-sm text-slate-500 mt-1">Consulte o programador para adicionar outros administradores.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)} // <-- ABRE O MODAL
            className="bg-slate-700 text-white px-5 py-3 rounded-lg font-semibold shadow-lg hover:bg-slate-800 transition-all cursor-pointer w-full md:w-auto"
          >
            Gerenciar Admins
          </button>
        </div>
      </div>

      <ManageAdmins 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}