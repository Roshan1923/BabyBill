import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { API_URL } from '../config/api';

const CreditsContext = createContext();



export function CreditsProvider({ children }) {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch credit balance from backend
  const fetchCredits = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch(`${API_URL}/credits/balance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const balance = await response.json();
        setCredits(balance);
        return balance;
      }
      return null;
    } catch (error) {
      console.log('Failed to fetch credits:', error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Update credits from a scan/process response (avoids extra API call)
  const updateCreditsFromResponse = useCallback((responseCredits) => {
    if (!responseCredits) return;
    setCredits((prev) => ({
      ...(prev || {}),
      tier: responseCredits.tier,
      is_active: responseCredits.is_active,
      free_remaining: responseCredits.free_remaining,
      sub_remaining: responseCredits.sub_remaining,
      sub_limit: responseCredits.sub_limit,
      topup_remaining: responseCredits.topup_remaining,
      sub_period_end: responseCredits.sub_period_end,
    }));
  }, []);

  // Computed: total usable remaining credits (respects bucket freeze rules)
  const totalRemaining = useMemo(() => {
    if (!credits) return 0;
    if (credits.unlimited) return Infinity;

    const topup = credits.topup_remaining || 0;

    if (credits.is_active) {
      // Subscribed: sub + topup (free is frozen)
      return (credits.sub_remaining || 0) + topup;
    } else {
      // Free tier: free + topup (sub doesn't exist)
      return (credits.free_remaining || 0) + topup;
    }
  }, [credits]);

  // Can the user scan right now? (local check for UX — backend is final authority)
  const canScan = useMemo(() => {
    if (!credits) return true; // Don't block if credits haven't loaded yet
    if (credits.unlimited) return true;
    return totalRemaining > 0;
  }, [credits, totalRemaining]);

  // Current tier display name
  const tierName = useMemo(() => {
    if (!credits) return 'Free';
    switch (credits.tier) {
      case 'essential': return 'Essential';
      case 'premium': return 'Premium';
      default: return 'Free';
    }
  }, [credits]);

  // Is the user on a paid subscription?
  const isSubscribed = useMemo(() => {
    return credits?.is_active === true;
  }, [credits]);

  // Display-friendly remaining for the active bucket
  const activeRemaining = useMemo(() => {
    if (!credits) return { remaining: 0, limit: 0, label: 'Free' };
    if (credits.unlimited) return { remaining: '∞', limit: '∞', label: 'Unlimited' };

    if (credits.is_active) {
      return {
        remaining: credits.sub_remaining || 0,
        limit: credits.sub_limit || 0,
        label: credits.tier === 'premium' ? 'Premium' : 'Essential',
      };
    } else {
      return {
        remaining: credits.free_remaining || 0,
        limit: 10,
        label: 'Free',
      };
    }
  }, [credits]);

  return (
    <CreditsContext.Provider
      value={{
        // Raw state
        credits,
        creditsLoading: loading,

        // Actions
        fetchCredits,
        updateCreditsFromResponse,

        // Computed helpers
        totalRemaining,
        canScan,
        tierName,
        isSubscribed,
        activeRemaining,
      }}
    >
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (!context) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}
