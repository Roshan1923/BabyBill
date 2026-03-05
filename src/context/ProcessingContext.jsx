import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { API_URL } from '../config/api';
import { useNotifications } from './NotificationContext';

const ProcessingContext = createContext();

// Statuses: uploading → processing → ready → reviewed | failed
const STATUS = {
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
  REVIEWED: 'reviewed',
};

export function ProcessingProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const [credits, setCredits] = useState(null);
  const jobsRef = useRef([]);
  const { addNotification } = useNotifications();

  // Keep ref in sync for use inside async callbacks
  const updateJobs = useCallback((updater) => {
    setJobs((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      jobsRef.current = next;
      return next;
    });
  }, []);

  // Get items for ToReview tab
  const getReviewItems = useCallback(() => {
    return jobsRef.current.filter(
      (j) => j.status !== STATUS.REVIEWED
    );
  }, []);

  // Get count of active (non-reviewed) items
  const getPendingCount = useCallback(() => {
    return jobsRef.current.filter(
      (j) => j.status !== STATUS.REVIEWED
    ).length;
  }, []);

  // Fetch credit balance from backend
  const fetchCredits = useCallback(async () => {
    try {
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
    }
  }, []);

  // Helper: get session token or throw
  const getSessionToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }
    return session.access_token;
  };

  // Start processing a batch of scans
  const processBatch = useCallback(async (scans) => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('ProcessingContext: No user logged in');
      return;
    }

    // Create job entries for each scan
    const newJobs = scans.map((scan) => ({
      id: scan.id,
      photoPath: scan.photoPath,
      rotation: scan.rotation || 0,
      status: STATUS.UPLOADING,
      storeName: null,
      receiptData: null,
      error: null,
      capturedAt: Date.now(),
    }));

    updateJobs((prev) => [...newJobs, ...prev]);

    // Process each scan in parallel
    newJobs.forEach((job) => {
      processOne(job);
    });
  }, [updateJobs]);

  // Process a single receipt
  const processOne = useCallback(async (job) => {
    try {
      // Update status to uploading
      updateJobStatus(job.id, STATUS.UPLOADING);

      // Get session token for auth
      const token = await getSessionToken();

      // Build form data (no user_id — backend gets it from JWT)
      const formData = new FormData();
      formData.append('image', {
        uri: 'file://' + job.photoPath,
        type: 'image/jpeg',
        name: `receipt_${Date.now()}.jpg`,
      });

      // Update status to processing
      updateJobStatus(job.id, STATUS.PROCESSING);

      // Send to backend with JWT auth
      const response = await fetch(`${API_URL}/process-receipt`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      // Update credits from response if available
      if (result.credits) {
        setCredits((prev) => ({ ...prev, ...result.credits }));
      }

      // Credit limit reached
      if (response.status === 403 && result.error === 'LIMIT_REACHED') {
        updateJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: STATUS.FAILED,
                  error: `You've used all ${result.credits_limit} scans this month. Resets ${new Date(result.period_end).toLocaleDateString()}.`,
                  isLimitReached: true,
                }
              : j
          )
        );
        addNotification({
          type: 'limit_reached',
          title: 'Scan Limit Reached',
          message: `You've used all ${result.credits_limit} free scans this month.`,
          data: { jobId: job.id },
        });
        return;
      }

      if (response.ok && result.success) {
        const store = result.receipt?.store_name || 'Receipt';
        // Success — update with receipt data
        updateJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: STATUS.READY,
                  storeName: store,
                  receiptData: result.receipt,
                  error: null,
                }
              : j
          )
        );
        // Notify
        addNotification({
          type: 'receipt_ready',
          title: 'Receipt Ready',
          message: `${store} — $${result.receipt?.total_amount || '0.00'} is ready to review.`,
          data: { jobId: job.id, receipt: result.receipt },
        });
      } else if (result.duplicate) {
        // Duplicate detected — mark as failed with clear message
        const store = result.receipt_data?.store_name || 'this store';
        const total = result.receipt_data?.total_amount || '?';
        updateJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: STATUS.FAILED,
                  storeName: store,
                  error: `Duplicate receipt: A receipt from ${store} for $${total} on the same date already exists.`,
                  isDuplicate: true,
                  duplicateData: result.receipt_data,
                  duplicateImagePath: result.image_path,
                }
              : j
          )
        );
        addNotification({
          type: 'duplicate',
          title: 'Duplicate Detected',
          message: `A receipt from ${store} for $${total} already exists.`,
          data: { jobId: job.id },
        });
      } else {
        // Backend returned error
        updateJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: STATUS.FAILED,
                  error: result.error || 'Processing failed. Please try again.',
                }
              : j
          )
        );
        addNotification({
          type: 'receipt_failed',
          title: 'Processing Failed',
          message: result.error || 'A receipt failed to process. Tap to retry.',
          data: { jobId: job.id },
        });
      }
    } catch (error) {
      // Network or other error
      updateJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                status: STATUS.FAILED,
                error: error.message || 'Network error',
              }
            : j
        )
      );
    }
  }, [updateJobs]);

  // Update a single job's status
  const updateJobStatus = useCallback((jobId, status) => {
    updateJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status } : j))
    );
  }, [updateJobs]);

  // Retry a failed job
  const retryJob = useCallback(async (jobId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job) return;

    updateJobStatus(jobId, STATUS.UPLOADING);
    processOne(job);
  }, [updateJobStatus, processOne]);

  // Force save a duplicate receipt
  const forceSave = useCallback(async (jobId) => {
    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job || !job.isDuplicate) return;

    updateJobStatus(jobId, STATUS.PROCESSING);

    try {
      const token = await getSessionToken();

      const response = await fetch(`${API_URL}/force-save-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          receipt_data: job.duplicateData,
          image_path: job.duplicateImagePath,
        }),
      });

      const result = await response.json();

      if (result.success) {
        updateJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: STATUS.READY,
                  storeName: result.receipt?.store_name || job.storeName,
                  receiptData: result.receipt,
                  error: null,
                  isDuplicate: false,
                }
              : j
          )
        );
      } else {
        updateJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, status: STATUS.FAILED, error: result.error || 'Force save failed' }
              : j
          )
        );
      }
    } catch (error) {
      updateJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? { ...j, status: STATUS.FAILED, error: error.message || 'Network error' }
            : j
        )
      );
    }
  }, [updateJobStatus, updateJobs]);

  // Mark a job as reviewed (moves it out of To Review)
  const markReviewed = useCallback((jobId) => {
    updateJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: STATUS.REVIEWED } : j))
    );
  }, [updateJobs]);

  // Remove a job entirely
  const removeJob = useCallback((jobId) => {
    updateJobs((prev) => prev.filter((j) => j.id !== jobId));
  }, [updateJobs]);

  // Clear all reviewed jobs
  const clearReviewed = useCallback(() => {
    updateJobs((prev) => prev.filter((j) => j.status !== STATUS.REVIEWED));
  }, [updateJobs]);

  return (
    <ProcessingContext.Provider
      value={{
        jobs,
        credits,
        getReviewItems,
        getPendingCount,
        processBatch,
        retryJob,
        forceSave,
        markReviewed,
        removeJob,
        clearReviewed,
        fetchCredits,
        STATUS,
      }}
    >
      {children}
    </ProcessingContext.Provider>
  );
}

export function useProcessing() {
  const context = useContext(ProcessingContext);
  if (!context) {
    throw new Error('useProcessing must be used within a ProcessingProvider');
  }
  return context;
}