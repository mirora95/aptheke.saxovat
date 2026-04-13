import React, { createContext, useContext, useState } from 'react';
import { Medicine, OrderItem } from '../types';

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

    let result: CartActionResult = { success: true };

    setItems(prev => {
      const existing = prev.find(i => i.medicineId === medicine.id);
      const nextQuantity = Math.min((existing?.quantity ?? 0) + quantity, medicine.stockQuantity);

      if (existing && nextQuantity === existing.quantity) {
        result = { success: false, message: 'You already have the maximum available quantity in your cart.' };
        return prev;
      }

      if (!existing && nextQuantity <= 0) {
        result = { success: false, message: 'This medicine is out of stock.' };
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
          unitPrice: medicine.price,
          totalPrice: medicine.price * nextQuantity,
          imageUrl: medicine.imageUrl,
          availableStock: medicine.stockQuantity,
          isActive: medicine.isActive,
        },
      ];
    });

    return result;
  };

  const removeItem = (medicineId: string) => {
    setItems(prev => prev.filter(i => i.medicineId !== medicineId));
  };

  const updateQuantity = (medicineId: string, quantity: number): CartActionResult => {
    if (quantity <= 0) {
      removeItem(medicineId);
      return { success: true };
    }

    let result: CartActionResult = { success: true };

    setItems(prev => {
      const existing = prev.find(item => item.medicineId === medicineId);

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

      return prev.map(i =>
        i.medicineId === medicineId
          ? { ...i, quantity: nextQuantity, totalPrice: nextQuantity * i.unitPrice }
          : i
      );
    });

    return result;
  };

  const clearCart = () => setItems([]);

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
