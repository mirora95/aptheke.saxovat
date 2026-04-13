import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Package,
  PackagePlus,
  Pencil,
  RefreshCw,
  Save,
} from 'lucide-react';
import { Badge, Button, Card, Input } from '../components/UI';
import {
  categoryService,
  getAllowedOrderStatusUpdates,
  LOW_STOCK_THRESHOLD,
  medicineService,
  ServiceError,
  orderService,
  userService,
} from '../services';
import { Category, Medicine, MedicineInput, Order, OrderStatus, User } from '../types';

const FALLBACK_IMAGE = 'https://placehold.co/400x400/e5e7eb/6b7280?text=Saxovat';
const fieldClasses =
  'flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500';
const textareaClasses =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pending',
  [OrderStatus.CONFIRMED]: 'Confirmed',
  [OrderStatus.PREPARING]: 'Preparing',
  [OrderStatus.READY]: 'Ready',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Out for delivery',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
};

type MedicineListFilter = 'all' | 'low-stock' | 'out-of-stock' | 'inactive';

type MedicineFormValues = {
  name: string;
  genericName: string;
  brandName: string;
  categoryId: string;
  description: string;
  shortDescription: string;
  price: string;
  discountPrice: string;
  stockQuantity: string;
  manufacturer: string;
  dosageForm: string;
  strength: string;
  packageSize: string;
  imageUrl: string;
  requiresPrescription: boolean;
  isFeatured: boolean;
  isActive: boolean;
};

type MedicineFormErrors = Partial<Record<keyof MedicineFormValues, string>>;

const formatCurrency = (amount: number) => `${new Intl.NumberFormat('en-US').format(amount)} UZS`;
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));

const createEmptyMedicineForm = (): MedicineFormValues => ({
  name: '',
  genericName: '',
  brandName: '',
  categoryId: '',
  description: '',
  shortDescription: '',
  price: '',
  discountPrice: '',
  stockQuantity: '',
  manufacturer: '',
  dosageForm: '',
  strength: '',
  packageSize: '',
  imageUrl: '',
  requiresPrescription: false,
  isFeatured: false,
  isActive: true,
});

const mapMedicineToForm = (medicine: Medicine): MedicineFormValues => ({
  name: medicine.name,
  genericName: medicine.genericName,
  brandName: medicine.brandName,
  categoryId: medicine.categoryId,
  description: medicine.description,
  shortDescription: medicine.shortDescription,
  price: String(medicine.price),
  discountPrice: medicine.discountPrice === undefined ? '' : String(medicine.discountPrice),
  stockQuantity: String(medicine.stockQuantity),
  manufacturer: medicine.manufacturer,
  dosageForm: medicine.dosageForm,
  strength: medicine.strength,
  packageSize: medicine.packageSize,
  imageUrl: medicine.imageUrl,
  requiresPrescription: medicine.requiresPrescription,
  isFeatured: medicine.isFeatured,
  isActive: medicine.isActive,
});

const validateMedicineForm = (values: MedicineFormValues) => {
  const errors: MedicineFormErrors = {};
  const requiredFields: Array<keyof MedicineFormValues> = [
    'name',
    'genericName',
    'brandName',
    'categoryId',
    'description',
    'shortDescription',
    'manufacturer',
    'dosageForm',
    'strength',
    'packageSize',
    'imageUrl',
  ];

  requiredFields.forEach(field => {
    if (!String(values[field]).trim()) {
      errors[field] = 'Required';
    }
  });

  const price = Number(values.price);
  if (!values.price.trim()) {
    errors.price = 'Required';
  } else if (!Number.isFinite(price) || price < 0) {
    errors.price = 'Use a valid non-negative number';
  }

  const stock = Number(values.stockQuantity);
  if (!values.stockQuantity.trim()) {
    errors.stockQuantity = 'Required';
  } else if (!Number.isInteger(stock) || stock < 0) {
    errors.stockQuantity = 'Use a valid whole number';
  }

  if (values.discountPrice.trim()) {
    const discountPrice = Number(values.discountPrice);
    if (!Number.isFinite(discountPrice) || discountPrice < 0) {
      errors.discountPrice = 'Use a valid non-negative number';
    }
  }

  return errors;
};

const mapFormToMedicineInput = (values: MedicineFormValues): MedicineInput => ({
  name: values.name.trim(),
  genericName: values.genericName.trim(),
  brandName: values.brandName.trim(),
  categoryId: values.categoryId,
  description: values.description.trim(),
  shortDescription: values.shortDescription.trim(),
  price: Number(values.price),
  discountPrice: values.discountPrice.trim() ? Number(values.discountPrice) : undefined,
  stockQuantity: Number(values.stockQuantity),
  manufacturer: values.manufacturer.trim(),
  dosageForm: values.dosageForm.trim(),
  strength: values.strength.trim(),
  packageSize: values.packageSize.trim(),
  imageUrl: values.imageUrl.trim(),
  requiresPrescription: values.requiresPrescription,
  isFeatured: values.isFeatured,
  isActive: values.isActive,
});

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ServiceError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

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

const onImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.src = FALLBACK_IMAGE;
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

const MedicineForm: React.FC<{
  values: MedicineFormValues;
  errors: MedicineFormErrors;
  categories: Category[];
  onChange: (field: keyof MedicineFormValues, value: string | boolean) => void;
}> = ({ values, errors, categories, onChange }) => (
  <div className="space-y-8">
    <Card className="p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Input label="Name" value={values.name} error={errors.name} onChange={event => onChange('name', event.target.value)} />
        <Input
          label="Generic name"
          value={values.genericName}
          error={errors.genericName}
          onChange={event => onChange('genericName', event.target.value)}
        />
        <Input
          label="Brand name"
          value={values.brandName}
          error={errors.brandName}
          onChange={event => onChange('brandName', event.target.value)}
        />
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Category</label>
          <select className={fieldClasses} value={values.categoryId} onChange={event => onChange('categoryId', event.target.value)}>
            <option value="">Select category</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {errors.categoryId ? <p className="text-xs text-red-500">{errors.categoryId}</p> : null}
        </div>
        <Input
          label="Manufacturer"
          value={values.manufacturer}
          error={errors.manufacturer}
          onChange={event => onChange('manufacturer', event.target.value)}
        />
        <Input
          label="Dosage form"
          value={values.dosageForm}
          error={errors.dosageForm}
          onChange={event => onChange('dosageForm', event.target.value)}
        />
        <Input
          label="Strength"
          value={values.strength}
          error={errors.strength}
          onChange={event => onChange('strength', event.target.value)}
        />
        <Input
          label="Package size"
          value={values.packageSize}
          error={errors.packageSize}
          onChange={event => onChange('packageSize', event.target.value)}
        />
        <Input
          label="Price (UZS)"
          type="number"
          min="0"
          step="1"
          value={values.price}
          error={errors.price}
          onChange={event => onChange('price', event.target.value)}
        />
        <Input
          label="Discount price (optional)"
          type="number"
          min="0"
          step="1"
          value={values.discountPrice}
          error={errors.discountPrice}
          onChange={event => onChange('discountPrice', event.target.value)}
        />
        <Input
          label="Stock quantity"
          type="number"
          min="0"
          step="1"
          value={values.stockQuantity}
          error={errors.stockQuantity}
          onChange={event => onChange('stockQuantity', event.target.value)}
        />
        <Input
          label="Image URL"
          value={values.imageUrl}
          error={errors.imageUrl}
          onChange={event => onChange('imageUrl', event.target.value)}
        />
      </div>
    </Card>

    <Card className="p-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Short description</label>
          <textarea
            rows={3}
            className={textareaClasses}
            value={values.shortDescription}
            onChange={event => onChange('shortDescription', event.target.value)}
          />
          {errors.shortDescription ? <p className="text-xs text-red-500">{errors.shortDescription}</p> : null}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea rows={5} className={textareaClasses} value={values.description} onChange={event => onChange('description', event.target.value)} />
          {errors.description ? <p className="text-xs text-red-500">{errors.description}</p> : null}
        </div>
      </div>
    </Card>

    <Card className="p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={values.requiresPrescription}
            onChange={event => onChange('requiresPrescription', event.target.checked)}
          />
          Requires prescription
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
          <input type="checkbox" checked={values.isFeatured} onChange={event => onChange('isFeatured', event.target.checked)} />
          Featured
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
          <input type="checkbox" checked={values.isActive} onChange={event => onChange('isActive', event.target.checked)} />
          Active
        </label>
      </div>
    </Card>
  </div>
);

const MedicineListCard: React.FC<{
  medicine: Medicine;
  stockDraft: string;
  onStockDraftChange: (id: string, value: string) => void;
  onStockSave: (id: string) => void;
  isSavingStock: boolean;
}> = ({ medicine, stockDraft, onStockDraftChange, onStockSave, isSavingStock }) => {
  const stockValue = Number(stockDraft);
  const stockIsInvalid = stockDraft.trim() === '' || !Number.isInteger(stockValue) || stockValue < 0;
  const stockIsUnchanged = stockDraft.trim() !== '' && stockValue === medicine.stockQuantity;
  const canSaveStock = !stockIsInvalid && !stockIsUnchanged && !isSavingStock;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <img src={medicine.imageUrl || FALLBACK_IMAGE} alt={medicine.name} className="h-28 w-28 rounded-2xl object-cover bg-gray-100" onError={onImageError} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{medicine.name}</h2>
                <Badge variant={getMedicineStatusVariant(medicine)}>
                  {!medicine.isActive ? 'Inactive' : medicine.stockQuantity <= 0 ? 'Out of stock' : medicine.stockQuantity <= LOW_STOCK_THRESHOLD ? 'Low stock' : 'Active'}
                </Badge>
                {medicine.requiresPrescription ? <Badge variant="info">Rx</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-gray-500">{medicine.genericName}</p>
              <p className="mt-3 text-sm text-gray-500">{medicine.categoryName} · {medicine.manufacturer}</p>
              <p className="mt-3 text-lg font-semibold text-gray-900">{formatCurrency(medicine.price)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
              SKU: <span className="font-medium text-gray-800">{medicine.sku}</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="Stock quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={stockDraft}
                  onChange={event => onStockDraftChange(medicine.id, event.target.value)}
                />
              </div>
              <Button className="sm:shrink-0" onClick={() => onStockSave(medicine.id)} disabled={!canSaveStock} isLoading={isSavingStock}>
                <Save size={16} className="mr-2" />
                Update stock
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link to={`/pharmacist/medicines/${medicine.id}/edit`}>
              <Button variant="outline">
                <Pencil size={16} className="mr-2" />
                Edit medicine
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
};

const MedicineEditorScreen: React.FC<{ mode: 'add' | 'edit' }> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form, setForm] = useState<MedicineFormValues>(createEmptyMedicineForm());
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<MedicineFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [missingMedicine, setMissingMedicine] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadForm = async () => {
      setLoading(true);
      setScreenError('');
      setMissingMedicine(false);

      try {
        const [loadedCategories, medicine] = await Promise.all([
          categoryService.getCategories(),
          mode === 'edit' && id ? medicineService.getMedicineById(id) : Promise.resolve(undefined),
        ]);

        if (!mounted) return;

        setCategories(loadedCategories);

        if (mode === 'edit') {
          if (!medicine) {
            setMissingMedicine(true);
            return;
          }

          setForm(mapMedicineToForm(medicine));
        }
      } catch (error) {
        if (!mounted) return;
        setScreenError(getErrorMessage(error, 'Unable to load medicine form right now.'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadForm();

    return () => {
      mounted = false;
    };
  }, [id, mode]);

  const handleChange = (field: keyof MedicineFormValues, value: string | boolean) => {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateMedicineForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setScreenError('');

    try {
      const payload = mapFormToMedicineInput(form);

      if (mode === 'edit' && id) {
        await medicineService.updateMedicine(id, payload);
      } else {
        await medicineService.createMedicine(payload);
      }

      navigate('/pharmacist/medicines', { replace: true });
    } catch (error) {
      setScreenError(getErrorMessage(error, `Unable to ${mode === 'edit' ? 'update' : 'create'} medicine right now.`));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 lg:p-8 text-sm text-gray-500">Loading medicine form...</div>;
  }

  if (missingMedicine) {
    return (
      <div className="p-6 lg:p-8">
        <EmptyState
          title="Medicine not found"
          description="The medicine you are trying to edit does not exist anymore."
          action={
            <Link to="/pharmacist/medicines">
              <Button variant="outline">
                <ArrowLeft size={16} className="mr-2" />
                Back to medicines
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link to="/pharmacist/medicines" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
            <ArrowLeft size={16} className="mr-2" />
            Back to medicines
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">{mode === 'edit' ? 'Edit medicine' : 'Add medicine'}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {mode === 'edit'
              ? 'Update medicine details, inventory, and customer-facing availability.'
              : 'Create a new medicine record using the existing pharmacy catalog model.'}
          </p>
        </div>
      </div>

      {screenError ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{screenError}</Card> : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <MedicineForm values={form} errors={errors} categories={categories} onChange={handleChange} />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" isLoading={submitting}>
            <Save size={16} className="mr-2" />
            {mode === 'edit' ? 'Save changes' : 'Create medicine'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/pharmacist/medicines')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export const PharmacistDashboard: React.FC = () => {
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
        const [loadedMedicines, loadedOrders] = await Promise.all([medicineService.getMedicines(), orderService.getOrders()]);

        if (!mounted) return;

        setMedicines(loadedMedicines);
        setOrders(loadedOrders);
      } catch (loadError) {
        if (!mounted) return;
        setError(getErrorMessage(loadError, 'Unable to load pharmacist dashboard right now.'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const totalMedicines = medicines.length;
  const activeMedicines = medicines.filter(medicine => medicine.isActive).length;
  const outOfStockMedicines = medicines.filter(medicine => medicine.stockQuantity <= 0).length;
  const lowStockMedicines = medicines.filter(
    medicine => medicine.isActive && medicine.stockQuantity > 0 && medicine.stockQuantity <= LOW_STOCK_THRESHOLD
  );
  const pendingOrders = orders.filter(order => order.orderStatus === OrderStatus.PENDING).length;

  if (loading) {
    return <div className="p-6 lg:p-8 text-sm text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pharmacist dashboard</h1>
          <p className="mt-2 text-sm text-gray-500">Monitor stock, keep medicine data current, and process customer orders from one place.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/pharmacist/medicines/add">
            <Button>
              <PackagePlus size={16} className="mr-2" />
              Add medicine
            </Button>
          </Link>
          <Link to="/pharmacist/orders">
            <Button variant="outline">
              <ClipboardList size={16} className="mr-2" />
              View orders
            </Button>
          </Link>
        </div>
      </div>

      {error ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total medicines" value={totalMedicines} hint="All catalog records" icon={<Package size={22} />} />
        <SummaryCard title="Pending orders" value={pendingOrders} hint="Orders waiting for action" icon={<ClipboardList size={22} />} />
        <SummaryCard
          title="Low stock"
          value={lowStockMedicines.length}
          hint={`Threshold: ${LOW_STOCK_THRESHOLD} units or fewer`}
          icon={<AlertTriangle size={22} />}
        />
        <SummaryCard
          title="Active / out of stock"
          value={`${activeMedicines} / ${outOfStockMedicines}`}
          hint="Available catalog vs zero stock"
          icon={<RefreshCw size={22} />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Low stock alerts</h2>
              <p className="mt-1 text-sm text-gray-500">Medicines that need replenishment soon.</p>
            </div>
            <Link to="/pharmacist/medicines">
              <Button variant="ghost" size="sm">Manage stock</Button>
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {lowStockMedicines.length === 0 ? (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">No low stock alerts right now.</p>
            ) : (
              lowStockMedicines.slice(0, 5).map(medicine => (
                <div key={medicine.id} className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{medicine.name}</p>
                    <p className="text-sm text-gray-500">{medicine.categoryName}</p>
                  </div>
                  <Badge variant="warning">{medicine.stockQuantity} left</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Recent orders</h2>
              <p className="mt-1 text-sm text-gray-500">Newest customer orders that may need pharmacist action.</p>
            </div>
            <Link to="/pharmacist/orders">
              <Button variant="ghost" size="sm">Open orders</Button>
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {orders.length === 0 ? (
              <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">No orders have been placed yet.</p>
            ) : (
              orders.slice(0, 5).map(order => (
                <Link key={order.id} to={`/pharmacist/orders/${order.id}`} className="block rounded-2xl border border-gray-100 px-4 py-3 hover:border-blue-200 hover:bg-blue-50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{order.orderNumber}</p>
                      <p className="mt-1 text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={getOrderStatusVariant(order.orderStatus)}>{ORDER_STATUS_LABELS[order.orderStatus]}</Badge>
                      <p className="mt-2 text-sm font-medium text-gray-700">{formatCurrency(order.totalAmount)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export const PharmacistMedicinesScreen: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MedicineListFilter>('all');
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [savingStockId, setSavingStockId] = useState<string | null>(null);

  const loadMedicines = async () => {
    setLoading(true);
    setError('');

    try {
      const loadedMedicines = await medicineService.getMedicines();
      setMedicines(loadedMedicines);
      setStockDrafts(
        loadedMedicines.reduce<Record<string, string>>((drafts, medicine) => {
          drafts[medicine.id] = String(medicine.stockQuantity);
          return drafts;
        }, {})
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load medicines right now.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMedicines();
  }, []);

  const filteredMedicines = useMemo(() => {
    const query = search.trim().toLowerCase();

    return medicines.filter(medicine => {
      const matchesQuery =
        !query ||
        medicine.name.toLowerCase().includes(query) ||
        medicine.genericName.toLowerCase().includes(query) ||
        medicine.brandName.toLowerCase().includes(query) ||
        medicine.categoryName.toLowerCase().includes(query);

      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'low-stock'
            ? medicine.isActive && medicine.stockQuantity > 0 && medicine.stockQuantity <= LOW_STOCK_THRESHOLD
            : filter === 'out-of-stock'
              ? medicine.stockQuantity <= 0
              : !medicine.isActive;

      return matchesQuery && matchesFilter;
    });
  }, [filter, medicines, search]);

  const handleStockDraftChange = (id: string, value: string) => {
    setStockDrafts(current => ({ ...current, [id]: value }));
  };

  const handleStockSave = async (id: string) => {
    const nextStockValue = Number(stockDrafts[id]);
    if (!Number.isInteger(nextStockValue) || nextStockValue < 0) {
      setError('Stock quantity must be a whole number of 0 or more.');
      return;
    }

    setSavingStockId(id);
    setError('');

    try {
      const updatedMedicine = await medicineService.updateMedicineStock(id, nextStockValue);
      setMedicines(current => current.map(medicine => (medicine.id === id ? updatedMedicine : medicine)));
      setStockDrafts(current => ({ ...current, [id]: String(updatedMedicine.stockQuantity) }));
    } catch (updateError) {
      setError(getErrorMessage(updateError, 'Unable to update stock right now.'));
    } finally {
      setSavingStockId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Medicine management</h1>
          <p className="mt-2 text-sm text-gray-500">Manage medicine details, inventory levels, and customer-facing availability.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void loadMedicines()} isLoading={loading}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
          <Link to="/pharmacist/medicines/add">
            <Button>
              <PackagePlus size={16} className="mr-2" />
              Add medicine
            </Button>
          </Link>
        </div>
      </div>

      {error ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      <Card className="p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <Input
            label="Search medicines"
            placeholder="Search by name, generic name, brand, or category"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {([
              ['all', 'All'],
              ['low-stock', 'Low stock'],
              ['out-of-stock', 'Out of stock'],
              ['inactive', 'Inactive'],
            ] as Array<[MedicineListFilter, string]>).map(([value, label]) => (
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
        <EmptyState
          title="No medicines found"
          description="Try a different filter or add a new medicine to the catalog."
          action={
            <Link to="/pharmacist/medicines/add">
              <Button>Add medicine</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredMedicines.map(medicine => (
            <MedicineListCard
              key={medicine.id}
              medicine={medicine}
              stockDraft={stockDrafts[medicine.id] ?? String(medicine.stockQuantity)}
              onStockDraftChange={handleStockDraftChange}
              onStockSave={handleStockSave}
              isSavingStock={savingStockId === medicine.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const PharmacistAddMedicineScreen: React.FC = () => <MedicineEditorScreen mode="add" />;

export const PharmacistEditMedicineScreen: React.FC = () => <MedicineEditorScreen mode="edit" />;

export const PharmacistOrdersScreen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadOrders = async () => {
      setLoading(true);
      setError('');

      try {
        const [loadedOrders, loadedUsers] = await Promise.all([orderService.getOrders(), userService.getUsers()]);

        if (!mounted) return;

        setOrders(loadedOrders);
        setUsers(loadedUsers);
      } catch (loadError) {
        if (!mounted) return;
        setError(getErrorMessage(loadError, 'Unable to load orders right now.'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadOrders();

    return () => {
      mounted = false;
    };
  }, []);

  const customerNameById = useMemo(
    () =>
      users.reduce<Record<string, string>>((accumulator, user) => {
        accumulator[user.id] = user.fullName;
        return accumulator;
      }, {}),
    [users]
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Customer orders</h1>
        <p className="mt-2 text-sm text-gray-500">Review new orders, inspect details, and move each order through the pharmacy workflow.</p>
      </div>

      {error ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      {loading ? (
        <div className="text-sm text-gray-500">Loading orders...</div>
      ) : orders.length === 0 ? (
        <EmptyState title="No orders yet" description="Customer orders will appear here once checkout is completed." />
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">{order.orderNumber}</h2>
                    <Badge variant={getOrderStatusVariant(order.orderStatus)}>{ORDER_STATUS_LABELS[order.orderStatus]}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    {customerNameById[order.customerId] ?? 'Unknown customer'} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(order.totalAmount)}</p>
                  </div>
                  <Link to={`/pharmacist/orders/${order.id}`}>
                    <Button variant="outline">Open details</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export const PharmacistOrderDetailsScreen: React.FC = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadOrder = async () => {
      setLoading(true);
      setError('');

      try {
        const loadedOrder = id ? await orderService.getOrderById(id) : undefined;

        if (!mounted) return;

        if (!loadedOrder) {
          setOrder(null);
          setCustomer(null);
          setSelectedStatus('');
          return;
        }

        const loadedCustomer = await userService.getUserById(loadedOrder.customerId);

        if (!mounted) return;

        setOrder(loadedOrder);
        setCustomer(loadedCustomer ?? null);
        setSelectedStatus(loadedOrder.orderStatus);
      } catch (loadError) {
        if (!mounted) return;
        setError(getErrorMessage(loadError, 'Unable to load order details right now.'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadOrder();

    return () => {
      mounted = false;
    };
  }, [id]);

  const allowedStatusOptions = order ? [order.orderStatus, ...getAllowedOrderStatusUpdates(order.orderStatus)] : [];
  const canUpdateStatus =
    !!order &&
    selectedStatus !== '' &&
    selectedStatus !== order.orderStatus &&
    allowedStatusOptions.includes(selectedStatus as OrderStatus);

  const handleStatusUpdate = async () => {
    if (!order || !canUpdateStatus) return;

    setUpdatingStatus(true);
    setError('');

    try {
      const updatedOrder = await orderService.updateOrderStatus(order.id, selectedStatus as OrderStatus);
      setOrder(updatedOrder);
      setSelectedStatus(updatedOrder.orderStatus);
    } catch (updateError) {
      setError(getErrorMessage(updateError, 'Unable to update order status right now.'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return <div className="p-6 lg:p-8 text-sm text-gray-500">Loading order details...</div>;
  }

  if (!order) {
    return (
      <div className="p-6 lg:p-8">
        <EmptyState
          title="Order not found"
          description="The requested order could not be found."
          action={
            <Link to="/pharmacist/orders">
              <Button variant="outline">
                <ArrowLeft size={16} className="mr-2" />
                Back to orders
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link to="/pharmacist/orders" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
            <ArrowLeft size={16} className="mr-2" />
            Back to orders
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">{order.orderNumber}</h1>
          <p className="mt-2 text-sm text-gray-500">Created {formatDate(order.createdAt)} · Updated {formatDate(order.updatedAt)}</p>
        </div>
        <Badge variant={getOrderStatusVariant(order.orderStatus)}>{ORDER_STATUS_LABELS[order.orderStatus]}</Badge>
      </div>

      {error ? <Card className="border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900">Order items</h2>
            <div className="mt-5 space-y-4">
              {order.orderItems.map(item => (
                <div key={item.medicineId} className="flex items-center gap-4 rounded-2xl border border-gray-100 p-4">
                  <img src={item.imageUrl || FALLBACK_IMAGE} alt={item.medicineName} className="h-16 w-16 rounded-xl object-cover bg-gray-100" onError={onImageError} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{item.medicineName}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.totalPrice)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900">Customer details</h2>
            <div className="mt-4 grid gap-3 text-sm text-gray-600">
              <p><span className="font-medium text-gray-900">Name:</span> {customer?.fullName ?? 'Unknown customer'}</p>
              <p><span className="font-medium text-gray-900">Phone:</span> {customer?.phone ?? 'Not available'}</p>
              <p><span className="font-medium text-gray-900">Email:</span> {customer?.email ?? 'Not available'}</p>
              <p><span className="font-medium text-gray-900">Delivery:</span> {order.deliveryType}</p>
              <p><span className="font-medium text-gray-900">Address:</span> {order.deliveryAddress ?? 'Pickup order'}</p>
              <p><span className="font-medium text-gray-900">Notes:</span> {order.notes?.trim() || 'No notes provided'}</p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900">Status update</h2>
            <p className="mt-2 text-sm text-gray-500">Only valid workflow transitions are enabled for the current order status.</p>
            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Order status</label>
                <select className={fieldClasses} value={selectedStatus} onChange={event => setSelectedStatus(event.target.value as OrderStatus)}>
                  {allowedStatusOptions.map(status => (
                    <option key={status} value={status}>
                      {ORDER_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={handleStatusUpdate} disabled={!canUpdateStatus} isLoading={updatingStatus} className="w-full">
                Update order status
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900">Order totals</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Delivery fee</span>
                <span>{formatCurrency(order.deliveryFee)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Discount</span>
                <span>-{formatCurrency(order.discountAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-base font-semibold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
