import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { auth, db, signInWithGoogle, serverTimestamp } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import Admin from './pages/Admin'
import Student from './pages/Student'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<AuthGate />} />
        <Route path='/admin' element={<RequireAuth role='admin'><Admin/></RequireAuth>} />
        <Route path='/student' element={<RequireAuth role='aluno'><Student/></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  )
}

function AuthGate() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setLoading(false)
      if (u) {
        const ref = doc(db, 'users', u.uid)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          await setDoc(ref, { uid: u.uid, email: u.email, role: 'aluno', createdAt: serverTimestamp() })
        }
        const data = (await getDoc(ref)).data()
        if (data?.role === 'admin') navigate('/admin')
        else navigate('/student')
      }
    })
    return () => unsub()
  }, [navigate])

  if (loading) return <div className='p-6'>Carregando...</div>

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-100'>
      <div className='bg-white shadow rounded p-8 w-full max-w-md'>
        <h1 className='text-2xl font-bold mb-4'>Simulador ENEM</h1>
        <p className='mb-6'>Autentique com Google para começar (admin / aluno por role no Firestore).</p>
        <button
          onClick={async () => { await signInWithGoogle() }}
          className='w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-700'
        >Entrar com Google</button>
      </div>
    </div>
  )
}

function RequireAuth({ children, role }){
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setLoading(false); navigate('/'); return }
      setUser(u)
      const ref = doc(db, 'users', u.uid)
      const snap = await getDoc(ref)
      const data = snap.exists() ? snap.data() : null
      if (!data || data.role !== role) {
        if (data?.role === 'admin') navigate('/admin')
        else navigate('/student')
      }
      setLoading(false)
    })
    return () => unsub()
  }, [navigate, role])

  if (loading) return <div className='p-6'>Verificando autenticação...</div>

  return (
    <div>
      <TopBar onSignOut={() => signOut(auth)} />
      <div className='p-6'>{children}</div>
    </div>
  )
}

function TopBar({ onSignOut }){
  return (
    <div className='bg-white shadow p-4 flex justify-between items-center'>
      <div className='font-bold'>Simulador ENEM</div>
      <div>
        <button onClick={onSignOut} className='px-3 py-1 border rounded'>Sair</button>
      </div>
    </div>
  )
}