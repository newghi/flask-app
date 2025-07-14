let koreanColorData = [];
let importColorData = [];
let orderedProducts = []; // Array to store all selected products
let currentModalProduct = {}; // Temporary storage for product being configured in modal
let pricesData = {};
let koreanPrimaryColorData = [];

// 가격 분류 기준
const BASIC_KEYWORDS = ["블랙", "검정", "실버", "은", "화이트", "흰"];
const BASIC_PRICE = 18000;
const SPECIAL_PRICE = 23000;

// --- 자동완성 색상 검색 (모달) ---
let allModalColors = [];
let selectedModalColor = null;

async function fetchAllModalColors() {
    console.log("fetchAllModalColors 실행됨.")
    const [korean, importCar, primary] = await Promise.all([
        fetch('/api/colors/korean').then(r => r.json()),
        fetch('/api/colors/import').then(r => r.json()),
        fetch('/api/colors/korean_primary').then(r => r.json())
    ]);
    const all = [];
    korean.forEach(c => all.push({
        ...c,
        type: '국산',
        display: `[국산] ${c.code} (${c.name})`,
        img: c.img_url || null,
        priceType: c.for_spray ? '카페인트' : '',
        price: null
    }));
    importCar.forEach(c => {
        if (!c.remarks_actual_code) return; // remarks_actual_code가 없으면 추가하지 않음
        all.push({
            ...c,
            type: '수입',
            code: c.remarks_actual_code,
            display: `[수입] ${c.remarks_actual_code} (${c.name})`,
            img: null,
            priceType: '카페인트 수입',
            price: null
        });
    });
    primary.forEach(c => all.push({
        ...c,
        type: '프라이머리',
        display: `[국산 원색] ${c.code} (${c.name})`,
        img: c.img_url || null,
        priceType: '카페인트 원색',
        price: null
    }));
    return all;
}

function filterModalColors(query) {
    query = query.trim().toLowerCase();
    if (!query) return [];
    return allModalColors.filter(c =>
        c.code.toLowerCase().includes(query) ||
        (c.name && c.name.toLowerCase().includes(query))
    );
}

function renderModalAutocompleteList(list) {
    const ul = document.getElementById('modal-autocomplete-list');
    ul.innerHTML = '';

    if (list.length === 0) {
        ul.style.display = 'none';
        return;
    }
    const seen = new Set(); // 중복 방지용
    list.forEach((item) => {
        // per이 'O'면 바탕/펄 두 줄로 분리 (제조사와 무관)
        if (item.per === 'O') {
            ['바탕', '펄'].forEach(type => {
                const key = `${item.code}_${type}_${item.color_korean || item.color_name || ''}`;
                if (seen.has(key)) return;
                seen.add(key);
                const li = document.createElement('li');
                li.className = 'autocomplete-item';
                const displayText = `[국산] ${item.code} ${type} (${item.color_korean || item.color_name || ''})`;
                li.textContent = displayText;
                li.onclick = () => selectModalColor({ ...item, type, display: displayText });
                ul.appendChild(li);
            });
        } else if (item.manufacturer && (item.manufacturer.includes('현대') || item.manufacturer.includes('기아') || item.manufacturer.includes('쌍용') || item.manufacturer.includes('르노') || item.manufacturer.includes('쉐보레'))) {
            // 국산차 일반
            const key = `${item.code}_${item.name}_${item.color_korean}`;
            if (seen.has(key)) return;
            seen.add(key);
            const li = document.createElement('li');
            li.className = 'autocomplete-item';
            li.textContent = item.display;
            li.onclick = () => selectModalColor(item);
            ul.appendChild(li);
        } else {
            // 수입차 일반
            const key = `${item.code}_${item.name}`;
            if (seen.has(key)) return;
            seen.add(key);
            const li = document.createElement('li');
            li.className = 'autocomplete-item';
            li.textContent = `[수입] ${item.code}(${item.color_name})`;
            li.onclick = () => selectModalColor(item);
            ul.appendChild(li);
        }
    });
    ul.style.display = 'block';
}

function selectModalColor(color) {
    selectedModalColor = color;
    document.getElementById('modal-color-autocomplete').value = color.display;
    // 자동완성 리스트를 닫지 않고, input에 포커스가 남아있으면 다시 표시
    setTimeout(() => {
        const input = document.getElementById('modal-color-autocomplete');
        if (document.activeElement === input) {
            const list = filterModalColors(input.value);
            renderModalAutocompleteList(list);
        } else {
            document.getElementById('modal-autocomplete-list').style.display = 'none';
        }
    }, 100);
    renderModalSelectedColorInfo(color);
}

async function renderModalSelectedColorInfo(color) {
    // 가격 정보 조회
    let price = color.price;
    if (!price && color.priceType) {
        try {
            const res = await fetch(`/api/price/${encodeURIComponent(color.priceType)}`);
            const data = await res.json();
            price = data.price;
        } catch {}
    }
    let html = '';
    if (color.img) {
        html += `<img src="${color.img}" class="color-img" alt="색상 이미지">`;
    }
    html += `<div><b>${color.name || ''}</b></div>`;
    html += `<div style="color:#3b82f6;font-weight:bold;">${color.priceType || ''}</div>`;
    if (price) {
        html += `<div style="color:green;font-size:20px;font-weight:bold;">${price.toLocaleString()}원</div>`;
    }
    document.getElementById('modal-selected-color-info').innerHTML = html;
    document.getElementById('modal-selected-color-info').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', async () => {
    allModalColors = await fetchAllModalColors();
    const input = document.getElementById('modal-color-autocomplete');
    if (input) {
        input.addEventListener('input', e => {
            const list = filterModalColors(e.target.value);
            renderModalAutocompleteList(list);
            document.getElementById('modal-selected-color-info').style.display = 'none';
        });
        input.addEventListener('focus', e => {
            let value = input.value.trim();
            let codeMatch = value.match(/\b([A-Z0-9]{2,})\b/);
            let searchTerm = codeMatch ? codeMatch[1] : value;
            const list = filterModalColors(searchTerm);
            renderModalAutocompleteList(list);
        });
        // 마우스를 올리면 자동완성 리스트 표시 (코드만 추출해서 검색)
        input.addEventListener('mouseenter', e => {
            let value = input.value.trim();
            let codeMatch = value.match(/\b([A-Z0-9]{2,})\b/);
            let searchTerm = codeMatch ? codeMatch[1] : value;
            const list = filterModalColors(searchTerm);
            renderModalAutocompleteList(list);
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('#modal-color-autocomplete') && !e.target.closest('#modal-autocomplete-list')) {
                document.getElementById('modal-autocomplete-list').style.display = 'none';
            }
        });
    }

    // 국산차 색상 불러오기
    fetch('/api/colors/korean')
        .then(res => res.json())
        .then(data => {
            koreanColorData = data.map(item => ({
                code: item.code || item.CarCode || item.Remarks_Actual_Code,
                name: item.name || item.Color_Name || '',
                manufacturer: item.manufacturer || item.Manufacturer || '',
                model: item.model || item.Model || '',
                image_url: item.img_url || item.ImgUrl || item.image_url || item['이미지 URL'] || '',
                color_korean: item.color_korean || item.Color_Korean || '',
            }));
        });

    // 수입차 색상 불러오기
    fetch('/api/colors/import')
        .then(res => res.json())
        .then(data => {
            importColorData = data.map(item => ({
                code: item.remarks_actual_code || item.code || item.BasicCode,
                name: item.name,
                color_name: item.Color_Name,
                model: item.model || item.Model,
                car_model: item.car_model || item.CarModel,
                standard: item.standard || item.Standard,
                product_name: item.product_name || item.ProductName,
                per: item.per
            }));
        });

    // 국산차 프라이머리 색상 불러오기
    fetch('/api/colors/korean_primary')
        .then(res => res.json())
        .then(data => {
            koreanPrimaryColorData = data.map(item => ({
                code: item.code || item.CarCode || item.Remarks_Actual_Code,
                name: item.name || item.Color_Name || '',
                manufacturer: item.manufacturer || item.Manufacturer || '',
                model: item.model || item.Model || '',
                image_url: item.img_url || item.ImgUrl || item.image_url || item['이미지 URL'] || '',
                color_korean: item.color_korean || item.Color_Korean || '',
                remarks_actual_code: item.remarks_actual_code || item.Remarks_Actual_Code || '',
            }));
        });

    fetch('/static/data/prices.json')
        .then(res => res.json())
        .then(data => {
            pricesData = data;
        });

    document.getElementById('open-product-modal-btn').addEventListener('click', openProductModal);
    renderSelectedProducts(); // Render any initial products (should be empty at start)
});

// 로그인 유효성 검사 js
function handleLogin(e) {
    e.preventDefault();
    const name = document.getElementById("name").value.trim();
    const phoneInput = document.getElementById("phone");
    let phone = phoneInput.value.trim();
    const password = document.getElementById("password").value.trim();

    // 숫자만 입력되도록 강제 (한글, 영어, 특수문자 제거)
    phone = phone.replace(/[^0-9]/g, '');
    phoneInput.value = phone;

    // 11자리(01012345678) 형식 체크
    if (!/^\d{11}$/.test(phone)) {
        alert("전화번호는 01012345678 형식의 11자리 숫자만 입력 가능합니다.");
        phoneInput.focus();
        return;
    }

    if (phone && password) {
        // 서버에 로그인 요청
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telephone: phone, password: password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                document.getElementById("login-screen").classList.add("hidden");
                document.getElementById("order-step1").classList.remove("hidden");
                // 배송주소 페이지에 이름, 전화번호 자동 입력
                document.getElementById("receiver").value = data.name || name;
                document.getElementById("contact").value = phone;
            } else {
                alert(data.message || '로그인에 실패했습니다.');
            }
        })
        .catch(() => {
            alert('서버 오류로 로그인에 실패했습니다.');
        });
    } else {
        alert("전화번호와 비밀번호를 모두 입력해주세요.");
    }
}

// --- Modal Functions ---
function openProductModal() {
    document.getElementById('product-modal').classList.remove('hidden');
    resetModalFields();
    renderModalCartList();
}

function closeProductModal() {
    // 1. modalCart(장바구니) 제품들을 orderedProducts에 반영 (요청사항 제외)
    orderedProducts = modalCart.filter(item => item.type !== '요청사항').map(item => {
        if (item.type === '정기주문') {
            return {
                type: '정기주문',
                name: item.name,
                quantity: item.qty,
                total_price: getRegularPrice(item.name) * item.qty
            };
        } else if (item.type === '색상코드') {
            return {
                type: '색상코드',
                name: item.name,
                color: item.color,
                quantity: item.qty,
                total_price: getColorPrice(item.color) * item.qty
            };
        }
        return null;
    }).filter(Boolean);
    // 2. 요청사항 입력란에 값이 있으면 orderedProducts에 type이 '요청사항'인 항목 추가/갱신
    const memoInput = document.getElementById('modal-memo-input');
    const memo = memoInput.value.trim();
    if (memo) {
        let found = false;
        for (let i = 0; i < orderedProducts.length; i++) {
            if (orderedProducts[i].type === '요청사항') {
                orderedProducts[i].memo = memo;
                found = true;
                break;
            }
        }
        if (!found) {
            orderedProducts.push({ type: '요청사항', memo });
        }
        memoInput.value = '';
    }
    document.getElementById('product-modal').classList.add('hidden');
    renderSelectedProducts();
}

function resetModalFields() {
    document.getElementById('modal-color-search-input').value = '';
    renderColorDropdown();
    document.getElementById('modal-color-select').disabled = false;
    document.getElementById('modal-color-info').style.display = 'none';
    document.getElementById('regular-price-info').style.display = 'none';
    document.getElementById('modal-quantity-input').value = '1';
    document.getElementById('modal-memo-input').value = '';
    document.getElementById('modal-regular-dropdown').value = '';
    currentModalProduct = {}; // Clear current product in modal
    calculateModalPrice(); // Reset modal price display
    renderModalCartList();
}

function renderColorDropdown(searchTerm = '') {
    console.log("main.js 에서 실행됨.")
    const colorSelect = document.getElementById('modal-color-select');
    colorSelect.innerHTML = '<option value="">색상 코드를 선택하세요</option>';

    // 국산차 (기존 + 프라이머리)
    if (koreanColorData.length > 0 || koreanPrimaryColorData.length > 0) {
        const groupK = document.createElement('optgroup');
        groupK.label = '국산차';
        // 국산차: (바탕), (펄) 등으로 구분된 항목은 각각 따로 표시
        const seen = new Set();
        [...koreanColorData, ...koreanPrimaryColorData].forEach(item => {
            if (
                !searchTerm ||
                (item.code && item.code.toLowerCase().includes(searchTerm)) ||
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.color_korean && item.color_korean.toLowerCase().includes(searchTerm)) ||
                (item.remarks_actual_code && item.remarks_actual_code.toLowerCase().includes(searchTerm))
            ) {
                let name = item.code;
                let displayName = item.name || '';
                // per이 'O'면 바탕/펄 두 줄로 분리
                if (item.per === 'O') {
                    ['바탕', '펄'].forEach(type => {
                        const key = `${item.code}_${type}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            const opt = document.createElement('option');
                            opt.value = item.code + '_' + type;
                            opt.textContent = `[국산] ${item.code} ${type} (${item.color_korean || ''})`;
                            groupK.appendChild(opt);
                        }
                    });
                } else if (displayName.includes('바탕') || displayName.includes('펄')) {
                    displayName.split(',').forEach(part => {
                        const trimmed = part.trim();
                        if (trimmed) {
                            const key = `${item.code}_${trimmed}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                const opt = document.createElement('option');
                                opt.value = item.code + '_' + trimmed;
                                opt.textContent = `[국산] ${item.code} (${trimmed})`;
                                groupK.appendChild(opt);
                            }
                        }
                    });
                } else {
                    const key = `${item.code}_${displayName}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        const opt = document.createElement('option');
                        opt.value = item.code;
                        let label = item.code;
                        if (displayName && displayName !== '-') {
                            label += ` (${displayName})`;
                        }
                        opt.textContent = `[국산] ${label}`;
                        groupK.appendChild(opt);
                    }
                }
            }
        });
        if (groupK.children.length > 0) colorSelect.appendChild(groupK);
    }

    // 수입차 (기존)
    if (importColorData.length > 0) {
        const groupI = document.createElement('optgroup');
        groupI.label = '수입차';
        importColorData.forEach(item => {
            if (
                !searchTerm ||
                (item.code && item.code.toLowerCase().includes(searchTerm)) ||
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.remarks_actual_code && item.remarks_actual_code.toLowerCase().includes(searchTerm))
            ) {
                const opt = document.createElement('option');
                opt.value = item.code;
                let name = item.code;
                if (item.name && item.name !== "-") {
                    name += ` (${item.name})`;
                }
                opt.textContent = `[수입] ${name}`;
                groupI.appendChild(opt);
            }
        });
        if (groupI.children.length > 0) colorSelect.appendChild(groupI);
    }

    colorSelect.disabled = false;
}

function onModalColorChange() {
    const codeValue = document.getElementById('modal-color-select').value;
    const colorSelectElement = document.getElementById('modal-color-select');
    const selectedOptionText = colorSelectElement.options[colorSelectElement.selectedIndex].textContent;

    // 코드와 옵션(바탕, 펄 등) 분리
    let code = codeValue;
    let optionPart = '';
    if (codeValue.includes('_')) {
        const idx = codeValue.lastIndexOf('_');
        code = codeValue.substring(0, idx);
        optionPart = codeValue.substring(idx + 1);
    }

    // info 찾기: 코드와 옵션(바탕, 펄 등)까지 일치하는 항목 우선, 없으면 코드만 일치하는 항목 fallback
    let info =
        koreanColorData.find(item => item.code === code && (!optionPart || (item.name && item.name.includes(optionPart)))) ||
        koreanPrimaryColorData.find(item => item.code === code && (!optionPart || (item.name && item.name.includes(optionPart)))) ||
        koreanColorData.find(item => item.code === code) ||
        koreanPrimaryColorData.find(item => item.code === code) ||
        importColorData.find(item => item.code === code);

    const colorInfoDisplay = document.getElementById('modal-color-info');
    const regularPriceInfo = document.getElementById('regular-price-info');

    if (!info) {
        colorInfoDisplay.style.display = 'none';
        calculateModalPrice();
        return;
    }

    // 이미지가 없으면 alt 텍스트 표시 및 encodeURI 적용
    const imgElem = document.getElementById('modal-color-img');
    if (info.image_url) {
        imgElem.src = encodeURI(info.image_url);
        imgElem.style.display = '';
    } else {
        imgElem.src = '';
        imgElem.style.display = 'none';
    }
    // 이름: 옵션이 있으면 이름에 옵션 붙이기
    let displayName = info.name || info.color_korean || code;
    if (optionPart && !displayName.includes(optionPart)) {
        displayName += ` (${optionPart})`;
    }
    imgElem.alt = displayName;
    document.getElementById('modal-color-name').textContent = displayName;

    let paintType, price;
    if (selectedOptionText.startsWith('[국산P]')) {
        paintType = '카페인트 원색';
        price = 23000;
    } else {
        paintType = BASIC_KEYWORDS.some(k => (info.name || '').includes(k)) ? '카페인트' : '카페인트 원색';
        price = paintType === '카페인트' ? BASIC_PRICE : SPECIAL_PRICE;
    }

    document.getElementById('modal-paint-type').textContent = paintType;
    document.getElementById('modal-paint-price').textContent = price.toLocaleString() + '원';
    colorInfoDisplay.style.display = 'block';
    regularPriceInfo.style.display = 'none';

    currentModalProduct = {
        maker: info.manufacturer,
        code: codeValue, // 실제 value 그대로 저장
        color_name: displayName,
        full_name: selectedOptionText,
        color_img: info.image_url,
        paint_type: paintType,
        unit_price: price,
        quantity: parseInt(document.getElementById('modal-quantity-input').value) || 1,
    };
    
    calculateModalPrice();

    document.getElementById('modal-regular-dropdown').value = '';
}

function onRegularDropdownChange() {
    const dropdown = document.getElementById('modal-regular-dropdown');
    const selected = dropdown.value;
    const priceInfoDiv = document.getElementById('regular-price-info');
    const priceElem = document.getElementById('regular-paint-price');
    const colorInfoDisplay = document.getElementById('modal-color-info');

    if (!selected) {
        priceElem.textContent = '';
        priceInfoDiv.style.display = 'none';
        currentModalProduct = {};
        calculateModalPrice();
        return;
    }
    
    const price = pricesData[selected] || 0;
    priceElem.innerHTML = `<div>${selected}</div><div>${price ? price.toLocaleString() + '원' : '가격 정보 없음'}</div>`;
    priceInfoDiv.style.display = 'block';
    colorInfoDisplay.style.display = 'none';

    currentModalProduct = {
        maker: '',
        code: selected,
        color_name: selected,
        full_name: dropdown.options[dropdown.selectedIndex].textContent,
        color_img: '',
        paint_type: selected,
        unit_price: price,
        quantity: parseInt(document.getElementById('modal-quantity-input').value) || 1,
    };
    
    calculateModalPrice();

    document.getElementById('modal-color-search-input').value = '';
    document.getElementById('modal-color-select').innerHTML = '<option value="">색상 코드를 선택하세요</option>';
    document.getElementById('modal-color-select').disabled = true;
}

function calculateModalPrice() {
    const quantity = parseInt(document.getElementById('modal-quantity-input').value) || 0;
    currentModalProduct.quantity = quantity;

    if (currentModalProduct.unit_price && quantity > 0) {
        currentModalProduct.total_price = currentModalProduct.unit_price * quantity;
    } else {
        currentModalProduct.total_price = 0;
    }
}

function addProductToOrder(keepModalOpen) {
    // 정기주문 옵션만 선택한 경우도 허용
    const regularDropdown = document.getElementById('modal-regular-dropdown');
    const selectedRegular = regularDropdown.value;
    const colorSelect = document.getElementById('modal-color-select');
    const selectedColor = colorSelect.value;
    const quantity = parseInt(document.getElementById('modal-quantity-input').value) || 0;

    if (!selectedRegular && !selectedColor) {
        alert("정기주문 품목 또는 색상 코드를 선택해주세요.");
        return;
    }
    if (quantity <= 0) {
        alert("수량을 입력해주세요.");
        return;
    }

    currentModalProduct.memo = document.getElementById('modal-memo-input').value;
    orderedProducts.push({ ...currentModalProduct }); // Add a copy to the array
    renderSelectedProducts();
    calculateTotalPrice();
    if (!keepModalOpen) {
        closeProductModal();
    } else {
        resetModalFields(); // 입력란만 초기화, 모달은 닫지 않음
    }
    renderModalCartList();
}

// --- Main Page Functions ---
function renderSelectedProducts() {
    const container = document.getElementById('selected-products-container');
    container.innerHTML = '';

    if (orderedProducts.length === 0) {
        container.innerHTML = '';
        return;
    }

    // 제품과 요청사항을 분리해서 렌더링
    let hasProduct = false;
    let requestMemo = null;
    orderedProducts.forEach((product, index) => {
        if (product.type === '요청사항') {
            requestMemo = product.memo;
        } else {
            hasProduct = true;
            const productDiv = document.createElement('div');
            productDiv.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
            productDiv.innerHTML = `
                <div style="flex-grow: 1;">
                    <strong>${product.full_name || product.color_name || product.name}</strong> - ${product.quantity || product.qty}개 <span class="text-muted">(${product.total_price ? product.total_price.toLocaleString() : '0'}원)</span>
                </div>
                <button type="button" class="remove-btn main-remove-btn" data-index="${index}">삭제</button>
            `;
            productDiv.querySelector('.remove-btn').addEventListener('click', (e) => {
                removeProductFromOrder(parseInt(e.target.dataset.index));
            });
            container.appendChild(productDiv);
        }
    });
    // 요청사항은 제품 아래에 별도 블록으로 표시
    if (requestMemo) {
        const reqDiv = document.createElement('div');
        reqDiv.classList.add('list-group-item');
        reqDiv.style.marginTop = '8px';
        reqDiv.innerHTML = `<strong style="color:#1976d2;">[요청사항]</strong> <span>${requestMemo}</span>`;
        container.appendChild(reqDiv);
    }
}

function removeProductFromOrder(index) {
    orderedProducts.splice(index, 1);
    renderSelectedProducts();
    calculateTotalPrice();
}

function calculateTotalPrice() {
    let overallTotalPrice = 0;
    orderedProducts.forEach(product => {
        overallTotalPrice += product.total_price || 0;
    });

    const priceDisplay = document.getElementById('price-display');
    const totalPriceElement = document.getElementById('total-price');
    const finalPriceElement = document.getElementById('final-price'); // Assuming this exists on step2

    if (overallTotalPrice > 0) {
        priceDisplay.style.display = 'block';
        totalPriceElement.textContent = `${overallTotalPrice.toLocaleString()}원`;
        if (finalPriceElement) {
            finalPriceElement.textContent = `${overallTotalPrice.toLocaleString()}원`;
        }
    } else {
        priceDisplay.style.display = 'none';
        totalPriceElement.textContent = `0원`;
        if (finalPriceElement) {
            finalPriceElement.textContent = `0원`;
        }
    }
}

function showAddressForm(e) {
    e.preventDefault();

    if (orderedProducts.length === 0) {
        alert("주문할 제품을 추가해주세요.");
        return;
    }

    // carOrderData will now be the orderedProducts array
    // This global variable will be passed to submitOrder

    document.getElementById("order-step1").classList.add("hidden");
    document.getElementById("order-step2").classList.remove("hidden");
    calculateTotalPrice(); // Ensure final price is updated on step2
}

// ✅ 최종 주문 접수 후, /admin에 저장하는 js
function submitOrder(e) {
    e.preventDefault();

    const paymentMethod = document.querySelector('input[name="payment"]:checked');
    if (!paymentMethod) {
        alert('결제 방법을 선택해주세요.');
        return;
    }

    const addressData = {
        receiver: document.getElementById('receiver').value,
        contact: document.getElementById('contact').value,
        address: document.getElementById('address').value,
        payment_method: paymentMethod.value,
        delivery_method: document.getElementById('delivery-method').value
    };

    const customerData = {
        customer_name: document.getElementById('name').value,
        customer_phone: document.getElementById('phone').value
    };

    // Combine all data: multiple products array, address, and customer info
    const formData = {
        products: orderedProducts, // This is the array of product objects
        ...addressData,
        ...customerData
    };

    // ✅ 실제로 서버로 전송되는 데이터 콘솔 출력
    console.log('submitOrder formData:', formData);

    fetch("/submit", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(formData),
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success") {
            // 주문 상세 페이지로 이동
            window.location.href = `/order_result?order_id=${data.order_id}`;
        } else {
            alert("주문 접수 중 오류가 발생했습니다.");
        }
    })
    .catch(err => {
        alert("주문 접수 중 오류가 발생했습니다.");
        console.error(err);
    });
}

function goBackToOrder() {
    document.getElementById("order-step2").classList.add("hidden");
    document.getElementById("order-step1").classList.remove("hidden");
    // Ensure total price is updated correctly when returning
    calculateTotalPrice();
}

function goBackToLogin() {
    document.getElementById("order-step1").classList.add("hidden");
    document.getElementById("login-screen").classList.remove("hidden");
}

function renderModalCartList() {
    const modalCartList = document.getElementById('modal-cart-list');
    modalCartList.innerHTML = '';

    if (orderedProducts.length === 0) {
        modalCartList.innerHTML = '<li class="list-group-item">장바구니가 비어 있습니다.</li>';
        return;
    }

    orderedProducts.forEach((product, idx) => {
        const li = document.createElement('li');
        li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
        li.innerHTML = `
            <div>
                <strong>${product.full_name || product.color_name}</strong> - ${product.quantity}개 <span class="text-muted">(${product.total_price ? product.total_price.toLocaleString() : '0'}원)</span>
            </div>
            <button type="button" class="btn btn-danger btn-sm remove-from-cart-btn" data-idx="${idx}" style="font-size: 0.7rem; padding: 0.1rem 0.3rem;">삭제</button>
        `;
        modalCartList.appendChild(li);
    });

    // Attach event listeners for remove buttons
    document.querySelectorAll('.remove-from-cart-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            removeProductFromModalCart(parseInt(e.target.dataset.idx));
        });
    });
}

function removeProductFromModalCart(idx) {
    orderedProducts.splice(idx, 1);
    renderModalCartList();
    renderSelectedProducts(); // Update main page cart
    calculateTotalPrice(); // Recalculate total price
}

// 장바구니 데이터
let modalCart = [];

function addRegularToCart() {
    const item = document.getElementById('regular-item-select').value;
    const qty = parseInt(document.getElementById('regular-qty').value, 10);
    const memo = document.getElementById('modal-memo-input').value;
    if (!item) {
        alert('정기주문 품목을 선택하세요.');
        return;
    }
    if (qty < 1) {
        alert('수량을 1 이상 입력하세요.');
        return;
    }
    modalCart.push({
        type: '정기주문',
        name: item,
        qty: qty,
        memo: memo
    });
    renderModalCartList();

    // ✅ 입력값 초기화
    document.getElementById('regular-item-select').value = '';
    document.getElementById('regular-qty').value = '1';
}

function addColorToCart() {
    if (!selectedModalColor) {
        alert('색상 코드를 선택하세요.');
        return;
    }
    const qty = parseInt(document.getElementById('color-qty').value, 10);
    const memo = document.getElementById('modal-memo-input').value;
    if (qty < 1) {
        alert('수량을 1 이상 입력하세요.');
        return;
    }
    modalCart.push({
        type: '색상코드',
        name: selectedModalColor.display,
        qty: qty,
        color: selectedModalColor,
        memo: memo
    });
    renderModalCartList();
    selectedModalColor = null;

    // ✅ input 박스 초기화
    document.getElementById('modal-color-autocomplete').value = '';
    // 선택된 색상 정보 영역도 숨기기
    document.getElementById('modal-selected-color-info').style.display = 'none';
}

function addMemoToCart() {
    const memoInput = document.getElementById('modal-memo-input');
    const memo = memoInput.value.trim();
    if (!memo) {
        alert('요청사항을 입력하세요.');
        return;
    }
    // orderedProducts에 type이 '요청사항'인 항목이 있으면 덮어쓰기, 없으면 추가
    let found = false;
    for (let i = 0; i < orderedProducts.length; i++) {
        if (orderedProducts[i].type === '요청사항') {
            orderedProducts[i].memo = memo;
            found = true;
            break;
        }
    }
    if (!found) {
        orderedProducts.push({ type: '요청사항', memo });
    }
    memoInput.value = '';
    alert('요청사항이 저장되었습니다.\n주문 제출 시 관리자에게 전달됩니다.');
    renderSelectedProducts();
}

function renderModalCartList() {
    const listDiv = document.getElementById('modal-cart-list');
    if (!modalCart.length) {
        listDiv.innerHTML = '<div style="color:#888;">장바구니가 비어 있습니다.</div>';
        return;
    }
    listDiv.innerHTML = modalCart.map((item, idx) => {
        if (item.type === '정기주문') {
            return `<div class="selected-product-item">[정기주문] ${item.name} x ${item.qty} <button class="remove-btn" onclick="removeFromModalCart(${idx})">삭제</button></div>`;
        } else if (item.type === '색상코드') {
            return `<div class="selected-product-item">[색상코드] ${item.name} x ${item.qty} <button class="remove-btn" onclick="removeFromModalCart(${idx})">삭제</button></div>`;
        } else if (item.type === '요청사항') {
            return `<div class="selected-product-item">[요청사항] ${item.memo} <button class="remove-btn" onclick="removeFromModalCart(${idx})">삭제</button></div>`;
        }
    }).join('');
}

function removeFromModalCart(idx) {
    modalCart.splice(idx, 1);
    renderModalCartList();
}

// 정기주문 품목 가격 반환
function getRegularPrice(name) {
    // pricesData는 이미 로드되어 있다고 가정
    return pricesData[name] || 0;
}
// 색상코드 품목 가격 반환
function getColorPrice(colorObj) {
    // colorObj.priceType을 기준으로 가격 조회
    if (!colorObj || !colorObj.priceType) return 0;
    return pricesData[colorObj.priceType] || 0;
}
