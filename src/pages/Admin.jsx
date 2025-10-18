import React, { useState, useEffect } from 'react';
import { db, serverTimestamp } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';

export default function Admin() {
  const [questions, setQuestions] = useState([]);
  const [resultsList, setResultsList] = useState([]);
  const [text, setText] = useState('');
  const [options, setOptions] = useState({ A: '', B: '', C: '', D: '', E: '' });
  const [correct, setCorrect] = useState('A');
  const [imageBase64, setImageBase64] = useState('');
  const [previewURL, setPreviewURL] = useState('');
  const [exam, setExam] = useState('');
  const [day, setDay] = useState('');
  const [tema, setTema] = useState('');

  const SUGGESTED_QUESTIONS = {
    "Linguagens": 45,
    "Ciências Humanas": 45,
    "Ciências da Natureza": 45,
    "Matemática": 45
  };

  // Buscar questões de todas as provas
  useEffect(() => {
    async function fetchQuestions() {
      const examsSnap = await getDocs(collection(db, 'exams'));
      let allQuestions = [];

      for (const examDoc of examsSnap.docs) {
        const examName = examDoc.id;
        const daysSnap = await getDocs(collection(db, `exams/${examName}`));
        for (const dayDoc of daysSnap.docs) {
          const dayName = dayDoc.id;
          const questionsSnap = await getDocs(collection(db, `exams/${examName}/${dayName}/questions`));
          questionsSnap.forEach(q => {
            allQuestions.push({ id: q.id, exam: examName, day: dayName, ...q.data() });
          });
        }
      }

      setQuestions(allQuestions);
    }

    async function fetchResults() {
      const snap = await getDocs(collection(db, 'results'));
      setResultsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }

    fetchQuestions();
    fetchResults();
  }, []);

  // Contagem por tema
  const countByTema = questions.reduce((acc, q) => {
    acc[q.tema] = (acc[q.tema] || 0) + 1;
    return acc;
  }, {});

  // Upload de imagem
  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) {
      setImageBase64('');
      setPreviewURL('');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result);
      setPreviewURL(reader.result);
    };
    reader.readAsDataURL(file);
  }

  // Adicionar questão
  async function handleAddQuestion() {
    if (!text || !exam || !day || !tema) return alert("Preencha todos os campos obrigatórios.");

    const colRef = collection(db, `exams/${exam}/${day}/questions`);
    await addDoc(colRef, {
      text,
      options,
      correct,
      tema,
      imageBase64: imageBase64 || null,
      createdAt: serverTimestamp()
    });

    // Reset form
    setText('');
    setOptions({ A: '', B: '', C: '', D: '', E: '' });
    setCorrect('A');
    setImageBase64('');
    setPreviewURL('');
    setExam('');
    setDay('');
    setTema('');

    // Atualiza questões
    const questionsSnap = await getDocs(colRef);
    const newQuestions = questionsSnap.docs.map(q => ({ id: q.id, exam, day, ...q.data() }));
    setQuestions(prev => [...prev, ...newQuestions]);
  }

  // Deletar questão
  async function handleDeleteQuestion(exam, day, questionId) {
    if (!confirm("Tem certeza que deseja deletar esta questão?")) return;
    await deleteDoc(doc(db, `exams/${exam}/${day}/questions`, questionId));
    setQuestions(prev => prev.filter(q => q.id !== questionId));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin - Criar Questão</h1>

      {/* Seleção de Exame, Dia, Tema */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <div>
          <label className="mr-2">Exame:</label>
          <select value={exam} onChange={e => setExam(e.target.value)} className="border p-1 w-full">
            <option value="">Selecione</option>
            <option value="Enem 1">Enem 1</option>
            <option value="Enem 2">Enem 2</option>
          </select>
        </div>
        <div>
          <label className="mr-2">Dia:</label>
          <select value={day} onChange={e => setDay(e.target.value)} className="border p-1 w-full">
            <option value="">Selecione</option>
            <option value="Dia 1">Dia 1</option>
            <option value="Dia 2">Dia 2</option>
          </select>
        </div>
        <div>
          <label className="mr-2">Tema:</label>
          <select value={tema} onChange={e => setTema(e.target.value)} className="border p-1 w-full">
            <option value="">Selecione</option>
            {Object.keys(SUGGESTED_QUESTIONS).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <textarea
        className="border p-2 w-full mb-2"
        placeholder="Digite a questão"
        value={text}
        onChange={e => setText(e.target.value)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        {['A','B','C','D','E'].map(l=>(
          <input 
            key={l} 
            className="border p-2" 
            placeholder={`Opção ${l}`} 
            value={options[l]} 
            onChange={e=>setOptions({...options,[l]:e.target.value})}
          />
        ))}
      </div>

      <div className="mb-2">
        <label className="mr-2">Resposta correta:</label>
        <select value={correct} onChange={e=>setCorrect(e.target.value)} className="border p-1">
          {['A','B','C','D','E'].map(l=><option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="mb-2">
        <label>Imagem da questão (opcional): </label>
        <input type="file" accept="image/*" onChange={handleImageChange} />
        {previewURL && <img src={previewURL} className="my-2 max-w-xs rounded" />}
      </div>

      <button onClick={handleAddQuestion} className="bg-blue-500 text-white px-4 py-2 rounded mb-4">Adicionar questão</button>

      {/* Contagem por tema */}
      <div className="mb-4">
        {Object.keys(SUGGESTED_QUESTIONS).map(t=>{
          const current = countByTema[t] || 0;
          return <p key={t}>{current} / {SUGGESTED_QUESTIONS[t]} Questões {t}</p>
        })}
      </div>

      {/* Lista de questões */}
      <h2 className="text-xl font-bold mb-2">Questões cadastradas</h2>
      <ul>
        {questions.map(q=>(
          <li key={q.id} className="mb-2 border p-2 rounded">
            <p className="font-semibold">{q.text}</p>
            <p>Exame: {q.exam} | Dia: {q.day} | Tema: {q.tema}</p>
            {q.imageBase64 && <img src={q.imageBase64} className="my-2 max-w-xs rounded" />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-2">
              {['A','B','C','D','E'].map(k=>{
                const v = q.options[k];
                return <div key={k} className={`p-1 ${q.correct===k?'bg-green-200':'bg-gray-100'}`}>{k}: {v}</div>
              })}
            </div>
            <button 
              onClick={()=>handleDeleteQuestion(q.exam, q.day, q.id)}
              className="bg-red-500 text-white px-2 py-1 rounded"
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>

      {/* Lista de resultados dos alunos */}
      <h2 className="text-xl font-bold mt-6 mb-2">Resultados dos Alunos</h2>
      <ul>
        {resultsList.map(r=>(
          <li key={r.id} className="mb-2 border p-2 rounded">
            <p>Aluno: {r.id} | Pontuação: {r.score || 0} / {r.total || '-'}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
