import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Package,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, Input } from '../components/UI';
import {
  categoryService,
  LOW_STOCK_THRESHOLD,
  medicineService,
  ServiceError,
  orderService,
  userService,
} from '../services';
import { Category, CategoryInput, Medicine, Order, OrderStatus, User, UserInput, UserRole } from '../types';

const textareaClasses =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

type PharmacistFormValues = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  isActive: boolean;
};

type CategoryFormValues = {
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
};

const createEmptyPharmacistForm = (): PharmacistFormValues => ({
  fullName: '',
  email: '',
  phone: '',
  password: '',
  isActive: true,
});

const createEmptyCategoryForm = (): CategoryFormValues => ({
  name: '',
  description: '',
  icon: '',
  isActive: true,
});

const formatCurrency = (amount: number) => `${new Intl.NumberFormat('en-US').format(amount)} UZS`;
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ServiceError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const EmptyState: React.FC<{ title: string; description: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <Card className="p-8 text-center">
    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    <p className="mt-2 text-sm text-gray-500">{description}</p>
    {action ? <div className="mt-5">{action}</div> : null}
  </Card>
);

const SummaryCard: React.FC<{ title: string; value: string | number; hint: string; icon: React.ReactNode }> = ({
  title,
  value,
  hint,
  icon,
}) => (
  <Card className="p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
        <p className="mt-2 text-sm text-gray-500">{hint}</p>
      </div>
      <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">{icon}</div>
    </div>
  </Card>
);

const getOrderStatusVariant = (status: OrderStatus): 'warning' | 'info' | 'success' | 'error' | 'neutral' => {
  switch (status) {
    case OrderStatus.PENDING:
      return 'warning';
    case OrderStatus.CONFIRMED:
    case OrderStatus.PREPARING:
    case OrderStatus.READY:
    case OrderStatus.OUT_FOR_DELIVERY:
      return 'info';
    case OrderStatus.DELIVERED:
      return 'success';
    case OrderStatus.CANCELLED:
      return 'error';
    default:
      return 'neutral';
  }
};

const getMedicineStatusVariant = (medicine: Medicine): 'success' | 'warning' | 'error' | 'neutral' => {
  if (!medicine.isActive) return 'neutral';
  if (medicine.stockQuantity <= 0) return 'error';
  if (medicine.stockQuantity <= LOW_STOCK_THRESHOLD) return 'warning';
  return 'success';
};

const validatePharmacistForm = (values: PharmacistFormValues, isEdit: boolean) => {
  const errors: Partial<Record<keyof PharmacistFormValues, string>> = {};

  if (!values.fullName.trim()) errors.fullName = 'Required';
  if (!values.email.trim()) errors.email = 'Required';
  else if (!values.email.includes('@')) errors.email = 'Use a valid email';
  if (!values.phone.trim()) errors.phone = 'Required';
  if (!isEdit && !values.password.trim()) errors.password = 'Required for new pharmacist';

  return errors;
};

const validateCategoryForm = (values: CategoryFormValues) => {
  const errors: Partial<Record<keyof CategoryFormValues, string>> = {};
  if (!values.name.trim()) errors.name = 'Required';
  if (!values.description.trim()) errors.description = 'Required';
  return errors;
};

const mapPharmacistToForm = (user: User): PharmacistFormValues => ({
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  password: '',
  isActive: user.isActive,
});

const mapCategoryToForm = (category: Category): CategoryFormValues => ({
  name: category.name,
  description: category.description,
  icon: category.icon ?? '',
  isActive: category.isActive,
});

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError('');

      try {
        const [loadedUsers, loadedMedicines, loadedOrders] = await Promise.all([
          userService.getUsers(),
          medicineService.getMedicines(),
          orderService.getOrders(),
        ]);

        if (!mounted) return;

        setUsers(loadedUsers);
        setMedicines(loadedMedicines);
        setOrders(loadedOrders);
      } catch (loadError) {
        if (!mounted) return;
        setError(getErrorMessage(loadError, 'Unable to load the SuperAdmin dashboard right now.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const pharmacists = users.filter(user => user.role === UserRole.PHARMACIST);
  const lowStockMedicines = medicines.filter(
    medicine => medicine.isActive && medicine.stockQuantity > 0 && medicine.stockQuantity <= LOW_STOCK_THRESHOLD
  );
  const orderStatusCounts = Object.values(OrderStatus).map(status => ({
    status,
    count: orders.filter(order => order.orderStatus === status).length,
  }));

  if (loading) {
    return <div className="p-6 lg:p-8 text-sm text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SuperAdmin dashboard</h1>
          <p className="mt-2 text-sm text-gray-500">Monitor platform activity, stock health, and account status from a single oversight view.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/pharmacists">
            <Button>
              <UserPlus size={16} className="mr-2" />
              Manage pharmacists
            </Button>
          </Link>
          <Link to="/admin/reports">
            <Button variant="outline">
              <BarChart3 size={16} className="mr-2" />
              Open reports
            </Button>
          </Link>
        </div>
      </div>

      {error ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Total users" value={users.length} hint="All accounts in the system" icon={<Users size={22} />} />
        <SummaryCard title="Pharmacists" value={pharmacists.length} hint="Operational pharmacy staff" icon={<ShieldCheck size={22} />} />
        <SummaryCard title="Medicines" value={medicines.length} hint="Full medicine catalog" icon={<Package size={22} />} />
        <SummaryCard title="Orders" value={orders.length} hint="Customer orders tracked" icon={<RefreshCw size={22} />} />
        <SummaryCard
          title="Low stock"
          value={lowStockMedicines.length}
          hint={`Threshold: ${LOW_STOCK_THRESHOLD} units or fewer`}
          icon={<AlertTriangle size={22} />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Quick oversight</h2>
              <p className="mt-1 text-sm text-gray-500">Fast links into the operational areas that need admin attention.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link to="/admin/users" className="rounded-2xl border border-gray-100 px-4 py-4 hover:border-blue-200 hover:bg-blue-50">
              <p className="font-medium text-gray-900">Users</p>
              <p className="mt-1 text-sm text-gray-500">Inspect customer and staff account status.</p>
            </Link>
            <Link to="/admin/categories" className="rounded-2xl border border-gray-100 px-4 py-4 hover:border-blue-200 hover:bg-blue-50">
              <p className="font-medium text-gray-900">Categories</p>
              <p className="mt-1 text-sm text-gray-500">Keep catalog grouping clean and active.</p>
            </Link>
            <Link to="/admin/medicines" className="rounded-2xl border border-gray-100 px-4 py-4 hover:border-blue-200 hover:bg-blue-50">
              <p className="font-medium text-gray-900">Medicines</p>
              <p className="mt-1 text-sm text-gray-500">Watch inventory health and featured status.</p>
            </Link>
            <Link to="/admin/settings" className="rounded-2xl border border-gray-100 px-4 py-4 hover:border-blue-200 hover:bg-blue-50">
              <p className="font-medium text-gray-900">Settings</p>
              <p className="mt-1 text-sm text-gray-500">Mock configuration placeholders for future backend settings.</p>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Orders by status</h2>
          <div className="mt-5 space-y-3">
            {orderStatusCounts.map(item => (
              <div key={item.status} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                <Badge variant={getOrderStatusVariant(item.status)}>{item.status}</Badge>
                <span className="text-sm font-semibold text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export const PharmacistManagementScreen: React.FC = () => {
  const [pharmacists, setPharmacists] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [form, setForm] = useState<PharmacistFormValues>(createEmptyPharmacistForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof PharmacistFormValues, string>>>({});

  const loadPharmacists = async () => {
    setLoading(true);
    setError('');

    try {
      const loadedPharmacists = await userService.getPharmacists();
      setPharmacists(loadedPharmacists);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load pharmacists right now.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPharmacists();
  }, []);

  const filteredPharmacists = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pharmacists;

    return pharmacists.filter(pharmacist =>
      [pharmacist.fullName, pharmacist.email, pharmacist.phone].some(value => value.toLowerCase().includes(query))
    );
  }, [pharmacists, search]);

  const resetForm = () => {
    setEditingId(null);
    setForm(createEmptyPharmacistForm());
    setFormErrors({});
  };

  const startEdit = (pharmacist: User) => {
    setEditingId(pharmacist.id);
    setForm(mapPharmacistToForm(pharmacist));
    setFormErrors({});
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validatePharmacistForm(form, Boolean(editingId));
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setError('');

    const payload: UserInput = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password.trim() || undefined,
      role: UserRole.PHARMACIST,
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await userService.updateUser(editingId, payload);
      } else {
        await userService.createPharmacist(payload);
      }

      resetForm();
      await loadPharmacists();
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to save pharmacist right now.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    setError('');

    try {
      await userService.toggleUserStatus(id);
      await loadPharmacists();
    } catch (toggleError) {
      setError(getErrorMessage(toggleError, 'Unable to update pharmacist status right now.'));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pharmacist management</h1>
          <p className="mt-2 text-sm text-gray-500">Create pharmacist accounts, edit contact details, and control active staff access.</p>
        </div>
        <Button variant="outline" onClick={() => void loadPharmacists()} isLoading={loading}>
          <RefreshCw size={16} className="mr-2" />
          Refresh
        </Button>
      </div>

      {error ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-md">
              <Input
                label="Search pharmacists"
                placeholder="Search by name, email, or phone"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {loading ? (
              <p className="text-sm text-gray-500">Loading pharmacists...</p>
            ) : filteredPharmacists.length === 0 ? (
              <EmptyState title="No pharmacists found" description="Create the first pharmacist account to start operational workflows." />
            ) : (
              filteredPharmacists.map(pharmacist => (
                <div key={pharmacist.id} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">{pharmacist.fullName}</p>
                        <Badge variant={pharmacist.isActive ? 'success' : 'neutral'}>
                          {pharmacist.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">{pharmacist.email}</p>
                      <p className="text-sm text-gray-500">{pharmacist.phone}</p>
                      <p className="mt-2 text-xs text-gray-400">Created {formatDate(pharmacist.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" onClick={() => startEdit(pharmacist)}>
                        Edit
                      </Button>
                      <Button
                        variant={pharmacist.isActive ? 'ghost' : 'secondary'}
                        onClick={() => void handleToggle(pharmacist.id)}
                        isLoading={togglingId === pharmacist.id}
                      >
                        {pharmacist.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit pharmacist' : 'Create pharmacist'}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {editingId ? 'Update pharmacist contact details and active status.' : 'New pharmacist accounts default to the supplied password or `password` if left blank.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <Input label="Full name" value={form.fullName} error={formErrors.fullName} onChange={event => setForm(current => ({ ...current, fullName: event.target.value }))} />
            <Input label="Email" value={form.email} error={formErrors.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} />
            <Input label="Phone" value={form.phone} error={formErrors.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} />
            <Input
              label={editingId ? 'Password (optional reset)' : 'Password'}
              type="password"
              value={form.password}
              error={formErrors.password}
              onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
            />
            <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={form.isActive} onChange={event => setForm(current => ({ ...current, isActive: event.target.checked }))} />
              Account active
            </label>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" isLoading={submitting}>
                {editingId ? 'Save pharmacist' : 'Create pharmacist'}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export const UserManagementScreen: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const loadedUsers = await userService.getUsers();
      setUsers(loadedUsers.filter(user => user.role !== UserRole.SUPERADMIN));
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load users right now.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;

    return users.filter(user =>
      [user.fullName, user.email, user.phone, user.role].some(value => value.toLowerCase().includes(query))
    );
  }, [users, search]);

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    setError('');

    try {
      await userService.toggleUserStatus(id);
      await loadUsers();
    } catch (toggleError) {
      setError(getErrorMessage(toggleError, 'Unable to update user status right now.'));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User management</h1>
          <p className="mt-2 text-sm text-gray-500">Inspect customer and staff account details and control whether an account is active.</p>
        </div>
        <Button variant="outline" onClick={() => void loadUsers()} isLoading={loading}>
          <RefreshCw size={16} className="mr-2" />
          Refresh
        </Button>
      </div>

      {error ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      <Card className="p-6">
        <div className="max-w-md">
          <Input
            label="Search users"
            placeholder="Search by name, email, phone, or role"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>

        <div className="mt-5 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <EmptyState title="No users found" description="No accounts match the current search." />
          ) : (
            filteredUsers.map(user => (
              <div key={user.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{user.fullName}</p>
                      <Badge variant={user.role === UserRole.PHARMACIST ? 'info' : 'neutral'}>
                        {user.role === UserRole.PHARMACIST ? 'Pharmacist' : 'Customer'}
                      </Badge>
                      <Badge variant={user.isActive ? 'success' : 'neutral'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">{user.email}</p>
                    <p className="text-sm text-gray-500">{user.phone}</p>
                    <p className="mt-2 text-xs text-gray-400">
                      Joined {formatDate(user.createdAt)}{user.address ? ` · ${user.address}` : ''}
                    </p>
                  </div>
                  <Button
                    variant={user.isActive ? 'ghost' : 'secondary'}
                    onClick={() => void handleToggle(user.id)}
                    isLoading={togglingId === user.id}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setResetPasswordUserId(user.id)}>
                    Reset Password
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        {resetPasswordUserId ? (
          <div className="mt-6 rounded-2xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-4">Enter a new password for this user.</p>
            <Input
              label="New Password"
              type="password"
              value={resetPasswordValue}
              onChange={e => setResetPasswordValue(e.target.value)}
              placeholder="At least 6 characters"
            />
            <div className="flex gap-3 mt-4">
              <Button
                isLoading={resettingPassword}
                onClick={async () => {
                  if (!resetPasswordValue || resetPasswordValue.length < 6) return;
                  setResettingPassword(true);
                  try {
                    await userService.resetPassword(resetPasswordUserId!, resetPasswordValue);
                    setResetPasswordUserId(null);
                    setResetPasswordValue('');
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setResettingPassword(false);
                  }
                }}
              >
                Save New Password
              </Button>
              <Button variant="outline" onClick={() => { setResetPasswordUserId(null); setResetPasswordValue(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export const CategoryManagementScreen: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormValues>(createEmptyCategoryForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CategoryFormValues, string>>>({});

  const loadCategories = async () => {
    setLoading(true);
    setError('');

    try {
      const loadedCategories = await categoryService.getAllCategories();
      setCategories(loadedCategories);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load categories right now.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categories;

    return categories.filter(category =>
      [category.name, category.description, category.icon ?? ''].some(value => value.toLowerCase().includes(query))
    );
  }, [categories, search]);

  const resetForm = () => {
    setEditingId(null);
    setForm(createEmptyCategoryForm());
    setFormErrors({});
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateCategoryForm(form);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setError('');

    const payload: CategoryInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      icon: form.icon.trim() || undefined,
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await categoryService.updateCategory(editingId, payload);
      } else {
        await categoryService.createCategory(payload);
      }

      resetForm();
      await loadCategories();
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to save category right now.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    setError('');

    try {
      await categoryService.toggleCategoryStatus(id);
      await loadCategories();
    } catch (toggleError) {
      setError(getErrorMessage(toggleError, 'Unable to update category status right now.'));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Category management</h1>
          <p className="mt-2 text-sm text-gray-500">Add, edit, and activate the categories used across the pharmacy catalog.</p>
        </div>
        <Button variant="outline" onClick={() => void loadCategories()} isLoading={loading}>
          <RefreshCw size={16} className="mr-2" />
          Refresh
        </Button>
      </div>

      {error ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-6">
          <div className="max-w-md">
            <Input
              label="Search categories"
              placeholder="Search by category name or description"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>

          <div className="mt-5 space-y-4">
            {loading ? (
              <p className="text-sm text-gray-500">Loading categories...</p>
            ) : filteredCategories.length === 0 ? (
              <EmptyState title="No categories found" description="Add a category to support better medicine organization." />
            ) : (
              filteredCategories.map(category => (
                <div key={category.id} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">{category.name}</p>
                        <Badge variant={category.isActive ? 'success' : 'neutral'}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">{category.description}</p>
                      {category.icon ? <p className="mt-2 text-xs text-gray-400">Icon: {category.icon}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" onClick={() => {
                        setEditingId(category.id);
                        setForm(mapCategoryToForm(category));
                        setFormErrors({});
                      }}>
                        Edit
                      </Button>
                      <Button
                        variant={category.isActive ? 'ghost' : 'secondary'}
                        onClick={() => void handleToggle(category.id)}
                        isLoading={togglingId === category.id}
                      >
                        {category.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit category' : 'Add category'}</h2>
            <p className="mt-1 text-sm text-gray-500">Keep category metadata aligned with the existing catalog model.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <Input label="Name" value={form.name} error={formErrors.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <textarea
                rows={4}
                className={textareaClasses}
                value={form.description}
                onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
              />
              {formErrors.description ? <p className="text-xs text-red-500">{formErrors.description}</p> : null}
            </div>
            <Input label="Icon (optional)" value={form.icon} onChange={event => setForm(current => ({ ...current, icon: event.target.value }))} />
            <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={form.isActive} onChange={event => setForm(current => ({ ...current, isActive: event.target.checked }))} />
              Category active
            </label>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" isLoading={submitting}>
                {editingId ? 'Save category' : 'Add category'}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export const MedicineOversightScreen: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'inactive' | 'out-of-stock' | 'featured'>('all');

  useEffect(() => {
    let mounted = true;

    const loadMedicines = async () => {
      setLoading(true);
      setError('');

      try {
        const loadedMedicines = await medicineService.getMedicines();
        if (!mounted) return;
        setMedicines(loadedMedicines);
      } catch (loadError) {
        if (!mounted) return;
        setError(getErrorMessage(loadError, 'Unable to load medicines right now.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadMedicines();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredMedicines = useMemo(() => {
    const query = search.trim().toLowerCase();

    return medicines.filter(medicine => {
      const matchesQuery =
        !query ||
        [medicine.name, medicine.genericName, medicine.brandName, medicine.categoryName, medicine.manufacturer]
          .some(value => value.toLowerCase().includes(query));

      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'inactive'
            ? !medicine.isActive
            : filter === 'out-of-stock'
              ? medicine.stockQuantity <= 0
              : medicine.isFeatured;

      return matchesQuery && matchesFilter;
    });
  }, [filter, medicines, search]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Medicine oversight</h1>
        <p className="mt-2 text-sm text-gray-500">Review catalog health across active status, featured items, and stock availability.</p>
      </div>

      {error ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      <Card className="p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <Input
            label="Search medicines"
            placeholder="Search by medicine, category, or manufacturer"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {([
              ['all', 'All'],
              ['inactive', 'Inactive'],
              ['out-of-stock', 'Out of stock'],
              ['featured', 'Featured'],
            ] as const).map(([value, label]) => (
              <Button key={value} variant={filter === value ? 'primary' : 'outline'} size="sm" onClick={() => setFilter(value)}>
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="text-sm text-gray-500">Loading medicines...</div>
      ) : filteredMedicines.length === 0 ? (
        <EmptyState title="No medicines found" description="No medicines match the current oversight filter." />
      ) : (
        <div className="space-y-4">
          {filteredMedicines.map(medicine => (
            <Card key={medicine.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">{medicine.name}</p>
                    <Badge variant={getMedicineStatusVariant(medicine)}>
                      {!medicine.isActive ? 'Inactive' : medicine.stockQuantity <= 0 ? 'Out of stock' : medicine.stockQuantity <= LOW_STOCK_THRESHOLD ? 'Low stock' : 'Active'}
                    </Badge>
                    {medicine.isFeatured ? <Badge variant="info">Featured</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{medicine.categoryName} · {medicine.manufacturer}</p>
                  <p className="text-sm text-gray-500">Stock: {medicine.stockQuantity} · Price: {formatCurrency(medicine.price)}</p>
                </div>
                <div className="text-sm text-gray-500">Updated {formatDate(medicine.updatedAt)}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export const AdminReportsScreen: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadReports = async () => {
      setLoading(true);
      setError('');

      try {
        const [loadedUsers, loadedMedicines, loadedOrders] = await Promise.all([
          userService.getUsers(),
          medicineService.getMedicines(),
          orderService.getOrders(),
        ]);

        if (!mounted) return;
        setUsers(loadedUsers);
        setMedicines(loadedMedicines);
        setOrders(loadedOrders);
      } catch (loadError) {
        if (!mounted) return;
        setError(getErrorMessage(loadError, 'Unable to load reports right now.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadReports();

    return () => {
      mounted = false;
    };
  }, []);

  const userCounts = {
    customers: users.filter(user => user.role === UserRole.CUSTOMER).length,
    pharmacists: users.filter(user => user.role === UserRole.PHARMACIST).length,
    superAdmins: users.filter(user => user.role === UserRole.SUPERADMIN).length,
  };

  const medicineCounts = {
    active: medicines.filter(medicine => medicine.isActive).length,
    inactive: medicines.filter(medicine => !medicine.isActive).length,
    lowStock: medicines.filter(medicine => medicine.isActive && medicine.stockQuantity > 0 && medicine.stockQuantity <= LOW_STOCK_THRESHOLD).length,
    outOfStock: medicines.filter(medicine => medicine.stockQuantity <= 0).length,
    featured: medicines.filter(medicine => medicine.isFeatured).length,
  };

  if (loading) {
    return <div className="p-6 lg:p-8 text-sm text-gray-500">Loading reports...</div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports and overview</h1>
        <p className="mt-2 text-sm text-gray-500">Lightweight system reporting built from the current backend data returned by the live API.</p>
      </div>

      {error ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Users by role</h2>
          <div className="mt-5 space-y-3 text-sm text-gray-600">
            <div className="flex items-center justify-between"><span>Customers</span><span>{userCounts.customers}</span></div>
            <div className="flex items-center justify-between"><span>Pharmacists</span><span>{userCounts.pharmacists}</span></div>
            <div className="flex items-center justify-between"><span>SuperAdmins</span><span>{userCounts.superAdmins}</span></div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Medicines by stock state</h2>
          <div className="mt-5 space-y-3 text-sm text-gray-600">
            <div className="flex items-center justify-between"><span>Active</span><span>{medicineCounts.active}</span></div>
            <div className="flex items-center justify-between"><span>Inactive</span><span>{medicineCounts.inactive}</span></div>
            <div className="flex items-center justify-between"><span>Low stock</span><span>{medicineCounts.lowStock}</span></div>
            <div className="flex items-center justify-between"><span>Out of stock</span><span>{medicineCounts.outOfStock}</span></div>
            <div className="flex items-center justify-between"><span>Featured</span><span>{medicineCounts.featured}</span></div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Orders by status</h2>
          <div className="mt-5 space-y-3">
            {Object.values(OrderStatus).map(status => (
              <div key={status} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                <Badge variant={getOrderStatusVariant(status)}>{status}</Badge>
                <span className="text-sm font-semibold text-gray-900">
                  {orders.filter(order => order.orderStatus === status).length}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export const AdminSettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState({
    customerRegistrationEnabled: true,
    allowFeaturedMedicines: true,
    showLowStockWarnings: true,
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">App settings</h1>
        <p className="mt-2 text-sm text-gray-500">Safe placeholder controls for future backend-backed system configuration.</p>
      </div>

      <Card className="p-6">
        <p className="text-sm text-gray-500">
          These values are still local to the current browser session. They provide route continuity until real settings persistence is added.
        </p>
        <div className="mt-5 space-y-4">
          <label className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-4">
            <div>
              <p className="font-medium text-gray-900">Customer registration</p>
              <p className="text-sm text-gray-500">Controls whether new customers could sign up once backend auth is added.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.customerRegistrationEnabled}
              onChange={event => setSettings(current => ({ ...current, customerRegistrationEnabled: event.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-4">
            <div>
              <p className="font-medium text-gray-900">Featured medicines</p>
              <p className="text-sm text-gray-500">Keeps a local switch for merchandising rules until backend settings are available.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.allowFeaturedMedicines}
              onChange={event => setSettings(current => ({ ...current, allowFeaturedMedicines: event.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-4">
            <div>
              <p className="font-medium text-gray-900">Low stock warnings</p>
              <p className="text-sm text-gray-500">Keeps alerting behavior configurable without backend settings yet.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.showLowStockWarnings}
              onChange={event => setSettings(current => ({ ...current, showLowStockWarnings: event.target.checked }))}
            />
          </label>
        </div>
      </Card>
    </div>
  );
};
