import React, { useState, useEffect } from 'react';
import Link from 'next/link';

import { useAppContext } from '../context/AppContext';

// MegaDropdown component for "By size" and similar categories (desktop)
const MegaDropdown = ({ title, categories }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <li className="mega-dropdown" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
      >
        {title}
      </a>
      {isOpen && (
        <div className="mega-dropdown-content">
          <div className="mega-dropdown-grid">
            {categories.map((category, index) => (
              <div key={index} className="mega-dropdown-column">
                <h3 className="mega-dropdown-title">{category.title}</h3>
                <ul className="mega-dropdown-list">
                  {category.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <Link href={`/all-products?${category.filterType}=${item.value}`}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </li>
  );
};

// Regular dropdown for simpler menus (desktop)
const Dropdown = ({ title, items, filterType, customLinks = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <li className="dropdown" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
      >
        {title}
      </a>
      <ul className={`dropdown-menu ${isOpen ? 'active' : ''}`}>
        {items.map((item, index) => (
          <li key={index}>
            {customLinks ? (
              <Link href={item.path}>{item.label}</Link>
            ) : (
              <Link href={`/all-products?${filterType}=${item.value}`}>
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
};

// Mobile nested dropdown component for "By size"
const MobileNestedDropdown = ({ title, categories }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);

  const toggleDropdown = (e) => {
    e.preventDefault();
    setIsOpen(!isOpen);
    if (!isOpen) {
      setActiveCategory(null);
    }
  };

  const toggleCategory = (index) => {
    setActiveCategory(activeCategory === index ? null : index);
  };

  return (
    <li className="mobile-nested-dropdown">
      <a
        href="#"
        onClick={toggleDropdown}
        className="mobile-dropdown-toggle"
      >
        {title} <span className="dropdown-arrow">{isOpen ? '' : ''}</span>
      </a>
      {isOpen && (
        <div className="mobile-dropdown-content">
          {categories.map((category, index) => (
            <div key={index} className="mobile-category">
              <div 
                className="mobile-category-header" 
                onClick={() => toggleCategory(index)}
              >
                <h3>{category.title}</h3>
                <span className="category-arrow">
                  {activeCategory === index ? '' : ''}
                </span>
              </div>
              {activeCategory === index && (
                <ul className="mobile-category-items">
                  {category.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <Link href={`/all-products?${category.filterType}=${item.value}`}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </li>
  );
};

// Mobile dropdown for simpler menus
const MobileDropdown = ({ title, items, filterType, customLinks = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = (e) => {
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  return (
    <li className="mobile-dropdown">
      <a
        href="#"
        onClick={toggleDropdown}
        className="mobile-dropdown-toggle"
      >
        {title} <span className="dropdown-arrow">{isOpen ? '' : ''}</span>
      </a>
      {isOpen && (
        <ul className="mobile-dropdown-menu">
          {items.map((item, index) => (
            <li key={index}>
              {customLinks ? (
                <Link href={item.path}>{item.label}</Link>
              ) : (
                <Link href={`/all-products?${filterType}=${item.value}`}>
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

const Navbar = () => {
 
  const [searchTerm, setSearchTerm] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { wishlist, cart } = useAppContext();

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Set initial value
    checkMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  // Handle search submission
  const handleSearch = () => {
    if (searchTerm.trim() !== '') {
      window.location.href = `/search?query=${searchTerm}`;
    }
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    // Prevent body scrolling when mobile menu is open
    document.body.style.overflow = isMobileMenuOpen ? 'auto' : 'hidden';
  };
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for user in localStorage
    const storedUser = localStorage.getItem('user');
    setUser(storedUser ? JSON.parse(storedUser) : null);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.reload();
  };

  // Size categories for the mega dropdown
  const sizeCategories = [
    {
      title: "Plans by area (SQM)",
      filterType: "area",
      items: [
        { label: '750+ SQM', value: '750plus' },
        { label: '500-750 SQM', value: '500-750' },
        { label: '400-500 SQM', value: '400-500' },
        { label: '300-400 SQM', value: '300-400' },
        { label: '200-300 SQM', value: '200-300' },
        { label: '100-200 SQM', value: '100-200' },
        { label: 'Under 100 SQM', value: 'under100' },
      ]
    },
    {
      title: "Plans by bedrooms",
      filterType: "bedrooms",
      items: [
        { label: '5+ Bedrooms', value: '5plus' },
        { label: '4 Bedrooms', value: '4' },
        { label: '3 Bedrooms', value: '3' },
        { label: '2 Bedrooms', value: '2' },
        { label: '1 Bedroom', value: '1' },
      ]
    },
    {
      title: "Plans by floors",
      filterType: "floors",
      items: [
        { label: '1 Floor', value: '1' },
        { label: '2 Floors', value: '2' },
        { label: '3 Floors', value: '3' },
        { label: '4+ Floors', value: '4plus' },
      ]
    }
  ];

  // Style items
  const styleItems = [
    { label: 'Modern house plans', value: 'modern' },
    { label: 'Contemporary plans', value: 'contemporary' },
    { label: 'Bungalow plans', value: 'bungalow' },
    { label: 'Luxury plans', value: 'luxury' },
    { label: 'Rustic plans', value: 'rustic' },
    { label: 'Country plans', value: 'country' },
  ];

  // Budget items
  const budgetItems = [
    { label: 'Under $100 Plans', value: 'under-100' },
    { label: '$100 - $300 Plans', value: '100-300' },
    { label: '$300 - $500 Plans', value: '300-500' },
    { label: '$500 - $700 Plans', value: '500-700' },
    { label: '$700+ Plans', value: '700-plus' },
  ];

  // Learn items
  const learnItems = [
    { label: "Building Designs", path: "/learn/building-designs" },
    { label: "Design Costs", path: "/learn/design-costs" }
  ];

  return (
    <nav className={`navbar ${isVisible ? '' : 'hidden'}`}>
      <div className="logo">
        <Link href="/">
          <img src="/Logo2.svg" alt="Logo" />
        </Link>
      </div>

      <div className="navbar-content">
        <div className="nav-links-container">
          <ul className="nav-links">
            <li><Link href="/all-products">Shop</Link></li>
            
            {/* Mega dropdown for "By size" */}
            <MegaDropdown title="By size" categories={sizeCategories} />
            
            <Dropdown
              title="By style"
              filterType="style"
              items={styleItems}
            />
            <Dropdown
              title="By budget"
              filterType="budget"
              items={budgetItems}
            />
            <Dropdown
              title="Learn"
              items={learnItems}
              customLinks={true}
            />
            <li><Link href="/custom-plans">Custom plan</Link></li>
          </ul>
        </div>
      </div>

      <div className="navbar-icons">
        <div className="search-container">
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            id="search-bar"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
        </div>

        <div className="icon-wrapper">
  <Link href="/Wishlist">
    <i className="fa fa-heart"></i>
    {wishlist.length > 0 && (
      <span className={`badge ${wishlist.length > 9 ? 'large' : ''} ${wishlist.length > 99 ? 'very-large' : ''} ${wishlist.some(item => item.isNew) ? 'new' : ''}`}>
        {wishlist.length > 99 ? '99' : wishlist.length}
      </span>
    )}
  </Link>
</div>

<div className="icon-wrapper">
      {user ? (
        // If logged in, show profile dropdown
        <div className="relative group">
         <button className="profile-icon flex items-center justify-center w-10 h-10 rounded-full overflow-hidden border border-gray-300 bg-white">
  {user.image || user.avatar ? (
    <img
      src={user.image || user.avatar}
      alt="Profile"
      className="w-10 h-10 object-cover rounded-full"
    />
  ) : (
    <i className="fa fa-user text-gray-500 text-xl"></i>
  )}
</button>
          <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50">
            <div className="px-4 py-2 text-gray-700 border-b">
              {user.firstName || user.first_name || user.email}
            </div>
            <Link href="/profile" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      ) : (
        // If not logged in, link to login page
        <Link href="/login">
          <i className="fa fa-user"></i>
        </Link>
      )}
    </div>
<div className="icon-wrapper">
  <Link href="/Cart">
    <i className="fa fa-shopping-cart"></i>
    {cart.length > 0 && (
      <span className={`badge ${cart.length > 9 ? 'large' : ''} ${cart.length > 99 ? 'very-large' : ''}`}>
        {cart.length > 99 ? '99' : cart.length}
      </span>
    )}
  </Link>
</div>

        <div className="hamburger-wrapper" onClick={toggleMobileMenu}>
          <div className={`hamburger-menu ${isMobileMenuOpen ? 'open' : ''}`}>
            <i className="fa fa-bars"></i>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="mobile-menu-container">
          <ul className="nav-links mobile">
            <li><Link href="/all-products">Shop</Link></li>
            
            {/* Mobile nested dropdown for "By size" */}
            <MobileNestedDropdown title="By size" categories={sizeCategories} />
            
            {/* Use MobileDropdown for other menu items */}
            <MobileDropdown
              title="By style"
              filterType="style"
              items={styleItems}
            />
            <MobileDropdown
              title="By budget"
              filterType="budget"
              items={budgetItems}
            />
            <MobileDropdown
              title="Learn"
              items={learnItems}
              customLinks={true}
            />
            <li><Link href="/custom-plans">Custom plan</Link></li>
          </ul>
        </div>
      )}
    </nav>
  );
};

export default Navbar;