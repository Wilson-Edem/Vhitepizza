import { useState } from 'react'
import './App.css'

const pizzas = [
  {
    name: 'Chicken Suya Pizza',
    description: 'Suya chicken, peppers, red onions and mozzarella.',
    price: '₦4,000',
  },
  {
    name: 'BBQ Chicken Pizza',
    description: 'Grilled chicken, BBQ sauce, red onions and mozzarella.',
    price: '₦3,800',
  },
  {
    name: 'Pepperoni Supreme',
    description: 'Beef pepperoni, tomato sauce and extra cheese.',
    price: '₦4,200',
  },
  {
    name: 'Veggie Overload',
    description: 'Mushrooms, peppers, sweet corn, olives and red onions.',
    price: '₦3,500',
  },
]

function App() {
  const [dark, setDark] = useState(true)

  return (
    <div className={`app ${dark ? 'dark' : 'light'}`}>
      <header className="navbar">
        <a href="#home" className="brand">
          <span className="brand-mark">V</span>
          <span>Vhite<span>Pizza</span></span>
        </a>

        <nav className="nav-links">
          <a href="#menu">Menu</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>

        <button
          type="button"
          className="theme-toggle"
          onClick={() => setDark((value) => !value)}
          aria-label="Toggle theme"
        >
          {dark ? '☀' : '☾'}
        </button>
      </header>

      <main>
        <section id="home" className="hero-section">
          <div className="hero-content">
            <span className="eyebrow">Fresh from Vhite Pizza</span>

            <h1>
              Hot pizza.
              <br />
              <span>Made for you.</span>
            </h1>

            <p className="hero-text">
              Delicious pizzas, sides and drinks delivered straight to your
              door. Built around your taste, made fresh when you order.
            </p>

            <div className="hero-actions">
              <a href="#menu" className="primary-button">
                Order now
              </a>

              <a href="#menu" className="secondary-button">
                View menu
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <div className="pizza-glow"></div>
            <div className="pizza-card">
              <div className="pizza-circle">
                <span>🍕</span>
              </div>
            </div>
          </div>
        </section>

        <section id="menu" className="menu-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Our menu</span>
              <h2>Something for every craving.</h2>
            </div>

            <p>
              Start with one of our favourites, then customise it your way.
            </p>
          </div>

          <div className="pizza-grid">
            {pizzas.map((pizza) => (
              <article className="pizza-item" key={pizza.name}>
                <div className="pizza-placeholder">
                  <span>🍕</span>
                </div>

                <div className="pizza-info">
                  <div>
                    <h3>{pizza.name}</h3>
                    <p>{pizza.description}</p>
                  </div>

                  <strong>{pizza.price}</strong>
                </div>

                <button type="button" className="add-button">
                  Add to order
                </button>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="feature-section">
          <div className="feature-card">
            <span className="feature-number">01</span>
            <h2>Made fresh.</h2>
            <p>
              Your pizza is prepared after you order, so every bite arrives
              hot and fresh.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-number">02</span>
            <h2>Made your way.</h2>
            <p>
              Choose your size, crust, cheese and toppings to create your
              perfect pizza.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-number">03</span>
            <h2>Delivered to you.</h2>
            <p>
              Give us your location and we handle the rest from the kitchen
              to your doorstep.
            </p>
          </div>
        </section>

        <section className="cta-section">
          <span className="eyebrow">Ready when you are</span>
          <h2>Your next pizza is only a few clicks away.</h2>

          <a href="#menu" className="primary-button">
            Start your order
          </a>
        </section>
      </main>

      <footer id="contact" className="footer">
        <div>
          <a href="#home" className="brand">
            <span className="brand-mark">V</span>
            <span>Vhite<span>Pizza</span></span>
          </a>
          <p>Fresh pizza. Your way.</p>
        </div>

        <div className="footer-links">
          <a href="#menu">Menu</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>

        <p className="copyright">
          © {new Date().getFullYear()} Vhite Pizza
        </p>
      </footer>
    </div>
  )
}

export default App