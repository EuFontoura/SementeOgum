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
          await setDoc(ref, { 
            uid: u.uid, 
            email: u.email, 
            name: u.displayName,
            role: 'aluno', 
            createdAt: serverTimestamp() 
          })
        }
        const data = (await getDoc(ref)).data()
        if (data?.role === 'admin') navigate('/admin')
        else navigate('/student')
      }
    })
    return () => unsub()
  }, [navigate])

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-slate-100'>
        <div className='text-xl font-semibold text-ogum-blue'>
          Carregando...
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-slate-100 p-4'>
      <div className='bg-white shadow-xl rounded-lg p-10 w-full max-w-md text-center'>
        <h1 className='text-4xl font-bold text-ogum-green mb-4'>
          Semente de Ogum
        </h1>
        <p className='mb-8 text-slate-600'>
          Faça login com sua conta Google para acessar a plataforma.
        </p>
        <button
          onClick={async () => { await signInWithGoogle() }}
          className='w-full py-3 rounded-lg bg-ogum-green text-white font-bold text-lg shadow-lg hover:bg-opacity-80 transition-all cursor-pointer'
        >
          Entrar com Google
        </button>
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
      } else {
        setLoading(false) 
      }
    })
    return () => unsub()
  }, [navigate, role])

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-slate-100'>
        <div className='text-xl font-semibold text-ogum-blue'>
          Verificando autenticação...
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-slate-100'>
      <TopBar onSignOut={() => signOut(auth)} />
      <div>{children}</div>
    </div>
  )
}

function TopBar({ onSignOut }){
  return (
    <div className='bg-white shadow-lg p-4 flex justify-between items-center sticky top-0 z-20'>
      <div className='font-bold text-2xl text-ogum-green'>
        Semente de Ogum
      </div>
      <div>
        <button 
          onClick={onSignOut} 
          className='px-4 py-2 text-slate-600 font-medium rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer'
        >
          Sair
        </button>
      </div>
    </div>
  )
}