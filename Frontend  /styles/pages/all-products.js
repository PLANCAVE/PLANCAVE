import React, { useState, useEffect, useContext, useRef } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import axiosInstance from '../axios';
import Filters from '../components/Filters';
import Pagination from '../components/Pagination';
import ProductCard from '../components/ProductCard';
import Navbar from '../components/Navbar';
import ContactUs from '../components/ContactUs';
import FooterSection from '../components/FooterSection';
import { AppContext } from '../context/AppContext';
import { FiFilter, FiX } from 'react-icons/fi';
import styles from '../styles/AllProducts.module.css';
import { toast } from 'react-toastify';

// Frontend fetch function with better error handling and timeout
const fetchProducts = async (filters = {}) => {
  try {
    // Remove null or undefined values from filters
    const validFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== null && value !== undefined)
    );
    
    // Add pagination parameters if not present
    validFilters.page = validFilters.page || 1;
    validFilters.limit = validFilters.limit || 12;

    // Construct the base URL correctly - be very careful here
    // Remove any trailing slashes from the base URL
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
    
    // Construct the query string
    const queryString = new URLSearchParams(validFilters).toString();
    const url = `${baseUrl}/api/products?${queryString}`;
    
    console.log('Fetching products from:', url);
    
    // Add timeout to fetch with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    // Clear timeout
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      
      // Try to parse the error as JSON if possible
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch (e) {
        // If not JSON, use the text as is
      }
      
      throw new Error(`Error ${response.status}: ${errorMessage}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in fetchProducts:', error);
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      return { data: [], totalPages: 0, error: 'Request timed out. Please try again.' };
    }
    
    // Return a default value instead of throwing
    return { data: [], totalPages: 0, error: error.message };
  }
};

export async function getServerSideProps(context) {
  try {
    const { query } = context;

    // Extract query parameters
    const filters = {
      style: query.style || null,
      budget: query.budget || null,
      size: query.size || null,
      category: query.category || null,
      id: query.id || null,
      area: query.area || null,
      bedrooms: query.bedrooms || null,
      floors: query.floors || null,
      page: query.page || 1,
      limit: query.limit || 12
    };

    console.log('Fetching with filters:', filters);

    // Fetch filtered products
    const products = await fetchProducts(filters);

    // Check for errors
    if (products.error) {
      console.warn('Product fetch returned error:', products.error);
    }

    return {
      props: {
        products: products.data ? products : { data: [], totalPages: 0 },
        initialFilters: filters,
        error: products.error || null
      },
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        products: { data: [], totalPages: 0 },
        initialFilters: {},
        error: "Failed to load products. Please try again later."
      }
    };
  }
}

const AllProducts = ({ initialProducts = [], totalPages = 10, initialFilters = {} }) => {
  
  const [products, setProducts] = useState(initialProducts.data || []);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [_selectedCategory, setSelectedCategory] = useState('All');
  const itemsPerPage = 20;
  const router = useRouter();
  const heroRef = useRef(null);
  const filtersRef = useRef(null);
  const { category, id } = router.query;

  // Parallax effect for hero image
  const { scrollY } = useScroll();
  const heroImageY = useTransform(scrollY, [0, 500], [0, 150]);

  const { addToWishlist, addToCart } = useContext(AppContext);
  
  // Determine if mobile view based on window width
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    
    // Set initial value
    if (typeof window !== 'undefined') {
      handleResize();
      window.addEventListener('resize', handleResize);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  // Initialize page load animation
  useEffect(() => {
    const timer = setTimeout(() => setIsPageLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // COMMENT: This useEffect is where you fetch products based on filters
  // This is already set up to handle the query parameters
  useEffect(() => {
    const fetchPlans = async () => {
      if (!router.isReady) return;
      
      setLoading(true);
      try {
        // COMMENT: Here you construct query parameters from the filters state
        // The filters state is initialized with URL parameters from getServerSideProps
        const queryParams = {
          ...filters,
          page: currentPage,
          limit: itemsPerPage,
        };
        
        // Add category and id from URL if present
        if (category) queryParams.category = category;
        if (id) queryParams.id = id;
        
        // COMMENT: Convert filters to URL query string
        const query = new URLSearchParams(queryParams).toString();
        
        // COMMENT: Make API request with all filters
        // Your backend API needs to handle the area, bedrooms, and floors parameters
        const endpoint = '/api/products'; // or '/api/products' depending on your backend
        const { data } = await axiosInstance.get(`${endpoint}?${query}`);
        
        setProducts(data);
      } catch (error) {
        console.error('Error fetching products:', error);
        toast.error('Error loading products. Please try again.'); 
      } finally {
        setTimeout(() => setLoading(false), 300);
      }
    };

    fetchPlans();
  }, [filters, currentPage, router.isReady, category, id]);

  // Paginate products based on the current page and items per page
  const paginateProducts = (productsArray, page, itemsPerPage) => {
    // Check if productsArray is undefined or null
    if (!productsArray) {
      return [];
    }
    
    // Check if productsArray is an object with a data property (API response format)
    const arrayToSlice = Array.isArray(productsArray) 
      ? productsArray 
      : (productsArray.data ? productsArray.data : []);
    
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    return arrayToSlice.slice(startIndex, endIndex);
  };
  
  // Update how paginatedProducts is calculated
  const paginatedProducts = paginateProducts(
    products, 
    currentPage, 
    itemsPerPage
  );
  


  // Toggle sidebar and handle body scroll lock
  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
    document.body.style.overflow = isSidebarOpen ? 'auto' : 'hidden';
  };

  // COMMENT: This function handles filter changes from the Filters component
  // It already updates the filters state which triggers the useEffect to fetch filtered products
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    if (isMobile) toggleSidebar();
    toast.info('Filters applied');
  };
  
  const handleOverlayClick = (e) => {
    // Only close if clicked directly on the overlay, not on the filters
    if (filtersRef.current && !filtersRef.current.contains(e.target)) {
      toggleSidebar();
    }
  };

  // Handle search form submission
  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchTerm)}`);
  };

  // Handle page change for pagination
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    
    // Smooth scroll to top of products section
    document.querySelector(`.${styles.productsGrid}`).scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  };

  // Category quick filter buttons
  const categories = ['All', 'New Arrivals', 'Best Sellers', 'On Sale'];
  
  // COMMENT: This function handles category filter clicks
  // You can add similar functions for area, bedrooms, and floors if needed
  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    let newFilters = {...filters};
    
    if (category === 'All') {
      delete newFilters.category;
      router.push('/all-products', undefined, { shallow: true });
    } else if (category === 'New Arrivals') {
      router.push('/all-products?category=new-arrivals', undefined, { shallow: true });
    } else if (category === 'Best Sellers') {
      router.push('/all-products?category=best-sellers', undefined, { shallow: true });
    } else if (category === 'On Sale') {
      router.push('/all-products?category=on-sale', undefined, { shallow: true });
    }
    
    setCurrentPage(1);
  };

  // COMMENT: You can add a similar function for displaying area, bedrooms, and floors titles
  // Get page title based on category
  const getPageTitle = () => {
    if (category === 'new-arrivals') return 'New Arrivals';
    if (category === 'best-sellers') return 'Best Selling Plans';
    if (category === 'on-sale') return 'On Sale Plans';
    if (category === 'under-10k') return 'Under $10,000 Plans';
    if (category === '10k-50k') return '$10,000 - $50,000 Plans';
    if (category === '50k-100k') return '$50,000 - $100,000 Plans';
    if (category === '100k-200k') return '$100,000 - $200,000 Plans';
    if (category === 'above-200k') return 'Above $200,000 Plans';
    
    // COMMENT: Add titles for area filters
    const { area } = router.query;
    if (area === '750plus') return 'Plans with 750+ SQM';
    if (area === '500-750') return 'Plans with 500-750 SQM';
    if (area === '400-500') return 'Plans with 400-500 SQM';
    if (area === '300-400') return 'Plans with 300-400 SQM';
    if (area === '200-300') return 'Plans with 200-300 SQM';
    if (area === '100-200') return 'Plans with 100-200 SQM';
    if (area === 'under100') return 'Plans under 100 SQM';
    
    // COMMENT: Add titles for bedroom filters
    const { bedrooms } = router.query;
    if (bedrooms === '5plus') return 'Plans with 5+ Bedrooms';
    if (bedrooms === '4') return 'Plans with 4 Bedrooms';
    if (bedrooms === '3') return 'Plans with 3 Bedrooms';
    if (bedrooms === '2') return 'Plans with 2 Bedrooms';
    if (bedrooms === '1') return 'Plans with 1 Bedroom';
    
    // COMMENT: Add titles for floor filters
    const { floors } = router.query;
    if (floors === '1') return 'Single Floor Plans';
    if (floors === '2') return 'Two Floor Plans';
    if (floors === '3') return 'Three Floor Plans';
    if (floors === '4plus') return 'Four+ Floor Plans';
    
    if (category) {
      return `${category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} Plans`;
    }
    
    return 'Explore our collection';
  };

  // Variants for framer-motion animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1
      }
    }
  };

  const productVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4 }
    }
  };

  // Calculate columns for product grid
  const getGridColumns = () => {
    if (isMobile) return 2;
    if (isTablet) return 3;
    return 4;
  };

  // COMMENT: You should add a function to display active filters
  // This will help users understand what filters are currently applied
  const getActiveFilters = () => {
    const activeFilters = [];
    
    // Check for area filter
    if (router.query.area) {
      let areaLabel = '';
      switch (router.query.area) {
        case '750plus': areaLabel = '750+ SQM'; break;
        case '500-750': areaLabel = '500-750 SQM'; break;
        case '400-500': areaLabel = '400-500 SQM'; break;
        case '300-400': areaLabel = '300-400 SQM'; break;
        case '200-300': areaLabel = '200-300 SQM'; break;
        case '100-200': areaLabel = '100-200 SQM'; break;
        case 'under100': areaLabel = 'Under 100 SQM'; break;
      }
      activeFilters.push(`Area: ${areaLabel}`);
    }
    
    // Check for bedrooms filter
    if (router.query.bedrooms) {
      let bedroomsLabel = '';
      switch (router.query.bedrooms) {
        case '5plus': bedroomsLabel = '5+ Bedrooms'; break;
        case '4': bedroomsLabel = '4 Bedrooms'; break;
        case '3': bedroomsLabel = '3 Bedrooms'; break;
        case '2': bedroomsLabel = '2 Bedrooms'; break;
        case '1': bedroomsLabel = '1 Bedroom'; break;
      }
      activeFilters.push(`Bedrooms: ${bedroomsLabel}`);
    }
    
    // Check for floors filter
    if (router.query.floors) {
      let floorsLabel = '';
      switch (router.query.floors) {
        case '4plus': floorsLabel = '4+ Floors'; break;
        case '3': floorsLabel = '3 Floors'; break;
        case '2': floorsLabel = '2 Floors'; break;
        case '1': floorsLabel = '1 Floor'; break;
      }
      activeFilters.push(`Floors: ${floorsLabel}`);
    }
    
    return activeFilters;
  };

  return (
    <div className={styles.container}>
      <Navbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        handleSearch={handleSearch}
      />

      <div className={styles.heroSection} ref={heroRef}>
        <motion.div 
          className={styles.heroParallax}
          style={{ y: heroImageY }}
        >
          {/* Hero background image is set in CSS with a semi-transparent overlay */}
        </motion.div>
        <div className={styles.heroOverlay}></div>
        <motion.div 
          className={styles.heroContent}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h1>{getPageTitle()}</h1>
          <p>Find your perfect design</p>
          <motion.button 
            className={styles.heroButton}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => document.querySelector(`.${styles.productsGrid}`).scrollIntoView({ 
              behavior: 'smooth',
              block: 'start'
            })}
          >
            Shop Now
          </motion.button>
        </motion.div>
      </div>

      <div className={styles.pageContent}>
        {/* COMMENT: You can add active filters display here */}
        {getActiveFilters().length > 0 && (
          <div className={styles.activeFilters}>
            <h3>Active Filters:</h3>
            <div className={styles.filterTags}>
              {getActiveFilters().map((filter, index) => (
                <span key={index} className={styles.filterTag}>
                  {filter}
                </span>
              ))}
              <button 
                className={styles.clearFiltersButton}
                onClick={() => {
                  router.push('/all-products', undefined, { shallow: true });
                }}
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}

        <div className={styles.categoryFilters}>
          {categories.map((cat) => (
            <motion.button
              key={cat}
              className={`${styles.categoryButton} ${
                (cat === 'All' && !category) || 
                (cat === 'New Arrivals' && category === 'new-arrivals') ||
                (cat === 'Best Sellers' && category === 'best-sellers') ||
                (cat === 'On Sale' && category === 'on-sale')
                  ? styles.active 
                  : ''
              }`}
              onClick={() => handleCategoryClick(cat)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {cat}
            </motion.button>
          ))}
        </div>

        <div className={styles.mainLayout}>
          {/* Desktop Filters Sidebar - Only shown on non-mobile */}
          {!isMobile && (
            <aside className={styles.filtersWrapper}>
              <Filters onFilterChange={handleFilterChange} isMobile={false} />
            </aside>
          )}

          {/* Products Grid */}
          <main className={styles.main}>
            <motion.div 
              className={styles.productsGrid}
              style={{ 
                gridTemplateColumns: `repeat(${getGridColumns()}, 1fr)` 
              }}
              variants={containerVariants}
              initial="hidden"
              animate={isPageLoaded ? "visible" : "hidden"}
            >
              {loading ? (
                // Loading skeleton
                [...Array(itemsPerPage)].map((_, index) => (
                  <motion.div 
                    key={index} 
                    className={styles.productCardSkeleton}
                    variants={productVariants}
                  >
                    <div className={styles.imageSkeleton}></div>
                    <div className={styles.contentSkeleton}>
                      <div className={styles.titleSkeleton}></div>
                      <div className={styles.priceSkeleton}></div>
                      <div className={styles.buttonSkeleton}></div>
                    </div>
                  </motion.div>
                ))
              ) : products.length > 0 ? (
                // Products grid with animation
                products.map((product) => (
                  <motion.div
                    key={product._id}
                    className={styles.productCardWrapper}
                    variants={productVariants}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  >
                    <ProductCard
                      product={product}
                      onAddToWishlist={() => addToWishlist(product)}
                      onAddToCart={() => addToCart(product)}
                    />
                  </motion.div>
                ))
              ) : paginatedProducts.length > 0 ? (
                  // Display paginated products
                  paginatedProducts.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      onAddToWishlist={() => addToWishlist(product)}
                      onAddToCart={() => addToCart(product)}
                    />
                  ))
                ) : (
                // No products found
                <motion.div 
                  className={styles.noProducts}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2>No products found</h2>
                  <p>Try adjusting your filters or search terms</p>
                  <button 
                    className={styles.resetButton}
                    onClick={() => {
                      setFilters({});
                      router.push('/all-products', undefined, { shallow: true });
                    }}
                  >
                    Reset Filters
                  </button>
                </motion.div>
              )}
            </motion.div>

            {/* Pagination */}
            {paginatedProducts.length > 0 && (
              <motion.div
                className={styles.paginationWrapper}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </motion.div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filter Toggle Button */}
      {isMobile && (
        <motion.button
          className={styles.filterToggleButton}
          onClick={toggleSidebar}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiFilter /> {isSidebarOpen ? 'Close' : 'Filters'}
        </motion.button>
      )}
      
      {/* Mobile Overlay */}
      {isMobile && (
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={handleOverlayClick}
            />
          )}
        </AnimatePresence>
      )}
      
      {/* Mobile Filters Sidebar */}
      {isMobile && (
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              className={styles.mobileSidebar}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3 }}
              ref={filtersRef}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: '85%',
                maxWidth: '350px',
                backgroundColor: 'white',
                zIndex: 1000,
                overflowY: 'auto',
                boxShadow: '0 0 10px rgba(0,0,0,0.2)',
                padding: '1rem'
              }}
            >
              <div className={styles.filterHeader} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '1rem',
                borderBottom: '1px solid #eee',
                paddingBottom: '0.5rem'
              }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Filters</h3>
                <button 
                  className={styles.closeButton} 
                  onClick={toggleSidebar}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FiX />
                </button>
              </div>
              <div style={{ padding: '0.5rem 0' }}>
                <Filters onFilterChange={handleFilterChange} isMobile={true} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Contact Us Section */}
      <ContactUs />

      {/* Footer Section */}
      <FooterSection />
    </div>
  );
};

export default AllProducts;