from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import json
from datetime import datetime
import os
from google_sheets_sync import sync_orders_to_sheet
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# MariaDB 연동 설정 (환경에 맞게 수정하세요)
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://egenauto:Ea%40%2146941808@182.227.119.34:3306/CarCodeOrderForm'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# 국산차 테이블 모델
class KoreanCar(db.Model):
    __tablename__ = 'Korean_Base_CarColor'
    id = db.Column(db.Integer, primary_key=True)
    CarCode = db.Column(db.String(1000))
    ImgUrl = db.Column(db.String(1000))
    Manufacturer = db.Column(db.String(1000))
    ProductNumber = db.Column(db.String(1000))
    Color_English = db.Column(db.String(1000))
    Color_Korean = db.Column(db.String(1000))
    ForSpray = db.Column(db.String(1000))
    ForBrushPen = db.Column(db.String(1000))
    CoatPearlType = db.Column(db.String(1000))
    EgenCarPaint = db.Column(db.String(1000))
    Model = db.Column(db.String(1000))
    Remarks_Actual_Code = db.Column(db.String(1000))
    Color_Name = db.Column(db.String(1000))
    Per = db.Column(db.String(1000))

# 수입차 테이블 모델
class ImporCar(db.Model):
    __tablename__ = 'Impor_Base_CarColor'
    id = db.Column(db.Integer, primary_key=True)
    BasicCode = db.Column(db.String(1000))
    ProductName = db.Column(db.String(1000))
    Remarks_Actual_Code = db.Column(db.String(1000))
    Model = db.Column(db.String(1000))
    Color_Name = db.Column(db.String(1000))
    Standard = db.Column(db.String(1000))
    CarModel = db.Column(db.String(1000))
    Per = db.Column(db.String(1000))

# 국산차 프라이머리 테이블 모델
class KoreanPrimaryCar(db.Model):
    __tablename__ = 'Korean_Primary_CarColor'
    id = db.Column(db.Integer, primary_key=True)
    CarCode = db.Column(db.String(1000))
    ImgUrl = db.Column(db.String(1000))
    Manufacturer = db.Column(db.String(1000))
    ProductNumber = db.Column(db.String(1000))
    Color_English = db.Column(db.String(1000))
    Color_Korean = db.Column(db.String(1000))
    ForSpray = db.Column(db.String(1000))
    ForBrushPen = db.Column(db.String(1000))
    CoatPearlType = db.Column(db.String(1000))
    EgenCarPaint = db.Column(db.String(1000))
    Model = db.Column(db.String(1000))
    Remarks_Actual_Code = db.Column(db.String(1000))
    Color_Name = db.Column(db.String(1000))
    Per = db.Column(db.String(1000))

# 주문 데이터를 저장할 파일
ORDERS_FILE = 'orders.json'
# 가격 데이터를 저장할 파일
PRICES_FILE = 'prices.json'

# 구글 시트 기반 기본 가격 데이터
DEFAULT_PRICES = {
    "카페인트": 18000,
    "카페인트 원색": 23000,
    "카페인트 수입": 23000,
    "카페인트 수입 원색": 28000,
    "투명": 16000,
    "서페": 12000,
    "서페 흰색": 14000,
    "서페 블랙": 14000,
    "블랜딩": 12000,
    "공캔": 4500,
    "헤드라이트복원제": 15000,
    "PP프라이머": 12000,
    "금속프라이머": 14000,
    "NAS500": 10000,
    "일신": 8000
}

class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(100))
    customer_phone = db.Column(db.String(100))
    code = db.Column(db.String(100))
    quantity = db.Column(db.Integer)
    option = db.Column(db.String(100))
    memo = db.Column(db.String(200))
    receiver = db.Column(db.String(100))
    contact = db.Column(db.String(100))
    address = db.Column(db.String(200))
    status = db.Column(db.String(50))
    created_at = db.Column(db.String(50))
    updated_at = db.Column(db.String(50))
    unit_price = db.Column(db.Integer)
    total_price = db.Column(db.Integer)
    payment_method = db.Column(db.String(50))
    payment_status = db.Column(db.String(50))
    overall_total_price = db.Column(db.Integer)
    # products 등 추가 필드는 실제 DB 구조에 맞게 추가

def load_orders():
    """주문 데이터 로드 (orders.json에서 읽기)"""
    if os.path.exists(ORDERS_FILE):
        with open(ORDERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_orders(orders):
    """주문 데이터 저장"""
    with open(ORDERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(orders, f, ensure_ascii=False, indent=2)

def load_prices():
    """가격 데이터 로드 - 기본값이 없으면 구글 시트 데이터로 초기화"""
    if os.path.exists(PRICES_FILE):
        with open(PRICES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    else:
        # 기본 가격 데이터로 초기화
        save_prices(DEFAULT_PRICES)
        return DEFAULT_PRICES

def save_prices(prices):
    """가격 데이터 저장"""
    with open(PRICES_FILE, 'w', encoding='utf-8') as f:
        json.dump(prices, f, ensure_ascii=False, indent=2)

def get_price(code):
    """자동차 코드별 가격 조회"""
    prices = load_prices()
    return prices.get(code, 0)

# ✅ ==================================== route 부분 ==================================== ✅
# 맨처음 시작
@app.route('/')
def home():
    return render_template('index.html')

# admin 주문내역 페이지
@app.route('/admin')
def admin():
    """관리자 주문 확인 페이지"""
    orders = update_old_orders()  # 기존 데이터 업데이트
    # 월 리스트 생성 (YYYY-MM)
    month_set = set()
    for order in orders:
        if 'created_at' in order:
            month_set.add(order['created_at'][:7])
    months = sorted(list(month_set), reverse=True)
    return render_template('admin/admin.html', orders=orders, months=months)

# admin 가격정보 페이지
@app.route('/admin/prices')
def admin_prices():
    """가격 관리 페이지"""
    prices = load_prices()
    return render_template('admin/admin_prices.html', prices=prices)

@app.route('/admin/prices', methods=['POST'])
def update_prices():
    """가격 업데이트"""
    data = request.json
    prices = load_prices()
    prices.update(data)
    save_prices(prices)
    return jsonify({"success": True})

@app.route('/admin/prices/reset', methods=['POST'])
def reset_prices():
    """구글 시트 기준으로 가격 초기화"""
    save_prices(DEFAULT_PRICES)
    return jsonify({"success": True})

@app.route('/api/price/<code>')
def get_price_api(code):
    """가격 조회 API"""
    price = get_price(code)
    return jsonify({"code": code, "price": price})

@app.route('/api/prices')
def get_all_prices_api():
    """모든 가격 조회 API"""
    prices = load_prices()
    return jsonify(prices)

# admin 주문내역 상세정보 페이지
@app.route('/admin/order/<int:order_id>')
def order_detail(order_id):
    """주문 상세 보기"""
    orders = update_old_orders()  # 기존 데이터 업데이트
    if 0 <= order_id < len(orders):
        return render_template('admin/order_detail.html', order=orders[order_id], order_id=order_id)
    return "주문을 찾을 수 없습니다.", 404

@app.route('/admin/order/<int:order_id>/status', methods=['POST'])
def update_order_status(order_id):
    """주문 상태 업데이트"""
    orders = update_old_orders()  # 기존 데이터 업데이트
    if 0 <= order_id < len(orders):
        new_status = request.json.get('status')
        orders[order_id]['status'] = new_status
        orders[order_id]['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        save_orders(orders)
        
        # 구글 시트에 동기화
        try:
            sync_orders_to_sheet(orders)
            print("주문 상태 업데이트 후 구글 시트 동기화 완료")
        except Exception as e:
            print(f"구글 시트 동기화 실패: {e}")
        
        return jsonify({"success": True})
    return jsonify({"success": False}), 404

# ✅ 최종주문 접수 내역 -> /admin에 저장 + 구글시트 동기화
@app.route('/submit', methods=['POST'])
def submit():
    data = request.json
    products = data.get('products', [])  # products 배열을 받음
    
    overall_total_price = 0
    # 각 제품의 총 가격을 합산
    for product in products:
        price = product.get('total_price', 0)
        if price is None:
            price = 0
        overall_total_price += price
    
    # 주문 ID와 시간 추가
    orders = load_orders()
    order_data = {
        'id': len(orders),
        'customer_name': data.get('customer_name', ''),
        'customer_phone': data.get('customer_phone', ''),
        'products': products,  # 제품 배열을 직접 저장
        'overall_total_price': overall_total_price, # 전체 주문의 총 금액
        'receiver': data.get('receiver', ''),
        'contact': data.get('contact', ''),
        'address': data.get('address', ''),
        'payment_method': data.get('payment_method', ''),
        'delivery_method': data.get('delivery_method', ''),
        'payment_status': '미결제',
        'status': '신규주문',
        'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'updated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    
    orders.append(order_data)
    save_orders(orders)
    
    # 구글 시트에 동기화
    try:
        sync_orders_to_sheet(orders)
        print("구글 시트 동기화 완료")
    except Exception as e:
        print(f"구글 시트 동기화 실패: {e}")
    
    print("받은 주문 정보:", order_data)
    return jsonify({
        "status": "success", 
        "message": f"총 금액은 {overall_total_price:,}원으로 예상되며 정확한 금액은 문자로 발송하겠습니다.",
        "order_id": order_data['id'],
        "total_price": overall_total_price
    })

def update_old_orders():
    """기존 주문 데이터를 새로운 형식으로 업데이트 (products 배열 도입)"""
    orders = load_orders()
    updated = False
    
    for order in orders:
        # 기존 단일 제품 주문 형식을 products 배열로 변환
        if 'products' not in order:
            single_product_data = {
                'maker': order.get('maker', ''), # 기존 maker 정보 사용 (만약 있었다면)
                'code': order.get('code', ''),
                'color_name': order.get('color_name', ''),
                'color_img': order.get('color_img', ''),
                'paint_type': order.get('paint_type', ''),
                'unit_price': order.get('unit_price', get_price(order.get('code', ''))),
                'quantity': int(order.get('quantity', 1)),
                'total_price': order.get('total_price', 0),
                'option': order.get('option', ''),
                'memo': order.get('memo', '')
            }
            # unit_price와 total_price가 누락된 경우 다시 계산
            if not single_product_data['unit_price']:
                 single_product_data['unit_price'] = get_price(single_product_data.get('code', ''))
            if not single_product_data['total_price']:
                single_product_data['total_price'] = single_product_data['unit_price'] * single_product_data['quantity']
            
            order['products'] = [single_product_data]
            order['overall_total_price'] = single_product_data['total_price'] # 전체 금액도 업데이트
            updated = True
        
        # payment_method가 없으면 기본값 설정 (products 배열 도입 전에도 필요)
        if 'payment_method' not in order:
            order['payment_method'] = ''
            updated = True
        
        # payment_status가 없으면 기본값 설정 (products 배열 도입 전에도 필요)
        if 'payment_status' not in order:
            order['payment_status'] = '미결제'
            updated = True
            
        # overall_total_price가 없거나 0인 경우 다시 계산
        if 'overall_total_price' not in order or order['overall_total_price'] == 0:
            current_overall_total = 0
            for product in order['products']:
                current_overall_total += product.get('total_price', 0)
            order['overall_total_price'] = current_overall_total
            updated = True
    
    if updated:
        save_orders(orders)
    
    return orders

# ✅ 구글 시트 동기화 route
@app.route('/admin/sync-sheet', methods=['POST'])
def sync_to_sheet():
    """관리자 페이지에서 수동으로 구글 시트 동기화"""
    try:
        orders = update_old_orders()  # 기존 데이터 업데이트
        success = sync_orders_to_sheet(orders)
        if success:
            return jsonify({"success": True, "message": "구글 시트 동기화가 완료되었습니다."})
        else:
            return jsonify({"success": False, "message": "구글 시트 동기화에 실패했습니다."})
    except Exception as e:
        return jsonify({"success": False, "message": f"동기화 중 오류가 발생했습니다: {str(e)}"})

@app.route('/api/colors/korean')
def get_korean_colors():
    cars = KoreanCar.query.all()
    result = []
    for car in cars:
        color_names = car.Color_Name.split(',') if car.Color_Name else ['']
        for color_name in color_names:
            result.append({
                "id": car.id,
                "code": car.CarCode,
                "name": color_name.strip(),
                "manufacturer": car.Manufacturer,
                "model": car.Model,
                "color_korean": car.Color_Korean,
                "img_url": car.ImgUrl,
                "product_number": car.ProductNumber,
                "color_english": car.Color_English,
                "for_spray": car.ForSpray,
                "for_brush_pen": car.ForBrushPen,
                "coat_pearl_type": car.CoatPearlType,
                "egen_car_paint": car.EgenCarPaint,
                "remarks_actual_code": car.Remarks_Actual_Code,
                "per": car.Per
            })
    return jsonify(result)

@app.route('/api/colors/import')
def get_import_colors():
    cars = ImporCar.query.all()
    result = []
    for car in cars:
        color_names = car.Color_Name.split(',') if car.Color_Name else ['']
        for color_name in color_names:
            result.append({
                "id": car.id,
                "code": car.BasicCode,  # 대표코드
                "remarks_actual_code": car.Remarks_Actual_Code,
                "name": color_name.strip(),
                "model": car.Model,
                "car_model": car.CarModel,
                "standard": car.Standard,
                "product_name": car.ProductName,
                "per": car.Per
            })
    return jsonify(result)

@app.route('/api/colors/korean_primary')
def get_korean_primary_carcolor():
    cars = KoreanPrimaryCar.query.all()
    result = []
    for car in cars:
        color_names = car.Color_Name.split(',') if car.Color_Name else ['']
        for color_name in color_names:
            result.append({
                "id": car.id,
                "code": car.CarCode,
                "name": color_name.strip(),
                "manufacturer": car.Manufacturer,
                "model": car.Model,
                "color_korean": car.Color_Korean,
                "img_url": car.ImgUrl,
                "product_number": car.ProductNumber,
                "color_english": car.Color_English,
                "for_spray": car.ForSpray,
                "for_brush_pen": car.ForBrushPen,
                "coat_pearl_type": car.CoatPearlType,
                "egen_car_paint": car.EgenCarPaint,
                "remarks_actual_code": car.Remarks_Actual_Code,
                "per": car.Per
            })
    return jsonify(result)

@app.route('/color_autocomplete')
def color_autocomplete():
    return render_template('color_autocomplete.html')

@app.route('/myorders')
def myorders():
    """
    로그인된 고객의 주문 내역 페이지
    이름과 전화번호를 쿼리 파라미터로 받아 해당 고객의 주문만 보여줌
    """
    name = request.args.get('name', '')
    phone = request.args.get('phone', '')
    orders = load_orders()
    my_orders = [o for o in orders if o.get('customer_name') == name and o.get('customer_phone') == phone]
    return render_template('my_orders.html', orders=my_orders, name=name, phone=phone)

@app.route('/api/myorders')
def api_myorders():
    """
    이름과 전화번호로 주문 내역을 JSON으로 반환
    """
    name = request.args.get('name', '')
    phone = request.args.get('phone', '')
    orders = load_orders()
    my_orders = [o for o in orders if o.get('customer_name') == name and o.get('customer_phone') == phone]
    return jsonify(my_orders)

@app.route('/order_result')
def order_result():
    order_id = request.args.get('order_id', type=int)
    orders = load_orders()
    order = next((o for o in orders if o.get('id') == order_id), None)
    if not order:
        return '주문을 찾을 수 없습니다.', 404
    return render_template('order_result.html', order=order)

# ✅ 사용자 로그인 API
from flask import request, jsonify

class User(db.Model):
    __tablename__ = 'USER'
    telephone = db.Column(db.String(20), primary_key=True)
    pw = db.Column(db.String(100))
    NAME = db.Column(db.String(100))

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    telephone = data.get('telephone', '').strip()
    pw = data.get('password', '').strip()
    user = User.query.filter_by(telephone=telephone, pw=pw).first()
    if user:
        return jsonify({'status': 'success', 'name': user.NAME})
    else:
        return jsonify({'status': 'fail', 'message': '존재하지 않는 아이디 입니다.'}), 401

if __name__ == '__main__':
    app.run(host="0.0.0.0", debug=True, port=8081)
