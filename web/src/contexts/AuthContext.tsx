import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  reload as reloadUser,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/api";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  rating: number;
  verified: boolean;
  emailVerified: boolean;
  createdAt?: Date;
  bio?: string;
  city?: string;
  walletBalance: number;
  subscriptionStatus: "free" | "premium";
  savedLocationName?: string;
  savedLocationAddress?: string;
  savedLocationLat?: number;
  savedLocationLng?: number;
  deliveryInstructions?: string;
  preferredCarriers?: string[];
  returnAddressName?: string;
  returnAddressDetails?: string;
  profileVisibility?: string;
  reviewsVisibility?: string;
  reviewNotifications?: boolean;
  showSubscriptionStatus?: boolean;
  totalDeliveries?: number;
  connectionsCount?: number;
  reviewsCount?: number;
  successRate?: number;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  googleLoading: boolean;
  error: string | null;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const mapProfile = (data: any, firebaseUser: User): UserProfile => ({
  id: firebaseUser.uid,
  name: data.name || firebaseUser.displayName || "",
  email: data.email || firebaseUser.email || "",
  phone: data.phone,
  photoUrl: data.photoUrl,
  rating: data.rating ?? 5.0,
  verified: data.verified ?? false,
  emailVerified: data.emailVerified ?? firebaseUser.emailVerified ?? false,
  createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
  bio: data.bio,
  city: data.city,
  walletBalance: data.walletBalance ?? 0,
  subscriptionStatus: data.subscriptionStatus || "free",
  savedLocationName: data.savedLocationName,
  savedLocationAddress: data.savedLocationAddress,
  savedLocationLat: data.savedLocationLat,
  savedLocationLng: data.savedLocationLng,
  deliveryInstructions: data.deliveryInstructions,
  preferredCarriers: data.preferredCarriers,
  returnAddressName: data.returnAddressName,
  returnAddressDetails: data.returnAddressDetails,
  profileVisibility: data.profileVisibility || "public",
  reviewsVisibility: data.reviewsVisibility || "public",
  reviewNotifications: data.reviewNotifications ?? true,
  showSubscriptionStatus: data.showSubscriptionStatus ?? false,
  totalDeliveries: data.totalDeliveries ?? 0,
  connectionsCount: data.connectionsCount ?? 0,
  reviewsCount: data.reviewsCount ?? 0,
  successRate: data.successRate ?? 100,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const syncProfile = useCallback(async (firebaseUser: User) => {
    try {
      await api.post("/api/users", {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
        email: firebaseUser.email || "",
        rating: 5.0,
        verified: false,
        emailVerified: firebaseUser.emailVerified,
        walletBalance: 0,
        subscriptionStatus: "free",
      });
      const data = await api.get<any>(`/api/users/${firebaseUser.uid}`);
      setProfile(mapProfile(data, firebaseUser));
    } catch (err) {
      console.error("Profile sync error:", err);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await syncProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [syncProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await syncProfile(cred.user);
    } catch (err: any) {
      setError(err.message || "Sign in failed");
      throw err;
    }
  }, [syncProfile]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try {
      setError(null);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await firebaseUpdateProfile(cred.user, { displayName: name });
      await api.post("/api/users", {
        id: cred.user.uid,
        name,
        email,
        rating: 5.0,
        verified: false,
        emailVerified: false,
        walletBalance: 0,
        subscriptionStatus: "free",
      });
      const data = await api.get<any>(`/api/users/${cred.user.uid}`);
      setProfile(mapProfile(data, cred.user));
    } catch (err: any) {
      setError(err.message || "Sign up failed");
      throw err;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      setError(null);
      setGoogleLoading(true);
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await syncProfile(cred.user);
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Google sign-in failed");
        throw err;
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [syncProfile]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
    setError(null);
  }, []);

  const resetPassword = useCallback((email: string) => {
    return sendPasswordResetEmail(auth, email);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await reloadUser(user);
      await syncProfile(user);
    }
  }, [user, syncProfile]);

  const updateUserProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!user) throw new Error("No authenticated user");
    try {
      const updated = await api.patch<any>(`/api/users/${user.uid}`, data);
      if (data.name) {
        await firebaseUpdateProfile(user, { displayName: data.name });
      }
      setProfile((prev) => prev ? { ...prev, ...updated } : null);
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
      throw err;
    }
  }, [user]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!user || !user.email) throw new Error("No authenticated user");
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    } catch (err: any) {
      setError(err.message || "Failed to change password");
      throw err;
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        googleLoading,
        error,
        clearError,
        signIn,
        signUp,
        signInWithGoogle,
        logout,
        resetPassword,
        refreshProfile,
        updateUserProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
