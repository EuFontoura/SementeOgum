import React, { useState, useEffect } from 'react';
import { db, serverTimestamp } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';

export default function Admin() {
  const [step, setStep] = useState(1);
  const [examName, setExamName] = useState('');
  const [day, setDay] = useState('');
  const [tema, setTema] = useState('');
  const [text, setText] = useState('');
  const [options, setOptions] = useState({A:'',B:'',C:'',D:'',E:''});
  const [correct, setCorrect] = useState('A');
  const [imageBase64, setImageBase64] = useState('');
  const [previewURL, setPreviewURL] = useState('');
  const [questions, setQuestions] = useState([]);
  const [provas, setProvas] = useState([]);
  const [resultsList, setResultsList] = useState([]);

  const THEMES = ["Linguagens","Ciências Humanas","Ciências da Natureza","Matemática"];
  const SUGGESTED_QUESTIONS_BY_DAY = {
    "Dia 1": { "Linguagens": 45, "Ciências Humanas": 45 },
    "Dia 2": { "Ciências da Natureza": 45, "Matemática": 45 }
  };

  useEffect(() => {
    if (!examName || !day) return;

    async function fetchQuestions() {
      try {
        const colRef = collection(db, 'exams', examName, 'days', day, 'questions');
        const snap = await getDocs(colRef);
        setQuestions(snap.docs.map(d=>({id:d.id,...d.data()})));
      } catch (err) {
        console.error("Erro fetchQuestions:", err);
      }
    }

    async function fetchProvas() {
      const snap = await getDocs(collection(db, 'provas'));
      setProvas(snap.docs.map(d=>({id:d.id,...d.data()})));
    }

    async function fetchResults() {
      const snap = await getDocs(collection(db, 'results'));
      setResultsList(snap.docs.map(d=>({id:d.id,...d.data()})));
    }

    fetchQuestions();
    fetchProvas();
    fetchResults();
  }, [examName, day]);

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
    try {
      const colRef = collection(db, 'exams', examName, 'days', day, 'questions');
      await addDoc(colRef,{
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
      const snap = await getDocs(colRef);
      setQuestions(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch(err){
      console.error(err);
      alert("Erro ao adicionar questão. Verifique suas permissões.");
    }
  }

  async function handleDeleteQuestion(questionId){
    if(!confirm("Deseja realmente deletar esta questão?")) return;
    try {
      await deleteDoc(doc(db, 'exams', examName, 'days', day, 'questions', questionId));
      setQuestions(prev=>prev.filter(q=>q.id!==questionId));
    } catch(err){
      console.error(err);
      alert("Erro ao deletar questão.");
    }
  }

  async function handleCreateProva() {
    if(!examName || !day) return alert("Selecione a prova e o dia");
    if(questions.length===0) return alert("Não há questões para criar a prova");

    try {
      const provaRef = doc(collection(db, 'provas'));
      await setDoc(provaRef,{
        name: examName,
        day,
        questions,
        createdAt: serverTimestamp()
      });
      alert("Prova criada com sucesso!");
      setExamName('');
      setDay('');
      setQuestions([]);
    } catch(err){
      console.error(err);
      alert("Erro ao criar a prova. Verifique permissões.");
    }
  }

  if(step===1){
    return (
      <div className="p-6 max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-4">Nome da prova</h2>
        <input className="border p-2 w-full mb-2" placeholder="Ex: Enem 1" value={examName} onChange={e=>setExamName(e.target.value)} />
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={()=>{if(!examName)return alert("Digite o nome da prova"); setStep(2);}}>Continuar</button>
      </div>
    )
  }

  if(step===2){
    return (
      <div className="p-6 max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-4">Selecione o dia</h2>
        <select className="border p-2 w-full mb-2" value={day} onChange={e=>setDay(e.target.value)}>
          <option value="">Selecione o dia</option>
          <option value="Dia 1">Dia 1</option>
          <option value="Dia 2">Dia 2</option>
        </select>
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={()=>{if(!day)return alert("Selecione o dia"); setStep(3);}}>Continuar</button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{examName} - {day}</h1>

      <p className="mb-4 font-semibold">Sugestão de criação de questões:</p>
      {Object.entries(SUGGESTED_QUESTIONS_BY_DAY[day] || {}).map(([t,count])=>{
        const current = countByTema[t]||0;
        return <p key={t}>{current} / {count} Questões {t}</p>
      })}

      <div className="my-4">
        <textarea className="border p-2 w-full mb-2" placeholder="Digite a questão" value={text} onChange={e=>setText(e.target.value)} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
          {['A','B','C','D','E'].map(l=>(<input key={l} className="border p-2" placeholder={`Opção ${l}`} value={options[l]} onChange={e=>setOptions({...options,[l]:e.target.value})}/>))}
        </div>

        <div className="mb-2">
          <label className="mr-2">Tema:</label>
          <select value={tema} onChange={e=>setTema(e.target.value)} className="border p-1">
            <option value="">Selecione o tema</option>
            {THEMES.map(t=> <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="mb-2">
          <label className="mr-2">Resposta correta:</label>
          <select value={correct} onChange={e=>setCorrect(e.target.value)} className="border p-1">
            {['A','B','C','D','E'].map(l=><option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="mb-2">
          <label>Imagem (opcional): </label>
          <input type="file" accept="image/*" onChange={handleImageChange} />
          {previewURL && <img src={previewURL} className="my-2 max-w-xs rounded" />}
        </div>

        <button onClick={handleAddQuestion} className="bg-blue-500 text-white px-4 py-2 rounded">Adicionar questão</button>
        <button onClick={handleCreateProva} className="bg-green-500 text-white px-4 py-2 rounded ml-2">Criar Prova</button>
      </div>

      <h2 className="text-xl font-bold mb-2">Questões cadastradas</h2>
      <ul>
        {questions.map(q=>(
          <li key={q.id} className="mb-2 border p-2 rounded">
            <p className="font-semibold">{q.text}</p>
            <p>Tema: {q.tema}</p>
            {q.imageBase64 && <img src={q.imageBase64} className="my-2 max-w-xs rounded" />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-2">
              {['A','B','C','D','E'].map(k=>{
                const v = q.options[k];
                return <div key={k} className={`p-1 ${q.correct===k?'bg-green-200':'bg-gray-100'}`}>{k}: {v}</div>
              })}
            </div>
            <button onClick={()=>handleDeleteQuestion(q.id)} className="bg-red-500 text-white px-2 py-1 rounded">Deletar</button>
          </li>
        ))}
      </ul>

      <h2 className="text-xl font-bold mt-4 mb-2">Provas criadas</h2>
      <ul>
        {provas.map(p=><li key={p.id}>{p.name} - {p.day}</li>)}
      </ul>
    </div>
  )
}
