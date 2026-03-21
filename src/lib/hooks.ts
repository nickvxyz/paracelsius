"use client";

import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import type { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle auth code from callback redirect
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (!error && data.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
        setLoading(false);
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return { user, session, loading, signOut };
}

export function usePatientProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("patient_profiles")
      .select("*")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        setProfile(data);
        setLoading(false);
      });
  }, [userId]);

  const refresh = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("patient_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(data);
  };

  return { profile, loading, refresh };
}

export function useSubscription(userId: string | undefined) {
  const [sub, setSub] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setSub(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        setSub(data);
        setLoading(false);
      });
  }, [userId]);

  const refresh = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single();
    setSub(data);
  };

  return { sub, loading, refresh };
}
