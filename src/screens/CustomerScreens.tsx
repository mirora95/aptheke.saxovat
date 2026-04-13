import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Input } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { categoryService, medicineService, orderService } from '../services';
import { Category, Medicine, Order } from '../types';
import { formatDate, formatPrice } from '../lib/utils';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Search,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Truck,
} from 'lucide-react';
import { motion } from 'motion/react';

const FREE_DELIVERY_THRESHOLD = 50000;
const STANDARD_DELIVERY_FEE = 15000;
const FALLBACK_MEDICINE_IMAGE = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23eff6ff'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236b7280' font-family='Arial, sans-serif' font-size='28'%3ENo Image%3C/text%3E%3C/svg%3E";

const getSafeText = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const getMedicineImageSrc = (imageUrl: unknown) => getSafeText(imageUrl, FALLBACK_MEDICINE_IMAGE);
const getMedicineName = (medicine: Medicine) => getSafeText(medicine.name, 'Unknown medicine');
const getMedicineCategoryName = (medicine: Medicine) => getSafeText(medicine.categoryName, 'Uncategorized');
const getMedicineDescription = (medicine: Medicine) => getSafeText(medicine.description, 'Description is not available for this medicine yet.');
const getMedicineShortDescription = (medicine: Medicine) => getSafeText(medicine.shortDescription, 'Additional medicine details are not available right now.');
const getMedicineManufacturer = (medicine: Medicine) => getSafeText(medicine.manufacturer, 'Unknown manufacturer');
const getMedicineBrandName = (medicine: Medicine) => getSafeText(medicine.brandName, 'Brand not listed');
const getMedicineGenericName = (medicine: Medicine) => getSafeText(medicine.genericName, 'Generic name not listed');
const getMedicineDosageForm = (medicine: Medicine) => getSafeText(medicine.dosageForm, 'Not specified');
const getMedicineStrength = (medicine: Medicine) => getSafeText(medicine.strength, 'Not specified');
const getMedicinePackageSize = (medicine: Medicine) => getSafeText(medicine.packageSize, 'Not specified');
const getCategoryDescription = (category: Category | null, fallback: string) => category ? getSafeText(category.description, fallback) : fallback;
const getDeliveryFee = (subtotal: number, deliveryType: 'Delivery' | 'Pickup' = 'Delivery') =>
  subtotal > FREE_DELIVERY_THRESHOLD || deliveryType === 'Pickup' ? 0 : STANDARD_DELIVERY_FEE;

const normalizeCategoryList = (categories: Category[] | unknown) =>
  (Array.isArray(categories) ? categories : []).filter(
    (category): category is Category => Boolean(category && typeof category.id === 'string' && typeof category.name === 'string')
  );

const normalizeMedicineList = (medicines: Medicine[] | unknown) =>
  (Array.isArray(medicines) ? medicines : []).filter(
    (medicine): medicine is Medicine =>
      Boolean(medicine && typeof medicine.id === 'string' && typeof medicine.name === 'string')
  );

const normalizeOrderList = (orders: Order[] | unknown) =>
  (Array.isArray(orders) ? orders : []).filter(
    (order): order is Order => Boolean(order && typeof order.id === 'string' && typeof order.customerId === 'string')
  );

const getMedicineStockState = (medicine: Medicine) => {
  if (!medicine.isActive) {
    return { label: 'Unavailable', variant: 'error' as const, canPurchase: false };
  }

  if (medicine.stockQuantity <= 0) {
    return { label: 'Out of stock', variant: 'error' as const, canPurchase: false };
  }

  if (medicine.stockQuantity <= 20) {
    return { label: `${medicine.stockQuantity} left`, variant: 'warning' as const, canPurchase: true };
  }

  return { label: 'In stock', variant: 'success' as const, canPurchase: true };
};

const getOrderStatusVariant = (status: Order['orderStatus']) => {
  switch (status) {
    case 'Delivered':
      return 'success' as const;
    case 'Cancelled':
      return 'error' as const;
    default:
      return 'warning' as const;
  }
};

const EmptyState: React.FC<{ title: string; description: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    <p className="mt-3 text-sm leading-6 text-gray-500">{description}</p>
    {action ? <div className="mt-6">{action}</div> : null}
  </div>
);

const OrderSummaryCard: React.FC<{ subtotal: number; deliveryFee: number; total: number }> = ({ subtotal, deliveryFee, total }) => (
  <Card className="p-6">
    <h2 className="text-lg font-bold mb-4">Order Summary</h2>
    <div className="space-y-3 text-sm">
      <div className="flex justify-between text-gray-500">
        <span>Subtotal</span>
        <span className="text-gray-900 font-medium">{formatPrice(subtotal)}</span>
      </div>
      <div className="flex justify-between text-gray-500">
        <span>Delivery Fee</span>
        <span className="text-emerald-600 font-medium">{deliveryFee === 0 ? 'Free' : formatPrice(deliveryFee)}</span>
      </div>
      <div className="pt-3 border-t border-gray-100 flex justify-between text-lg font-bold">
        <span>Total</span>
        <span className="text-blue-600">{formatPrice(total)}</span>
      </div>
    </div>
  </Card>
);

const MedicineCard: React.FC<{ medicine: Medicine; onAddToCart: (medicine: Medicine) => void }> = ({ medicine, onAddToCart }) => {
  const stockState = getMedicineStockState(medicine);
  const medicineName = getMedicineName(medicine);

  return (
    <motion.div whileHover={{ y: -4 }}>
      <Card className="h-full flex flex-col">
        <Link to={`/medicine/${medicine.id}`} className="relative aspect-square overflow-hidden">
          <img
            src={getMedicineImageSrc(medicine.imageUrl)}
            alt={medicineName}
            className={medicine.stockQuantity <= 0 ? 'w-full h-full object-cover opacity-60' : 'w-full h-full object-cover'}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = FALLBACK_MEDICINE_IMAGE;
            }}
          />
          <div className="absolute top-2 left-2 flex flex-col gap-2">
            {medicine.requiresPrescription ? <Badge variant="warning">Rx</Badge> : null}
            <Badge variant={stockState.variant}>{stockState.label}</Badge>
          </div>
        </Link>
        <div className="p-4 flex-1 flex flex-col">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{getMedicineCategoryName(medicine)}</p>
          <Link to={`/medicine/${medicine.id}`} className="mt-1 text-sm font-bold text-gray-800 line-clamp-2 hover:text-blue-600 transition-colors">
            {medicineName}
          </Link>
          <p className="mt-1 text-xs text-gray-500 line-clamp-2">
            {getMedicineBrandName(medicine)} - {getMedicineDosageForm(medicine)} - {getMedicineStrength(medicine)}
          </p>
          <p className="mt-3 text-xs text-gray-500 line-clamp-2">{getMedicineShortDescription(medicine)}</p>
          <div className="mt-auto pt-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-blue-600">{formatPrice(medicine.price)}</p>
              <p className="text-[11px] text-gray-400">Manufacturer: {getMedicineManufacturer(medicine)}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="text-blue-600 hover:bg-blue-50"
              disabled={!stockState.canPurchase}
              onClick={() => onAddToCart(medicine)}
              aria-label={`Add ${medicineName} to cart`}
            >
              <ShoppingCart size={18} />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

const CustomerCatalogContent: React.FC<{ title: string; description: string }> = ({ title, description }) => {
  const { id: selectedCategoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const { addItem } = useCart();

  const query = searchParams.get('q')?.trim() ?? '';

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const [loadedCategories, baseMedicines] = await Promise.all([
          categoryService.getCategories(),
          query ? medicineService.searchMedicines(query) : medicineService.getActiveMedicines(),
        ]);

        const safeCategories = normalizeCategoryList(loadedCategories);
        const safeMedicines = normalizeMedicineList(baseMedicines);
        const filteredMedicines = selectedCategoryId
          ? safeMedicines.filter(medicine => medicine.categoryId === selectedCategoryId)
          : safeMedicines;

        setCategories(safeCategories);
        setMedicines(filteredMedicines);
      } catch (err: any) {
        setCategories([]);
        setMedicines([]);
        setLoadError(err.message ?? 'Unable to load medicines right now.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [query, selectedCategoryId]);

  const selectedCategory = useMemo(
    () => categories.find(category => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextQuery = searchValue.trim();
    const nextParams = new URLSearchParams(searchParams);

    if (nextQuery) {
      nextParams.set('q', nextQuery);
    } else {
      nextParams.delete('q');
    }

    setSearchParams(nextParams);
  };

  const handleCategoryChange = (categoryId?: string) => {
    const nextQuery = searchValue.trim();
    const nextPath = categoryId ? `/category/${categoryId}` : '/search';
    navigate(nextQuery ? `${nextPath}?q=${encodeURIComponent(nextQuery)}` : nextPath);
  };

  const handleAddToCart = (medicine: Medicine) => {
    const result = addItem(medicine);
    setNotice(result.success ? `${getMedicineName(medicine)} added to cart.` : result.message ?? 'Unable to add this medicine.');
  };

  if (loading) return <div className="p-8 text-center">Loading medicines...</div>;

  if (loadError) {
    return (
      <div className="p-4 md:p-6 pb-24 md:pb-8">
        <EmptyState
          title="Unable to load medicines"
          description={loadError}
          action={<Button onClick={() => navigate(0)}>Try Again</Button>}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8 space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Browse Medicines</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">{selectedCategory ? selectedCategory.name : title}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              {getCategoryDescription(selectedCategory, description)}
            </p>
          </div>
          <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {medicines.length} medicine{medicines.length === 1 ? '' : 's'} available
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by medicine, generic name, or brand"
              className="pl-10"
            />
          </div>
          <Button type="submit" className="h-10">Search</Button>
        </form>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleCategoryChange()}
            className={selectedCategoryId ? 'rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600' : 'rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700'}
          >
            All Categories
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              type="button"
              onClick={() => handleCategoryChange(category.id)}
              className={selectedCategoryId === category.id ? 'rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700' : 'rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600'}
            >
              {category.name}
            </button>
          ))}
        </div>
      </section>

      {notice ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {notice}
        </div>
      ) : null}

      {medicines.length === 0 ? (
        <EmptyState
          title="No medicines found"
          description={query || selectedCategoryId ? 'Try changing the search text or switching to another category.' : 'There are no active medicines available right now.'}
          action={<Button onClick={() => { setSearchValue(''); navigate('/search'); }}>Reset Filters</Button>}
        />
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {medicines.map(medicine => (
            <MedicineCard key={medicine.id} medicine={medicine} onAddToCart={handleAddToCart} />
          ))}
        </section>
      )}
    </div>
  );
};

export const CustomerHome: React.FC = () => {
  const [featured, setFeatured] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const { addItem } = useCart();

  useEffect(() => {
    const loadData = async () => {
      setLoadError('');

      try {
        const [featuredMedicines, loadedCategories] = await Promise.all([
          medicineService.getFeaturedMedicines(),
          categoryService.getCategories(),
        ]);

        setFeatured(normalizeMedicineList(featuredMedicines));
        setCategories(normalizeCategoryList(loadedCategories));
      } catch (err: any) {
        setFeatured([]);
        setCategories([]);
        setLoadError(err.message ?? 'Unable to load the customer catalog right now.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleAddToCart = (medicine: Medicine) => {
    const result = addItem(medicine);
    setNotice(result.success ? `${getMedicineName(medicine)} added to cart.` : result.message ?? 'Unable to add this medicine.');
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  if (loadError) {
    return (
      <div className="p-4 md:p-6 pb-24 md:pb-8">
        <EmptyState
          title="Unable to load the catalog"
          description={loadError}
          action={<Button onClick={() => window.location.reload()}>Try Again</Button>}
        />
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-8">
      <section className="bg-blue-600 text-white p-8 md:rounded-2xl md:mx-6 md:mt-6 overflow-hidden relative">
        <div className="relative z-10 max-w-lg">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">Your Health, Our Priority</h1>
          <p className="mt-4 text-blue-100">Browse active medicines, search quickly, and place your order in a few steps.</p>
          <Link to="/search">
            <Button variant="secondary" className="mt-6">Shop Now</Button>
          </Link>
        </div>
        <div className="absolute right-0 bottom-0 opacity-20 transform translate-x-1/4 translate-y-1/4">
          <ShoppingCart size={200} />
        </div>
      </section>

      {notice ? (
        <div className="mx-6 mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {notice}
        </div>
      ) : null}

      <section className="mt-8 px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Categories</h2>
          <Link to="/categories" className="text-blue-600 text-sm font-medium flex items-center">
            View All <ChevronRight size={16} />
          </Link>
        </div>
        <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide">
          {categories.length === 0 ? (
            <div className="w-full rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
              No categories available right now.
            </div>
          ) : categories.map(category => (
            <Link key={category.id} to={`/category/${category.id}`} className="flex-shrink-0">
              <div className="bg-white border border-gray-100 p-4 rounded-2xl flex flex-col items-center w-32 shadow-sm hover:border-blue-200 transition-colors">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-2">
                  <Stethoscope size={22} />
                </div>
                <span className="text-xs font-semibold text-gray-700 text-center">{category.name}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Featured Products</h2>
          <Link to="/search" className="text-blue-600 text-sm font-medium flex items-center">
            Browse Catalog <ChevronRight size={16} />
          </Link>
        </div>
        {featured.length === 0 ? (
          <EmptyState
            title="No medicines found"
            description="There are no featured active medicines available right now."
            action={<Link to="/search"><Button>Browse Full Catalog</Button></Link>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featured.map(medicine => (
              <MedicineCard key={medicine.id} medicine={medicine} onAddToCart={handleAddToCart} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export const CustomerCatalogScreen: React.FC = () => (
  <CustomerCatalogContent
    title="Medicine Catalog"
    description="Search medicines by name, generic name, or brand and narrow the list by category."
  />
);

export const CustomerCategoriesScreen: React.FC = () => (
  <CustomerCatalogContent
    title="Browse Categories"
    description="Filter the medicine catalog by category and compare availability before you order."
  />
);

export const MedicineDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const { addItem } = useCart();

  useEffect(() => {
    const load = async () => {
      setLoadError('');

      if (!id) {
        setMedicine(null);
        setLoading(false);
        return;
      }

      try {
        const foundMedicine = await medicineService.getMedicineById(id);
        setMedicine(foundMedicine?.isActive ? foundMedicine : null);
      } catch (err: any) {
        setMedicine(null);
        setLoadError(err.message ?? 'Unable to load this medicine right now.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (loadError) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          title="Unable to load medicine"
          description={loadError}
          action={<Button onClick={() => navigate('/search')}>Back to Catalog</Button>}
        />
      </div>
    );
  }
  if (!medicine) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          title="Medicine not found"
          description="The medicine you're trying to view is unavailable or does not exist."
          action={<Button onClick={() => navigate('/search')}>Back to Catalog</Button>}
        />
      </div>
    );
  }

  const stockState = getMedicineStockState(medicine);
  const medicineName = getMedicineName(medicine);

  const handleAddToCart = () => {
    const result = addItem(medicine);
    setNotice(result.success ? `${medicineName} added to cart.` : result.message ?? 'Unable to add this medicine.');
  };

  return (
    <div className="pb-20 md:pb-8">
      <div className="p-4 md:p-6">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-blue-600 mb-6">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>

        {notice ? (
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {notice}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Card className="aspect-square overflow-hidden">
              <img
                src={getMedicineImageSrc(medicine.imageUrl)}
                alt={medicineName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = FALLBACK_MEDICINE_IMAGE;
                }}
              />
            </Card>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="info">{getMedicineCategoryName(medicine)}</Badge>
                <Badge variant={stockState.variant}>{stockState.label}</Badge>
                {medicine.requiresPrescription ? <Badge variant="warning">Prescription Required</Badge> : null}
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{medicineName}</h1>
              <p className="text-lg text-gray-500 mt-1">{getMedicineGenericName(medicine)}</p>
              <p className="mt-2 text-sm text-gray-500">Brand: {getMedicineBrandName(medicine)}</p>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-3xl font-bold text-blue-600">{formatPrice(medicine.price)}</span>
              {medicine.discountPrice ? (
                <span className="text-lg text-gray-400 line-through">{formatPrice(medicine.discountPrice)}</span>
              ) : null}
            </div>

            <div className="space-y-4 py-6 border-y border-gray-100">
              <div className="flex items-center text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-500 mr-3" />
                <span className="text-gray-600">100% Genuine Medicine</span>
              </div>
              <div className="flex items-center text-sm">
                <Truck className="w-5 h-5 text-blue-500 mr-3" />
                <span className="text-gray-600">Free delivery on orders above {formatPrice(FREE_DELIVERY_THRESHOLD)}</span>
              </div>
              <div className="flex items-center text-sm">
                <Clock className="w-5 h-5 text-amber-500 mr-3" />
                <span className="text-gray-600">Delivery within 30-60 minutes</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-gray-800">Product Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-gray-500">Description:</div>
                <div className="text-gray-800 font-medium">{getMedicineDescription(medicine)}</div>
                <div className="text-gray-500">Manufacturer:</div>
                <div className="text-gray-800 font-medium">{getMedicineManufacturer(medicine)}</div>
                <div className="text-gray-500">Dosage Form:</div>
                <div className="text-gray-800 font-medium">{getMedicineDosageForm(medicine)}</div>
                <div className="text-gray-500">Strength:</div>
                <div className="text-gray-800 font-medium">{getMedicineStrength(medicine)}</div>
                <div className="text-gray-500">Package Size:</div>
                <div className="text-gray-800 font-medium">{getMedicinePackageSize(medicine)}</div>
                <div className="text-gray-500">Stock Status:</div>
                <div className="text-gray-800 font-medium">{stockState.label}</div>
              </div>
            </div>

            <div className="pt-4 flex space-x-4">
              <Button className="flex-1 h-12" disabled={!stockState.canPurchase} onClick={handleAddToCart}>
                <ShoppingCart className="w-5 h-5 mr-2" />
                {stockState.canPurchase ? 'Add to Cart' : 'Unavailable'}
              </Button>
              <Link to="/cart" className="flex-1">
                <Button variant="outline" className="w-full h-12">
                  View Cart
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CartScreen: React.FC = () => {
  const { items, subtotal, updateQuantity, removeItem, totalItems } = useCart();
  const [notice, setNotice] = useState<string | null>(null);
  const deliveryFee = getDeliveryFee(subtotal);
  const total = subtotal + deliveryFee;
  const hasInvalidItems = items.some(item => !item.isActive || item.availableStock <= 0);

  if (items.length === 0) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-6">
          <ShoppingCart size={48} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Your cart is empty</h2>
        <p className="text-gray-500 mt-2 max-w-xs">Looks like you haven't added any medicines to your cart yet.</p>
        <Link to="/search">
          <Button className="mt-8">Start Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Shopping Cart ({totalItems})</h1>

      {notice ? (
        <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => (
            <Card key={item.medicineId} className="p-4 flex items-center space-x-4">
              <img src={item.imageUrl} alt={item.medicineName} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" referrerPolicy="no-referrer" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-gray-900 truncate">{item.medicineName}</h3>
                  <Badge variant={item.availableStock > 0 ? 'success' : 'error'}>
                    {item.availableStock > 0 ? `${item.availableStock} in stock` : 'Out of stock'}
                  </Badge>
                </div>
                <p className="text-sm text-blue-600 font-bold mt-1">{formatPrice(item.unitPrice)}</p>
                <div className="flex items-center space-x-4 mt-3">
                  <div className="flex items-center border border-gray-200 rounded-lg">
                    <button
                      className="px-3 py-1 text-gray-500 hover:text-blue-600"
                      onClick={() => {
                        const result = updateQuantity(item.medicineId, item.quantity - 1);
                        setNotice(result.success ? null : result.message ?? 'Unable to update quantity.');
                      }}
                    >
                      -
                    </button>
                    <span className="px-2 text-sm font-bold w-8 text-center">{item.quantity}</span>
                    <button
                      className="px-3 py-1 text-gray-500 hover:text-blue-600 disabled:text-gray-300"
                      disabled={item.quantity >= item.availableStock}
                      onClick={() => {
                        const result = updateQuantity(item.medicineId, item.quantity + 1);
                        setNotice(result.success ? null : result.message ?? 'Unable to update quantity.');
                      }}
                    >
                      +
                    </button>
                  </div>
                  <button
                    className="text-xs text-red-500 font-medium hover:underline"
                    onClick={() => {
                      removeItem(item.medicineId);
                      setNotice(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <p className="font-bold text-gray-900">{formatPrice(item.totalPrice)}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <OrderSummaryCard subtotal={subtotal} deliveryFee={deliveryFee} total={total} />
          <Link to="/checkout">
            <Button className="w-full h-12" disabled={hasInvalidItems}>Proceed to Checkout</Button>
          </Link>

          {hasInvalidItems ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Remove unavailable medicines from your cart before checkout.
            </div>
          ) : null}

          <div className="bg-blue-50 p-4 rounded-xl flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed">
              Your order is protected by our 100% genuine medicine guarantee. We only source from licensed manufacturers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CheckoutScreen: React.FC = () => {
  const { user } = useAuth();
  const { items, subtotal, clearCart } = useCart();
  const [deliveryType, setDeliveryType] = useState<'Delivery' | 'Pickup'>('Delivery');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address ?? '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [validationNotice, setValidationNotice] = useState('');

  const deliveryFee = getDeliveryFee(subtotal, deliveryType);
  const total = subtotal + deliveryFee;
  const hasInvalidItems = items.some(item => !item.isActive || item.availableStock <= 0);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (createdOrder) {
    return (
      <div className="p-4 md:p-6 pb-24 md:pb-8">
        <EmptyState
          title="Order placed successfully"
          description={`Your order ${createdOrder.orderNumber} has been created and is now awaiting processing.`}
          action={
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to={`/orders/${createdOrder.id}`}>
                <Button>View Order Details</Button>
              </Link>
              <Link to="/search">
                <Button variant="outline">Continue Shopping</Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-4 md:p-6 pb-24 md:pb-8">
        <EmptyState
          title="Nothing to check out yet"
          description="Add medicines to your cart before starting checkout."
          action={<Link to="/search"><Button>Browse Medicines</Button></Link>}
        />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationNotice('');

    if (deliveryType === 'Delivery' && !deliveryAddress.trim()) {
      setError('Delivery address is required for delivery orders.');
      return;
    }

    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }

    if (hasInvalidItems) {
      setError('Remove unavailable medicines from your cart before checkout.');
      return;
    }

    setSubmitting(true);

    try {
      const latestMedicines = await Promise.all(items.map(item => medicineService.getMedicineById(item.medicineId)));
      const invalidItem = items.find((item, index) => {
        const latestMedicine = latestMedicines[index];
        return !latestMedicine || !latestMedicine.isActive || latestMedicine.stockQuantity < item.quantity;
      });

      if (invalidItem) {
        setError(`${invalidItem.medicineName} is no longer available in the requested quantity.`);
        return;
      }

      const order = await orderService.createOrder({
        customerId: user.id,
        paymentMethod,
        deliveryType,
        deliveryAddress: deliveryType === 'Delivery' ? deliveryAddress.trim() : undefined,
        orderItems: items.map(item => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          imageUrl: item.imageUrl,
        })),
        subtotal,
        deliveryFee,
        totalAmount: total,
        notes: notes.trim() || undefined,
      });

      if (!order?.id || !order.orderNumber) {
        throw new Error('Order confirmation data is incomplete.');
      }

      clearCart();
      setCreatedOrder(order);
    } catch (err: any) {
      setError(err.message ?? 'Unable to place your order right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        <p className="mt-2 text-sm text-gray-500">Review your order and confirm delivery details.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-bold">Customer Details</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input value={user.fullName} disabled label="Full Name" />
              <Input value={user.phone} disabled label="Phone Number" />
            </div>
            <Input value={user.email} disabled label="Email" />
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-bold">Delivery & Payment</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-gray-700">
                <span>Delivery Type</span>
                <select
                  value={deliveryType}
                  onChange={(e) => setDeliveryType(e.target.value as 'Delivery' | 'Pickup')}
                  className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="Delivery">Delivery</option>
                  <option value="Pickup">Pickup</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-gray-700">
                <span>Payment Method</span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="Cash on Delivery">Cash on Delivery</option>
                  <option value="Click">Click</option>
                </select>
              </label>
            </div>

            {deliveryType === 'Delivery' ? (
              <Input
                label="Delivery Address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter your delivery address"
                required
              />
            ) : (
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Pickup orders are prepared for collection, so no delivery fee applies.
              </div>
            )}

            <label className="block space-y-1.5 text-sm font-medium text-gray-700">
              <span>Order Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any delivery or prescription notes"
                className="min-h-24 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </label>
          </Card>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {validationNotice ? <p className="text-sm text-amber-600">{validationNotice}</p> : null}

          <div className="flex gap-3">
            <Link to="/cart">
              <Button variant="outline" type="button">Back to Cart</Button>
            </Link>
            <Button type="submit" isLoading={submitting} disabled={hasInvalidItems || items.length === 0}>
              Place Order
            </Button>
          </div>
        </form>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4">Items</h2>
            <div className="space-y-4">
              {items.map(item => (
                <div key={item.medicineId} className="flex items-center gap-3">
                  <img src={item.imageUrl} alt={item.medicineName} className="w-14 h-14 rounded-lg object-cover" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{item.medicineName}</p>
                    <p className="text-xs text-gray-500">Qty {item.quantity} - {formatPrice(item.unitPrice)}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatPrice(item.totalPrice)}</p>
                </div>
              ))}
            </div>
          </Card>

          <OrderSummaryCard subtotal={subtotal} deliveryFee={deliveryFee} total={total} />
        </div>
      </div>
    </div>
  );
};

export const OrderHistoryScreen: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadOrders = async () => {
      setLoadError('');

      if (!user) {
        setOrders([]);
        setLoading(false);
        return;
      }

      try {
        const customerOrders = await orderService.getOrdersByUserId(user.id);
        setOrders(normalizeOrderList(customerOrders));
      } catch (err: any) {
        setOrders([]);
        setLoadError(err.message ?? 'Unable to load your orders right now.');
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [user]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) return <div className="p-8 text-center">Loading orders...</div>;
  if (loadError) {
    return (
      <div className="p-4 md:p-6 pb-24 md:pb-8">
        <EmptyState
          title="Unable to load orders"
          description={loadError}
          action={<Button onClick={() => window.location.reload()}>Try Again</Button>}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <p className="mt-2 text-sm text-gray-500">Track your past purchases and open order details anytime.</p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Once you complete checkout, your orders will appear here."
          action={<Link to="/search"><Button>Browse Medicines</Button></Link>}
        />
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">{order.orderNumber}</h2>
                    <Badge variant={getOrderStatusVariant(order.orderStatus)}>{order.orderStatus}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {order.orderItems.length} item{order.orderItems.length === 1 ? '' : 's'} - {order.deliveryType}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <p className="text-lg font-bold text-blue-600">{formatPrice(order.totalAmount)}</p>
                  <Link to={`/orders/${order.id}`}>
                    <Button variant="outline">View Details</Button>
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

export const OrderDetailsScreen: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadOrder = async () => {
      setLoadError('');

      if (!user || !id) {
        setOrder(null);
        setLoading(false);
        return;
      }

      try {
        const foundOrder = await orderService.getOrderById(id);
        setOrder(foundOrder && foundOrder.customerId === user.id ? foundOrder : null);
      } catch (err: any) {
        setOrder(null);
        setLoadError(err.message ?? 'Unable to load this order right now.');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [id, user]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) return <div className="p-8 text-center">Loading order...</div>;
  if (loadError) {
    return (
      <div className="p-4 md:p-6 pb-24 md:pb-8">
        <EmptyState
          title="Unable to load order"
          description={loadError}
          action={<Link to="/orders"><Button>Back to Orders</Button></Link>}
        />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 md:p-6 pb-24 md:pb-8">
        <EmptyState
          title="Order not found"
          description="We couldn't find that order in your account."
          action={<Link to="/orders"><Button>Back to Orders</Button></Link>}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8 space-y-6">
      <Link to="/orders" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-blue-600">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Orders
      </Link>

      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
              <Badge variant={getOrderStatusVariant(order.orderStatus)}>{order.orderStatus}</Badge>
            </div>
            <p className="mt-2 text-sm text-gray-500">{formatDate(order.createdAt)}</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-blue-600">{formatPrice(order.totalAmount)}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">Ordered Medicines</h2>
          <div className="space-y-4">
            {order.orderItems.map(item => (
              <div key={item.medicineId} className="flex items-center gap-4 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                <img src={item.imageUrl} alt={item.medicineName} className="w-16 h-16 rounded-lg object-cover" referrerPolicy="no-referrer" />
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{item.medicineName}</p>
                  <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                  <p className="text-sm text-gray-500">Unit Price: {formatPrice(item.unitPrice)}</p>
                </div>
                <p className="font-semibold text-gray-900">{formatPrice(item.totalPrice)}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 space-y-3">
            <h2 className="text-lg font-bold">Delivery</h2>
            <p className="text-sm text-gray-600">Type: {order.deliveryType}</p>
            <p className="text-sm text-gray-600">
              Address: {order.deliveryType === 'Delivery' ? order.deliveryAddress ?? 'Not provided' : 'Pickup at pharmacy'}
            </p>
            <p className="text-sm text-gray-600">Payment: {order.paymentMethod}</p>
          </Card>

          <OrderSummaryCard subtotal={order.subtotal} deliveryFee={order.deliveryFee} total={order.totalAmount} />
        </div>
      </div>
    </div>
  );
};
