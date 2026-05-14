import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';

export const NotificationToast: React.FC = () => {
  const { lastNotification, clearNotification } = useNotifications();

  useEffect(() => {
    if (lastNotification) {
      const timer = setTimeout(clearNotification, 6000);
      return () => clearTimeout(timer);
    }
  }, [lastNotification, clearNotification]);

  return (
    <AnimatePresence>
      {lastNotification ? (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 50, x: '-50%' }}
          className="fixed bottom-20 md:bottom-4 left-1/2 z-50 w-[90vw] max-w-md"
        >
          <div className="bg-white rounded-2xl border border-blue-100 shadow-lg p-4 flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Order Updated</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Order {lastNotification.orderNumber} is now <span className="font-medium text-blue-600">{lastNotification.newStatus}</span>
              </p>
              <Link to={`/orders/${lastNotification.orderId}`} className="text-xs text-blue-600 font-medium hover:underline mt-1 inline-block">
                View Details
              </Link>
            </div>
            <button onClick={clearNotification} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
