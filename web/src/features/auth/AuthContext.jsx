import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "../../lib/firebase";
import { apiFetch } from "../../lib/api";

const AuthContext = createContext(null);

const STAFF_ROLES = ["admin", "kitchen", "rider"];

const ERROR_MESSAGES = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/user-not-found": "No account found with this email.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/popup-blocked":
    "Your browser blocked the sign-in popup. Allow popups and try again.",
  "auth/network-request-failed":
    "Network error. Check your internet connection.",
};

const friendly = (error) =>
  new Error(
    ERROR_MESSAGES[error?.code] || "Something went wrong. Please try again."
  );

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("customer");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Reads the role from the login token and makes sure the server has a
  // profile record for this user.
  const loadAccount = useCallback(async (firebaseUser, extra = {}) => {
    const token = await firebaseUser.getIdTokenResult();
    setRole(token.claims.role || "customer");

    try {
      const saved = await apiFetch("/users/me", {
        method: "POST",
        body: extra,
      });
      setProfile(saved);
    } catch (error) {
      console.error(error);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await loadAccount(firebaseUser);
      } else {
        setRole("customer");
        setProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [loadAccount]);

  const signInEmail = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      throw friendly(error);
    }
  };

  const signUpEmail = async ({ name, phone, email, password }) => {
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      if (name.trim()) {
        await updateProfile(credential.user, { displayName: name.trim() });
      }

      await loadAccount(credential.user, {
        displayName: name.trim(),
        phone: phone.trim(),
      });
    } catch (error) {
      throw friendly(error);
    }
  };

 const signInGoogle = async () => {
  try {
    const credential = await signInWithPopup(auth, googleProvider);

    await loadAccount(credential.user, {
      displayName: credential.user.displayName || "",
      phone: "",
    });
  } catch (error) {
    throw friendly(error);
  }
};

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error) {
      throw friendly(error);
    }
  };

  const logout = () => signOut(auth);

  // Use after a role changes so the new role is picked up without logging out.
  const refreshAccount = async () => {
    if (!auth.currentUser) return;

    await auth.currentUser.getIdToken(true);
    await loadAccount(auth.currentUser);
  };

  const value = {
    user,
    profile,
    role,
    isStaff: STAFF_ROLES.includes(role),
    loading,
    signInEmail,
    signUpEmail,
    signInGoogle,
    resetPassword,
    logout,
    refreshAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) throw new Error("useAuth must be used inside AuthProvider.");

  return context;
}
