// DOM Elements
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const mainNav = document.querySelector('.main-nav');
const cartIcon = document.querySelector('.cart-icon');
const cartSidebar = document.getElementById('cart-sidebar');
const overlay = document.createElement('div');
overlay.className = 'overlay';
document.body.appendChild(overlay);

// Global Variables
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Initialize the application
function init() {
    setupEventListeners();
    fetchProducts();
    renderCart();
    updateCartCount();
}

// Setup all event listeners
function setupEventListeners() {
    // Mobile Menu Toggle
    mobileMenuBtn.addEventListener('click', () => {
        mainNav.classList.toggle('active');
    });

    // Cart Toggle
    cartIcon.addEventListener('click', (e) => {
        e.preventDefault();
        document.body.classList.add('cart-open');
    });

    overlay.addEventListener('click', () => {
        document.body.classList.remove('cart-open');
    });

    if (document.querySelector('.close-cart')) {
        document.querySelector('.close-cart').addEventListener('click', () => {
            document.body.classList.remove('cart-open');
        });
    }

    // Back to Top Button
    const backToTopBtn = document.getElementById('back-to-top');
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Category Filter
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const category = this.dataset.category;
            if (category === 'all') {
                renderProducts(products);
            } else {
                const filteredProducts = products.filter(p => p.category === category);
                renderProducts(filteredProducts);
            }
        });
    });

    // Search Functionality
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const filteredProducts = products.filter(product => 
                product.name.toLowerCase().includes(searchTerm) || 
                product.description.toLowerCase().includes(searchTerm)
            );
            renderProducts(filteredProducts);
        });
    }

    // Navigation between views
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.page-view').forEach(view => {
                view.style.display = 'none';
            });
            document.querySelectorAll('.nav-link').forEach(navLink => {
                navLink.classList.remove('active');
            });
            document.getElementById(this.dataset.view).style.display = 'block';
            this.classList.add('active');
        });
    });
}

// Fetch products from API
async function fetchProducts() {
    try {
        const response = await fetch('http://localhost:5000/api/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        products = await response.json();
        renderProducts(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        showMessage('Failed to load products. Please try again later.', 'error');
    }
}

// Fetch single product details
async function fetchProductDetails(productId) {
    try {
        const response = await fetch(`http://localhost:5000/api/products/${productId}`);
        if (!response.ok) throw new Error('Failed to fetch product details');
        return await response.json();
    } catch (error) {
        console.error('Error fetching product details:', error);
        showMessage('Failed to load product details', 'error');
        return null;
    }
}

// Render products to the page
function renderProducts(productsToRender) {
    const productGrid = document.getElementById('product-list');
    if (!productGrid) return;
    
    if (productsToRender.length === 0) {
        productGrid.innerHTML = '<p class="no-products">No products found.</p>';
        return;
    }

    productGrid.innerHTML = productsToRender.map(product => `
        <div class="product-card" data-id="${product.id}" data-category="${product.category}">
            <div class="product-image">
                <img src="${product.image_url || 'images/placeholder.jpg'}" alt="${product.name}">
                <button class="quick-add-btn" data-product-id="${product.id}" title="Quick Add to Cart">
                    <i class="fas fa-cart-plus"></i>
                </button>
                ${product.stock < 5 ? `<span class="stock-badge">Only ${product.stock} left!</span>` : ''}
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <div class="price">
                    <span class="current-price">$${product.price.toFixed(2)}</span>
                </div>
                <div class="product-actions">
                    <button class="view-details-btn" onclick="showProductDetail(${product.id})">
                        <i class="fas fa-eye"></i> Details
                    </button>
                    <button class="add-to-cart-btn" onclick="addToCart(${product.id})" ${product.stock < 1 ? 'disabled' : ''}>
                        <i class="fas fa-cart-plus"></i> ${product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    // Setup quick add buttons
    document.querySelectorAll('.quick-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const productId = parseInt(btn.dataset.productId);
            addToCart(productId);
        });
    });
}

// Show product detail view
async function showProductDetail(productId) {
    try {
        const product = await fetchProductDetails(productId);
        if (!product) return;
        
        const detailView = document.getElementById('product-detail-content');
        if (!detailView) return;
        
        detailView.innerHTML = `
            <div class="product-detail-container">
                <div class="product-detail-images">
                    <div class="main-image">
                        <img src="${product.image_url || 'images/placeholder.jpg'}" alt="${product.name}">
                    </div>
                </div>
                <div class="product-detail-info">
                    <h1>${product.name}</h1>
                    <div class="price">$${product.price.toFixed(2)}</div>
                    <div class="rating">
                        ${renderRating(product.rating || 4.5)}
                        <span class="review-count">(${product.reviews || 24} reviews)</span>
                    </div>
                    <div class="description">
                        <p>${product.description}</p>
                    </div>
                    
                    <div class="availability">
                        <i class="fas ${product.stock > 0 ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                        <span>${product.stock > 0 ? `${product.stock} items in stock` : 'Out of stock'}</span>
                    </div>
                    
                    <div class="quantity-selector">
                        <label>Quantity:</label>
                        <button class="quantity-btn minus" onclick="adjustQuantity('detail-quantity', -1)">-</button>
                        <input type="number" id="detail-quantity" class="quantity-input" value="1" min="1" max="${product.stock}">
                        <button class="quantity-btn plus" onclick="adjustQuantity('detail-quantity', 1)">+</button>
                    </div>
                    
                    <div class="action-buttons">
                        <button class="btn-primary detail-add-to-cart" 
                                data-product-id="${product.id}"
                                ${product.stock < 1 ? 'disabled' : ''}>
                            <i class="fas fa-shopping-cart"></i> 
                            ${product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                        <button class="btn-outline add-to-wishlist" onclick="addToWishlist(${product.id})">
                            <i class="fas fa-heart"></i> Wishlist
                        </button>
                    </div>
                    
                    <div class="product-meta">
                        <div class="meta-item">
                            <span>Category:</span>
                            <span>${product.category}</span>
                        </div>
                        <div class="meta-item">
                            <span>SKU:</span>
                            <span>${product.id}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Setup add to cart button in detail view
        const detailAddBtn = detailView.querySelector('.detail-add-to-cart');
        if (detailAddBtn) {
            detailAddBtn.addEventListener('click', () => {
                const quantity = parseInt(document.getElementById('detail-quantity').value) || 1;
                addToCart(product.id, quantity);
            });
        }

        // Show the detail view
        document.getElementById('products-view').style.display = 'block';
        if (document.getElementById('product-list-view')) {
            document.getElementById('product-list-view').style.display = 'none';
        }
        if (document.getElementById('product-detail-view')) {
            document.getElementById('product-detail-view').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading product details:', error);
        showMessage('Failed to load product details.', 'error');
    }
}

// Add to cart functionality
function addToCart(productId, quantity = 1) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        showMessage('Product not found!', 'error');
        return;
    }
    
    if (product.stock < quantity) {
        showMessage(`Only ${product.stock} items available in stock!`, 'error');
        return;
    }

    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > product.stock) {
            showMessage(`Cannot add more than available stock (${product.stock})`, 'error');
            return;
        }
        existingItem.quantity = newQuantity;
    } else {
        cart.push({ 
            id: productId, 
            quantity: quantity,
            addedAt: new Date().toISOString()
        });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
    
    showMessage(`${quantity} ${quantity > 1 ? 'items' : 'item'} of ${product.name} added to cart!`, 'success');
    pulseCartIcon();
    
    if (window.innerWidth > 768) {
        document.body.classList.add('cart-open');
    }
}

// Update cart item quantity
function updateCartItemQuantity(productId, newQuantity) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    newQuantity = Math.max(1, Math.min(newQuantity, product.stock));
    
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = newQuantity;
        localStorage.setItem('cart', JSON.stringify(cart));
        renderCart();
        
        if (Math.abs(item.quantity - newQuantity) > 2) {
            showMessage(`Quantity updated to ${newQuantity}`, 'info');
        }
    }
}

// Render the cart
async function renderCart() {
    const cartItemsElement = document.getElementById('cart-items');
    if (!cartItemsElement) return;
    
    if (cart.length === 0) {
        cartItemsElement.innerHTML = '<p>Your cart is empty</p>';
        if (document.getElementById('checkout-button')) {
            document.getElementById('checkout-button').disabled = true;
        }
        if (document.getElementById('cart-total')) {
            document.getElementById('cart-total').textContent = '$0.00';
        }
        return;
    }

    try {
        const productIds = cart.map(item => item.id);
        const response = await fetch('http://localhost:5000/api/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        
        const allProducts = await response.json();
        const cartProducts = allProducts.filter(product => productIds.includes(product.id));
        
        let total = 0;
        cartItemsElement.innerHTML = cart.map(item => {
            const product = cartProducts.find(p => p.id === item.id);
            if (!product) return '';
            
            const itemTotal = product.price * item.quantity;
            total += itemTotal;
            
            return `
                <div class="cart-item">
                    <div class="cart-item-image">
                        <img src="${product.image_url || 'images/placeholder.jpg'}" alt="${product.name}">
                    </div>
                    <div class="cart-item-details">
                        <h4>${product.name}</h4>
                        <div class="price">$${product.price.toFixed(2)}</div>
                        <div class="cart-item-controls">
                            <button onclick="updateCartItemQuantity(${product.id}, ${item.quantity - 1})">-</button>
                            <input type="text" value="${item.quantity}" readonly>
                            <button onclick="updateCartItemQuantity(${product.id}, ${item.quantity + 1})">+</button>
                            <button class="remove-item" onclick="removeFromCart(${product.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        if (document.getElementById('cart-total')) {
            document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;
        }
        if (document.getElementById('checkout-button')) {
            document.getElementById('checkout-button').disabled = false;
        }
    } catch (error) {
        console.error('Error rendering cart:', error);
        cartItemsElement.innerHTML = '<p>Error loading cart items</p>';
    }
}

// Remove item from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
    showMessage('Product removed from cart.', 'info');
}

// Update cart count display
function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.textContent = totalItems;
    }
}

// Checkout function
async function checkout() {
    if (cart.length === 0) {
        showMessage('Your cart is empty!', 'error');
        return;
    }

    try {
        const response = await fetch('http://localhost:5000/api/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: cart.map(item => ({
                    id: item.id,
                    quantity: item.quantity
                }))
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Checkout failed');
        }

        const result = await response.json();
        showMessage(`Order #${result.order_id} placed successfully!`, 'success');
        
        cart = [];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        renderCart();
        document.body.classList.remove('cart-open');
        fetchProducts();
    } catch (error) {
        console.error('Checkout error:', error);
        showMessage(error.message, 'error');
    }
}

// Wishlist functions
function addToWishlist(productId) {
    let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    const index = wishlist.indexOf(productId);
    
    if (index === -1) {
        wishlist.push(productId);
        showMessage('Added to wishlist!', 'success');
    } else {
        wishlist.splice(index, 1);
        showMessage('Removed from wishlist', 'info');
    }
    
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
}

// Helper functions
function adjustQuantity(inputId, change) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    let newValue = parseInt(input.value) + change;
    newValue = Math.max(parseInt(input.min), Math.min(newValue, parseInt(input.max)));
    input.value = newValue;
}

function pulseCartIcon() {
    const cartIcon = document.querySelector('.cart-icon a');
    if (!cartIcon) return;
    
    cartIcon.classList.add('pulse');
    setTimeout(() => {
        cartIcon.classList.remove('pulse');
    }, 1000);
}

function renderRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';
    
    for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) {
            stars += '<i class="fas fa-star"></i>';
        } else if (i === fullStars + 1 && hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        } else {
            stars += '<i class="far fa-star"></i>';
        }
    }
    
    return `<div class="stars">${stars}</div>`;
}

function showMessage(message, type = 'info') {
    const globalError = document.getElementById('global-error');
    if (!globalError) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    globalError.innerHTML = '';
    globalError.appendChild(messageElement);
    
    setTimeout(() => {
        messageElement.remove();
    }, 3000);
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Make functions available globally for HTML onclick attributes
window.showProductDetail = showProductDetail;
window.addToCart = addToCart;
window.addToWishlist = addToWishlist;
window.removeFromCart = removeFromCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.checkout = checkout;
window.adjustQuantity = adjustQuantity;
window.showListView = showListView;