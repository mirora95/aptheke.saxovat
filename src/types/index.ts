/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  PHARMACIST = 'PHARMACIST',
  SUPERADMIN = 'SUPERADMIN',
}

export enum OrderStatus {
  PENDING = 'Pending',
  CONFIRMED = 'Confirmed',
  PREPARING = 'Preparing',
  READY = 'Ready',
  OUT_FOR_DELIVERY = 'OutForDelivery',
  DELIVERED = 'Delivered',
  CANCELLED = 'Cancelled',
}

export enum PaymentStatus {
  UNPAID = 'Unpaid',
  PAID = 'Paid',
  REFUNDED = 'Refunded',
}

export interface User {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  password?: string;
  role: UserRole;
  profileImage?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
}

export interface UserInput {
  fullName: string;
  phone: string;
  email: string;
  password?: string;
  role: UserRole;
  profileImage?: string;
  address?: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon?: string;
  isActive: boolean;
}

export interface CategoryInput {
  name: string;
  description: string;
  icon?: string;
  isActive: boolean;
}

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  description: string;
  shortDescription: string;
  price: number;
  discountPrice?: number;
  stockQuantity: number;
  sku: string;
  manufacturer: string;
  dosageForm: string;
  strength: string;
  packageSize: string;
  imageUrl: string;
  galleryImages: string[];
  requiresPrescription: boolean;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MedicineInput {
  name: string;
  genericName: string;
  brandName: string;
  categoryId: string;
  description: string;
  shortDescription: string;
  price: number;
  discountPrice?: number;
  stockQuantity: number;
  manufacturer: string;
  dosageForm: string;
  strength: string;
  packageSize: string;
  imageUrl: string;
  requiresPrescription: boolean;
  isFeatured: boolean;
  isActive: boolean;
}

export interface OrderItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl: string;
}

export interface Order {
  id: string;
  customerId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  deliveryType: 'Delivery' | 'Pickup';
  deliveryAddress?: string;
  orderItems: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderInput {
  customerId: string;
  paymentMethod: string;
  deliveryType: 'Delivery' | 'Pickup';
  deliveryAddress?: string;
  orderItems: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discountAmount?: number;
  totalAmount: number;
  notes?: string;
}

export type ApiProvider = 'mock' | 'api';

export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'NETWORK'
  | 'UNKNOWN';

export interface ApiFieldError {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  code: AppErrorCode;
  message: string;
  fieldErrors?: ApiFieldError[];
  traceId?: string;
}

export interface ApiListResponse<T> {
  items: T[];
  total: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresAt?: string;
}

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  session: AuthSession;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  tokens: AuthTokens;
}

export interface CurrentUserResponse {
  user: User;
}

export interface GetUsersQuery {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

export type UserResponse = User;
export type PharmacistResponse = User;
export type CreatePharmacistRequest = UserInput;
export type UpdateUserRequest = Partial<UserInput>;

export interface GetCategoriesQuery {
  isActive?: boolean;
  search?: string;
}

export type CategoryResponse = Category;
export type CreateCategoryRequest = CategoryInput;
export type UpdateCategoryRequest = Partial<CategoryInput>;

export interface GetMedicinesQuery {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  lowStockOnly?: boolean;
  featuredOnly?: boolean;
  outOfStockOnly?: boolean;
}

export type MedicineResponse = Medicine;
export type CreateMedicineRequest = MedicineInput;
export type UpdateMedicineRequest = Partial<MedicineInput>;

export interface UpdateMedicineStockRequest {
  stockQuantity: number;
}

export interface GetOrdersQuery {
  customerId?: string;
  status?: OrderStatus;
}

export type OrderResponse = Order;
export type CreateOrderRequest = CreateOrderInput;

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'system' | 'promo';
  isRead: boolean;
  createdAt: string;
}
