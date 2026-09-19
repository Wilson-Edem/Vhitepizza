import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronLeft,
  Heart,
  Home,
  MapPin,
  Minus,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Star,
  Trash2,
  User,
  Utensils,
  X,
} from "lucide-react";
import "./App.css";

const API_URL = "http://localhost:5000/api/v1/menu";
const THEME_KEY = "vhitepizza-theme";

const getStoredTheme = () => {
  if (typeof window === "undefined") return "system";
  return localStorage.getItem(THEME_KEY) || "system";
};

const getSystemTheme = () => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const getImageUrl = (image) => {
  if (!image) return "";

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  if (image.startsWith("/")) {
    return image;
  }

  return `/images/menu/${image}`;
};

const getProductImage = (product) => {
  if (product?.image) {
    const image = product.image;

    if (
      image.endsWith(".png") ||
      image.endsWith(".jpg") ||
      image.endsWith(".jpeg") ||
      image.endsWith(".webp") ||
      image.endsWith(".avif")
    ) {
      return getImageUrl(image);
    }

    return `/images/menu/${image}.png`;
  }

  return "";
};

const getProductPrice = (product) => {
  if (!product?.prices) return 0;

  const prices = Object.values(product.prices);

  return prices.length ? Number(prices[0]) : 0;
};

const getDefaultSize = (product) => {
  if (!product?.prices) return null;

  const sizeId = Object.keys(product.prices)[0];

  return sizeId
    ? {
        id: sizeId,
        label: sizeId,
        price: Number(product.prices[sizeId]),
      }
    : null;
};

const formatMoney = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG")}`;

function App() {
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeScreen, setActiveScreen] = useState("home");
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [theme, setTheme] = useState(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState(getSystemTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const nextTheme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;

      document.documentElement.dataset.theme = nextTheme;
      setResolvedTheme(nextTheme);
    };

    applyTheme();

    if (theme !== "system") return undefined;

    media.addEventListener("change", applyTheme);

    return () => {
      media.removeEventListener("change", applyTheme);
    };
  }, [theme]);

  const changeTheme = (value) => {
    localStorage.setItem(THEME_KEY, value);
    setTheme(value);
  };

  useEffect(() => {
    const loadMenu = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error("Unable to load menu.");
        }

        const result = await response.json();

        setMenu(result?.data || result);
      } catch (err) {
        console.error(err);
        setError(
          "Unable to load the Vhitepizza menu. Make sure the API server is running."
        );
      } finally {
        setLoading(false);
      }
    };

    loadMenu();
  }, []);

  const products = useMemo(() => {
    if (!menu) return [];

    if (Array.isArray(menu)) return menu;

    if (Array.isArray(menu.products)) return menu.products;

    return [];
  }, [menu]);

  const categories = useMemo(() => {
    if (!menu) return [];

    if (Array.isArray(menu.categories)) {
      return menu.categories;
    }

    return [];
  }, [menu]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (activeCategory !== "all") {
      result = result.filter((product) => {
        const categoryId = String(
          product.categoryId || product.category || ""
        ).toLowerCase();

        return categoryId === String(activeCategory).toLowerCase();
      });
    }

    if (search.trim()) {
      const query = search.toLowerCase().trim();

      result = result.filter((product) => {
        return (
          String(product.name || "")
            .toLowerCase()
            .includes(query) ||
          String(product.description || "")
            .toLowerCase()
            .includes(query)
        );
      });
    }

    return result;
  }, [products, activeCategory, search]);

  const cartCount = cart.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );

  const cartSubtotal = cart.reduce(
    (total, item) =>
      total + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

  const deliveryFee = cart.length ? 1500 : 0;
  const cartTotal = cartSubtotal + deliveryFee;

  const navigate = (screen) => {
    setActiveScreen(screen);
  };

  const addToCart = (product) => {
    const size = getDefaultSize(product);
    const price = size?.price || getProductPrice(product);

    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.productId === product.id && item.sizeId === size?.id
      );

      if (existing) {
        return currentCart.map((item) =>
          item.productId === product.id && item.sizeId === size?.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          id: `${product.id}-${size?.id || "default"}-${Date.now()}`,
          productId: product.id,
          name: product.name,
          image: product.image,
          sizeId: size?.id || null,
          sizeLabel: size?.label || "Regular",
          price,
          quantity: 1,
        },
      ];
    });

    setSelectedProduct(null);
  };

  const updateQuantity = (itemId, amount) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === itemId
            ? {
                ...item,
                quantity: Math.max(0, item.quantity + amount),
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (itemId) => {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== itemId)
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  return (
    <div className={`app-shell ${resolvedTheme}`}>
      <DesktopSidebar
        activeScreen={activeScreen}
        navigate={navigate}
        cartCount={cartCount}
      />

      <main className="main-content">
        <TopBar
          search={search}
          setSearch={setSearch}
          navigate={navigate}
        />

        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading Vhitepizza menu...</p>
          </div>
        )}

        {!loading && error && (
          <div className="error-state">
            <Utensils size={42} />
            <h2>Menu unavailable</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {activeScreen === "home" && (
              <HomeView
                products={filteredProducts}
                categories={categories}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                search={search}
                setSearch={setSearch}
                onProductClick={setSelectedProduct}
                onAddToCart={addToCart}
                onOrderNow={() => navigate("explore")}
              />
            )}

            {activeScreen === "explore" && (
              <ExploreView
                products={filteredProducts}
                categories={categories}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                search={search}
                setSearch={setSearch}
                onProductClick={setSelectedProduct}
                onAddToCart={addToCart}
              />
            )}

            {activeScreen === "orders" && <OrdersView />}

            {activeScreen === "profile" && <ProfileView />}

            {activeScreen === "settings" && (
              <SettingsView
                theme={theme}
                changeTheme={changeTheme}
              />
            )}

            {activeScreen === "cart" && (
              <MobileCart
                cart={cart}
                subtotal={cartSubtotal}
                deliveryFee={deliveryFee}
                total={cartTotal}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
                clearCart={clearCart}
                navigate={navigate}
              />
            )}
          </>
        )}
      </main>

      <CartSidebar
        cart={cart}
        subtotal={cartSubtotal}
        deliveryFee={deliveryFee}
        total={cartTotal}
        updateQuantity={updateQuantity}
        removeFromCart={removeFromCart}
        clearCart={clearCart}
        navigate={navigate}
      />

      <MobileBottomNav
        activeScreen={activeScreen}
        navigate={navigate}
        cartCount={cartCount}
      />

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
        />
      )}
    </div>
  );
}

function DesktopSidebar({ activeScreen, navigate, cartCount }) {
  return (
    <aside className="desktop-sidebar">
      <div className="brand">
        <div className="brand-icon">🍕</div>

        <div>
          <h1>Vhitepizza</h1>
          <span>Hot Pizza. Fast Delivery.</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <SidebarItem
          icon={<Home size={19} />}
          label="Home"
          active={activeScreen === "home"}
          onClick={() => navigate("home")}
        />

        <SidebarItem
          icon={<Search size={19} />}
          label="Explore"
          active={activeScreen === "explore"}
          onClick={() => navigate("explore")}
        />

        <SidebarItem
          icon={<ShoppingCart size={19} />}
          label="Cart"
          badge={cartCount}
          active={activeScreen === "cart"}
          onClick={() => navigate("cart")}
        />

        <SidebarItem
          icon={<ShoppingBag size={19} />}
          label="Orders"
          active={activeScreen === "orders"}
          onClick={() => navigate("orders")}
        />

        <SidebarItem
          icon={<User size={19} />}
          label="Profile"
          active={activeScreen === "profile"}
          onClick={() => navigate("profile")}
        />

        <SidebarItem
          icon={<Settings size={19} />}
          label="Settings"
          active={activeScreen === "settings"}
          onClick={() => navigate("settings")}
        />
      </nav>

      <div className="sidebar-promo">
        <span>🚀</span>
        <strong>Fast Delivery</strong>
        <p>Hot, fresh and on time, every time.</p>
      </div>
    </aside>
  );
}

function SidebarItem({ icon, label, badge, active, onClick }) {
  return (
    <button
      className={`sidebar-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>

      {badge > 0 && <b>{badge}</b>}
    </button>
  );
}

function TopBar({ search, setSearch, navigate }) {
  return (
    <header className="topbar">
      <div className="top-search">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search for pizzas, sides, drinks..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="topbar-right">
        <button className="location-button">
          <MapPin size={17} />
          <span>Lagos, Nigeria</span>
          <ChevronDown size={15} />
        </button>

        <button className="notification-button">
          <Bell size={20} />
          <i />
        </button>

        <button
          className="profile-button"
          onClick={() => navigate("profile")}
        >
          <div className="avatar">V</div>
        </button>
      </div>
    </header>
  );
}

function HomeView({
  products,
  categories,
  activeCategory,
  setActiveCategory,
  search,
  setSearch,
  onProductClick,
  onAddToCart,
  onOrderNow,
}) {
  const popularProducts = products.slice(0, 8);

  return (
    <div className="page-content">
      <HeroBanner onOrderNow={onOrderNow} />

      <div className="mobile-home-search">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search for pizza..."
        />
      </div>

      <CategoryFilter
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
      />

      <section className="content-section">
        <SectionHeading
          title="Popular Pizzas"
          subtitle="Our most loved picks"
          action="View All"
          onAction={() => setActiveCategory("all")}
        />

        <ProductGrid
          products={popularProducts}
          onProductClick={onProductClick}
          onAddToCart={onAddToCart}
        />
      </section>

      <RecentOrders />
    </div>
  );
}

function ExploreView({
  products,
  categories,
  activeCategory,
  setActiveCategory,
  search,
  setSearch,
  onProductClick,
  onAddToCart,
}) {
  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <span>DISCOVER</span>
          <h2>Explore Menu</h2>
          <p>Find something delicious from Vhitepizza.</p>
        </div>
      </div>

      <div className="explore-search">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search pizzas, sides, drinks..."
        />
      </div>

      <CategoryFilter
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
      />

      <section className="content-section">
        <ProductList
          products={products}
          onProductClick={onProductClick}
          onAddToCart={onAddToCart}
        />
      </section>
    </div>
  );
}

function HeroBanner({ onOrderNow }) {
  return (
    <section className="hero-banner">
      <img
        className="hero-background-image"
        src="/images/hero/pizza-hero.png"
        alt="Fresh Vhitepizza"
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

function CategoryFilter({
  categories,
  activeCategory,
  setActiveCategory,
}) {
  return (
    <div className="category-row">
      <button
        className={activeCategory === "all" ? "active" : ""}
        onClick={() => setActiveCategory("all")}
      >
        All
      </button>

      {categories.map((category) => {
        const id = category.id || category.categoryId || category.name;

        return (
          <button
            key={id}
            className={activeCategory === id ? "active" : ""}
            onClick={() => setActiveCategory(id)}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}

function ProductGrid({ products, onProductClick, onAddToCart }) {
  if (!products.length) {
    return <EmptyState message="No menu items found." />;
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onProductClick={onProductClick}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
}

function ProductCard({ product, onProductClick, onAddToCart }) {
  const price = getProductPrice(product);

  return (
    <article className="product-card">
      <button
        className="product-image"
        onClick={() => onProductClick(product)}
      >
        {getProductImage(product) ? (
          <img
            src={getProductImage(product)}
            alt={product.name}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span>🍕</span>
        )}

        <span className="favorite-button">
          <Heart size={17} />
        </span>
      </button>

      <div className="product-info">
        <div className="product-rating">
          <Star size={13} fill="currentColor" />
          <span>4.8</span>
        </div>

        <h3>{product.name}</h3>

        <p>{product.description || "Freshly prepared and delicious."}</p>

        <div className="product-bottom">
          <strong>{formatMoney(price)}</strong>

          <button
            className="add-button"
            onClick={() => onAddToCart(product)}
          >
            <Plus size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductList({ products, onProductClick, onAddToCart }) {
  if (!products.length) {
    return <EmptyState message="No menu items found." />;
  }

  return (
    <div className="product-list">
      {products.map((product) => {
        const price = getProductPrice(product);

        return (
          <article className="product-list-item" key={product.id}>
            <button
              className="list-image"
              onClick={() => onProductClick(product)}
            >
              {getProductImage(product) ? (
                <img
                  src={getProductImage(product)}
                  alt={product.name}
                />
              ) : (
                <span>🍕</span>
              )}
            </button>

            <div className="list-info">
              <h3>{product.name}</h3>
              <p>{product.description || "Freshly prepared."}</p>

              <strong>{formatMoney(price)}</strong>
            </div>

            <button
              className="add-button"
              onClick={() => onAddToCart(product)}
            >
              <Plus size={18} />
            </button>
          </article>
        );
      })}
    </div>
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

function RecentOrders() {
  return (
    <section className="content-section recent-section">
      <SectionHeading
        title="Recent Orders"
        subtitle="Your latest Vhitepizza orders"
      />

      <div className="recent-orders">
        <div className="recent-order">
          <div className="recent-order-icon">
            <ShoppingBag size={20} />
          </div>

          <div>
            <strong>Order history</strong>
            <p>Your previous orders will appear here.</p>
          </div>

          <span className="order-status">Ready</span>
        </div>
      </div>
    </section>
  );
}

function CartSidebar({
  cart,
  subtotal,
  deliveryFee,
  total,
  updateQuantity,
  removeFromCart,
  clearCart,
  navigate,
}) {
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

      {cart.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
          <CartItems
            cart={cart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
          />

          <CartSummary
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            navigate={navigate}
          />
        </>
      )}
    </aside>
  );
}

function CartItems({ cart, updateQuantity, removeFromCart }) {
  return (
    <div className="cart-items">
      {cart.map((item) => (
        <div className="cart-item" key={item.id}>
          <div className="cart-item-image">
            {getImageUrl(item.image) ? (
              <img src={getImageUrl(item.image)} alt={item.name} />
            ) : (
              <span>🍕</span>
            )}
          </div>

          <div className="cart-item-info">
            <h4>{item.name}</h4>
            <span>{item.sizeLabel}</span>

            <strong>{formatMoney(item.price)}</strong>

            <div className="quantity-controls">
              <button onClick={() => updateQuantity(item.id, -1)}>
                <Minus size={13} />
              </button>

              <span>{item.quantity}</span>

              <button onClick={() => updateQuantity(item.id, 1)}>
                <Plus size={13} />
              </button>
            </div>
          </div>

          <button
            className="cart-remove"
            onClick={() => removeFromCart(item.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function CartSummary({
  subtotal,
  deliveryFee,
  total,
  navigate,
}) {
  return (
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

      <button
        className="checkout-button"
        onClick={() => navigate("cart")}
      >
        Checkout
        <ArrowRight size={17} />
      </button>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="empty-cart">
      <div>
        <ShoppingCart size={30} />
      </div>

      <h3>Your cart is empty</h3>
      <p>Add something delicious from our menu.</p>
    </div>
  );
}

function MobileCart({
  cart,
  subtotal,
  deliveryFee,
  total,
  updateQuantity,
  removeFromCart,
  clearCart,
  navigate,
}) {
  return (
    <div className="mobile-cart-page">
      <div className="mobile-page-header">
        <button onClick={() => navigate("home")}>
          <ChevronLeft size={21} />
        </button>

        <h2>Your Cart</h2>

        {cart.length > 0 && (
          <button onClick={clearCart}>
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
          <CartItems
            cart={cart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
          />

          <CartSummary
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            navigate={() => {}}
          />
        </>
      )}
    </div>
  );
}

function MobileBottomNav({ activeScreen, navigate, cartCount }) {
  return (
    <nav className="mobile-bottom-nav">
      <button
        className={activeScreen === "home" ? "active" : ""}
        onClick={() => navigate("home")}
      >
        <Home size={20} />
        <span>Home</span>
      </button>

      <button
        className={activeScreen === "explore" ? "active" : ""}
        onClick={() => navigate("explore")}
      >
        <Search size={20} />
        <span>Explore</span>
      </button>

      <button
        className={activeScreen === "cart" ? "active" : ""}
        onClick={() => navigate("cart")}
      >
        <div className="bottom-icon">
          <ShoppingCart size={20} />
          {cartCount > 0 && <b>{cartCount}</b>}
        </div>

        <span>Cart</span>
      </button>

      <button
        className={
          activeScreen === "profile" || activeScreen === "settings"
            ? "active"
            : ""
        }
        onClick={() => navigate("profile")}
      >
        <User size={20} />
        <span>More</span>
      </button>
    </nav>
  );
}

function ProductModal({ product, onClose, onAddToCart }) {
  const price = getProductPrice(product);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="product-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-image">
          {getProductImage(product) ? (
            <img src={getProductImage(product)} alt={product.name} />
          ) : (
            <span>🍕</span>
          )}
        </div>

        <div className="modal-content">
          <div className="product-rating">
            <Star size={14} fill="currentColor" />
            <span>4.8</span>
          </div>

          <h2>{product.name}</h2>

          <p>
            {product.description ||
              "Fresh ingredients, carefully prepared and delivered hot."}
          </p>

          <strong className="modal-price">{formatMoney(price)}</strong>

          <button
            className="modal-add-button"
            onClick={() => onAddToCart(product)}
          >
            Add to Cart
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

function OrdersView() {
  return (
    <div className="page-content">
      <div className="page-heading">
        <span>YOUR ORDERS</span>
        <h2>Order History</h2>
        <p>Track and view your Vhitepizza orders.</p>
      </div>

      <EmptyState message="Your orders will appear here." />
    </div>
  );
}

function ProfileView() {
  return (
    <div className="page-content">
      <div className="page-heading">
        <span>ACCOUNT</span>
        <h2>Profile</h2>
        <p>Manage your Vhitepizza account.</p>
      </div>

      <div className="profile-card">
        <div className="large-avatar">V</div>

        <div>
          <h3>Vhitepizza Customer</h3>
          <p>Welcome to Vhitepizza.</p>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ theme, changeTheme }) {
  return (
    <div className="page-content">
      <div className="page-heading">
        <span>PREFERENCES</span>
        <h2>Settings</h2>
        <p>Customize your Vhitepizza experience.</p>
      </div>

      <section className="settings-card">
        <div className="settings-section">
          <div className="settings-title">
            <div className="settings-icon">
              <Settings size={19} />
            </div>

            <div>
              <h3>Appearance</h3>
              <p>Choose how Vhitepizza looks on your device.</p>
            </div>
          </div>

          <div className="theme-options">
            <ThemeOption
              value="system"
              current={theme}
              label="System"
              description="Follow your device settings"
              icon="⚙️"
              onChange={changeTheme}
            />

            <ThemeOption
              value="light"
              current={theme}
              label="Light"
              description="Use the light theme"
              icon="☀️"
              onChange={changeTheme}
            />

            <ThemeOption
              value="dark"
              current={theme}
              label="Dark"
              description="Use the dark theme"
              icon="🌙"
              onChange={changeTheme}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function ThemeOption({
  value,
  current,
  label,
  description,
  icon,
  onChange,
}) {
  return (
    <button
      className={`theme-option ${current === value ? "selected" : ""}`}
      onClick={() => onChange(value)}
    >
      <span className="theme-option-icon">{icon}</span>

      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>

      <span className="theme-radio">
        {current === value && <i />}
      </span>
    </button>
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

export default App;