import React, { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export function ManageAdmins() {
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
      const adminDocRef = doc(db, "admins", uid);

      await setDoc(adminDocRef, {
        name: userName || "Admin (Nome não fornecido)",
        addedAt: serverTimestamp(),
        addedBy: getAuth().currentUser.uid,
      });

      setMessage(`Sucesso! O usuário (UID: ${uid}) agora é um administrador.`);
      setUid("");
      setUserName("");
    } catch (err) {
      console.error(err);
      setError(
        "Erro ao adicionar admin. Você tem permissão ou o UID está correto?"
      );
    }
    setLoading(false);
  };

  return (
    <div className="my-8 p-4 border rounded-lg shadow border-purple-300">
      <h2 className="text-xl font-bold mb-4 text-purple-700">
        Gerenciar Administradores
      </h2>
      <p className="text-sm text-gray-600 mb-2">
        Para promover um usuário a admin, peça a ele que se logue no site, vá ao
        Firebase Console (Authentication), e lhe envie o UID dele.
      </p>

      {message && (
        <p className="mb-3 text-sm font-semibold text-green-700">{message}</p>
      )}
      {error && (
        <p className="mb-3 text-sm font-semibold text-red-700">{error}</p>
      )}

      <div className="flex flex-col md:flex-row gap-2">
        <input
          type="text"
          className="border p-2 w-full md:w-2/3"
          placeholder="Cole o UID do novo admin aqui"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
        />
        <input
          type="text"
          className="border p-2 w-full md:w-1/3"
          placeholder="Nome (Opcional)"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
        />
      </div>
      <button
        className="bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50 mt-2"
        onClick={handleMakeAdmin}
        disabled={loading}
      >
        {loading ? "Processando..." : "Tornar Admin"}
      </button>
    </div>
  );
}
