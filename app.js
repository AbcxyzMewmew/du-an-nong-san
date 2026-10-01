/* ==========================================================================
   DỰ ÁN: WEBSITE BÁN RAU CỦ & HOA QUẢ SẠCH - GREENFARM (CLIENT APPLICATION)
   Mô tả: Tích hợp toàn diện với Máy chủ tập trung & CSDL quan hệ
          Bao gồm: Danh mục, Tìm kiếm, Lọc, Giỏ hàng, Đặt hàng, Tra cứu,
                   Thanh toán Sandbox, Khu vực Nhà Vườn và Bảng Quản Trị
   ========================================================================== */

// 1. CẤU HÌNH ĐỊA CHỈ MÁY CHỦ API
const API_BASE = (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) 
  ? '/api' 
  : 'http://localhost:3000/api';

// 2. BIẾN TRẠNG THÁI TOÀN CỤC CỦA GIAO DIỆN
let currentProducts = [];
let currentCategory = 'all';
let currentStockFilter = 'in_stock';
let currentSort = 'latest';
let currentSearch = '';

// ==========================================================================
// 3. TIỆN ÍCH LƯU TRỮ TRÌNH DUYỆT (LOCAL STORAGE)
// ==========================================================================

function getAuthToken() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('greenfarm_jwt');
}

function setAuthToken(token) {
  if (typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem('greenfarm_jwt', token);
    else localStorage.removeItem('greenfarm_jwt');
  }
}

function getStoredUser() {
  if (typeof localStorage === 'undefined') return null;
  const user = localStorage.getItem('greenfarm_user');
  return user ? JSON.parse(user) : null;
}

function setStoredUser(user) {
  if (typeof localStorage !== 'undefined') {
    if (user) localStorage.setItem('greenfarm_user', JSON.stringify(user));
    else localStorage.removeItem('greenfarm_user');
  }
}

function getCart() {
  if (typeof localStorage === 'undefined') return [];
  const cart = localStorage.getItem('greenfarm_cart');
  return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('greenfarm_cart', JSON.stringify(cart));
  }
}

// ==========================================================================
// 4. THÔNG BÁO TOAST TRÊN GIAO DIỆN
// ==========================================================================

function showToast(message, type = 'success') {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';
  if (type === 'info') icon = 'fa-circle-info';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ==========================================================================
// 5. GỌI API BACKEND VỚI TOKEN BẢO MẬT
// ==========================================================================

async function fetchAPI(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    console.error(`Lỗi kết nối API [${endpoint}]:`, error);
    return { ok: false, status: 500, data: { message: 'Không thể kết nối đến máy chủ GreenFarm.' } };
  }
}

// ==========================================================================
// 6. XÁC THỰC NGƯỜI DÙNG & GIAO DIỆN HEADER (AUTH UI)
// ==========================================================================

async function checkAuthSession() {
  const token = getAuthToken();
  if (!token) {
    updateAuthUI(null);
    return;
  }

  const res = await fetchAPI('/auth/me');
  if (res.ok && res.data.success) {
    setStoredUser(res.data.user);
    updateAuthUI(res.data.user);
  } else {
    setAuthToken(null);
    setStoredUser(null);
    updateAuthUI(null);
  }
}

function updateAuthUI(user) {
  if (typeof document === 'undefined') return;

  const guestZone = document.getElementById('auth-guest-zone');
  const userZone = document.getElementById('auth-user-zone');
  const avatarEl = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-display-name');
  const roleBadgeEl = document.getElementById('user-role-badge');
  const adminBtn = document.getElementById('btn-open-admin');
  const sellerBtn = document.getElementById('btn-open-seller');

  if (user) {
    guestZone.classList.add('hidden');
    userZone.classList.remove('hidden');

    nameEl.textContent = user.fullName || user.username;
    avatarEl.textContent = (user.fullName || user.username).charAt(0).toUpperCase();

    if (user.role === 'admin') {
      roleBadgeEl.textContent = '👑 Quản Trị';
      roleBadgeEl.className = 'role-badge role-admin';
      avatarEl.className = 'avatar-circle avatar-admin';
      adminBtn.classList.remove('hidden');
      sellerBtn.classList.add('hidden');
    } else if (user.role === 'seller') {
      roleBadgeEl.textContent = '🚜 Nhà Vườn';
      roleBadgeEl.className = 'role-badge role-seller';
      avatarEl.className = 'avatar-circle avatar-seller';
      sellerBtn.classList.remove('hidden');
      adminBtn.classList.add('hidden');
    } else {
      roleBadgeEl.textContent = '👤 Khách Hàng';
      roleBadgeEl.className = 'role-badge';
      avatarEl.className = 'avatar-circle';
      adminBtn.classList.add('hidden');
      sellerBtn.classList.add('hidden');
    }
  } else {
    guestZone.classList.remove('hidden');
    userZone.classList.add('hidden');
    if (adminBtn) adminBtn.classList.add('hidden');
    if (sellerBtn) sellerBtn.classList.add('hidden');
  }
}

// ==========================================================================
// 7. TẢI VÀ RENDER DANH MỤC NÔNG SẢN (PRODUCTS CATALOG)
// ==========================================================================

function updateCartBadge() {
  if (typeof document === 'undefined') return;
  const badgeEl = document.getElementById('cart-count');
  if (!badgeEl) return;

  const cart = getCart();
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  badgeEl.textContent = totalCount;
}

async function loadProducts() {
  const countTextEl = document.getElementById('catalog-count-text');
  if (countTextEl) countTextEl.textContent = 'Đang đồng bộ dữ liệu nông sản từ máy chủ...';

  const params = new URLSearchParams();
  if (currentCategory && currentCategory !== 'all') params.append('category', currentCategory);
  if (currentStockFilter) params.append('stock_status', currentStockFilter);
  if (currentSort) params.append('sort', currentSort);
  if (currentSearch) params.append('search', currentSearch);

  const res = await fetchAPI(`/products?${params.toString()}`);
  if (res.ok && res.data.success) {
    currentProducts = res.data.data;
    renderProductGrid(currentProducts);
  } else {
    showToast(res.data.message || 'Lỗi tải danh mục nông sản.', 'error');
  }
}

function renderProductGrid(products) {
  if (typeof document === 'undefined') return;
  const gridEl = document.getElementById('product-grid');
  const countTextEl = document.getElementById('catalog-count-text');
  if (!gridEl) return;

  if (countTextEl) {
    countTextEl.innerHTML = `Hiển thị <strong>${products.length}</strong> nông sản sạch từ các nhà vườn đối tác`;
  }

  gridEl.innerHTML = '';

  if (products.length === 0) {
    gridEl.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; background: white; border-radius: 10px; border: 1px dashed #cbd5e1;">
        <i class="fa-solid fa-leaf" style="font-size: 40px; color: #cbd5e1; margin-bottom: 12px;"></i>
        <h4 style="color: #475569; margin-bottom: 6px;">Không tìm thấy nông sản phù hợp</h4>
        <p style="color: #94a3b8; font-size: 14px;">Thử đổi từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái "Tất cả tình trạng".</p>
      </div>
    `;
    return;
  }

  products.forEach(p => {
    const isAvailable = p.stock > 0;
    const badgeClass = isAvailable ? 'in-stock' : 'out-of-stock';
    const badgeText = isAvailable ? 'Còn hàng' : 'Hết hàng';

    let stockText = '';
    if (isAvailable) {
      if (p.stock <= 5) {
        stockText = `Chỉ còn <span class="stock-low">${p.stock}</span> ${p.unit}`;
      } else {
        stockText = `Kho còn: <span class="stock-high">${p.stock}</span> ${p.unit}`;
      }
    } else {
      stockText = `<span class="stock-empty"><i class="fa-solid fa-circle-xmark"></i> Tạm hết hàng</span>`;
    }

    const card = document.createElement('article');
    card.className = `product-card ${!isAvailable ? 'card-out-of-stock' : ''}`;

    card.innerHTML = `
      <div class="product-image" onclick="openProductDetail(${p.id})">
        <img src="${p.image_url}" alt="${p.name}" loading="lazy">
        <span class="badge ${badgeClass}">${badgeText}</span>
        ${p.certification ? `<span class="badge-cert-tag"><i class="fa-solid fa-shield-check"></i> Kiểm định</span>` : ''}
      </div>

      <div class="product-info">
        <div class="product-category-row">
          <span class="product-category">${p.category_name || p.category}</span>
          <span class="product-unit-tag">${p.unit}</span>
        </div>

        <h3 class="product-name" onclick="openProductDetail(${p.id})">${p.name}</h3>

        <div class="product-origin-line" title="${p.origin || 'Nông trại Việt Nam'}">
          <i class="fa-solid fa-location-dot"></i> ${p.origin || (p.farm_name ? p.farm_name + ' (' + p.farm_location + ')' : 'Nông trại Việt Nam')}
        </div>

        <div class="stock-info">
          ${stockText}
        </div>

        <div class="price-box">
          <span class="current-price">${p.price.toLocaleString('vi-VN')} đ</span>
          ${p.old_price > 0 ? `<span class="old-price">${p.old_price.toLocaleString('vi-VN')} đ</span>` : ''}
        </div>

        <div class="card-actions-row">
          <button type="button" class="btn btn-view-detail" onclick="openProductDetail(${p.id})">
            <i class="fa-solid fa-eye"></i> Chi tiết
          </button>

          ${isAvailable ? `
            <button type="button" class="btn btn-add-cart" onclick="addToCartById(${p.id})">
              <i class="fa-solid fa-cart-plus"></i> Chọn mua
            </button>
          ` : `
            <button type="button" class="btn btn-disabled" disabled title="Sản phẩm tạm thời hết hàng">
              <i class="fa-solid fa-ban"></i> Tạm hết
            </button>
          `}
        </div>
      </div>
    `;

    gridEl.appendChild(card);
  });
}

// ==========================================================================
// 8. CHI TIẾT SẢN PHẨM (PRODUCT DETAILS MODAL)
// ==========================================================================

async function openProductDetail(productId) {
  const modal = document.getElementById('product-detail-modal');
  const content = document.getElementById('product-detail-content');
  if (!modal || !content) return;

  content.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải thông tin nông sản...</div>';
  modal.classList.remove('hidden');

  const res = await fetchAPI(`/products/${productId}`);
  if (!res.ok || !res.data.success) {
    showToast(res.data.message || 'Không tìm thấy sản phẩm.', 'error');
    modal.classList.add('hidden');
    return;
  }

  const p = res.data.data;
  const isAvailable = p.stock > 0;
  const badgeClass = isAvailable ? 'in-stock' : 'out-of-stock';
  const badgeText = isAvailable ? `Còn hàng (Kho: ${p.stock} ${p.unit})` : 'Tạm hết hàng';

  content.innerHTML = `
    <div class="detail-grid">
      <div class="detail-image-box">
        <img src="${p.image_url}" alt="${p.name}">
      </div>

      <div class="detail-meta-box">
        <span class="detail-category-badge">${p.category_name} &bull; ${p.unit}</span>
        <h2 class="detail-title">${p.name}</h2>

        <div class="detail-price-box">
          <span class="detail-current-price">${p.price.toLocaleString('vi-VN')} đ</span>
          ${p.old_price > 0 ? `<span class="detail-old-price">${p.old_price.toLocaleString('vi-VN')} đ</span>` : ''}
          <span class="badge ${badgeClass}" style="position: static; margin-left: auto;">${badgeText}</span>
        </div>

        <div class="detail-info-list">
          <div class="detail-info-item">
            <i class="fa-solid fa-tractor"></i>
            <div><strong>Nhà vườn / Trang trại:</strong> ${p.farm_name ? `${p.farm_name} (${p.farm_location})` : p.origin}</div>
          </div>
          <div class="detail-info-item">
            <i class="fa-solid fa-seedling"></i>
            <div><strong>Xuất xứ vùng trồng:</strong> ${p.origin || 'Việt Nam'}</div>
          </div>
          <div class="detail-info-item">
            <i class="fa-solid fa-calendar-check"></i>
            <div><strong>Thu hoạch:</strong> ${p.harvest_date || 'Thu hái sáng sớm mỗi ngày'}</div>
          </div>
          <div class="detail-info-item">
            <i class="fa-solid fa-leaf"></i>
            <div><strong>Quy trình canh tác:</strong> ${p.cultivation_method || 'Canh tác an toàn sinh học'}</div>
          </div>
          <div class="detail-info-item">
            <i class="fa-solid fa-certificate"></i>
            <div><strong>Chứng nhận / Kiểm định:</strong> ${p.certification || 'Đang cập nhật hồ sơ kiểm định'}</div>
          </div>
        </div>

        ${isAvailable ? `
          <div class="detail-add-section">
            <div class="quantity-stepper">
              <button type="button" onclick="adjustDetailQty(-1)">-</button>
              <input type="number" id="detail-qty-input" value="1" min="1" max="${p.stock}" readonly>
              <button type="button" onclick="adjustDetailQty(1, ${p.stock})">+</button>
            </div>
            <button type="button" class="btn btn-primary btn-lg" style="flex: 1;" onclick="addDetailToCart(${p.id})">
              <i class="fa-solid fa-cart-plus"></i> Thêm vào giỏ hàng
            </button>
          </div>
        ` : `
          <div class="detail-add-section">
            <button type="button" class="btn btn-disabled btn-lg" style="width: 100%;" disabled>
              <i class="fa-solid fa-ban"></i> Nông sản hiện đang tạm hết hàng
            </button>
          </div>
        `}
      </div>
    </div>
  `;
}

function adjustDetailQty(delta, maxStock = 999) {
  const input = document.getElementById('detail-qty-input');
  if (!input) return;
  let val = parseInt(input.value, 10) || 1;
  val += delta;
  if (val < 1) val = 1;
  if (val > maxStock) {
    val = maxStock;
    showToast(`Số lượng tối đa trong kho là ${maxStock}!`, 'info');
  }
  input.value = val;
}

function addDetailToCart(productId) {
  const input = document.getElementById('detail-qty-input');
  const qty = input ? parseInt(input.value, 10) || 1 : 1;
  addToCartById(productId, qty);
  const modal = document.getElementById('product-detail-modal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================================================
// 9. QUẢN LÝ GIỎ HÀNG (SHOPPING CART)
// ==========================================================================

function addToCartById(productId, requestedQty = 1) {
  const product = currentProducts.find(p => p.id === productId);
  if (!product) {
    showToast('Không tìm thấy thông tin sản phẩm.', 'error');
    return;
  }

  if (product.stock <= 0) {
    showToast(`Sản phẩm "${product.name}" hiện đang hết hàng!`, 'error');
    return;
  }

  const cart = getCart();
  const existing = cart.find(item => item.id === productId);
  const currentQty = existing ? existing.quantity : 0;
  const newQty = currentQty + requestedQty;

  if (newQty > product.stock) {
    showToast(`Kho chỉ còn ${product.stock} ${product.unit}! Bạn đã có ${currentQty} trong giỏ.`, 'error');
    return;
  }

  if (existing) {
    existing.quantity = newQty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      image: product.image_url,
      stock: product.stock,
      quantity: requestedQty
    });
  }

  saveCart(cart);
  updateCartBadge();
  showToast(`Đã thêm ${requestedQty} ${product.unit} "${product.name}" vào giỏ hàng!`, 'success');
}

function renderCartModal() {
  const modal = document.getElementById('cart-modal');
  const body = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');
  if (!modal || !body || !footer) return;

  const cart = getCart();

  if (cart.length === 0) {
    body.innerHTML = `
      <div class="cart-empty-box">
        <i class="fa-solid fa-basket-shopping"></i>
        <h4>Giỏ hàng của bạn đang trống!</h4>
        <p>Hãy lựa chọn những món rau củ quả tươi ngon chuẩn nông trại cho gia đình bạn nhé.</p>
        <button type="button" class="btn btn-primary" onclick="closeCartModal()">
          <i class="fa-solid fa-leaf"></i> Khám phá nông sản ngay
        </button>
      </div>
    `;
    footer.classList.add('hidden');
    modal.classList.remove('hidden');
    return;
  }

  footer.classList.remove('hidden');

  let itemsHTML = `<div class="cart-items-list">`;
  let subtotal = 0;

  cart.forEach(item => {
    const lineTotal = item.price * item.quantity;
    subtotal += lineTotal;

    itemsHTML += `
      <div class="cart-item-row">
        <img src="${item.image}" alt="${item.name}" class="cart-item-thumb">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-unit">${item.unit} &bull; ${item.price.toLocaleString('vi-VN')} đ</div>
        </div>

        <div class="quantity-stepper">
          <button type="button" onclick="updateCartItemQty(${item.id}, -1)">-</button>
          <input type="number" value="${item.quantity}" readonly>
          <button type="button" onclick="updateCartItemQty(${item.id}, 1)" ${item.quantity >= item.stock ? 'disabled' : ''}>+</button>
        </div>

        <div class="cart-item-subtotal">${lineTotal.toLocaleString('vi-VN')} đ</div>

        <button type="button" class="btn-remove-item" onclick="removeCartItem(${item.id})" title="Xóa khỏi giỏ">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
  });
  itemsHTML += `</div>`;
  body.innerHTML = itemsHTML;

  const isFreeShip = subtotal >= 200000;
  const shippingFee = isFreeShip ? 0 : 25000;
  const grandTotal = subtotal + shippingFee;

  document.getElementById('cart-subtotal-price').textContent = `${subtotal.toLocaleString('vi-VN')} đ`;
  document.getElementById('cart-shipping-price').textContent = isFreeShip ? '0 đ (Miễn phí)' : '25.000 đ';
  document.getElementById('cart-total-price').textContent = `${grandTotal.toLocaleString('vi-VN')} đ`;

  const freeshipNote = document.getElementById('shipping-freeship-note');
  if (freeshipNote) {
    if (isFreeShip) {
      freeshipNote.innerHTML = `<i class="fa-solid fa-circle-check"></i> Đơn hàng từ 200.000 đ &mdash; <strong>Được MIỄN PHÍ vận chuyển!</strong>`;
      freeshipNote.style.backgroundColor = '#e8f5e9';
      freeshipNote.style.color = '#2e7d32';
    } else {
      const needMore = 200000 - subtotal;
      freeshipNote.innerHTML = `<i class="fa-solid fa-truck-fast"></i> Mua thêm <strong>${needMore.toLocaleString('vi-VN')} đ</strong> để nhận ưu đãi MIỄN PHÍ ship 2H!`;
      freeshipNote.style.backgroundColor = '#fffbeb';
      freeshipNote.style.color = '#b45309';
    }
  }

  modal.classList.remove('hidden');
}

function updateCartItemQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    removeCartItem(productId);
    return;
  }

  if (newQty > item.stock) {
    showToast(`Đã đạt giới hạn số lượng trong kho (${item.stock} ${item.unit})!`, 'info');
    return;
  }

  item.quantity = newQty;
  saveCart(cart);
  updateCartBadge();
  renderCartModal();
}

function removeCartItem(productId) {
  let cart = getCart();
  const item = cart.find(i => i.id === productId);
  cart = cart.filter(i => i.id !== productId);
  saveCart(cart);
  updateCartBadge();
  renderCartModal();
  if (item) showToast(`Đã bỏ "${item.name}" ra khỏi giỏ.`, 'info');
}

function closeCartModal() {
  const modal = document.getElementById('cart-modal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================================================
// 10. ĐẶT HÀNG & GỬI ĐẾN SERVER TRUNG TÂM (CHECKOUT FLOW)
// ==========================================================================

function openCheckoutModal() {
  const cart = getCart();
  if (cart.length === 0) {
    showToast('Giỏ hàng trống, vui lòng chọn nông sản trước!', 'error');
    return;
  }

  closeCartModal();

  const checkoutModal = document.getElementById('checkout-modal');
  const previewContainer = document.getElementById('checkout-items-preview');
  if (!checkoutModal || !previewContainer) return;

  const user = getStoredUser();
  const nameInput = document.getElementById('order-fullname');
  const phoneInput = document.getElementById('order-phone');
  if (user) {
    if (nameInput && !nameInput.value) nameInput.value = user.fullName || '';
    if (phoneInput && !phoneInput.value) phoneInput.value = user.phone || '';
  }

  clearCheckoutErrors();

  let subtotal = 0;
  let previewHTML = '';
  cart.forEach(item => {
    const line = item.price * item.quantity;
    subtotal += line;
    previewHTML += `
      <div class="checkout-preview-item">
        <span><strong>${item.name}</strong> (${item.unit}) x ${item.quantity}</span>
        <span>${line.toLocaleString('vi-VN')} đ</span>
      </div>
    `;
  });

  previewContainer.innerHTML = previewHTML;

  const isFreeShip = subtotal >= 200000;
  const shippingFee = isFreeShip ? 0 : 25000;
  const grandTotal = subtotal + shippingFee;

  document.getElementById('checkout-subtotal').textContent = `${subtotal.toLocaleString('vi-VN')} đ`;
  document.getElementById('checkout-shipping').textContent = isFreeShip ? '0 đ (Miễn phí)' : '25.000 đ';
  document.getElementById('checkout-total').textContent = `${grandTotal.toLocaleString('vi-VN')} đ`;

  checkoutModal.classList.remove('hidden');
}

function clearCheckoutErrors() {
  ['fullname', 'phone', 'address'].forEach(f => {
    const err = document.getElementById(`error-${f}`);
    const input = document.getElementById(`order-${f}`);
    if (err) err.textContent = '';
    if (input) input.classList.remove('is-invalid');
  });
}

function validatePhoneNumber(phone) {
  const regex = /^(0[3|5|7|8|9])[0-9]{8}$/;
  return regex.test(phone.replace(/\s+/g, ''));
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  clearCheckoutErrors();

  const cart = getCart();
  if (cart.length === 0) {
    showToast('Giỏ hàng trống!', 'error');
    return;
  }

  const nameInput = document.getElementById('order-fullname');
  const phoneInput = document.getElementById('order-phone');
  const addressInput = document.getElementById('order-address');
  const noteInput = document.getElementById('order-note');
  const paymentRadio = document.querySelector('input[name="payment-method"]:checked');

  const customerName = nameInput.value.trim();
  const customerPhone = phoneInput.value.trim();
  const shippingAddress = addressInput.value.trim();
  const note = noteInput ? noteInput.value.trim() : '';
  const paymentMethod = paymentRadio ? paymentRadio.value : 'COD';

  let hasError = false;

  if (!customerName || customerName.length < 2) {
    document.getElementById('error-fullname').textContent = 'Vui lòng nhập họ tên người nhận hàng.';
    nameInput.classList.add('is-invalid');
    hasError = true;
  }

  if (!validatePhoneNumber(customerPhone)) {
    document.getElementById('error-phone').textContent = 'Số điện thoại không hợp lệ (cần 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09).';
    phoneInput.classList.add('is-invalid');
    hasError = true;
  }

  if (!shippingAddress || shippingAddress.length < 6) {
    document.getElementById('error-address').textContent = 'Vui lòng nhập địa chỉ nhận hàng chi tiết.';
    addressInput.classList.add('is-invalid');
    hasError = true;
  }

  if (hasError) return;

  // Gửi đơn hàng lên máy chủ (Server-side validation & atomic deduction)
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
  }

  const payload = {
    customerName,
    customerPhone,
    shippingAddress,
    note,
    paymentMethod,
    items: cart.map(i => ({ id: i.id, quantity: i.quantity }))
  };

  const res = await fetchAPI('/orders', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Xác nhận đặt hàng';
  }

  if (!res.ok || !res.data.success) {
    showToast(res.data.message || 'Lỗi khi đặt hàng.', 'error');
    return;
  }

  const order = res.data.order;

  // Xóa giỏ hàng sau khi máy chủ xác nhận thành công
  saveCart([]);
  updateCartBadge();
  document.getElementById('checkout-modal').classList.add('hidden');
  document.getElementById('form-checkout').reset();

  showOrderSuccessModal(order);
  loadProducts(); // Cập nhật lại tồn kho hiển thị
}

function showOrderSuccessModal(order) {
  const modal = document.getElementById('order-success-modal');
  const idEl = document.getElementById('success-order-id');
  const contentEl = document.getElementById('order-success-content');
  const buttonsEl = document.getElementById('order-success-buttons');
  if (!modal || !idEl || !contentEl || !buttonsEl) return;

  idEl.textContent = `Mã đơn hàng: ${order.order_code}`;

  let itemsHTML = `<div style="margin: 10px 0; border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 10px 0;">`;
  order.items.forEach(i => {
    itemsHTML += `
      <div class="order-success-row">
        <span>${i.name} (${i.unit}) &times; ${i.quantity}</span>
        <strong>${i.subtotal.toLocaleString('vi-VN')} đ</strong>
      </div>
    `;
  });
  itemsHTML += `</div>`;

  contentEl.innerHTML = `
    <div class="order-success-row">
      <span>Thời gian đặt:</span>
      <span>${new Date(order.created_at).toLocaleString('vi-VN')}</span>
    </div>
    <div class="order-success-row">
      <span>Người nhận hàng:</span>
      <strong>${order.customer_name}</strong>
    </div>
    <div class="order-success-row">
      <span>Số điện thoại:</span>
      <span>${order.customer_phone}</span>
    </div>
    <div class="order-success-row">
      <span>Địa chỉ:</span>
      <span>${order.shipping_address}</span>
    </div>
    <div class="order-success-row">
      <span>Phương thức:</span>
      <span>${order.payment_method === 'SANDBOX_PAYMENT' ? 'Cổng thanh toán Sandbox' : (order.payment_method === 'VIETQR' ? 'Chuyển khoản VietQR' : 'Tiền mặt khi nhận hàng (COD)')}</span>
    </div>

    ${itemsHTML}

    <div class="order-success-row" style="font-size: 16px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #cbd5e1;">
      <span><strong>TỔNG THANH TOÁN:</strong></span>
      <strong style="color: var(--primary-color); font-size: 18px;">${order.total_amount.toLocaleString('vi-VN')} đ</strong>
    </div>
  `;

  let actionButtons = `
    <button type="button" class="btn btn-primary" onclick="closeSuccessModal()">
      <i class="fa-solid fa-basket-shopping"></i> Tiếp tục mua hàng
    </button>
    <button type="button" class="btn btn-outline" onclick="openLookupModal('${order.order_code}')">
      <i class="fa-solid fa-magnifying-glass"></i> Tra cứu trạng thái đơn này
    </button>
  `;

  if (order.payment_method === 'SANDBOX_PAYMENT' && order.payment_status !== 'PAID') {
    actionButtons = `
      <button type="button" class="btn btn-primary" onclick="initiateSandboxPayment('${order.order_code}')">
        <i class="fa-solid fa-credit-card"></i> Thanh toán ngay qua Sandbox
      </button>
    ` + actionButtons;
  }

  buttonsEl.innerHTML = actionButtons;
  modal.classList.remove('hidden');
  showToast(`Đơn hàng #${order.order_code} đã được tạo thành công!`, 'success');
}

function closeSuccessModal() {
  const modal = document.getElementById('order-success-modal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================================================
// 11. TRA CỨU ĐƠN HÀNG TRỰC TIẾP TỪ SERVER (ORDER LOOKUP)
// ==========================================================================

function openLookupModal(prefillCode = '') {
  const modal = document.getElementById('lookup-modal');
  const input = document.getElementById('lookup-input');
  if (!modal) return;

  if (input && prefillCode) {
    input.value = prefillCode;
    submitOrderLookup(prefillCode);
  }
  modal.classList.remove('hidden');
}

async function submitOrderLookup(keyword) {
  const resultsContainer = document.getElementById('lookup-results');
  if (!resultsContainer) return;

  resultsContainer.innerHTML = '<div style="text-align: center; padding: 25px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tra cứu dữ liệu...</div>';

  const isPhone = /^[0-9]{9,11}$/.test(keyword.replace(/\s+/g, ''));
  const queryParam = isPhone ? `phone=${encodeURIComponent(keyword)}` : `order_code=${encodeURIComponent(keyword)}`;

  const res = await fetchAPI(`/orders/lookup?${queryParam}`);
  if (!res.ok || !res.data.success || res.data.data.length === 0) {
    resultsContainer.innerHTML = `
      <div class="lookup-hint" style="text-align: center; border-left: 3px solid #ef4444;">
        <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; font-size: 24px; margin-bottom: 8px;"></i>
        <p>Không tìm thấy đơn hàng nào khớp với từ khóa <strong>"${keyword}"</strong>. Vui lòng kiểm tra lại mã đơn hoặc số điện thoại.</p>
      </div>
    `;
    return;
  }

  let html = '';
  res.data.data.forEach(order => {
    let orderStatusBadge = '';
    switch (order.order_status) {
      case 'CONFIRMED':
        orderStatusBadge = '<span class="status-badge status-confirmed">Đã xác nhận</span>';
        break;
      case 'SHIPPING':
        orderStatusBadge = '<span class="status-badge status-shipping">Đang giao hàng</span>';
        break;
      case 'COMPLETED':
        orderStatusBadge = '<span class="status-badge status-completed">Giao thành công</span>';
        break;
      case 'CANCELLED':
        orderStatusBadge = '<span class="status-badge status-cancelled">Đã hủy</span>';
        break;
      case 'PENDING':
      default:
        orderStatusBadge = '<span class="status-badge status-pending">Chờ xác nhận</span>';
        break;
    }

    const paymentBadge = order.payment_status === 'PAID'
      ? '<span class="status-badge payment-paid"><i class="fa-solid fa-check"></i> Đã thanh toán</span>'
      : '<span class="status-badge payment-pending"><i class="fa-solid fa-clock"></i> Chưa thanh toán</span>';

    let itemsTable = `<table style="width: 100%; font-size: 13px; margin: 10px 0; border-collapse: collapse;">`;
    order.items.forEach(it => {
      itemsTable += `
        <tr style="border-bottom: 1px dashed #e2e8f0;">
          <td style="padding: 6px 0;"><strong>${it.product_name}</strong> (${it.unit}) &times; ${it.quantity}</td>
          <td style="text-align: right; padding: 6px 0;">${it.subtotal.toLocaleString('vi-VN')} đ</td>
        </tr>
      `;
    });
    itemsTable += `</table>`;

    html += `
      <div class="lookup-order-card">
        <div class="lookup-order-header">
          <span class="lookup-order-code">Đơn hàng #${order.order_code}</span>
          <div style="display: flex; gap: 8px;">
            ${orderStatusBadge}
            ${paymentBadge}
          </div>
        </div>

        <div style="font-size: 13.5px; line-height: 1.5; color: #475569;">
          <div><strong>Người nhận:</strong> ${order.customer_name} &bull; <strong>SĐT:</strong> ${order.customer_phone}</div>
          <div><strong>Địa chỉ:</strong> ${order.shipping_address}</div>
          <div><strong>Thời gian đặt:</strong> ${new Date(order.created_at).toLocaleString('vi-VN')}</div>
          ${order.note ? `<div><strong>Ghi chú:</strong> <em>${order.note}</em></div>` : ''}
        </div>

        ${itemsTable}

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
          <span>Phí giao: ${order.shipping_fee === 0 ? 'Miễn phí' : `${order.shipping_fee.toLocaleString('vi-VN')} đ`}</span>
          <strong style="color: var(--primary-color); font-size: 16px;">Tổng: ${order.total_amount.toLocaleString('vi-VN')} đ</strong>
        </div>

        ${order.payment_status !== 'PAID' && order.payment_method === 'SANDBOX_PAYMENT' ? `
          <div style="margin-top: 12px; text-align: right;">
            <button type="button" class="btn btn-primary btn-sm" onclick="initiateSandboxPayment('${order.order_code}')">
              <i class="fa-solid fa-credit-card"></i> Thanh toán thử nghiệm Sandbox
            </button>
          </div>
        ` : ''}
      </div>
    `;
  });

  resultsContainer.innerHTML = html;
}

// ==========================================================================
// 12. CỔNG THANH TOÁN SANDBOX VỚI CHỮ KÝ SỐ MÁY CHỦ (SANDBOX GATEWAY)
// ==========================================================================

let activeSandboxSession = null;

async function initiateSandboxPayment(orderCode) {
  const modal = document.getElementById('sandbox-modal');
  const infoBox = document.getElementById('sandbox-info-box');
  if (!modal || !infoBox) return;

  infoBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang khởi tạo phiên thanh toán bảo mật phía máy chủ...';
  modal.classList.remove('hidden');

  const res = await fetchAPI('/payments/create-sandbox-checkout', {
    method: 'POST',
    body: JSON.stringify({ orderCode })
  });

  if (!res.ok || !res.data.success) {
    showToast(res.data.message || 'Lỗi khởi tạo thanh toán.', 'error');
    modal.classList.add('hidden');
    return;
  }

  activeSandboxSession = res.data.data;

  infoBox.innerHTML = `
    <div style="margin-bottom: 8px;"><strong>Mã đơn hàng:</strong> ${activeSandboxSession.orderCode}</div>
    <div style="margin-bottom: 8px;"><strong>Số tiền cần thanh toán:</strong> <span style="font-size: 18px; font-weight: 800; color: var(--primary-color);">${activeSandboxSession.amount.toLocaleString('vi-VN')} đ</span></div>
    <div style="margin-bottom: 8px;"><strong>Mã giao dịch (TxID):</strong> <code>${activeSandboxSession.transactionId}</code></div>
    <div style="font-size: 11.5px; color: var(--text-muted); word-break: break-all;">
      <strong>Chữ ký số (HMAC-SHA256):</strong> <code>${activeSandboxSession.signature}</code>
    </div>
  `;
}

async function confirmSandboxPayment() {
  if (!activeSandboxSession) return;

  const btn = document.getElementById('btn-confirm-sandbox-pay');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xác minh chữ ký số Webhook...';
  }

  // Gửi Webhook với chữ ký số máy chủ đã cấp
  const res = await fetchAPI('/payments/sandbox-webhook', {
    method: 'POST',
    body: JSON.stringify({
      orderCode: activeSandboxSession.orderCode,
      amount: activeSandboxSession.amount,
      transactionId: activeSandboxSession.transactionId,
      timestamp: activeSandboxSession.timestamp,
      signature: activeSandboxSession.signature,
      idempotencyKey: `idemp-${activeSandboxSession.transactionId}`
    })
  });

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Giả lập thanh toán thành công (Kích hoạt Webhook)';
  }

  if (res.ok && res.data.success) {
    showToast('Xác thực chữ ký số thành công! Đơn hàng đã được thanh toán.', 'success');
    document.getElementById('sandbox-modal').classList.add('hidden');
    activeSandboxSession = null;
    openLookupModal();
  } else {
    showToast(res.data.message || 'Xác thực webhook thất bại!', 'error');
  }
}

// ==========================================================================
// 13. KHU VỰC NGƯỜI BÁN & NHÀ VƯỜN (SELLER ZONE)
// ==========================================================================

async function openSellerModal() {
  const modal = document.getElementById('seller-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  loadSellerProducts();
}

async function loadSellerProducts() {
  const tbody = document.getElementById('seller-products-tbody');
  const countEl = document.getElementById('seller-product-count');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải danh sách nông sản của nhà vườn...</td></tr>';

  const res = await fetchAPI('/seller/products');
  if (res.ok && res.data.success) {
    const products = res.data.data;
    if (countEl) countEl.textContent = `Tổng cộng: ${products.length} nông sản`;

    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #888;">Chưa có nông sản nào được đăng bán. Hãy bấm tab "Đăng bán sản phẩm mới"!</td></tr>';
      return;
    }

    tbody.innerHTML = products.map(p => `
      <tr>
        <td><img src="${p.image_url}" alt="${p.name}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover;"></td>
        <td><strong>${p.name}</strong><br><small style="color: #64748b;">${p.unit}</small></td>
        <td>${p.category_name}</td>
        <td>${p.price.toLocaleString('vi-VN')} đ</td>
        <td>
          <input type="number" value="${p.stock}" min="0" style="width: 70px; padding: 4px; border: 1px solid #ccc; border-radius: 4px;" id="seller-stock-${p.id}">
        </td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="updateSellerStock(${p.id})">Lưu kho</button>
        </td>
      </tr>
    `).join('');
  }
}

async function updateSellerStock(productId) {
  const input = document.getElementById(`seller-stock-${productId}`);
  if (!input) return;
  const newStock = parseInt(input.value, 10);

  const res = await fetchAPI(`/seller/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({ stock: newStock })
  });

  if (res.ok && res.data.success) {
    showToast('Đã cập nhật tồn kho nông sản thành công!', 'success');
    loadProducts();
  } else {
    showToast(res.data.message || 'Lỗi cập nhật tồn kho.', 'error');
  }
}

async function loadSellerOrders() {
  const tbody = document.getElementById('seller-orders-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải đơn hàng...</td></tr>';

  const res = await fetchAPI('/seller/orders');
  if (res.ok && res.data.success) {
    const orders = res.data.data;
    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #888;">Chưa có đơn hàng nào cho nông sản của vườn.</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(o => `
      <tr>
        <td><strong>#${o.order_code}</strong></td>
        <td>${o.customer_name}</td>
        <td>${o.customer_phone}</td>
        <td>${o.items.map(i => `${i.product_name} (${i.quantity} ${i.unit})`).join(', ')}</td>
        <td><span class="status-badge status-${o.order_status.toLowerCase()}">${o.order_status}</span></td>
      </tr>
    `).join('');
  }
}

// ==========================================================================
// 14. KHU VỰC QUẢN TRỊ VIÊN HỆ THỐNG (ADMIN ZONE)
// ==========================================================================

async function openAdminModal() {
  const modal = document.getElementById('admin-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  loadAdminOverview();
}

async function loadAdminOverview() {
  const res = await fetchAPI('/admin/overview');
  if (res.ok && res.data.success) {
    const s = res.data.data;
    document.getElementById('stat-revenue').textContent = `${s.totalRevenue.toLocaleString('vi-VN')} đ`;
    document.getElementById('stat-orders').textContent = s.totalOrders;
    document.getElementById('stat-users').textContent = s.totalUsers;
    document.getElementById('stat-products').textContent = `${s.totalProducts} (${s.lowStockProducts} sắp hết)`;
  }
}

async function loadAdminOrders() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải đơn hàng...</td></tr>';

  const res = await fetchAPI('/admin/orders');
  if (res.ok && res.data.success) {
    const orders = res.data.data;
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td><strong>#${o.order_code}</strong><br><small>${new Date(o.created_at).toLocaleDateString('vi-VN')}</small></td>
        <td>${o.customer_name}<br><small>${o.customer_phone}</small></td>
        <td><strong>${o.total_amount.toLocaleString('vi-VN')} đ</strong></td>
        <td><span class="status-badge payment-${o.payment_status.toLowerCase()}">${o.payment_status}</span></td>
        <td>
          <select id="admin-status-${o.id}" style="padding: 4px; border-radius: 4px;">
            <option value="PENDING" ${o.order_status === 'PENDING' ? 'selected' : ''}>Chờ xác nhận</option>
            <option value="CONFIRMED" ${o.order_status === 'CONFIRMED' ? 'selected' : ''}>Đã xác nhận</option>
            <option value="SHIPPING" ${o.order_status === 'SHIPPING' ? 'selected' : ''}>Đang giao</option>
            <option value="COMPLETED" ${o.order_status === 'COMPLETED' ? 'selected' : ''}>Hoàn tất</option>
            <option value="CANCELLED" ${o.order_status === 'CANCELLED' ? 'selected' : ''}>Đã hủy</option>
          </select>
        </td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="updateAdminOrderStatus(${o.id})">Cập nhật</button>
        </td>
      </tr>
    `).join('');
  }
}

async function updateAdminOrderStatus(orderId) {
  const select = document.getElementById(`admin-status-${orderId}`);
  if (!select) return;

  const res = await fetchAPI(`/admin/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ orderStatus: select.value })
  });

  if (res.ok && res.data.success) {
    showToast('Cập nhật trạng thái đơn hàng thành công!', 'success');
    loadAdminOrders();
    loadAdminOverview();
  } else {
    showToast(res.data.message || 'Lỗi cập nhật đơn hàng.', 'error');
  }
}

async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải tài khoản...</td></tr>';

  const res = await fetchAPI('/admin/users');
  if (res.ok && res.data.success) {
    const users = res.data.data;
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>#${u.id}</td>
        <td><strong>${u.username}</strong></td>
        <td>${u.full_name}</td>
        <td>${u.phone || '-'}</td>
        <td><span class="role-badge role-${u.role_name}">${u.role_name}</span></td>
        <td>
          <select id="user-role-${u.id}" onchange="changeUserRole(${u.id})" style="padding: 4px; border-radius: 4px;">
            <option value="1" ${u.role_name === 'admin' ? 'selected' : ''}>Admin (Quản trị)</option>
            <option value="2" ${u.role_name === 'seller' ? 'selected' : ''}>Seller (Nhà vườn)</option>
            <option value="3" ${u.role_name === 'customer' ? 'selected' : ''}>Customer (Khách)</option>
          </select>
        </td>
      </tr>
    `).join('');
  }
}

async function changeUserRole(userId) {
  const select = document.getElementById(`user-role-${userId}`);
  if (!select) return;

  const res = await fetchAPI(`/admin/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ roleId: parseInt(select.value, 10) })
  });

  if (res.ok && res.data.success) {
    showToast('Cập nhật vai trò thành công!', 'success');
    loadAdminUsers();
  } else {
    showToast(res.data.message || 'Lỗi cập nhật vai trò.', 'error');
  }
}

async function loadAdminFarms() {
  const tbody = document.getElementById('admin-farms-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải danh sách trang trại...</td></tr>';

  const res = await fetchAPI('/admin/farms');
  if (res.ok && res.data.success) {
    const farms = res.data.data;
    tbody.innerHTML = farms.map(f => `
      <tr>
        <td><strong>${f.farm_name}</strong><br><small>${f.description || ''}</small></td>
        <td>${f.location}</td>
        <td>${f.owner_name} (${f.owner_username})<br><small>${f.owner_phone || ''}</small></td>
        <td><small>${f.certification_info || 'Đang cập nhật'}</small></td>
        <td><strong>${f.product_count}</strong> sản phẩm</td>
      </tr>
    `).join('');
  }
}

// ==========================================================================
// 15. GẮN SỰ KIỆN TRÊN TRÌNH DUYỆT KHI TẢI XONG DOM
// ==========================================================================

if (typeof window !== 'undefined') {
  window.openProductDetail = openProductDetail;
  window.adjustDetailQty = adjustDetailQty;
  window.addDetailToCart = addDetailToCart;
  window.addToCartById = addToCartById;
  window.updateCartItemQty = updateCartItemQty;
  window.removeCartItem = removeCartItem;
  window.closeCartModal = closeCartModal;
  window.closeSuccessModal = closeSuccessModal;
  window.openLookupModal = openLookupModal;
  window.initiateSandboxPayment = initiateSandboxPayment;
  window.updateSellerStock = updateSellerStock;
  window.updateAdminOrderStatus = updateAdminOrderStatus;
  window.changeUserRole = changeUserRole;
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    // 1. Kiểm tra phiên đăng nhập và tải sản phẩm ban đầu
    checkAuthSession();
    updateCartBadge();
    loadProducts();

    // 2. Modals DOM
    const authModal = document.getElementById('auth-modal');
    const adminModal = document.getElementById('admin-modal');
    const sellerModal = document.getElementById('seller-modal');
    const cartModal = document.getElementById('cart-modal');
    const detailModal = document.getElementById('product-detail-modal');
    const checkoutModal = document.getElementById('checkout-modal');
    const successModal = document.getElementById('order-success-modal');
    const lookupModal = document.getElementById('lookup-modal');
    const sandboxModal = document.getElementById('sandbox-modal');

    // 3. Nút mở giỏ hàng & đặt hàng
    const cartBtn = document.getElementById('cart-btn');
    if (cartBtn) cartBtn.addEventListener('click', renderCartModal);

    const btnCloseCart = document.getElementById('btn-close-cart');
    if (btnCloseCart) btnCloseCart.addEventListener('click', closeCartModal);

    const btnContinueShopping = document.getElementById('btn-continue-shopping');
    if (btnContinueShopping) btnContinueShopping.addEventListener('click', closeCartModal);

    const btnOpenCheckout = document.getElementById('btn-open-checkout');
    if (btnOpenCheckout) btnOpenCheckout.addEventListener('click', openCheckoutModal);

    const btnCloseCheckout = document.getElementById('btn-close-checkout');
    if (btnCloseCheckout) btnCloseCheckout.addEventListener('click', () => checkoutModal.classList.add('hidden'));

    const btnBackToCart = document.getElementById('btn-back-to-cart');
    if (btnBackToCart) {
      btnBackToCart.addEventListener('click', () => {
        checkoutModal.classList.add('hidden');
        renderCartModal();
      });
    }

    const formCheckout = document.getElementById('form-checkout');
    if (formCheckout) formCheckout.addEventListener('submit', handleCheckoutSubmit);

    // 4. Tra cứu đơn hàng
    const btnOpenLookup = document.getElementById('btn-open-lookup');
    const navLinkLookup = document.getElementById('nav-link-lookup');
    if (btnOpenLookup) btnOpenLookup.addEventListener('click', () => openLookupModal());
    if (navLinkLookup) navLinkLookup.addEventListener('click', () => openLookupModal());

    const btnCloseLookup = document.getElementById('btn-close-lookup');
    if (btnCloseLookup) btnCloseLookup.addEventListener('click', () => lookupModal.classList.add('hidden'));

    const formLookup = document.getElementById('form-lookup');
    if (formLookup) {
      formLookup.addEventListener('submit', (e) => {
        e.preventDefault();
        const kw = document.getElementById('lookup-input').value.trim();
        if (kw) submitOrderLookup(kw);
      });
    }

    // 5. Sandbox Payment
    const btnConfirmSandbox = document.getElementById('btn-confirm-sandbox-pay');
    if (btnConfirmSandbox) btnConfirmSandbox.addEventListener('click', confirmSandboxPayment);

    const btnCloseSandbox = document.getElementById('btn-close-sandbox');
    const btnCancelSandbox = document.getElementById('btn-cancel-sandbox');
    if (btnCloseSandbox) btnCloseSandbox.addEventListener('click', () => sandboxModal.classList.add('hidden'));
    if (btnCancelSandbox) btnCancelSandbox.addEventListener('click', () => sandboxModal.classList.add('hidden'));

    // 6. Tìm kiếm, lọc và sắp xếp
    const searchInput = document.getElementById('search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        currentSearch = this.value.trim();
        if (btnClearSearch) {
          if (currentSearch) btnClearSearch.classList.remove('hidden');
          else btnClearSearch.classList.add('hidden');
        }
        loadProducts();
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', function () {
        if (searchInput) {
          searchInput.value = '';
          currentSearch = '';
          this.classList.add('hidden');
          loadProducts();
        }
      });
    }

    const stockFilter = document.getElementById('stock-filter');
    if (stockFilter) {
      stockFilter.addEventListener('change', function () {
        currentStockFilter = this.value;
        loadProducts();
      });
    }

    const sortFilter = document.getElementById('sort-filter');
    if (sortFilter) {
      sortFilter.addEventListener('change', function () {
        currentSort = this.value;
        loadProducts();
      });
    }

    const filterBtns = document.querySelectorAll('.category-filter .filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        filterBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentCategory = this.getAttribute('data-category');
        loadProducts();
      });
    });

    // 7. Chi tiết sản phẩm modal close
    const btnCloseDetail = document.getElementById('btn-close-detail');
    if (btnCloseDetail) btnCloseDetail.addEventListener('click', () => detailModal.classList.add('hidden'));

    // 8. Khu vực người bán (Seller)
    const btnOpenSeller = document.getElementById('btn-open-seller');
    const btnCloseSeller = document.getElementById('btn-close-seller');
    if (btnOpenSeller) btnOpenSeller.addEventListener('click', openSellerModal);
    if (btnCloseSeller) btnCloseSeller.addEventListener('click', () => sellerModal.classList.add('hidden'));

    const tabSellerProdsBtn = document.getElementById('tab-seller-products-btn');
    const tabSellerAddBtn = document.getElementById('tab-seller-add-btn');
    const tabSellerOrdersBtn = document.getElementById('tab-seller-orders-btn');
    const sellerPanelProds = document.getElementById('seller-panel-products');
    const sellerPanelAdd = document.getElementById('seller-panel-add');
    const sellerPanelOrders = document.getElementById('seller-panel-orders');

    if (tabSellerProdsBtn && tabSellerAddBtn && tabSellerOrdersBtn) {
      tabSellerProdsBtn.addEventListener('click', () => {
        tabSellerProdsBtn.classList.add('active');
        tabSellerAddBtn.classList.remove('active');
        tabSellerOrdersBtn.classList.remove('active');
        sellerPanelProds.classList.remove('hidden');
        sellerPanelAdd.classList.add('hidden');
        sellerPanelOrders.classList.add('hidden');
        loadSellerProducts();
      });

      tabSellerAddBtn.addEventListener('click', () => {
        tabSellerAddBtn.classList.add('active');
        tabSellerProdsBtn.classList.remove('active');
        tabSellerOrdersBtn.classList.remove('active');
        sellerPanelAdd.classList.remove('hidden');
        sellerPanelProds.classList.add('hidden');
        sellerPanelOrders.classList.add('hidden');
      });

      tabSellerOrdersBtn.addEventListener('click', () => {
        tabSellerOrdersBtn.classList.add('active');
        tabSellerProdsBtn.classList.remove('active');
        tabSellerAddBtn.classList.remove('active');
        sellerPanelOrders.classList.remove('hidden');
        sellerPanelProds.classList.add('hidden');
        sellerPanelAdd.classList.add('hidden');
        loadSellerOrders();
      });
    }

    const formSellerAdd = document.getElementById('form-seller-add-product');
    if (formSellerAdd) {
      formSellerAdd.addEventListener('submit', async function (e) {
        e.preventDefault();
        const payload = {
          name: document.getElementById('sp-name').value.trim(),
          categoryId: document.getElementById('sp-category').value,
          price: document.getElementById('sp-price').value,
          stock: document.getElementById('sp-stock').value,
          unit: document.getElementById('sp-unit').value.trim(),
          origin: document.getElementById('sp-origin').value.trim(),
          certification: document.getElementById('sp-certification').value.trim(),
          cultivationMethod: document.getElementById('sp-cultivation').value.trim(),
          imageUrl: document.getElementById('sp-image').value.trim()
        };

        const res = await fetchAPI('/seller/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (res.ok && res.data.success) {
          showToast('Đăng bán nông sản mới thành công!', 'success');
          formSellerAdd.reset();
          tabSellerProdsBtn.click();
          loadProducts();
        } else {
          showToast(res.data.message || 'Lỗi thêm sản phẩm.', 'error');
        }
      });
    }

    // 9. Khu vực quản trị viên (Admin)
    const btnOpenAdmin = document.getElementById('btn-open-admin');
    const btnCloseAdmin = document.getElementById('btn-close-admin');
    if (btnOpenAdmin) btnOpenAdmin.addEventListener('click', openAdminModal);
    if (btnCloseAdmin) btnCloseAdmin.addEventListener('click', () => adminModal.classList.add('hidden'));

    const tabAdminOverviewBtn = document.getElementById('tab-admin-overview-btn');
    const tabAdminOrdersBtn = document.getElementById('tab-admin-orders-btn');
    const tabAdminUsersBtn = document.getElementById('tab-admin-users-btn');
    const tabAdminFarmsBtn = document.getElementById('tab-admin-farms-btn');
    const adminPanelOverview = document.getElementById('admin-panel-overview');
    const adminPanelOrders = document.getElementById('admin-panel-orders');
    const adminPanelUsers = document.getElementById('admin-panel-users');
    const adminPanelFarms = document.getElementById('admin-panel-farms');

    if (tabAdminOverviewBtn && tabAdminOrdersBtn && tabAdminUsersBtn && tabAdminFarmsBtn) {
      tabAdminOverviewBtn.addEventListener('click', () => {
        [tabAdminOverviewBtn, tabAdminOrdersBtn, tabAdminUsersBtn, tabAdminFarmsBtn].forEach(b => b.classList.remove('active'));
        [adminPanelOverview, adminPanelOrders, adminPanelUsers, adminPanelFarms].forEach(p => p.classList.add('hidden'));
        tabAdminOverviewBtn.classList.add('active');
        adminPanelOverview.classList.remove('hidden');
        loadAdminOverview();
      });

      tabAdminOrdersBtn.addEventListener('click', () => {
        [tabAdminOverviewBtn, tabAdminOrdersBtn, tabAdminUsersBtn, tabAdminFarmsBtn].forEach(b => b.classList.remove('active'));
        [adminPanelOverview, adminPanelOrders, adminPanelUsers, adminPanelFarms].forEach(p => p.classList.add('hidden'));
        tabAdminOrdersBtn.classList.add('active');
        adminPanelOrders.classList.remove('hidden');
        loadAdminOrders();
      });

      tabAdminUsersBtn.addEventListener('click', () => {
        [tabAdminOverviewBtn, tabAdminOrdersBtn, tabAdminUsersBtn, tabAdminFarmsBtn].forEach(b => b.classList.remove('active'));
        [adminPanelOverview, adminPanelOrders, adminPanelUsers, adminPanelFarms].forEach(p => p.classList.add('hidden'));
        tabAdminUsersBtn.classList.add('active');
        adminPanelUsers.classList.remove('hidden');
        loadAdminUsers();
      });

      tabAdminFarmsBtn.addEventListener('click', () => {
        [tabAdminOverviewBtn, tabAdminOrdersBtn, tabAdminUsersBtn, tabAdminFarmsBtn].forEach(b => b.classList.remove('active'));
        [adminPanelOverview, adminPanelOrders, adminPanelUsers, adminPanelFarms].forEach(p => p.classList.add('hidden'));
        tabAdminFarmsBtn.classList.add('active');
        adminPanelFarms.classList.remove('hidden');
        loadAdminFarms();
      });
    }

    // 10. Đăng nhập / Đăng ký (Auth Modal)
    const btnOpenLogin = document.getElementById('btn-open-login');
    const btnCloseAuth = document.getElementById('btn-close-auth');
    const tabLoginBtn = document.getElementById('tab-login-btn');
    const tabRegisterBtn = document.getElementById('tab-register-btn');
    const loginPanel = document.getElementById('login-panel');
    const registerPanel = document.getElementById('register-panel');
    const btnLogout = document.getElementById('btn-logout');

    function switchAuthTab(mode = 'login') {
      if (mode === 'login') {
        tabLoginBtn.classList.add('active');
        tabRegisterBtn.classList.remove('active');
        loginPanel.classList.remove('hidden');
        registerPanel.classList.add('hidden');
      } else {
        tabRegisterBtn.classList.add('active');
        tabLoginBtn.classList.remove('active');
        registerPanel.classList.remove('hidden');
        loginPanel.classList.add('hidden');
      }
    }

    if (btnOpenLogin) {
      btnOpenLogin.addEventListener('click', () => {
        authModal.classList.remove('hidden');
        switchAuthTab('login');
      });
    }

    if (btnCloseAuth) btnCloseAuth.addEventListener('click', () => authModal.classList.add('hidden'));
    if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => switchAuthTab('login'));
    if (tabRegisterBtn) tabRegisterBtn.addEventListener('click', () => switchAuthTab('register'));

    const formLogin = document.getElementById('form-login');
    if (formLogin) {
      formLogin.addEventListener('submit', async function (e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        const res = await fetchAPI('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });

        if (res.ok && res.data.success) {
          setAuthToken(res.data.token);
          setStoredUser(res.data.user);
          updateAuthUI(res.data.user);
          authModal.classList.add('hidden');
          formLogin.reset();
          showToast(`Đăng nhập thành công! Xin chào ${res.data.user.fullName || res.data.user.username}`, 'success');
        } else {
          showToast(res.data.message || 'Đăng nhập không thành công.', 'error');
        }
      });
    }

    const formRegister = document.getElementById('form-register');
    if (formRegister) {
      formRegister.addEventListener('submit', async function (e) {
        e.preventDefault();
        const fullName = document.getElementById('reg-fullname').value.trim();
        const username = document.getElementById('reg-username').value.trim();
        const role = document.getElementById('reg-role').value;
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        if (password !== confirmPassword) {
          showToast('Mật khẩu xác nhận không khớp!', 'error');
          return;
        }

        if (password.length < 6) {
          showToast('Mật khẩu phải từ 6 ký tự trở lên!', 'error');
          return;
        }

        const res = await fetchAPI('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ fullName, username, password, role })
        });

        if (res.ok && res.data.success) {
          setAuthToken(res.data.token);
          setStoredUser(res.data.user);
          updateAuthUI(res.data.user);
          authModal.classList.add('hidden');
          formRegister.reset();
          showToast(`Đăng ký tài khoản thành công! Xin chào ${fullName}`, 'success');
        } else {
          showToast(res.data.message || 'Đăng ký không thành công.', 'error');
        }
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        setAuthToken(null);
        setStoredUser(null);
        updateAuthUI(null);
        showToast('Bạn đã đăng xuất tài khoản.', 'info');
      });
    }

    // 11. Đóng modal khi bấm ra ngoài hoặc nhấn phím Escape
    window.addEventListener('click', (e) => {
      [authModal, adminModal, sellerModal, cartModal, detailModal, checkoutModal, successModal, lookupModal, sandboxModal].forEach(m => {
        if (m && e.target === m) m.classList.add('hidden');
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        [authModal, adminModal, sellerModal, cartModal, detailModal, checkoutModal, successModal, lookupModal, sandboxModal].forEach(m => {
          if (m) m.classList.add('hidden');
        });
      }
    });
  });
}
