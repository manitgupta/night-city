```sql
CREATE SEQUENCE SeqAddresses OPTIONS (
  sequence_kind = 'bit_reversed_positive'
);

CREATE SEQUENCE SeqCategories OPTIONS (
  sequence_kind = 'bit_reversed_positive'
);

CREATE SEQUENCE SeqOrderItems OPTIONS (
  sequence_kind = 'bit_reversed_positive'
);

CREATE SEQUENCE SeqOrders OPTIONS (
  sequence_kind = 'bit_reversed_positive'
);

CREATE SEQUENCE SeqPayments OPTIONS (
  sequence_kind = 'bit_reversed_positive'
);

CREATE SEQUENCE SeqProducts OPTIONS (
  sequence_kind = 'bit_reversed_positive'
);

CREATE SEQUENCE SeqReviews OPTIONS (
  sequence_kind = 'bit_reversed_positive'
);

CREATE SEQUENCE SeqShipments OPTIONS (
  sequence_kind = 'bit_reversed_positive'
);

CREATE SEQUENCE SeqSuppliers OPTIONS (
  sequence_kind = 'bit_reversed_positive'
);

CREATE SEQUENCE SeqUsers OPTIONS (
  sequence_kind = 'bit_reversed_positive'
);

CREATE SEQUENCE SeqWarehouses OPTIONS (
  sequence_kind = 'bit_reversed_positive'
);

CREATE TABLE Categories (
  category_id INT64 NOT NULL DEFAULT (GET_NEXT_SEQUENCE_VALUE(SEQUENCE SeqCategories)),
  parent_id INT64,
  name STRING(100) NOT NULL,
  slug STRING(100) NOT NULL,
  description STRING(MAX),
  FOREIGN KEY(parent_id) REFERENCES Categories(category_id),
) PRIMARY KEY(category_id);

CREATE UNIQUE INDEX Categories_Slug ON Categories(slug);

CREATE TABLE Products (
  product_id INT64 NOT NULL DEFAULT (GET_NEXT_SEQUENCE_VALUE(SEQUENCE SeqProducts)),
  supplier_id INT64,
  name STRING(255) NOT NULL,
  sku STRING(100) NOT NULL,
  description STRING(MAX),
  base_price NUMERIC NOT NULL,
  weight_kg NUMERIC,
  is_active BOOL DEFAULT (TRUE),
  created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP()),
) PRIMARY KEY(product_id);

CREATE UNIQUE INDEX Products_Sku ON Products(sku);

CREATE TABLE Inventory (
  product_id INT64 NOT NULL,
  warehouse_id INT64 NOT NULL,
  quantity_on_hand INT64 DEFAULT (0),
  reorder_level INT64 DEFAULT (10),
  last_updated TIMESTAMP DEFAULT (CURRENT_TIMESTAMP()),
) PRIMARY KEY(product_id, warehouse_id),
  INTERLEAVE IN PARENT Products ON DELETE CASCADE;

CREATE TABLE Product_Categories (
  product_id INT64 NOT NULL,
  category_id INT64 NOT NULL,
  FOREIGN KEY(category_id) REFERENCES Categories(category_id),
) PRIMARY KEY(product_id, category_id),
  INTERLEAVE IN PARENT Products ON DELETE CASCADE;

CREATE TABLE Reviews (
  product_id INT64 NOT NULL,
  review_id INT64 NOT NULL DEFAULT (GET_NEXT_SEQUENCE_VALUE(SEQUENCE SeqReviews)),
  user_id INT64 NOT NULL,
  rating INT64,
  comment STRING(MAX),
  created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP()),
  CONSTRAINT CK_Reviews_Rating CHECK(rating >= 1 AND rating <= 5),
) PRIMARY KEY(product_id, review_id),
  INTERLEAVE IN PARENT Products ON DELETE CASCADE;

CREATE TABLE Suppliers (
  supplier_id INT64 NOT NULL DEFAULT (GET_NEXT_SEQUENCE_VALUE(SEQUENCE SeqSuppliers)),
  company_name STRING(255) NOT NULL,
  contact_name STRING(100),
  email STRING(255),
  phone STRING(20),
) PRIMARY KEY(supplier_id);

ALTER TABLE Products ADD FOREIGN KEY(supplier_id) REFERENCES Suppliers(supplier_id);

CREATE TABLE Users (
  user_id INT64 NOT NULL DEFAULT (GET_NEXT_SEQUENCE_VALUE(SEQUENCE SeqUsers)),
  email STRING(255) NOT NULL,
  password_hash STRING(255) NOT NULL,
  first_name STRING(100),
  last_name STRING(100),
  phone STRING(20),
  role STRING(MAX) DEFAULT ('customer'),
  created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP()),
  last_login TIMESTAMP,
  CONSTRAINT CK_Users_Role CHECK(role IN ('customer', 'admin', 'vendor')),
) PRIMARY KEY(user_id);

ALTER TABLE Reviews ADD FOREIGN KEY(user_id) REFERENCES Users(user_id);

CREATE UNIQUE INDEX Users_Email ON Users(email);

CREATE TABLE Addresses (
  user_id INT64 NOT NULL,
  address_id INT64 NOT NULL DEFAULT (GET_NEXT_SEQUENCE_VALUE(SEQUENCE SeqAddresses)),
  address_line1 STRING(255) NOT NULL,
  address_line2 STRING(255),
  city STRING(100) NOT NULL,
  state STRING(100),
  postal_code STRING(20) NOT NULL,
  country STRING(100) NOT NULL,
  is_default BOOL DEFAULT (FALSE),
) PRIMARY KEY(user_id, address_id),
  INTERLEAVE IN PARENT Users ON DELETE CASCADE;

CREATE TABLE Orders (
  user_id INT64 NOT NULL,
  order_id INT64 NOT NULL DEFAULT (GET_NEXT_SEQUENCE_VALUE(SEQUENCE SeqOrders)),
  status STRING(MAX) DEFAULT ('pending'),
  total_amount NUMERIC NOT NULL,
  shipping_address_id INT64,
  billing_address_id INT64,
  created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP()),
  updated_at TIMESTAMP,
  FOREIGN KEY(user_id, shipping_address_id) REFERENCES Addresses(user_id, address_id),
  FOREIGN KEY(user_id, billing_address_id) REFERENCES Addresses(user_id, address_id),
  CONSTRAINT CK_Orders_Status CHECK(status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')),
) PRIMARY KEY(user_id, order_id),
  INTERLEAVE IN PARENT Users ON DELETE CASCADE;

CREATE TABLE Order_Items (
  user_id INT64 NOT NULL,
  order_id INT64 NOT NULL,
  order_item_id INT64 NOT NULL DEFAULT (GET_NEXT_SEQUENCE_VALUE(SEQUENCE SeqOrderItems)),
  product_id INT64 NOT NULL,
  quantity INT64 NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC AS (quantity * unit_price) STORED,
  FOREIGN KEY(product_id) REFERENCES Products(product_id),
) PRIMARY KEY(user_id, order_id, order_item_id),
  INTERLEAVE IN PARENT Orders ON DELETE CASCADE;

CREATE TABLE Payments (
  user_id INT64 NOT NULL,
  order_id INT64 NOT NULL,
  payment_id INT64 NOT NULL DEFAULT (GET_NEXT_SEQUENCE_VALUE(SEQUENCE SeqPayments)),
  payment_method STRING(MAX) NOT NULL,
  transaction_id STRING(255),
  amount NUMERIC NOT NULL,
  status STRING(MAX) DEFAULT ('pending'),
  payment_date TIMESTAMP DEFAULT (CURRENT_TIMESTAMP()),
  CONSTRAINT CK_Payments_Method CHECK(payment_method IN ('credit_card', 'paypal', 'bank_transfer')),
  CONSTRAINT CK_Payments_Status CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
) PRIMARY KEY(user_id, order_id, payment_id),
  INTERLEAVE IN PARENT Orders ON DELETE NO ACTION;

CREATE TABLE Shipments (
  user_id INT64 NOT NULL,
  order_id INT64 NOT NULL,
  shipment_id INT64 NOT NULL DEFAULT (GET_NEXT_SEQUENCE_VALUE(SEQUENCE SeqShipments)),
  warehouse_id INT64,
  carrier_name STRING(100),
  tracking_number STRING(100),
  shipped_date TIMESTAMP,
  estimated_delivery TIMESTAMP,
) PRIMARY KEY(user_id, order_id, shipment_id),
  INTERLEAVE IN PARENT Orders ON DELETE NO ACTION;

CREATE TABLE Warehouses (
  warehouse_id INT64 NOT NULL DEFAULT (GET_NEXT_SEQUENCE_VALUE(SEQUENCE SeqWarehouses)),
  name STRING(100) NOT NULL,
  location_code STRING(50),
  address_id INT64,
  is_active BOOL DEFAULT (TRUE),
) PRIMARY KEY(warehouse_id);

ALTER TABLE Inventory ADD FOREIGN KEY(warehouse_id) REFERENCES Warehouses(warehouse_id);

ALTER TABLE Shipments ADD FOREIGN KEY(warehouse_id) REFERENCES Warehouses(warehouse_id);

CREATE UNIQUE INDEX Warehouses_LocationCode ON Warehouses(location_code);
```