import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from './AuthContext';

interface OrderStatusNotification {
  orderId: string;
  orderNumber: string;
  newStatus: string;
  customerId: string;
  timestamp: string;
}

interface NotificationContextType {
  lastNotification: OrderStatusNotification | null;
  clearNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? 'http://localhost:5062';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { accessToken, isAuthenticated } = useAuth();
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [lastNotification, setLastNotification] = useState<OrderStatusNotification | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/orders`, {
        accessTokenFactory: () => accessToken,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();

    connection.on('OrderStatusChanged', (data: OrderStatusNotification) => {
      setLastNotification(data);
    });

    connection.start().catch(() => { /* silent fail */ });
    connectionRef.current = connection;

    return () => {
      connection.stop().catch(() => { /* noop */ });
      connectionRef.current = null;
    };
  }, [isAuthenticated, accessToken]);

  const clearNotification = useCallback(() => setLastNotification(null), []);

  return (
    <NotificationContext.Provider value={{ lastNotification, clearNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
