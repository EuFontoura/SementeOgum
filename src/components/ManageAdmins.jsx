import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { getAuth } from "firebase/auth"; 

export function ManageAdmins({ isOpen, onClose }) {
  const [uid, setUid] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleMakeAdmin = async () => {
    if (!uid) return setError("Por favor, digite o UID do usuário.");
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const adminDocRef = doc(db, 'admins', uid);
      
      await setDoc(adminDocRef, { 
        name: userName || "Admin (Nome não fornecido)",
        addedAt: serverTimestamp(),
        addedBy: getAuth().currentUser.uid 
      }); 
      
      setMessage(`Sucesso! O usuário (UID: ${uid}) agora é um administrador.`);
      setUid("");
      setUserName("");
    } catch (err) {
      console.error(err);
      setError("Erro ao adicionar admin. Você tem permissão ou o UID está correto?");
    }
    setLoading(false);
  };

  const handleClose = () => {
    setUid("");
    setUserName("");
    setMessage("");
    setError("");
    setLoading(false);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="relative bg-white p-8 rounded-xl shadow-2xl max-w-lg w-full z-50">
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title="Fechar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold mb-4 text-secondary-blue">Gerenciar Administradores</h2>
        <p className="text-sm text-slate-600 mb-6">
          Para promover um usuário a admin, peça a ele que se logue no site, vá ao 
          Firebase Console (Authentication), e lhe envie o UID dele.
        </p>
        
        {message && <p className="mb-4 text-sm font-semibold text-green-700 p-3 bg-green-50 rounded-lg">{message}</p>}
        {error && <p className="mb-4 text-sm font-semibold text-red-700 p-3 bg-red-50 rounded-lg">{error}</p>}
        
        <div className="flex flex-col gap-4">
          <input
            type="text"
            className="border p-3 w-full rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary-blue"
            placeholder="Cole o UID do novo admin aqui"
            value={uid}
            onChange={e => setUid(e.target.value)}
          />
          <input
            type="text"
            className="border p-3 w-full rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary-blue"
            placeholder="Nome (Opcional)"
            value={userName}
            onChange={e => setUserName(e.target.value)}
          />
        </div>
        <button
          className="bg-secondary-blue text-white w-full px-5 py-3 rounded-lg font-semibold disabled:opacity-50 mt-6 shadow-lg hover:bg-opacity-80 transition-all cursor-pointer"
          onClick={handleMakeAdmin}
          disabled={loading}
        >
          {loading ? "Processando..." : "Tornar Admin"}
        </button>
      </div>
    </div>
  );
}