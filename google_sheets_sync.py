import os
import json
from datetime import datetime
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import pickle

# 구글 시트 API 설정
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '1zyblfK01GQE9XIaj_jteo3XcA0je21C9TbIPjU550JM'
RANGE_NAME = '시트11!A:Z'  # 시트11의 A-Z 열까지

def get_google_sheets_service():
    """구글 시트 API 서비스 객체 생성"""
    creds = None
    
    # 토큰 파일이 있으면 로드
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    
    # 유효한 인증 정보가 없거나 만료된 경우
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # credentials.json 파일이 필요합니다 (구글 클라우드 콘솔에서 다운로드)
            if not os.path.exists('credentials.json'):
                print("credentials.json 파일이 필요합니다.")
                print("구글 클라우드 콘솔에서 Google Sheets API를 활성화하고 credentials.json을 다운로드하세요.")
                return None
            
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        # 토큰 저장
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    
    try:
        service = build('sheets', 'v4', credentials=creds)
        return service
    except Exception as e:
        print(f"구글 시트 서비스 생성 실패: {e}")
        return None

def format_order_data_for_sheet(orders):
    """주문 데이터를 구글 시트 형식으로 변환 (템플릿 형식 O열)"""
    headers = [
        '주문ID', '고객명', '연락처', '수령인', '연락처', '주소', 
        '결제방법', '결제상태', '주문상태', '주문일시', '수정일시', '총금액',
        '배송방법',
        '제품정보',
        '요청사항'  # O열 추가
    ]
    rows = [headers]

    # 가격 정보 로드
    try:
        with open('prices.json', 'r', encoding='utf-8') as f:
            price_data = json.load(f)
    except Exception:
        price_data = {}

    for order in orders:
        # 주문 날짜 (MM/DD)
        order_date = ''
        if order.get('created_at'):
            try:
                dt = datetime.strptime(order['created_at'], '%Y-%m-%d %H:%M:%S')
                order_date = dt.strftime('%m/%d')
            except Exception:
                order_date = order['created_at'][:5]
        product_codes = []
        price_lines = []
        subtotal = 0
        request_memos = []
        for product in order.get('products', []):
            code = product.get('code', '')
            name = product.get('color_name', '')
            qty = int(product.get('quantity', 1))
            total_price = int(product.get('total_price', 0))
            product_type = product.get('type', '')
            memo = product.get('memo', '')
            # 요청사항만 별도 저장
            if product_type == '요청사항' and memo:
                request_memos.append(memo)
                continue  # 요청사항은 제품코드/가격 줄에 포함하지 않음
            # 제품코드 표기 (정기주문은 이름, 색상코드는 code 또는 remarks_actual_code)
            if product_type == '정기주문':
                code_display = product.get('name', name)
            elif product_type == '색상코드':
                code_display = product.get('name', name)  # 제품명만 사용
            else:
                code_display = product.get('name', name)
            # 제품코드 줄에 제품명/코드와 수량만 추가
            product_codes.append(f"{code_display} {qty}")
            # 가격 줄 생성 (0원/빈 제품 제외)
            price_type = None
            if product_type == '정기주문':
                item_name = product.get('name', name)
                price_type = item_name
            elif product_type == '색상코드':
                price_type = (
                    (product.get('color', {}) or {}).get('priceType') or
                    product.get('priceType') or
                    product.get('paint_type') or
                    ''
                )
                if price_type == '카페인트 원색':
                    price_type = '카페인트 원색'
                elif price_type == '카페인트 수입':
                    price_type = '카페인트 수입'
                elif price_type == '카페인트':
                    price_type = '카페인트'
                else:
                    price_type = price_type or '카페인트'
            else:
                price_type = product.get('name', name)
            if total_price > 0 and qty > 0:
                line = f"{price_type} {qty}캔 {total_price:,}원"
                price_lines.append(line)
                subtotal += total_price
        # 택배/기타 배송비 처리 (루프 밖에서 한 번만 추가)
        delivery_method = order.get('delivery_method', '')
        if delivery_method == '택배':
            price_lines.append('택배: 2,500원')
            subtotal += 2500
        elif delivery_method in ['화물', '퀵', '방문수령']:
            price_lines.append(delivery_method)
        template_lines = [
            f"{order_date} 주문 내역입니다.",
            ", ".join(product_codes),
            "",
            *price_lines,
            f"소계: {subtotal:,}원",
            "",
            f"합계 {subtotal:,}원 입금하실 계좌는 신한은행 110-419-405710 박혜정(이젠몰) 입니다. 감사합니다. 이젠몰 배상"
        ]
        template_text = "\n".join(template_lines)
        # 요청사항 O열에 추가
        row = [
            order.get('id', ''),
            order.get('customer_name', ''),
            order.get('customer_phone', ''),
            order.get('receiver', ''),
            order.get('contact', ''),
            order.get('address', ''),
            order.get('payment_method', ''),
            order.get('payment_status', ''),
            order.get('status', ''),
            order.get('created_at', ''),
            order.get('updated_at', ''),
            order.get('overall_total_price', 0),
            order.get('delivery_method', ''),
            template_text,
            "\n".join(request_memos) if request_memos else ''
        ]
        rows.append(row)
    return rows

def sync_orders_to_sheet(orders):
    """주문 데이터를 구글 시트에 동기화"""
    service = get_google_sheets_service()
    if not service:
        print("구글 시트 서비스를 초기화할 수 없습니다.")
        return False
    
    try:
        # 데이터 형식 변환
        sheet_data = format_order_data_for_sheet(orders)
        
        # 기존 데이터 삭제 (헤더 제외)
        clear_range = '시트11!A2:Z'
        service.spreadsheets().values().clear(
            spreadsheetId=SPREADSHEET_ID,
            range=clear_range
        ).execute()
        
        # 새 데이터 업로드
        body = {
            'values': sheet_data
        }
        
        result = service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=RANGE_NAME,
            valueInputOption='RAW',
            body=body
        ).execute()
        
        print(f"구글 시트 동기화 완료: {result.get('updatedCells')}개 셀 업데이트")
        return True
        
    except Exception as e:
        print(f"구글 시트 동기화 실패: {e}")
        return False

def get_sheet_data():
    """구글 시트에서 데이터 읽기 (테스트용)"""
    service = get_google_sheets_service()
    if not service:
        return None
    
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=RANGE_NAME
        ).execute()
        
        return result.get('values', [])
    except Exception as e:
        print(f"구글 시트 데이터 읽기 실패: {e}")
        return None

if __name__ == '__main__':
    # 테스트용
    print("구글 시트 연동 모듈 테스트")
    service = get_google_sheets_service()
    if service:
        print("구글 시트 서비스 연결 성공")
    else:
        print("구글 시트 서비스 연결 실패") 