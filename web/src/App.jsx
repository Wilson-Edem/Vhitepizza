import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  House,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPin,
  Minus,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Trash2,
  User,
  Utensils,
  X,
} from "lucide-react";
import { useAuth } from "./features/auth/AuthContext";
import AuthScreen from "./features/auth/AuthScreen";
import CustomizeSheet from "./features/customize/CustomizeSheet";
import LocationPicker from "./features/location/LocationPicker";
import AddressesView from "./features/location/AddressesView";
import PaymentReturnView from "./features/payment/PaymentReturnView";
import CheckoutView from "./features/checkout/CheckoutView";
import OrdersView from "./features/orders/OrdersView";
import StaffDashboard from "./features/staff/StaffDashboard";
import { saveAddress } from "./features/location/addresses";
import { apiFetch } from "./lib/api";
import "./App.css";

const API_URL = `${
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"
}/menu`;
const THEME_KEY = "vhitepizza-theme";
const CART_KEY = "vhitepizza-cart";
const ADDRESS_KEY = "vhitepizza-address";

// The hero tries these files in order, so the first one that exists is used.
const HERO_SOURCES = [
  "/images/hero/pizza-hero.webp",
  "/images/hero/pizza-hero.png",
  "/images/hero/pizza-herod.png",
  "/images/pizza-hero.webp",
  "/images/pizza-hero.png",
  "/images/pizza-herod.png",
];

const IMAGE_EXTENSIONS = ["jpeg", "jpg", "webp", "png"];
const CATEGORY_EMOJI = {
  pizzas: "🍕",
  sides: "🍗",
  desserts: "🍰",
  drinks: "🥤",
};

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: House },
  { id: "explore", label: "Explore", icon: Search },
  { id: "cart", label: "Cart", icon: ShoppingCart },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "profile", label: "Profile", icon: User },
];

const STAFF_TITLES = {
  admin: "Admin Dashboard",
  kitchen: "Kitchen Queue",
  rider: "Rider Deliveries",
};

/* ---------- helpers ---------- */

const formatMoney = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG")}`;

const titleCase = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const getStoredTheme = () => {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return ["system", "light", "dark"].includes(value) ? value : "system";
  } catch {
    return "system";
  }
};

const getStoredCart = () => {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const getStoredAddress = () => {
  try {
    const value = JSON.parse(localStorage.getItem(ADDRESS_KEY));
    return value && typeof value.formattedAddress === "string" ? value : null;
  } catch {
    return null;
  }
};

const shortAddress = (address) =>
  address?.formattedAddress
    ? address.formattedAddress.split(",")[0].trim()
    : "";

// What the server needs to price one cart line. Prices are never sent.
const toOrderItem = (item) => ({
  productId: item.productId,
  sizeId: item.sizeId,
  quantity: item.quantity,
  crustId: item.crustId ?? null,
  cheeseId: item.cheeseId ?? null,
  extraToppingIds: item.extraToppingIds || [],
  removedToppingIds: item.removedToppingIds || [],
});

const prefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

// Menu images live in web/public/images/menu. The menu "image" value is used
// as the file name; if the extension is missing or the file is not found,
// .jpeg, .jpg, .webp and .png versions of the same name are tried.
const getImageSources = (image) => {
  if (!image) return [];

  if (/^(https?:)?\/\//.test(image) || image.startsWith("/")) return [image];

  const hasExtension = /\.[a-z0-9]+$/i.test(image);
  const base = image.replace(/\.[a-z0-9]+$/i, "");
  const guesses = IMAGE_EXTENSIONS.map((ext) => `/images/menu/${base}.${ext}`);

  return [
    ...new Set(hasExtension ? [`/images/menu/${image}`, ...guesses] : guesses),
  ];
};

const getSizes = (product, sizeLabels) =>
  Object.entries(product?.prices || {}).map(([id, price]) => ({
    id,
    label: sizeLabels[id] || titleCase(id),
    price: Number(price),
  }));

const getStartingPrice = (sizes) =>
  sizes.length ? Math.min(...sizes.map((size) => size.price)) : 0;

const getIncluded = (product, options) => {
  const cheese = (options.cheeses || []).find(
    (item) => item.id === product.defaultCheese
  );

  const toppings = (product.defaultToppings || []).map(
    (id) => (options.toppings || []).find((item) => item.id === id)?.name
  );

  return [cheese?.name, ...toppings].filter(Boolean);
};

/* ---------- App ---------- */

function App() {
  const { user, profile, role, isStaff, logout, loading: authLoading } = useAuth();

  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [screen, setScreen] = useState(
    window.location.pathname === "/payment/return"
      ? "payment-return"
      : "home"
  );
  const [checkoutAddress, setCheckoutAddress] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [openOrderId, setOpenOrderId] = useState(null);
  const [authReturn, setAuthReturn] = useState("profile");
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  const [cart, setCart] = useState(getStoredCart);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [toast, setToast] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState(getStoredAddress);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [theme, setTheme] = useState(getStoredTheme);
  const [systemDark, setSystemDark] = useState(prefersDark);

  const resolvedTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  const displayName = profile?.displayName || user?.displayName || "";
  const initial = (displayName || user?.email || "V").charAt(0).toUpperCase();

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event) => setSystemDark(event.matches);

    media.addEventListener("change", onChange);

    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const changeTheme = (value) => {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {
      // The choice still applies for this visit if storage is blocked.
    }

    setTheme(value);
  };

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage errors; the cart still works for this visit.
    }
  }, [cart]);

  useEffect(() => {
    try {
      if (deliveryAddress) {
        localStorage.setItem(ADDRESS_KEY, JSON.stringify(deliveryAddress));
      } else {
        localStorage.removeItem(ADDRESS_KEY);
      }
    } catch {
      // Ignore storage errors; the address still works for this visit.
    }
  }, [deliveryAddress]);

  useEffect(() => {
    if (!toast) return undefined;

    const timer = setTimeout(() => setToast(""), 2400);

    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(API_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load menu.");
        return response.json();
      })
      .then((result) => {
        const menuData = result?.data ?? result;
        setMenu(menuData);
        setDeliveryFee(Number(menuData?.settings?.flatDeliveryFee ?? 0));
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error(err);
        setError(
          "We could not load the menu. Make sure the API server is running."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const sizeLabels = useMemo(
    () =>
      Object.fromEntries(
        (menu?.sizes || []).map((size) => [size.id, size.label])
      ),
    [menu]
  );

  const options = useMemo(() => menu?.options || {}, [menu]);

  // Items marked unavailable are hidden until sold-out badges are added.
  const products = useMemo(
    () =>
      Array.isArray(menu?.products)
        ? menu.products.filter((product) => product.available !== false)
        : [],
    [menu]
  );

  const categories = useMemo(
    () =>
      Array.isArray(menu?.categories)
        ? [...menu.categories].sort((a, b) => (a.order || 0) - (b.order || 0))
        : [],
    [menu]
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const inCategory =
        activeCategory === "all" || product.category === activeCategory;

      const matchesSearch =
        !query ||
        String(product.name || "").toLowerCase().includes(query) ||
        String(product.description || "").toLowerCase().includes(query);

      return inCategory && matchesSearch;
    });
  }, [products, activeCategory, search]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const total = subtotal + deliveryFee;

  const navigate = (next, orderId) => {
    if (next === "staff" && !isStaff) {
      setToast("Staff access only.");
      return;
    }

    if (orderId) setOpenOrderId(orderId);

    setScreen(next);
    window.scrollTo(0, 0);
  };

  const goToAuth = (back = "profile") => {
    setAuthReturn(back);
    navigate("auth");
  };

  const handleSearch = (value) => {
    setSearch(value);

    if (screen !== "home" && screen !== "explore") setScreen("explore");
  };

  const closeProduct = useCallback(() => setSelectedProduct(null), []);

  const addItem = (item) => {
    setCart((current) =>
      current.some((entry) => entry.id === item.id)
        ? current.map((entry) =>
            entry.id === item.id
              ? { ...entry, quantity: entry.quantity + item.quantity }
              : entry
          )
        : [...current, item]
    );

    setSelectedProduct(null);
    setToast(`${item.name} added to cart`);
  };

  // Quick add for sides, drinks and desserts.
  const addToCart = (product, size) => {
    const chosen = size || getSizes(product, sizeLabels)[0];

    if (!chosen) return;

    addItem({
      id: `${product.id}:${chosen.id}`,
      productId: product.id,
      name: product.name,
      image: product.image,
      category: product.category,
      sizeId: chosen.id,
      sizeLabel: chosen.label,
      price: chosen.price,
      quantity: 1,
      details: [],
    });
  };

  const updateQuantity = (id, amount) =>
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + amount) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );

  const removeFromCart = (id) =>
    setCart((current) => current.filter((item) => item.id !== id));

  const clearCart = () => setCart([]);

  const chooseAddress = (address) => {
    setDeliveryAddress(address);
    setToast("Delivery address updated.");
  };

  const confirmPicker = async (address, { save, label } = {}) => {
    setDeliveryAddress(address);
    setCheckoutAddress(address);
    setPickerOpen(false);

    if (save && user) {
      try {
        await saveAddress(user.uid, address, label || "", false);
        setToast("Address saved.");
      } catch {
        setToast("Could not save this address.");
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    setToast("Signed out.");
    navigate("home");
  };

  const cartProps = {
    cart,
    subtotal,
    deliveryFee,
    total,
    updateQuantity,
    removeFromCart,
    clearCart,
    onCheckout: () => setScreen("checkout"),
  };

  const menuProps = {
    products: filteredProducts,
    categories,
    activeCategory,
    setActiveCategory,
    search,
    onSearch: handleSearch,
    sizeLabels,
    onOpen: setSelectedProduct,
    onAdd: addToCart,
  };

  const needsMenu = screen === "home" || screen === "explore";

  return (
    <div className="app-shell">
      <DesktopSidebar
        screen={screen}
        navigate={navigate}
        cartCount={cartCount}
        isStaff={isStaff}
      />

      <main className="main-content">
        <TopBar
          search={search}
          onSearch={handleSearch}
          navigate={navigate}
          initial={initial}
          address={deliveryAddress}
          onPickLocation={() => setPickerOpen(true)}
        />

        {needsMenu && loading && (
          <div className="state-box">
            <div className="spinner" />
            <p>Loading the menu...</p>
          </div>
        )}

        {needsMenu && !loading && error && (
          <div className="state-box">
            <Utensils size={42} />
            <h2>Menu unavailable</h2>
            <p>{error}</p>
            <button
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        )}

        {screen === "home" && !loading && !error && (
          <HomeView {...menuProps} onOrderNow={() => navigate("explore")} />
        )}

        {screen === "explore" && !loading && !error && (
          <ExploreView {...menuProps} />
        )}

        {screen === "cart" && (
          <CartPage {...cartProps} onBack={() => navigate("home")} />
        )}

        {screen === "orders" && (
          <OrdersView
            user={user}
            onToast={setToast}
            onSignIn={() => goToAuth("orders")}
            initialOrderId={openOrderId}
            onConsumedInitial={() => setOpenOrderId(null)}
          />
        )}

        {screen === "checkout" && (
          <CheckoutView
            cart={cart}
            user={user}
            deliveryAddress={checkoutAddress}
            onPickAddress={() => setPickerOpen(true)}
            onBack={() => setScreen("cart")}
            onToast={setToast}
          />
        )}

        {screen === "payment-return" && !authLoading && (
          <PaymentReturnView
            user={user}
            onNavigate={navigate}
            onClearCart={clearCart}
          />
        )}

        {screen === "profile" && (
          <ProfileView
            user={user}
            name={displayName}
            role={role}
            isStaff={isStaff}
            navigate={navigate}
            goToAuth={goToAuth}
            onLogout={handleLogout}
          />
        )}

        {screen === "auth" && (
          <AuthScreen onDone={() => navigate(authReturn)} />
        )}

        {screen === "addresses" && (
          <AddressesView
            user={user}
            dark={resolvedTheme === "dark"}
            onUse={chooseAddress}
            goToAuth={goToAuth}
            onBack={() => navigate("profile")}
          />
        )}

        {screen === "staff" && (
          <StaffView role={role} isStaff={isStaff} uid={user?.uid} dark={resolvedTheme === "dark"} />
        )}

        {screen === "settings" && (
          <SettingsView
            theme={theme}
            changeTheme={changeTheme}
            navigate={navigate}
          />
        )}
      </main>

      <CartPanel {...cartProps} />

      <MobileBottomNav
        screen={screen}
        navigate={navigate}
        cartCount={cartCount}
      />

      {selectedProduct &&
        (selectedProduct.type === "pizza" ? (
          <CustomizeSheet
            product={selectedProduct}
            sizes={getSizes(selectedProduct, sizeLabels)}
            options={options}
            imageSlot={<ProductImage product={selectedProduct} />}
            onClose={closeProduct}
            onAdd={addItem}
          />
        ) : (
          <ProductModal
            product={selectedProduct}
            sizeLabels={sizeLabels}
            options={options}
            onClose={closeProduct}
            onAdd={addToCart}
          />
        ))}

      {pickerOpen && (
        <LocationPicker
          dark={resolvedTheme === "dark"}
          initial={deliveryAddress}
          canSave={Boolean(user)}
          onClose={() => setPickerOpen(false)}
          onConfirm={confirmPicker}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- shared pieces ---------- */

function ImageChain({ sources, alt, className, priority = false, fallback = null }) {
  const [index, setIndex] = useState(0);

  if (index >= sources.length) return fallback;

  return (
    <img
      className={className}
      src={sources[index]}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      onError={() => setIndex((current) => current + 1)}
    />
  );
}

function ProductImage({ product, className }) {
  return (
    <ImageChain
      className={className}
      sources={getImageSources(product.image)}
      alt={product.name}
      fallback={
        <span className="image-fallback">
          {CATEGORY_EMOJI[product.category] || "🍕"}
        </span>
      }
    />
  );
}

function SectionHeading({ title, subtitle, action, onAction }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {action && (
        <button onClick={onAction}>
          {action}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="empty-state">
      <ShoppingBag size={34} />
      <p>{message}</p>
    </div>
  );
}

function PageHeading({ tag, title, text }) {
  return (
    <div className="page-heading">
      <span>{tag}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

/* ---------- navigation ---------- */

function DesktopSidebar({ screen, navigate, cartCount, isStaff }) {
  const items = [
    ...NAV_ITEMS,
    ...(isStaff
      ? [{ id: "staff", label: "Staff", icon: LayoutDashboard }]
      : []),
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="desktop-sidebar">
      <div className="brand">
        <span className="brand-icon">🍕</span>

        <div>
          <h1>Vhite Pizza</h1>
          <small>Hot Pizza. Fast Delivery.</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              className={`sidebar-item ${screen === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <Icon size={19} />
              <span>{item.label}</span>
              {item.id === "cart" && cartCount > 0 && <b>{cartCount}</b>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-promo">
        <span>🛵</span>
        <strong>Fast Delivery</strong>
        <p>Hot, fresh and on time, every time.</p>
      </div>
    </aside>
  );
}

function TopBar({ search, onSearch, navigate, initial, address, onPickLocation }) {
  return (
    <header className="topbar">
      <div className="top-brand">
        <span className="brand-icon">🍕</span>
        <strong>Vhite Pizza</strong>
      </div>

      <label className="search-field top-search">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search for pizzas, sides, drinks..."
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>

      <div className="topbar-right">
        <button
          className="location-button"
          type="button"
          onClick={onPickLocation}
        >
          <MapPin size={17} />
          <span>{shortAddress(address) || "Set delivery location"}</span>
          <ChevronDown size={15} />
        </button>

        <button
          className="icon-button"
          type="button"
          aria-label="Notifications"
        >
          <Bell size={20} />
          <i />
        </button>

        <button
          className="avatar"
          type="button"
          aria-label="Open profile"
          onClick={() => navigate("profile")}
        >
          {initial}
        </button>
      </div>
    </header>
  );
}

function MobileBottomNav({ screen, navigate, cartCount }) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          screen === item.id ||
          (item.id === "profile" &&
            ["settings", "auth", "staff", "addresses"].includes(screen));

        return (
          <button
            key={item.id}
            className={active ? "active" : ""}
            onClick={() => navigate(item.id)}
          >
            <span className="bottom-icon">
              <Icon size={21} />
              {item.id === "cart" && cartCount > 0 && <b>{cartCount}</b>}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ---------- menu screens ---------- */

function HeroBanner({ onOrderNow }) {
  return (
    <section className="hero-banner">
      <ImageChain
        className="hero-image"
        sources={HERO_SOURCES}
        alt="Fresh pizza from Vhite Pizza"
        priority
      />

      <div className="hero-overlay" />

      <div className="hero-content">
        <span>THE BEST PIZZA IN TOWN</span>

        <h2>Fresh Pizza, Fast Delivery</h2>

        <p>
          Craving something delicious? Get your favorite pizza delivered hot
          and fresh, right to your door.
        </p>

        <button className="hero-button" onClick={onOrderNow}>
          Order Now
          <ArrowRight size={17} />
        </button>
      </div>

      <div className="hero-decoration">
        <span>Good Food</span>
        <strong>Great Mood</strong>
      </div>
    </section>
  );
}

function CategoryFilter({ categories, activeCategory, setActiveCategory }) {
  return (
    <div className="category-row">
      <button
        className={activeCategory === "all" ? "active" : ""}
        onClick={() => setActiveCategory("all")}
      >
        All
      </button>

      {categories.map((category) => (
        <button
          key={category.id}
          className={activeCategory === category.id ? "active" : ""}
          onClick={() => setActiveCategory(category.id)}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}

function MobileSearch({ search, onSearch }) {
  return (
    <label className="search-field mobile-search">
      <Search size={18} />
      <input
        type="text"
        placeholder="Search for pizza, sides, drinks..."
        value={search}
        onChange={(event) => onSearch(event.target.value)}
      />
    </label>
  );
}

function ProductCard({ product, sizeLabels, onOpen, onAdd }) {
  const sizes = getSizes(product, sizeLabels);
  const isPizza = product.type === "pizza";

  return (
    <article className="product-card">
      <button
        className="product-image"
        onClick={() => onOpen(product)}
        aria-label={`View ${product.name}`}
      >
        <ProductImage product={product} />
      </button>

      <div className="product-info">
        <h3>{product.name}</h3>
        <p>{product.description}</p>

        <div className="product-bottom">
          <strong>
            {sizes.length > 1 && <small>From </small>}
            {formatMoney(getStartingPrice(sizes))}
          </strong>

          {isPizza ? (
            <button className="customize-button" onClick={() => onOpen(product)}>
              Customize
            </button>
          ) : (
            <button
              className="add-button"
              aria-label={`Add ${product.name} to cart`}
              onClick={() => onAdd(product)}
            >
              <Plus size={17} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ProductGrid({ products, layout = "grid", ...cardProps }) {
  if (!products.length) return <EmptyState message="No menu items found." />;

  return (
    <div className={`product-grid ${layout}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} {...cardProps} />
      ))}
    </div>
  );
}

function HomeView({
  products,
  categories,
  activeCategory,
  setActiveCategory,
  search,
  onSearch,
  sizeLabels,
  onOpen,
  onAdd,
  onOrderNow,
}) {
  const activeName = categories.find((item) => item.id === activeCategory)?.name;
  const showAll = activeCategory !== "all" || search.trim();

  return (
    <div className="page-content">
      <HeroBanner onOrderNow={onOrderNow} />

      <MobileSearch search={search} onSearch={onSearch} />

      <CategoryFilter
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
      />

      <section className="content-section">
        <SectionHeading
          title={activeName || "Popular Right Now"}
          subtitle="Our most loved picks"
          action="See all"
          onAction={onOrderNow}
        />

        <ProductGrid
          products={showAll ? products : products.slice(0, 8)}
          sizeLabels={sizeLabels}
          onOpen={onOpen}
          onAdd={onAdd}
        />
      </section>

      <section className="content-section">
        <SectionHeading
          title="Recent Orders"
          subtitle="Your latest Vhite Pizza orders"
        />

        <div className="recent-order">
          <span className="recent-order-icon">
            <ShoppingBag size={20} />
          </span>

          <div>
            <strong>Order history</strong>
            <p>Your previous orders will appear here.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ExploreView({
  products,
  categories,
  activeCategory,
  setActiveCategory,
  search,
  onSearch,
  sizeLabels,
  onOpen,
  onAdd,
}) {
  return (
    <div className="page-content">
      <PageHeading
        tag="DISCOVER"
        title="Explore Menu"
        text="Find something delicious from Vhite Pizza."
      />

      <MobileSearch search={search} onSearch={onSearch} />

      <CategoryFilter
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
      />

      <section className="content-section">
        <ProductGrid
          products={products}
          layout="list"
          sizeLabels={sizeLabels}
          onOpen={onOpen}
          onAdd={onAdd}
        />
      </section>
    </div>
  );
}

// Simple details popup for sides, desserts and drinks.
function ProductModal({ product, sizeLabels, options, onClose, onAdd }) {
  const sizes = getSizes(product, sizeLabels);
  const [sizeId, setSizeId] = useState(sizes[0]?.id);
  const selected = sizes.find((size) => size.id === sizeId) || sizes[0];
  const included = getIncluded(product, options);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="product-modal"
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="modal-image">
          <ProductImage product={product} />
        </div>

        <div className="modal-content">
          <h2>{product.name}</h2>
          <p>{product.description}</p>

          {included.length > 0 && (
            <div className="included">
              <span>Includes</span>

              <div>
                {included.map((name) => (
                  <em key={name}>{name}</em>
                ))}
              </div>
            </div>
          )}

          {sizes.length > 1 && (
            <div className="size-options">
              <span>Choose your size</span>

              <div>
                {sizes.map((size) => (
                  <button
                    key={size.id}
                    className={`size-chip ${
                      selected?.id === size.id ? "selected" : ""
                    }`}
                    onClick={() => setSizeId(size.id)}
                  >
                    <strong>{size.label}</strong>
                    <small>{formatMoney(size.price)}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            className="primary-button modal-add-button"
            onClick={() => onAdd(product, selected)}
          >
            Add to Cart · {formatMoney(selected?.price)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- cart ---------- */

function EmptyCart() {
  return (
    <div className="empty-cart">
      <span>
        <ShoppingCart size={30} />
      </span>
      <h3>Your cart is empty</h3>
      <p>Add something delicious from our menu.</p>
    </div>
  );
}

function CartBody({
  cart,
  subtotal,
  deliveryFee,
  total,
  updateQuantity,
  removeFromCart,
  onCheckout,
}) {
  if (!cart.length) return <EmptyCart />;

  return (
    <>
      <div className="cart-items">
        {cart.map((item) => (
          <div className="cart-item" key={item.id}>
            <div className="cart-item-image">
              <ImageChain
                sources={getImageSources(item.image)}
                alt={item.name}
                fallback={
                  <span className="image-fallback">
                    {CATEGORY_EMOJI[item.category] || "🍕"}
                  </span>
                }
              />
            </div>

            <div className="cart-item-info">
              <h4>{item.name}</h4>
              <small>{item.sizeLabel}</small>

              {item.details?.length > 0 && (
                <small className="cart-details">{item.details.join(" · ")}</small>
              )}

              <strong>{formatMoney(item.price)}</strong>

              <div className="quantity-controls">
                <button
                  aria-label="Decrease quantity"
                  onClick={() => updateQuantity(item.id, -1)}
                >
                  <Minus size={13} />
                </button>

                <span>{item.quantity}</span>

                <button
                  aria-label="Increase quantity"
                  onClick={() => updateQuantity(item.id, 1)}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            <button
              className="cart-remove"
              aria-label={`Remove ${item.name}`}
              onClick={() => removeFromCart(item.id)}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div>
          <span>Subtotal</span>
          <strong>{formatMoney(subtotal)}</strong>
        </div>

        <div>
          <span>Delivery</span>
          <strong>{formatMoney(deliveryFee)}</strong>
        </div>

        <div className="summary-total">
          <span>Total</span>
          <strong>{formatMoney(total)}</strong>
        </div>

        <button className="primary-button" onClick={onCheckout}>
          Proceed to Checkout
          <ArrowRight size={17} />
        </button>
      </div>
    </>
  );
}

function CartPanel(props) {
  const { cart, clearCart } = props;

  return (
    <aside className="cart-sidebar">
      <div className="cart-header">
        <div>
          <span>YOUR ORDER</span>
          <h2>Cart</h2>
        </div>

        {cart.length > 0 && (
          <button onClick={clearCart}>
            <Trash2 size={15} />
            Clear
          </button>
        )}
      </div>

      <CartBody {...props} />
    </aside>
  );
}

function CartPage(props) {
  const { cart, clearCart, onBack } = props;

  return (
    <div className="page-content cart-page">
      <div className="page-header">
        <button aria-label="Back to home" onClick={onBack}>
          <ChevronLeft size={21} />
        </button>

        <h2>Your Cart</h2>

        {cart.length > 0 ? (
          <button aria-label="Clear cart" onClick={clearCart}>
            <Trash2 size={18} />
          </button>
        ) : (
          <span />
        )}
      </div>

      <CartBody {...props} />
    </div>
  );
}

function ProfileView({
  user,
  name,
  role,
  isStaff,
  navigate,
  goToAuth,
  onLogout,
}) {
  return (
    <div className="page-content">
      <PageHeading
        tag="ACCOUNT"
        title="Profile"
        text="Manage your Vhite Pizza account."
      />

      {user ? (
        <div className="profile-card">
          <span className="large-avatar">
            {user.photoURL ? (
              <img src={user.photoURL} alt={name || "Profile"} />
            ) : (
              (name || user.email || "V").charAt(0).toUpperCase()
            )}
          </span>

          <div>
            <h3>{name || "Vhite Pizza Customer"}</h3>
            <p>{user.email}</p>
            {isStaff && <p>Role: {titleCase(role)}</p>}
          </div>
        </div>
      ) : (
        <div className="profile-card">
          <span className="large-avatar">V</span>

          <div>
            <h3>Welcome to Vhite Pizza</h3>
            <p>Sign in to order, save addresses and track your orders.</p>
          </div>
        </div>
      )}

      {!user && (
        <button className="primary-button" onClick={() => goToAuth("profile")}>
          <LogIn size={18} />
          Sign In or Create Account
        </button>
      )}

      <div className="menu-list">
        <button onClick={() => navigate("orders")}>
          <ShoppingBag size={20} />
          <span>
            <strong>My Orders</strong>
            <small>Track your orders</small>
          </span>
          <ChevronRight size={18} />
        </button>

        {user && (
          <button onClick={() => navigate("addresses")}>
            <MapPin size={20} />
            <span>
              <strong>Saved Addresses</strong>
              <small>Where we deliver your pizza</small>
            </span>
            <ChevronRight size={18} />
          </button>
        )}

        {isStaff && (
          <button onClick={() => navigate("staff")}>
            <LayoutDashboard size={20} />
            <span>
              <strong>Staff Dashboard</strong>
              <small>{STAFF_TITLES[role] || "Staff tools"}</small>
            </span>
            <ChevronRight size={18} />
          </button>
        )}

        <button onClick={() => navigate("settings")}>
          <Settings size={20} />
          <span>
            <strong>Settings</strong>
            <small>Appearance and preferences</small>
          </span>
          <ChevronRight size={18} />
        </button>

        {user && (
          <button onClick={onLogout}>
            <LogOut size={20} />
            <span>
              <strong>Sign Out</strong>
              <small>Log out of your account</small>
            </span>
            <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function StaffView({ role, isStaff, uid, dark }) {
  if (!isStaff) {
    return (
      <div className="page-content">
        <EmptyState message="This area is for Vhite Pizza staff only." />
      </div>
    );
  }

  return <StaffDashboard role={role} uid={uid} dark={dark} />;
}

const THEME_CHOICES = [
  {
    value: "system",
    label: "System",
    description: "Follow your device settings",
    icon: Monitor,
  },
  {
    value: "light",
    label: "Light",
    description: "Always use the light theme",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark theme",
    icon: Moon,
  },
];

function SettingsView({ theme, changeTheme, navigate }) {
  return (
    <div className="page-content">
      <div className="page-header settings-header">
        <button aria-label="Back to profile" onClick={() => navigate("profile")}>
          <ChevronLeft size={21} />
        </button>
      </div>

      <PageHeading
        tag="PREFERENCES"
        title="Settings"
        text="Customize your Vhite Pizza experience."
      />

      <section className="settings-card">
        <h3>Appearance</h3>
        <p>Choose how Vhite Pizza looks on your device.</p>

        <div className="theme-options">
          {THEME_CHOICES.map((choice) => {
            const Icon = choice.icon;

            return (
              <button
                key={choice.value}
                className={`theme-option ${
                  theme === choice.value ? "selected" : ""
                }`}
                onClick={() => changeTheme(choice.value)}
                aria-pressed={theme === choice.value}
              >
                <span className="theme-option-icon">
                  <Icon size={20} />
                </span>

                <span>
                  <strong>{choice.label}</strong>
                  <small>{choice.description}</small>
                </span>

                <span className="theme-radio">
                  {theme === choice.value && <i />}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default App;