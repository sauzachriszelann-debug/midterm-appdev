import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Filter,
  Package,
  Plus,
  Save,
  Search,
  ShoppingBasket,
  Trash2,
  XCircle
} from "lucide-react";
import "./styles.css";

const START_PRODUCTS = [
  { id: crypto.randomUUID(), name: "Rice", category: "Crop", price: 48, stock: 120 },
  { id: crypto.randomUUID(), name: "Corn", category: "Crop", price: 32, stock: 18 },
  { id: crypto.randomUUID(), name: "Tilapia", category: "Fishery", price: 145, stock: 55 },
  { id: crypto.randomUUID(), name: "Bangus", category: "Fishery", price: 180, stock: 12 }
];

const START_ORDERS = [];
const STATUSES = ["Pending", "Confirmed", "Delivered", "Cancelled"];

function readStore(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function money(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(value || 0);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function App() {
  const [products, setProducts] = useState(() => readStore("coop-products", START_PRODUCTS));
  const [orders, setOrders] = useState(() => readStore("coop-orders", START_ORDERS));
  const [activeTab, setActiveTab] = useState("products");
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "Crop",
    price: "",
    stock: ""
  });
  const [orderForm, setOrderForm] = useState({
    buyer: "",
    contact: "",
    orderDate: today(),
    items: [{ productId: "", kg: "" }]
  });
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [productCategory, setProductCategory] = useState("All");
  const [orderFilters, setOrderFilters] = useState({ status: "All", buyer: "", date: "" });
  const [notice, setNotice] = useState("");
  const [contactError, setContactError] = useState("");

  function persistProducts(next) {
    setProducts(next);
    localStorage.setItem("coop-products", JSON.stringify(next));
  }

  function persistOrders(next) {
    setOrders(next);
    localStorage.setItem("coop-orders", JSON.stringify(next));
  }

  const productsById = useMemo(
    () => Object.fromEntries(products.map((product) => [product.id, product])),
    [products]
  );

  const usedProductIds = useMemo(
    () => new Set(orders.flatMap((order) => order.items.map((item) => item.productId))),
    [orders]
  );

  const visibleProducts = products.filter(
    (product) => productCategory === "All" || product.category === productCategory
  );

  const visibleOrders = orders.filter((order) => {
    const searchText = orderFilters.buyer.toLowerCase();
    const searchMatch =
      order.buyer.toLowerCase().includes(searchText) ||
      order.orderNumber.toLowerCase().includes(searchText);
    const statusMatch = orderFilters.status === "All" || order.status === orderFilters.status;
    const dateMatch = !orderFilters.date || order.orderDate === orderFilters.date;
    return searchMatch && statusMatch && dateMatch;
  });

  const report = useMemo(() => {
    const delivered = orders.filter((order) => order.status === "Delivered");
    const sales = delivered.reduce((sum, order) => sum + order.total, 0);
    const statusCounts = STATUSES.reduce((acc, status) => {
      acc[status] = orders.filter((order) => order.status === status).length;
      return acc;
    }, {});
    const soldKg = {};
    delivered.forEach((order) => {
      order.items.forEach((item) => {
        soldKg[item.productId] = (soldKg[item.productId] || 0) + Number(item.kg);
      });
    });
    const bestProductId = Object.entries(soldKg).sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
      sales,
      statusCounts,
      topProduct: bestProductId
        ? `${productsById[bestProductId]?.name || "Deleted product"} (${soldKg[bestProductId]} kg)`
        : "No delivered sales yet"
    };
  }, [orders, productsById]);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || visibleOrders[0];

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function resetProductForm() {
    setEditingProduct(null);
    setProductForm({ name: "", category: "Crop", price: "", stock: "" });
  }

  function saveProduct(event) {
    event.preventDefault();
    const product = {
      id: editingProduct?.id || crypto.randomUUID(),
      name: productForm.name.trim(),
      category: productForm.category,
      price: Number(productForm.price),
      stock: Number(productForm.stock)
    };
    if (!product.name || product.price <= 0 || product.stock < 0) {
      showNotice("Please complete the product with valid price and stock.");
      return;
    }
    const next = editingProduct
      ? products.map((item) => (item.id === editingProduct.id ? product : item))
      : [...products, product];
    persistProducts(next);
    resetProductForm();
    showNotice(editingProduct ? "Product updated." : "Product added.");
  }

  function editProduct(product) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock
    });
  }

  function deleteProduct(productId) {
    if (usedProductIds.has(productId)) {
      showNotice("A product already used in an order cannot be deleted.");
      return;
    }
    persistProducts(products.filter((product) => product.id !== productId));
    showNotice("Product deleted.");
  }

  function updateOrderItem(index, field, value) {
    const nextItems = orderForm.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item
    );
    setOrderForm({ ...orderForm, items: nextItems });
  }

  function addOrderLine() {
    setOrderForm({
      ...orderForm,
      items: [...orderForm.items, { productId: "", kg: "" }]
    });
  }

  function removeOrderLine(index) {
    setOrderForm({
      ...orderForm,
      items: orderForm.items.filter((_, itemIndex) => itemIndex !== index)
    });
  }

  function updateContact(value) {
    const digitsOnly = value.replace(/\D/g, "");
    setOrderForm({ ...orderForm, contact: digitsOnly });
    setContactError(digitsOnly && digitsOnly.length !== 11 ? "Contact number must be exactly 11 digits." : "");
  }

  function createOrder(event) {
    event.preventDefault();
    const cleanItems = orderForm.items
      .filter((item) => item.productId && Number(item.kg) > 0)
      .map((item) => ({
        productId: item.productId,
        kg: Number(item.kg),
        price: productsById[item.productId]?.price || 0,
        lineTotal: Number(item.kg) * (productsById[item.productId]?.price || 0)
      }));

    if (!orderForm.buyer.trim() || !orderForm.contact.trim() || cleanItems.length === 0) {
      showNotice("Please add buyer details and at least one valid item.");
      return;
    }

    if (orderForm.contact.length !== 11) {
      setContactError("Contact number must be exactly 11 digits.");
      showNotice("Contact number must be exactly 11 digits.");
      return;
    }

    const overStock = cleanItems.find((item) => item.kg > (productsById[item.productId]?.stock || 0));
    if (overStock) {
      showNotice(`${productsById[overStock.productId]?.name} does not have enough stock.`);
      return;
    }

    const orderNumber = `ORD-${String(orders.length + 1).padStart(4, "0")}`;
    const newOrder = {
      id: crypto.randomUUID(),
      orderNumber,
      buyer: orderForm.buyer.trim(),
      contact: orderForm.contact.trim(),
      orderDate: orderForm.orderDate,
      status: "Pending",
      items: cleanItems,
      total: cleanItems.reduce((sum, item) => sum + item.lineTotal, 0)
    };
    persistOrders([newOrder, ...orders]);
    setSelectedOrderId(newOrder.id);
    setOrderForm({ buyer: "", contact: "", orderDate: today(), items: [{ productId: "", kg: "" }] });
    setContactError("");
    setActiveTab("orders");
    showNotice("Order created as Pending.");
  }

  function changeStatus(orderId, nextStatus) {
    const order = orders.find((item) => item.id === orderId);
    if (!order || order.status === nextStatus) return;

    if (order.status === "Delivered" || order.status === "Cancelled") {
      showNotice("Delivered or Cancelled orders can no longer change status.");
      return;
    }

    if (order.status === "Pending" && nextStatus === "Delivered") {
      showNotice("Confirm the order before marking it Delivered.");
      return;
    }

    if (nextStatus === "Confirmed") {
      const shortage = order.items.find((item) => item.kg > (productsById[item.productId]?.stock || 0));
      if (shortage) {
        showNotice(`${productsById[shortage.productId]?.name} is short on stock.`);
        return;
      }
      persistProducts(
        products.map((product) => {
          const ordered = order.items.find((item) => item.productId === product.id);
          return ordered ? { ...product, stock: product.stock - ordered.kg } : product;
        })
      );
    }

    if (order.status === "Confirmed" && nextStatus === "Cancelled") {
      persistProducts(
        products.map((product) => {
          const ordered = order.items.find((item) => item.productId === product.id);
          return ordered ? { ...product, stock: product.stock + ordered.kg } : product;
        })
      );
    }

    if (order.status === "Confirmed" && nextStatus === "Pending") {
      showNotice("Confirmed orders can become Delivered or Cancelled only.");
      return;
    }

    persistOrders(orders.map((item) => (item.id === orderId ? { ...item, status: nextStatus } : item)));
    showNotice(`Order marked ${nextStatus}.`);
  }

  function linePreview(item) {
    const product = productsById[item.productId];
    const kg = Number(item.kg) || 0;
    return product ? money(kg * product.price) : money(0);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          
  
          <h1>Agri-Fishery Cooperative Order and Inventory System</h1>
        </div>
        <div className="topbar-stats">
          <span>{products.length} products</span>
          <span>{orders.length} orders</span>
          <span>{money(report.sales)} delivered sales</span>
        </div>
      </header>

      {notice && <div className="notice">{notice}</div>}

      <nav className="tabs" aria-label="Main sections">
        <button className={activeTab === "products" ? "active" : ""} onClick={() => setActiveTab("products")}>
          <Package size={18} /> Products
        </button>
        <button className={activeTab === "create" ? "active" : ""} onClick={() => setActiveTab("create")}>
          <Plus size={18} /> New Order
        </button>
        <button className={activeTab === "orders" ? "active" : ""} onClick={() => setActiveTab("orders")}>
          <ClipboardList size={18} /> Orders
        </button>
        <button className={activeTab === "report" ? "active" : ""} onClick={() => setActiveTab("report")}>
          <BarChart3 size={18} /> Report
        </button>
      </nav>

      {activeTab === "products" && (
        <section className="work-grid">
          <form className="panel form-panel" onSubmit={saveProduct}>
            <h2>{editingProduct ? "Edit Product" : "Add Product"}</h2>
            <label>
              Name
              <input
                value={productForm.name}
                onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                placeholder="Product name"
              />
            </label>
            <label>
              Category
              <select
                value={productForm.category}
                onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}
              >
                <option>Crop</option>
                <option>Fishery</option>
              </select>
            </label>
            <label>
              Price per kg
              <input
                type="number"
                min="1"
                value={productForm.price}
                onChange={(event) => setProductForm({ ...productForm, price: event.target.value })}
                placeholder="0"
              />
            </label>
            <label>
              Stock in kg
              <input
                type="number"
                min="0"
                value={productForm.stock}
                onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })}
                placeholder="0"
              />
            </label>
            <div className="button-row">
              <button className="primary" type="submit">
                <Save size={17} /> Save
              </button>
              {editingProduct && (
                <button type="button" onClick={resetProductForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          <section className="panel wide-panel">
            <div className="section-head">
              <h2>Product List</h2>
              <label className="inline-filter">
                <Filter size={17} />
                <select value={productCategory} onChange={(event) => setProductCategory(event.target.value)}>
                  <option>All</option>
                  <option>Crop</option>
                  <option>Fishery</option>
                </select>
              </label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price/kg</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.category}</td>
                      <td>{money(product.price)}</td>
                      <td>{product.stock} kg</td>
                      <td>
                        {product.stock < 20 ? (
                          <span className="badge danger">
                            <AlertTriangle size={14} /> LOW STOCK
                          </span>
                        ) : (
                          <span className="badge ok">
                            <CheckCircle2 size={14} /> In stock
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="mini-actions">
                          <button type="button" onClick={() => editProduct(product)}>
                            Edit
                          </button>
                          <button type="button" onClick={() => deleteProduct(product.id)} title="Delete product">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}

      {activeTab === "create" && (
        <form className="panel order-form" onSubmit={createOrder}>
          <h2>Make an Order</h2>
          <div className="field-grid">
            <label>
              Buyer name
              <input
                value={orderForm.buyer}
                onChange={(event) => setOrderForm({ ...orderForm, buyer: event.target.value })}
                placeholder="Buyer name"
              />
            </label>
            <label>
              Contact number
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={orderForm.contact}
                onChange={(event) => updateContact(event.target.value)}
                placeholder="Enter Contact Number"
              />
              {contactError && <span className="field-error">{contactError}</span>}
            </label>
            <label>
              Order date
              <input
                type="date"
                value={orderForm.orderDate}
                onChange={(event) => setOrderForm({ ...orderForm, orderDate: event.target.value })}
              />
            </label>
          </div>

          <div className="line-list">
            {orderForm.items.map((item, index) => (
              <div className="order-line" key={index}>
                <label>
                  Product
                  <select value={item.productId} onChange={(event) => updateOrderItem(index, "productId", event.target.value)}>
                    <option value="">Choose product</option>
                    {products.map((product) => (
                      <option value={product.id} key={product.id}>
                        {product.name} - {product.stock} kg available
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Kg
                  <input
                    type="number"
                    min="1"
                    value={item.kg}
                    onChange={(event) => updateOrderItem(index, "kg", event.target.value)}
                    placeholder="0"
                  />
                </label>
                <output>{linePreview(item)}</output>
                <button type="button" onClick={() => removeOrderLine(index)} title="Remove line">
                  <XCircle size={18} />
                </button>
              </div>
            ))}
          </div>
          <div className="button-row">
            <button type="button" onClick={addOrderLine}>
              <Plus size={17} /> Add item
            </button>
            <button className="primary" type="submit">
              <ShoppingBasket size={17} /> Create order
            </button>
          </div>
        </form>
      )}

      {activeTab === "orders" && (
        <section className="orders-layout">
          <section className="panel">
            <div className="section-head">
              <h2>Order List</h2>
            </div>
            <div className="filters">
              <label>
                <Search size={16} />
                <input
                  value={orderFilters.buyer}
                  onChange={(event) => setOrderFilters({ ...orderFilters, buyer: event.target.value })}
                  placeholder="Search order or buyer"
                />
              </label>
              <select
                value={orderFilters.status}
                onChange={(event) => setOrderFilters({ ...orderFilters, status: event.target.value })}
              >
                <option>All</option>
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              <input
                type="date"
                value={orderFilters.date}
                onChange={(event) => setOrderFilters({ ...orderFilters, date: event.target.value })}
              />
            </div>
            <div className="order-stack">
              {visibleOrders.map((order) => (
                <button
                  type="button"
                  className={`order-card ${selectedOrder?.id === order.id ? "selected" : ""}`}
                  onClick={() => setSelectedOrderId(order.id)}
                  key={order.id}
                >
                  <span>
                    <strong>{order.orderNumber}</strong>
                    <small>{order.buyer}</small>
                  </span>
                  <span>
                    <b>{money(order.total)}</b>
                    <small className={`status ${order.status.toLowerCase()}`}>{order.status}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel detail-panel">
            {selectedOrder ? (
              <>
                <div className="section-head">
                  <div>
                    <h2>{selectedOrder.orderNumber}</h2>
                    <p>{selectedOrder.buyer} · {selectedOrder.contact} · {selectedOrder.orderDate}</p>
                  </div>
                  <span className={`status ${selectedOrder.status.toLowerCase()}`}>{selectedOrder.status}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Kg</th>
                        <th>Price/kg</th>
                        <th>Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item) => (
                        <tr key={`${selectedOrder.id}-${item.productId}`}>
                          <td>{productsById[item.productId]?.name || "Deleted product"}</td>
                          <td>{item.kg} kg</td>
                          <td>{money(item.price)}</td>
                          <td>{money(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="total-row">
                  <span>Order total</span>
                  <strong>{money(selectedOrder.total)}</strong>
                </div>
                <div className="status-actions">
                  {STATUSES.map((status) => (
                    <button
                      type="button"
                      key={status}
                      className={selectedOrder.status === status ? "active-status" : ""}
                      onClick={() => changeStatus(selectedOrder.id, status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">No orders yet.</div>
            )}
          </section>
        </section>
      )}

      {activeTab === "report" && (
        <section className="report-grid">
          <article className="metric">
            <span>Total sales</span>
            <strong>{money(report.sales)}</strong>
            <small>Delivered orders only</small>
          </article>
          {STATUSES.map((status) => (
            <article className="metric" key={status}>
              <span>{status}</span>
              <strong>{report.statusCounts[status]}</strong>
              <small>Orders</small>
            </article>
          ))}
          <article className="metric wide-metric">
            <span>Product with most kg sold</span>
            <strong>{report.topProduct}</strong>
            <small>Based on delivered orders</small>
          </article>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
