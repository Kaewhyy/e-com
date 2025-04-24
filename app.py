import sqlite3
from flask import Flask, jsonify, abort, request, g, render_template
import logging
import os
from flask_cors import CORS

# Initialize Flask application
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ecommerce.log'),
        logging.StreamHandler()
    ]
)

# Database Configuration
DATABASE = 'ecommerce.db'
MAX_STOCK_QUANTITY = 1000

def get_db():
    """Opens a new database connection if there is none yet for the current context."""
    if 'db_connection' not in g:
        g.db_connection = sqlite3.connect(DATABASE)
        g.db_connection.row_factory = sqlite3.Row
        g.db_connection.execute('PRAGMA foreign_keys = ON;')
    return g.db_connection

@app.teardown_appcontext
def close_db(error):
    """Closes the database connection at the end of the request."""
    if hasattr(g, 'db_connection'):
        g.db_connection.close()

def init_db(populate=True):
    """Initializes the database with tables and sample data."""
    db_exists = os.path.exists(DATABASE)
    with app.app_context():
        conn = get_db()
        cursor = conn.cursor()
        
        # Create tables with enhanced constraints
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL CHECK(price >= 0),
                image_url TEXT,
                category TEXT,
                stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0 AND stock <= ?)
            );
        ''', (MAX_STOCK_QUANTITY,))
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_amount REAL NOT NULL CHECK(total_amount >= 0),
                customer_name TEXT,
                customer_email TEXT
            );
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL CHECK(quantity > 0),
                price_per_item REAL NOT NULL CHECK(price_per_item >= 0),
                FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products (id)
            );
        ''')
        
        # Insert sample data if database is new
        if not db_exists and populate:
            initial_products = [
                ("Wireless Mouse 2", "Ergonomic wireless mouse", 29.99, "/img/tee.", "Electronics", 50),
                ("Mechanical Keyboard", "RGB backlit keyboard", 85.00, "/static/images/keyboard.jpg", "Electronics", 25),
                ("USB-C Hub", "7-in-1 connectivity hub", 42.50, "/static/images/hub.jpg", "Computers", 100)
            ]
            cursor.executemany('''
                INSERT INTO products (name, description, price, image_url, category, stock)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', initial_products)
        
        conn.commit()

# Initialize database
if not app.debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
    init_db()

# API Routes
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/products')
def get_products():
    """Returns all available products."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE stock > 0 ORDER BY name;")
    return jsonify([dict(row) for row in cursor.fetchall()])

@app.route('/api/products/<int:product_id>')
def get_product(product_id):
    """Returns details for a specific product."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE id = ?;", (product_id,))
    product = cursor.fetchone()
    return jsonify(dict(product)) if product else abort(404)

@app.route('/api/checkout', methods=['POST'])
def checkout():
    """Processes checkout with cart items and customer info."""
    data = request.json
    if not data or 'items' not in data:
        abort(400, description="Invalid request format")
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        conn.execute('BEGIN TRANSACTION;')
        
        # Calculate total and validate stock
        total = 0
        for item in data['items']:
            cursor.execute("SELECT price, stock FROM products WHERE id = ?;", (item['id'],))
            product = cursor.fetchone()
            if not product or product['stock'] < item['quantity']:
                raise ValueError(f"Invalid product ID {item['id']} or insufficient stock")
            total += product['price'] * item['quantity']
        
        # Create order
        cursor.execute(
            "INSERT INTO orders (total_amount, customer_name, customer_email) VALUES (?, ?, ?);",
            (total, data.get('customer_name'), data.get('customer_email'))
        order_id = cursor.lastrowid
        
        # Create order items
        for item in data['items']:
            cursor.execute('''
                INSERT INTO order_items (order_id, product_id, quantity, price_per_item)
                VALUES (?, ?, ?, (SELECT price FROM products WHERE id = ?));
            ''', (order_id, item['id'], item['quantity'], item['id']))
            cursor.execute("UPDATE products SET stock = stock - ? WHERE id = ?;", 
                          (item['quantity'], item['id']))
        
        conn.commit()
        return jsonify({
            "success": True,
            "order_id": order_id,
            "total": total
        }), 201
        
    except Exception as e:
        conn.rollback()
        abort(400, description=str(e))

# Error Handlers
@app.errorhandler(404)
def not_found(e):
    return jsonify(error=str(getattr(e, 'description', 'Not found'))), 404

@app.errorhandler(400)
def bad_request(e):
    return jsonify(error=str(getattr(e, 'description', 'Bad request'))), 400

    # Add these new routes to your existing app.py

@app.route('/api/inventory')
def get_inventory():
    """Get complete inventory with stock levels"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, stock, price, 
               CASE WHEN stock < 10 THEN 'LOW' ELSE 'OK' END as status 
        FROM products 
        ORDER BY stock ASC;
    """)
    inventory = [dict(row) for row in cursor.fetchall()]
    return jsonify(inventory)

@app.route('/api/inventory/<int:product_id>', methods=['PUT'])
def update_inventory(product_id):
    """Update stock levels for a product"""
    data = request.json
    if 'stock' not in data or not isinstance(data['stock'], int):
        abort(400, description="Invalid stock value")
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE products 
            SET stock = ? 
            WHERE id = ? 
            RETURNING id, name, stock;
        """, (data['stock'], product_id))
        
        updated = cursor.fetchone()
        if not updated:
            abort(404, description="Product not found")
            
        conn.commit()
        return jsonify({
            "success": True,
            "product": dict(updated),
            "message": f"Stock updated for {updated['name']}"
        })
        
    except sqlite3.Error as e:
        conn.rollback()
        abort(500, description=f"Database error: {str(e)}")

@app.route('/api/inventory/low-stock')
def get_low_stock():
    """Get products with low stock (less than 10 items)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, stock 
        FROM products 
        WHERE stock < 10 
        ORDER BY stock ASC;
    """)
    low_stock = [dict(row) for row in cursor.fetchall()]
    return jsonify({
        "count": len(low_stock),
        "products": low_stock
    })

@app.route('/inventory')
def inventory_dashboard():
    """Serve the inventory management dashboard"""
    return render_template('inventory.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True ))