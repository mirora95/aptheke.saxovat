import React, { createContext, useContext, useRef, useState } from 'react';
import { Medicine, OrderItem } from '../types';
import { getMedicinePrice } from '../lib/utils';

interface CartItem extends OrderItem {
  availableStock: number;
  isActive: boolean;
}

interface CartActionResult {
  success: boolean;
  message?: string;
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (medicine: Medicine, quantity?: number) => CartActionResult;
  removeItem: (medicineId: string) => void;
  updateQuantity: (medicineId: string, quantity: number) => CartActionResult;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const itemsRef = useRef<CartItem[]>([]);

  // Compute event-time results before React renders any queued cart updates.
  const updateItems = (update: (current: CartItem[]) => CartItem[]) => {
    const next = update(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

  const addItem = (medicine: Medicine, quantity = 1): CartActionResult => {
    if (!medicine.isActive) {
      return { success: false, message: 'This medicine is unavailable right now.' };
    }

    if (medicine.stockQuantity <= 0) {
      return { success: false, message: 'This medicine is out of stock.' };
    }

    if (quantity <= 0) {
      return { success: false, message: 'Quantity must be at least 1.' };
    }

    const unitPrice = getMedicinePrice(medicine);
    let result: CartActionResult = { success: true };

    updateItems(prev => {
      const existing = prev.find(i => i.medicineId === medicine.id);
      const nextQuantity = Math.min((existing?.quantity ?? 0) + quantity, medicine.stockQuantity);

      if (existing && nextQuantity === existing.quantity) {
        result = { success: false, message: 'You already have the maximum available quantity in your cart.' };
        return prev;
      }

      if (existing) {
        return prev.map(i =>
          i.medicineId === medicine.id
            ? {
                ...i,
                quantity: nextQuantity,
                totalPrice: nextQuantity * i.unitPrice,
                availableStock: medicine.stockQuantity,
                isActive: medicine.isActive,
              }
            : i
        );
      }
      return [
        ...prev,
        {
          medicineId: medicine.id,
          medicineName: medicine.name,
          quantity: nextQuantity,
          unitPrice,
          totalPrice: unitPrice * nextQuantity,
          imageUrl: medicine.imageUrl,
          availableStock: medicine.stockQuantity,
          isActive: medicine.isActive,
        },
      ];
    });

    return result;
  };

  const removeItem = (medicineId: string) => {
    updateItems(prev => prev.filter(i => i.medicineId !== medicineId));
  };

  const updateQuantity = (medicineId: string, quantity: number): CartActionResult => {
    if (quantity <= 0) {
      removeItem(medicineId);
      return { success: true };
    }

    let result: CartActionResult = { success: true };

    updateItems(prev => {
      const index = prev.findIndex(item => item.medicineId === medicineId);
      const existing = prev[index];

      if (!existing) {
        result = { success: false, message: 'Cart item not found.' };
        return prev;
      }

      if (!existing.isActive || existing.availableStock <= 0) {
        result = { success: false, message: 'This medicine is unavailable right now.' };
        return prev;
      }

      const nextQuantity = Math.min(quantity, existing.availableStock);

      if (nextQuantity === existing.quantity && quantity > existing.availableStock) {
        result = { success: false, message: 'Requested quantity exceeds available stock.' };
        return prev;
      }

      const next = [...prev];
      next[index] = { ...existing, quantity: nextQuantity, totalPrice: nextQuantity * existing.unitPrice };
      return next;
    });

    return result;
  };

  const clearCart = () => updateItems(() => []);

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        subtotal,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
