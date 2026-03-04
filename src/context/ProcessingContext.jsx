import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { API_URL } from '../config/api';
import { useNotifications } from './NotificationContext';
import RNFS from 'react-native-fs';

const ProcessingContext = createContext();

// Statuses: uploading → processing → ready → reviewed | failed
const STATUS = {
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
  REVIEWED: 'reviewed',
};

/**
 * Simple hash function for image bytes (djb2 variant).
 * Reads the file, hashes the base64 string — fast and deterministic.
 */
async function hashImageFile(photoPath) {
  try {
    const base64 = await RNFS.readFile(photoPath, 'base64');
    let hash = 5381;
    for (let i = 0; i < base64.length; i++) {
      hash = ((hash << 5) + hash + base64.charCodeAt(i)) & 0xffffffff;
    }
    return hash.toString(16);
  } catch (err) {
    console.log('Hash error:', err);
    return null;
  }
}

export function ProcessingProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const jobsRef = useRef([]);
  const { addNotification } = useNotifications();

  const updateJobs = useCallback((updater) => {
    setJobs((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      jobsRef.current = next;
      return next;
    });
  }, []);

  const getReviewItems = useCallback(() => {
    return jobsRef.current.filter((j) => j.status !== STATUS.REVIEWED);
  }, []);

  const getPendingCount = useCallback(() => {
    return jobsRef.current.filter((j) => j.status !== STATUS.REVIEWED).length;
  }, []);

  // ── Check for image-level duplicate (same exact photo) ──
  const checkImageDuplicate = useCallback(async (imageHash, userId) => {
    if (!imageHash) return false;
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('id')
        .eq('user_id', userId)
        .eq('image_hash', imageHash)
        .limit(1);
      if (!error && data && data.length > 0) return true;
    } catch (err) {
      console.log('Image duplicate check error:', err);
    }
    return false;
  }, []);

  // ── Start processing a batch of scans ──
  const processBatch = useCallback(async (scans) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('ProcessingContext: No user logged in');
      return;
    }

    const newJobs = scans.map((scan) => ({
      id: scan.id,
      photoPath: scan.photoPath,
      rotation: scan.rotation || 0,
      status: STATUS.UPLOADING,
      storeName: null,
      receiptData: null,
      error: null,
      capturedAt: Date.now(),
      imageHash: null,
    }));

    updateJobs((prev) => [...newJobs, ...prev]);

    newJobs.forEach((job) => {
      processOne(job, user.id);
    });
  }, [updateJobs]);

  // ── Process a single receipt ──
  const processOne = useCallback(async (job, userId) => {
    try {
      updateJobStatus(job.id, STATUS.UPLOADING);

      // Compute image hash for duplicate detection
      const imageHash = await hashImageFile(job.photoPath);

      // Update job with hash
      updateJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, imageHash } : j))
      );

      // Check if this exact image was already scanned
      if (imageHash) {
        const isDupe = await checkImageDuplicate(imageHash, userId);
        if (isDupe) {
          updateJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? {
                    ...j,
                    status: STATUS.FAILED,
                    storeName: 'Duplicate Image',
                    error: 'This exact image has already been scanned and saved.',
                    isDuplicate: true,
                    isImageDuplicate: true,
                  }
                : j
            )
          );
          addNotification({
            type: 'duplicate',
            title: 'Duplicate Image',
            message: 'This exact image has already been scanned.',
            data: { jobId: job.id },
          });
          return;
        }
      }

      // Build form data
      const formData = new FormData();
      formData.append('image', {
        uri: 'file://' + job.photoPath,
        type: 'image/jpeg',
        name: `receipt_${Date.now()}.jpg`,
      });
      formData.append('user_id', userId);
      if (imageHash) {
        formData.append('image_hash', imageHash);
      }

      updateJobStatus(job.id, STATUS.PROCESSING);

      const response = await fetch(`${API_URL}/process-receipt`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const store = result.receipt?.store_name || 'Receipt';
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
        addNotification({
          type: 'receipt_ready',
          title: 'Receipt Ready',
          message: `${store} — $${result.receipt?.total_amount || '0.00'} is ready to review.`,
          data: { jobId: job.id, receipt: result.receipt },
        });
      } else if (result.duplicate) {
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
  }, [updateJobs, checkImageDuplicate]);

  const updateJobStatus = useCallback((jobId, status) => {
    updateJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status } : j))
    );
  }, [updateJobs]);

  // ── Retry a failed job ──
  const retryJob = useCallback(async (jobId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job) return;

    updateJobStatus(jobId, STATUS.UPLOADING);
    processOne(job, user.id);
  }, [updateJobStatus, processOne]);

  // ── Force save a duplicate receipt ──
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
          image_hash: job.imageHash,
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

  // ── Delete a job — removes from queue + cleans up uploaded image ──
  const deleteJob = useCallback(async (jobId) => {
    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job) return;

    // If a receipt was saved to Supabase, delete it
    if (job.receiptData?.id) {
      try {
        await supabase.from('receipts').delete().eq('id', job.receiptData.id);
      } catch (err) {
        console.log('Error deleting receipt from DB:', err);
      }
    }

    // If an image was uploaded to storage, delete it
    const imagePath = job.duplicateImagePath || job.receiptData?.image_url;
    if (imagePath) {
      try {
        const filePath = imagePath.replace('receipt-images/', '');
        await supabase.storage.from('receipt-images').remove([filePath]);
      } catch (err) {
        console.log('Error deleting image from storage:', err);
      }
    }

    // Remove from jobs list
    updateJobs((prev) => prev.filter((j) => j.id !== jobId));
  }, [updateJobs]);

  const markReviewed = useCallback((jobId) => {
    updateJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: STATUS.REVIEWED } : j))
    );
  }, [updateJobs]);

  const removeJob = useCallback((jobId) => {
    updateJobs((prev) => prev.filter((j) => j.id !== jobId));
  }, [updateJobs]);

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
        deleteJob,
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