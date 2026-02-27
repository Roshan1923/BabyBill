import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { API_URL } from '../config/api';

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
  const jobsRef = useRef([]);

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
      processOne(job, user.id);
    });
  }, [updateJobs]);

  // Process a single receipt
  const processOne = useCallback(async (job, userId) => {
    try {
      // Update status to uploading
      updateJobStatus(job.id, STATUS.UPLOADING);

      // Build form data
      const formData = new FormData();
      formData.append('image', {
        uri: 'file://' + job.photoPath,
        type: 'image/jpeg',
        name: `receipt_${Date.now()}.jpg`,
      });
      formData.append('user_id', userId);

      // Update status to processing
      updateJobStatus(job.id, STATUS.PROCESSING);

      // Send to backend
      const response = await fetch(`${API_URL}/process-receipt`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Success — update with receipt data
        updateJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: STATUS.READY,
                  storeName: result.receipt?.store_name || 'Receipt',
                  receiptData: result.receipt,
                  error: null,
                }
              : j
          )
        );
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
    processOne(job, user.id);
  }, [updateJobStatus, processOne]);

  // Force save a duplicate receipt
  const forceSave = useCallback(async (jobId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job || !job.isDuplicate) return;

    updateJobStatus(jobId, STATUS.PROCESSING);

    try {
      const response = await fetch(`${API_URL}/force-save-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
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
        getReviewItems,
        getPendingCount,
        processBatch,
        retryJob,
        forceSave,
        markReviewed,
        removeJob,
        clearReviewed,
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