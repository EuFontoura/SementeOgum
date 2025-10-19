import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(() => auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const adminDocRef = doc(db, "admins", user.uid);
          const adminSnap = await getDoc(adminDocRef);

          setIsAdmin(adminSnap.exists());
          setUser(user);
        } catch (error) {
          console.error("Erro ao verificar permissão de admin:", error);
          setIsAdmin(false);
          setUser(user);
        }
      } else {
        setIsAdmin(false);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, isAdmin, loading };
}
