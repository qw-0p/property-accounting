#!/usr/bin/env python3
"""
Extract table from invoice image using OpenCV cell detection + pytesseract OCR.
1. Find table region by detecting lines
2. Crop to table
3. Detect cells
4. OCR each cell
5. Return JSON
"""
import sys
import json
import cv2
import numpy as np
import pytesseract
import os

def find_table_region(gray):
    """Find and crop the main table region."""
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(40, gray.shape[1] // 25), 1))
    h_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, h_kernel, iterations=2)

    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(20, gray.shape[0] // 40)))
    v_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, v_kernel, iterations=2)

    table_mask = cv2.add(h_lines, v_lines)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    table_mask = cv2.dilate(table_mask, kernel, iterations=3)

    contours, _ = cv2.findContours(table_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return gray, 0, 0

    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < gray.shape[0] * gray.shape[1] * 0.1:
        return gray, 0, 0

    x, y, w, h = cv2.boundingRect(largest)
    pad = 5
    x = max(0, x - pad)
    y = max(0, y - pad)
    w = min(gray.shape[1] - x, w + pad * 2)
    h = min(gray.shape[0] - y, h + pad * 2)

    sys.stderr.write(f"Table region: ({x},{y}) {w}x{h}\n")
    cropped = gray[y:y+h, x:x+w]
    cropped = cv2.normalize(cropped, None, 0, 255, cv2.NORM_MINMAX)
    clahe = cv2.createCLAHE(clipLimit=10.0, tileGridSize=(8,8))
    cropped = clahe.apply(cropped)
    cv2.imwrite(os.path.expanduser('~/Desktop/table_cropped_with_10.png'), cropped)
    return cropped, x, y

def detect_lines(gray):
    """Detect horizontal and vertical lines in table."""
    img_h, img_w = gray.shape
    gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(40, img_w // 20), 1))
    h_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, h_kernel, iterations=2)

    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(20, img_h // 30)))
    v_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, v_kernel, iterations=2)

    return h_lines, v_lines

def get_line_positions(lines_img, axis, min_gap=5):
    projection = np.sum(lines_img, axis=axis)
    threshold = np.max(projection) * 0.1
    positions = np.where(projection > threshold)[0]
    if len(positions) == 0:
        return []
    clusters = []
    cluster = [positions[0]]
    for p in positions[1:]:
        if p - cluster[-1] <= min_gap:
            cluster.append(p)
        else:
            clusters.append(int(np.mean(cluster)))
            cluster = [p]
    clusters.append(int(np.mean(cluster)))
    return clusters

def build_cells(h_pos, v_pos, img_h, img_w):
    if not h_pos or h_pos[0] > 10:
        h_pos = [0] + h_pos
    if not h_pos or h_pos[-1] < img_h - 10:
        h_pos = h_pos + [img_h]
    if not v_pos or v_pos[0] > 10:
        v_pos = [0] + v_pos
    if not v_pos or v_pos[-1] < img_w - 10:
        v_pos = v_pos + [img_w]

    cells = []
    for i in range(len(h_pos) - 1):
        y1, y2 = h_pos[i], h_pos[i + 1]
        if y2 - y1 < 8:
            continue
        row = []
        for j in range(len(v_pos) - 1):
            x1, x2 = v_pos[j], v_pos[j + 1]
            if x2 - x1 < 8:
                continue
            row.append((x1, y1, x2, y2))
        if row:
            cells.append(row)
    return cells

def ocr_cell(gray, x1, y1, x2, y2, pad=4):
    x1 = max(0, x1 + pad)
    y1 = max(0, y1 + pad)
    x2 = min(gray.shape[1], x2 - pad)
    y2 = min(gray.shape[0], y2 - pad)
    if x2 <= x1 or y2 <= y1:
        return ''

    cell = gray[y1:y2, x1:x2]
    h, w = cell.shape

    # Upscale small cells
    if h < 40 or w < 40:
        scale = max(40 / max(h, 1), 40 / max(w, 1), 2.0)
        cell = cv2.resize(cell, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    cell = cv2.normalize(cell, None, 0, 255, cv2.NORM_MINMAX)

    text = pytesseract.image_to_string(
        cell,
        lang='ukr+eng',
        config='--psm 6 --oem 3'
    ).strip()

    return ' '.join(text.split())

COLUMN_MAP = [
    {'field': 'row_no',             'keywords': ['№', 'з/п', 'п/п', 'no']},
    {'field': 'name', 'keywords': ['назва', 'найменування', 'newn', 'нева', 'група']},
	{'field': 'nomenclature_code', 'keywords': ['код', 'номенклатур', 'поменклатур', 'помейклатур', 'koa']},
    {'field': 'price', 'keywords': ['ціна', 'вартість за', 'одиницю', 'вартість одн', 'інь']},
    {'field': 'unit',               'keywords': ['одиниц', 'виміру', 'измер']},
    {'field': 'category',           'keywords': ['категор', 'сорт']},
    {'field': 'qty_sent',           'keywords': ['відправлено', 'відпущено', 'вимагається']},
    {'field': 'qty_received',       'keywords': ['прийнято', 'надійшло']},
    {'field': 'total',              'keywords': ['сума']},
    {'field': 'note',               'keywords': ['примітка']},
]

def map_columns(header_rows):
    if not header_rows:
        return {}
    num_cols = max(len(r) for r in header_rows)
    col_texts = [''] * num_cols
    for row in header_rows:
        for j, text in enumerate(row):
            if j < num_cols:
                col_texts[j] += ' ' + text.lower()

    col_map = {0: 'row_no'}
    used_fields = {'row_no'}
    for j, text in enumerate(col_texts):
        if j == 0:
            continue
        for cm in COLUMN_MAP:
            if cm['field'] not in used_fields and any(k in text for k in cm['keywords']):
                col_map[j] = cm['field']
                used_fields.add(cm['field'])
                break
    return col_map

def find_header_row(cells_text):
    """Find first row with column headers."""
    keywords = ['назва', 'найменування', 'код', 'номенклатур', 'поменклатур',
                'одиниц', 'виміру', 'ціна', 'вартість', 'сума']
    for i, row in enumerate(cells_text):
        row_text = ' '.join(row).lower()
        score = sum(1 for k in keywords if k in row_text)
        if score >= 2:
            return i
    # fallback — перший рядок де є хоч один keyword
    for i, row in enumerate(cells_text):
        row_text = ' '.join(row).lower()
        if any(k in row_text for k in keywords):
            return i
    return 0

FIELD_COLORS = {
    'row_no':            (200, 200, 200),
    'name':              (255, 178,  50),
    'nomenclature_code': ( 50, 205,  50),
    'unit':              ( 50, 150, 255),
    'category':          (180,  50, 255),
    'price':             (255,  80,  80),
    'qty_sent':          ( 50, 220, 220),
    'qty_received':      (220, 180,  50),
    'total':             (255, 120, 180),
    'note':              (160, 160, 160),
}

def draw_visualization(table_gray, cells, cells_text, col_map, header_idx):
    import base64
    vis = cv2.cvtColor(table_gray, cv2.COLOR_GRAY2BGR)

    for i, (row_cells, row_text) in enumerate(zip(cells, cells_text)):
        for j, ((x1, y1, x2, y2), text) in enumerate(zip(row_cells, row_text)):
            field = col_map.get(j)
            if not field:
                continue
            color = FIELD_COLORS.get(field, (200, 200, 200))
            overlay = vis.copy()
            cv2.rectangle(overlay, (x1+2, y1+2), (x2-2, y2-2), color, -1)
            cv2.addWeighted(overlay, 0.25, vis, 0.75, 0, vis)
            cv2.rectangle(vis, (x1+1, y1+1), (x2-1, y2-1), color, 2)
            if i == header_idx and text.strip():
                cv2.putText(vis, field, (x1+4, y1+14),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.35, color, 1, cv2.LINE_AA)

    _, encoded = cv2.imencode('.png', vis)
    return base64.b64encode(encoded.tobytes()).decode('utf-8')

def extract(input_bytes):
    nparr = np.frombuffer(input_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        sys.stderr.write("Failed to decode\n")
        print(json.dumps([]))
        return

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 1. Вирізаємо таблицю
    table_gray, _, _ = find_table_region(gray)
    img_h, img_w = table_gray.shape

    # 2. Детектуємо лінії
    h_lines, v_lines = detect_lines(table_gray)
    h_pos = get_line_positions(h_lines, axis=1)
    v_pos = get_line_positions(v_lines, axis=0)
    sys.stderr.write(f"H lines: {len(h_pos)}, V lines: {len(v_pos)}\n")

    if len(h_pos) < 2 or len(v_pos) < 2:
        sys.stderr.write("Not enough lines\n")
        print(json.dumps([]))
        return

    # 3. Будуємо клітинки
    cells = build_cells(h_pos, v_pos, img_h, img_w)
    sys.stderr.write(f"Cells: {len(cells)} rows x {max(len(r) for r in cells) if cells else 0} cols\n")

    # 4. OCR кожної клітинки
    cells_text = []
    for row in cells:
        row_text = [ocr_cell(table_gray, *cell) for cell in row]
        cells_text.append(row_text)
        sys.stderr.write(f"Row: {row_text}\n")

    # 5. Знаходимо хедер
    header_idx = find_header_row(cells_text)
    sys.stderr.write(f"Header row: {header_idx}\n")

    # 6. Маппінг колонок
    col_map = map_columns(cells_text[max(0, header_idx-1):header_idx+2])
    sys.stderr.write(f"Column map: {col_map}\n")

    # 7. Парсимо дані
    records = []
    current = None
    stop_keywords = ['всього', 'разом', 'підпис', 'матеріально', 'здав', 'прийняв']

    for i in range(header_idx + 1, len(cells_text)):
        row = cells_text[i]
        row_text = ' '.join(row).lower()

        if any(k in row_text for k in stop_keywords):
            break
        if not any(c.strip() for c in row):
            continue
        
        digit_cells = sum(1 for c in row if c.strip().isdigit())
        if digit_cells >= len(row) // 2:
          continue

        # Перший стовпець — номер рядка
        record = {}
        for j, text in enumerate(row):
            field = col_map.get(j)
            if field and field != 'row_no' and text.strip():
                record[field] = text.strip()

        if record.get('name') or record.get('nomenclature_code'):
            records.append(record)

    sys.stderr.write(f"Extracted {len(records)} records\n")
    viz_b64 = draw_visualization(table_gray, cells, cells_text, col_map, header_idx)
    print(json.dumps({'records': records, 'viz': viz_b64}, ensure_ascii=False))

if __name__ == '__main__':
    input_bytes = sys.stdin.buffer.read()
    extract(input_bytes)