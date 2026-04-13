import {
  AuthSession,
  CategoryResponse,
  CreateCategoryRequest,
  CreateMedicineRequest,
  CreateOrderRequest,
  CreatePharmacistRequest,
  CurrentUserResponse,
  GetCategoriesQuery,
  GetMedicinesQuery,
  GetOrdersQuery,
  GetUsersQuery,
  LoginRequest,
  LoginResponse,
  MedicineResponse,
  OrderResponse,
  OrderStatus,
  RefreshTokenRequest,
  RefreshTokenResponse,
  UpdateCategoryRequest,
  UpdateMedicineRequest,
  UpdateMedicineStockRequest,
  UpdateOrderStatusRequest,
  UpdateUserRequest,
  User,
  UserResponse,
  UserRole,
} from '../types';
import { apiClient, getListItems, ServiceError, toApiErrorResponse } from './apiClient';

export { ServiceError } from './apiClient';
export { AUTH_UNAUTHORIZED_EVENT, toApiErrorResponse } from './apiClient';

export const LOW_STOCK_THRESHOLD = 20;

const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

const mapRole = (role: string): UserRole => {
  if (role in UserRole) {
    return role as UserRole;
  }

  throw new ServiceError('UNKNOWN', `Unsupported user role: ${role}`);
};

const normalizeUser = (user: UserResponse): User => ({
  ...user,
  role: mapRole(user.role),
});

const normalizeUsers = (users: UserResponse[]) => users.map(normalizeUser);

const getAllowedStatusOptions = (status: OrderStatus) => ORDER_STATUS_TRANSITIONS[status] ?? [];

const buildUserQuery = (query?: GetUsersQuery) => ({
  role: query?.role,
  isActive: query?.isActive,
  search: query?.search,
});

const buildCategoryQuery = (query?: GetCategoriesQuery) => ({
  isActive: query?.isActive,
  search: query?.search,
});

const buildMedicineQuery = (query?: GetMedicinesQuery) => ({
  search: query?.search,
  categoryId: query?.categoryId,
  isActive: query?.isActive,
  lowStockOnly: query?.lowStockOnly,
  featuredOnly: query?.featuredOnly,
  outOfStockOnly: query?.outOfStockOnly,
});

const buildOrderQuery = (query?: GetOrdersQuery) => ({
  customerId: query?.customerId,
  status: query?.status,
});

const buildPharmacistPayload = (user: Partial<CreatePharmacistRequest & UpdateUserRequest> & { password?: string }) => ({
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  password: user.password,
  profileImage: user.profileImage,
  address: user.address,
  isActive: user.isActive,
});

export const getAllowedOrderStatusUpdates = getAllowedStatusOptions;

export interface IAuthService {
  login(request: LoginRequest): Promise<LoginResponse>;
  restoreSession(session: AuthSession | null): Promise<AuthSession | null>;
  refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse>;
  getCurrentUser(session: AuthSession): Promise<CurrentUserResponse>;
  logout(): Promise<void>;
}

export interface IMedicineService {
  getMedicines(query?: GetMedicinesQuery): Promise<MedicineResponse[]>;
  getActiveMedicines(): Promise<MedicineResponse[]>;
  getLowStockMedicines(threshold?: number): Promise<MedicineResponse[]>;
  getMedicineById(id: string): Promise<MedicineResponse | undefined>;
  getFeaturedMedicines(): Promise<MedicineResponse[]>;
  getMedicinesByCategory(categoryId: string): Promise<MedicineResponse[]>;
  searchMedicines(query: string): Promise<MedicineResponse[]>;
  createMedicine(medicine: CreateMedicineRequest): Promise<MedicineResponse>;
  updateMedicine(id: string, medicine: UpdateMedicineRequest): Promise<MedicineResponse>;
  updateMedicineStock(id: string, request: UpdateMedicineStockRequest | number): Promise<MedicineResponse>;
}

export interface ICategoryService {
  getCategories(query?: GetCategoriesQuery): Promise<CategoryResponse[]>;
  getAllCategories(): Promise<CategoryResponse[]>;
  getCategoryById(id: string): Promise<CategoryResponse | undefined>;
  createCategory(category: CreateCategoryRequest): Promise<CategoryResponse>;
  updateCategory(id: string, category: UpdateCategoryRequest): Promise<CategoryResponse>;
  toggleCategoryStatus(id: string): Promise<CategoryResponse>;
}

export interface IOrderService {
  getOrders(query?: GetOrdersQuery): Promise<OrderResponse[]>;
  getOrdersByUserId(userId: string): Promise<OrderResponse[]>;
  getOrderById(id: string): Promise<OrderResponse | undefined>;
  createOrder(order: CreateOrderRequest): Promise<OrderResponse>;
  updateOrderStatus(id: string, request: UpdateOrderStatusRequest | OrderStatus): Promise<OrderResponse>;
}

export interface IUserService {
  getUsers(query?: GetUsersQuery): Promise<UserResponse[]>;
  getUserById(id: string): Promise<UserResponse | undefined>;
  getPharmacists(): Promise<UserResponse[]>;
  createPharmacist(user: CreatePharmacistRequest): Promise<UserResponse>;
  updateUser(id: string, user: UpdateUserRequest): Promise<UserResponse>;
  toggleUserStatus(id: string): Promise<UserResponse>;
}

export class ApiAuthService implements IAuthService {
  async login(request: LoginRequest) {
    const response = await apiClient.post<LoginResponse>('/auth/login', request, {
      suppressUnauthorizedEvent: true,
    });

    return {
      session: {
        user: normalizeUser(response.session.user),
        tokens: response.session.tokens,
      },
    };
  }

  async restoreSession(session: AuthSession | null) {
    if (!session?.tokens.accessToken) {
      return null;
    }

    try {
      const currentUser = await this.getCurrentUser(session);
      return {
        user: currentUser.user,
        tokens: session.tokens,
      };
    } catch (error) {
      if (error instanceof ServiceError) {
        if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
          return null;
        }

        if (error.code === 'NETWORK') {
          return session;
        }
      }

      return null;
    }
  }

  async refreshToken(_request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    throw new ServiceError('UNAUTHORIZED', 'Token refresh is not supported by the current API.', {
      status: 401,
    });
  }

  async getCurrentUser(session: AuthSession) {
    const response = await apiClient.get<CurrentUserResponse>('/auth/me', {
      accessToken: session.tokens.accessToken,
    });

    return {
      user: normalizeUser(response.user),
    };
  }

  async logout() {
    return;
  }
}

export class ApiMedicineService implements IMedicineService {
  async getMedicines(query?: GetMedicinesQuery) {
    const response = await apiClient.get<{ items: MedicineResponse[]; total: number }>('/medicines', {
      query: buildMedicineQuery(query),
    });

    return getListItems(response);
  }

  async getActiveMedicines() {
    return this.getMedicines({ isActive: true });
  }

  async getLowStockMedicines(threshold = LOW_STOCK_THRESHOLD) {
    const medicines = await this.getMedicines({ isActive: true });
    return medicines.filter(medicine => medicine.stockQuantity > 0 && medicine.stockQuantity <= threshold);
  }

  async getMedicineById(id: string) {
    try {
      return await apiClient.get<MedicineResponse>(`/medicines/${id}`);
    } catch (error) {
      if (error instanceof ServiceError && error.code === 'NOT_FOUND') {
        return undefined;
      }

      throw error;
    }
  }

  async getFeaturedMedicines() {
    return this.getMedicines({ isActive: true, featuredOnly: true });
  }

  async getMedicinesByCategory(categoryId: string) {
    return this.getMedicines({ isActive: true, categoryId });
  }

  async searchMedicines(query: string) {
    return this.getMedicines({ isActive: true, search: query });
  }

  async createMedicine(medicine: CreateMedicineRequest) {
    return apiClient.post<MedicineResponse>('/medicines', medicine);
  }

  async updateMedicine(id: string, medicine: UpdateMedicineRequest) {
    return apiClient.put<MedicineResponse>(`/medicines/${id}`, medicine);
  }

  async updateMedicineStock(id: string, request: UpdateMedicineStockRequest | number) {
    const stockQuantity = typeof request === 'number' ? request : request.stockQuantity;
    return this.updateMedicine(id, { stockQuantity });
  }
}

export class ApiCategoryService implements ICategoryService {
  async getCategories(query?: GetCategoriesQuery) {
    const response = await apiClient.get<{ items: CategoryResponse[]; total: number }>('/categories', {
      query: buildCategoryQuery(query),
    });

    return getListItems(response);
  }

  async getAllCategories() {
    return this.getCategories();
  }

  async getCategoryById(id: string) {
    const categories = await this.getAllCategories();
    return categories.find(category => category.id === id);
  }

  async createCategory(category: CreateCategoryRequest) {
    return apiClient.post<CategoryResponse>('/categories', category);
  }

  async updateCategory(id: string, category: UpdateCategoryRequest) {
    return apiClient.put<CategoryResponse>(`/categories/${id}`, category);
  }

  async toggleCategoryStatus(id: string) {
    const category = await this.getCategoryById(id);

    if (!category) {
      throw new ServiceError('NOT_FOUND', 'Category not found', {
        status: 404,
      });
    }

    return this.updateCategory(id, { isActive: !category.isActive });
  }
}

export class ApiOrderService implements IOrderService {
  async getOrders(query?: GetOrdersQuery) {
    const response = await apiClient.get<{ items: OrderResponse[]; total: number }>('/orders', {
      query: buildOrderQuery(query),
    });

    return getListItems(response);
  }

  async getOrdersByUserId(userId: string) {
    return this.getOrders({ customerId: userId });
  }

  async getOrderById(id: string) {
    try {
      return await apiClient.get<OrderResponse>(`/orders/${id}`);
    } catch (error) {
      if (error instanceof ServiceError && error.code === 'NOT_FOUND') {
        return undefined;
      }

      throw error;
    }
  }

  async createOrder(order: CreateOrderRequest) {
    return apiClient.post<OrderResponse>('/orders', order);
  }

  async updateOrderStatus(id: string, request: UpdateOrderStatusRequest | OrderStatus) {
    const status = typeof request === 'string' ? request : request.status;
    return apiClient.patch<OrderResponse>(`/orders/${id}/status`, { status });
  }
}

export class ApiUserService implements IUserService {
  async getUsers(query?: GetUsersQuery) {
    const response = await apiClient.get<{ items: UserResponse[]; total: number }>('/users', {
      query: buildUserQuery(query),
    });

    return normalizeUsers(getListItems(response));
  }

  async getUserById(id: string) {
    try {
      const response = await apiClient.get<UserResponse>(`/users/${id}`);
      return normalizeUser(response);
    } catch (error) {
      if (error instanceof ServiceError && error.code === 'NOT_FOUND') {
        return undefined;
      }

      throw error;
    }
  }

  async getPharmacists() {
    const response = await apiClient.get<{ items: UserResponse[]; total: number }>('/pharmacists');
    return normalizeUsers(getListItems(response));
  }

  async createPharmacist(user: CreatePharmacistRequest) {
    const response = await apiClient.post<UserResponse>('/pharmacists', buildPharmacistPayload(user));
    return normalizeUser(response);
  }

  async updateUser(id: string, user: UpdateUserRequest) {
    const response = await apiClient.put<UserResponse>(`/pharmacists/${id}`, buildPharmacistPayload(user));
    return normalizeUser(response);
  }

  async toggleUserStatus(id: string) {
    const user = await this.getUserById(id);

    if (!user) {
      throw new ServiceError('NOT_FOUND', 'User not found', {
        status: 404,
      });
    }

    const endpoint = user.role === UserRole.PHARMACIST ? `/pharmacists/${id}/status` : `/users/${id}/status`;
    const response = await apiClient.patch<UserResponse>(endpoint, { isActive: !user.isActive });
    return normalizeUser(response);
  }
}

export interface ServiceRegistry {
  auth: IAuthService;
  medicines: IMedicineService;
  categories: ICategoryService;
  orders: IOrderService;
  users: IUserService;
}

export const serviceRegistry: ServiceRegistry = {
  auth: new ApiAuthService(),
  medicines: new ApiMedicineService(),
  categories: new ApiCategoryService(),
  orders: new ApiOrderService(),
  users: new ApiUserService(),
};

export const authService = serviceRegistry.auth;
export const medicineService = serviceRegistry.medicines;
export const categoryService = serviceRegistry.categories;
export const orderService = serviceRegistry.orders;
export const userService = serviceRegistry.users;
