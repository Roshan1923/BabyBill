import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const idCounter = useRef(0);

  // Add a new notification
  const addNotification = useCallback(({ type, title, message, data }) => {
    idCounter.current += 1;
    const notification = {
      id: `notif_${idCounter.current}_${Date.now()}`,
      type: type || 'info', // 'receipt_ready' | 'receipt_failed' | 'duplicate' | 'info'
      title,
      message,
      data, // optional payload (receipt data, jobId, etc.)
      timestamp: Date.now(),
      read: false,
    };

    setNotifications((prev) => [notification, ...prev]);
    return notification.id;
  }, []);

  // Mark a single notification as read
  const markRead = useCallback((notifId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
  }, []);

  // Mark all as read
  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Remove a notification
  const removeNotification = useCallback((notifId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markRead,
        markAllRead,
        removeNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}