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
  // currentExam controla qual prova estamos editando. Se null, mostra o dashboard.
  const [currentExam, setCurrentExam] = useState(null); // Ex: { name: 'Enem 1', day: 'Dia 1' }
  // viewMode controla se estamos vendo o dashboard, ou a tela de resultados.
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' | 'results'

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
  const [questions, setQuestions] = useState([]); // Questões da prova *selecionada*
  const [provas, setProvas] = useState([]); // Lista de provas *publicadas*
  const [resultsList, setResultsList] = useState([]); // Lista de *todos* os resultados
  const [selectedResults, setSelectedResults] = useState([]); // Resultados da prova *selecionada*

  const THEMES = ["Linguagens","Ciências Humanas","Ciências da Natureza","Matemática"];
  const SUGGESTED_QUESTIONS_BY_DAY = {
    "Dia 1": { "Linguagens": 45, "Ciências Humanas": 45 },
    "Dia 2": { "Ciências da Natureza": 45, "Matemática": 45 }
  };

  // --- Efeitos (Hooks) ---

  // Busca provas publicadas e todos os resultados no início
  useEffect(() => {
    async function fetchProvas() {
      const snap = await getDocs(collection(db, 'provas'));
      setProvas(snap.docs.map(d=>({id:d.id,...d.data()})));
    }
    async function fetchResults() {
      const snap = await getDocs(collection(db, 'results'));
      setResultsList(snap.docs.map(d=>({id:d.id,...d.data()})));
    }
    fetchProvas();
    fetchResults();
  }, []);

  // Busca as questões *apenas* quando uma prova é selecionada para edição
  useEffect(() => {
    if (!currentExam) {
      setQuestions([]); // Limpa as questões se nenhuma prova estiver selecionada
      return;
    }

    async function fetchQuestions() {
      try {
        const { name, day } = currentExam;
        const colRef = collection(db, 'exams', name, 'days', day, 'questions');
        // Ordena pela data de criação
        const q = query(colRef, orderBy('createdAt', 'asc')); 
        const snap = await getDocs(q);
        setQuestions(snap.docs.map(d=>({id:d.id,...d.data()})));
      } catch (err) {
        console.error("Erro fetchQuestions:", err);
      }
    }
    fetchQuestions();
  }, [currentExam]); // Depende apenas da prova selecionada

  
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
      
      const newDoc = await addDoc(colRef,{
        text,
        options,
        correct,
        tema,
        imageBase64: imageBase64||null,
        createdAt: serverTimestamp()
      });

      // Limpa o formulário
      setText('');
      setOptions({A:'',B:'',C:'',D:'',E:''});
      setCorrect('A');
      setImageBase64('');
      setPreviewURL('');
      setTema('');
      
      // Atualiza a lista de questões localmente para não recarregar do DB
      // Adiciona o ID e um timestamp 'fake' para ordenação, ou apenas recarrega
      setQuestions(prev => [...prev, {
        id: newDoc.id, 
        text, options, correct, tema, imageBase64: imageBase64||null, 
        createdAt: { seconds: Date.now()/1000 } // Simula timestamp para ordenação
      }]);

    } catch(err){
      console.error(err);
      alert("Erro ao adicionar questão. Verifique suas permissões.");
    }
  }

  async function handleDeleteQuestion(questionId){
    if(!confirm("Deseja realmente deletar esta questão?")) return;
    if(!currentExam) return alert("Nenhuma prova selecionada");
    
    try {
      const { name, day } = currentExam;
      await deleteDoc(doc(db, 'exams', name, 'days', day, 'questions', questionId));
      setQuestions(prev=>prev.filter(q=>q.id!==questionId)); // Atualiza localmente
    } catch(err){
      console.error(err);
      alert("Erro ao deletar questão.");
    }
  }

  // --- Funções de Gerenciamento (Provas) ---

  // Esta função agora "Publica" ou "Atualiza" a prova na coleção 'provas'
  async function handlePublishProva() {
    if(!currentExam) return alert("Nenhuma prova selecionada");
    if(questions.length === 0) return alert("Adicione questões antes de publicar");

    try {
      const { name, day } = currentExam;
      
      // Tentamos achar uma prova *publicada* com esse nome e dia
      const existingProva = provas.find(p => p.name === name && p.day === day);
      
      const provaRef = existingProva 
        ? doc(db, 'provas', existingProva.id) // Atualiza a existente
        : doc(collection(db, 'provas')); // Cria uma nova

      await setDoc(provaRef, {
        name,
        day,
        // Note: O 'questions' aqui é usado pelo seu código original.
        // O Student.js ignora isso e busca da coleção 'exams', o que é bom.
        // Vamos manter assim para consistência.
        questions: questions.map(q => q.id), // Apenas IDs, ou a lista inteira se preferir
        questionCount: questions.length,
        updatedAt: serverTimestamp()
      }, { merge: true }); // Merge true para não sobrescrever createdAt se existir

      alert("Prova publicada/atualizada com sucesso!");
      
      // Atualiza a lista de provas localmente
      if (!existingProva) {
        setProvas(prev => [...prev, { id: provaRef.id, name, day, questionCount: questions.length }]);
      }
      
      setCurrentExam(null); // Volta para o dashboard
    } catch(err){
      console.error(err);
      alert("Erro ao publicar a prova. Verifique permissões.");
    }
  }

  // Despublica a prova (remove da lista 'provas')
  async function handleDeleteProva(provaId) {
    if(!confirm("Deseja realmente despublicar esta prova? Os alunos não poderão mais vê-la. (As questões NÃO serão apagadas).")) return;
    try {
      await deleteDoc(doc(db, 'provas', provaId));
      setProvas(prev => prev.filter(p => p.id !== provaId)); // Atualiza localmente
      alert("Prova despublicada.");
    } catch (err) {
      console.error(err);
      alert("Erro ao despublicar prova.");
    }
  }

  // Mostra a tela de resultados
  function handleShowResults(provaId) {
    const results = resultsList.filter(r => r.provaId === provaId);
    setSelectedResults(results);
    setViewMode('results');
  }

  // --- Renderização ---

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
              <li key={r.id} className="py-3">
                <p className="font-semibold">{r.name} ({r.email})</p>
                <p>Pontuação: <span className="font-bold">{r.score} / {r.total}</span></p>
                <p>Data: {new Date(r.finishedAt?.seconds * 1000).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
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
                  <p className="text-sm text-gray-500">ID: {p.id}</p>
                </div>
                <div className="flex gap-2 mt-2 md:mt-0">
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