
import re
import json

def parse_ahs(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    items = []
    current_item = None
    current_section = None # 'Labor', 'Material', 'Equipment'
    
    # Regex patterns
    start_pattern = re.compile(r'^(\(2022\)\s+)?([A-Za-z0-9\.]+)\s+(.*)$')
    price_pattern = re.compile(r'^D\s+.*\s+([\d,\.]+)\s*$')
    unit_pattern = re.compile(r'\b1\s*(m2|m3|m1|m\'|kg|buah|unit|titik|set|ls)\b', re.IGNORECASE)
    
    # Section headers
    # A	 TENAGA KERJA
    # A	TENAGA
    section_map = {
        'A': 'Labor',
        'B': 'Material',
        'C': 'Equipment'
    }
    
    # Component line regex
    # It usually starts with a tab or spaces, then name, code, unit, coef, price, total
    # But splitting by tab might be safer if available.
    # Let's try to be flexible.
    
    for line in lines:
        original_line = line
        line = line.strip()
        if not line:
            continue

        # Check for Item End (Price Line D)
        price_match = price_pattern.match(line)
        if price_match and current_item:
            clean_price = price_match.group(1).replace(',', '')
            try:
                current_item['basePrice'] = float(clean_price)
            except ValueError:
                current_item['basePrice'] = 0
            
            items.append(current_item)
            current_item = None
            current_section = None
            continue

        # Check for Section Headers
        # Starts with A, B, or C followed by tab or space
        # A	 TENAGA KERJA
        if re.match(r'^[ABC]\s+', line) or re.match(r'^[ABC]\t', line):
            section_char = line[0]
            if section_char in section_map:
                current_section = section_map[section_char]
            continue
            
        # Check for Item Start
        # We use the same logic as before but refined
        match = start_pattern.match(line)
        is_start_line = False
        
        if match:
            prefix = match.group(1) or ""
            code = match.group(2)
            desc = match.group(3)
            
            # Filter out non-items
            if code not in ['No', 'Uraian', 'Kode', 'Satuan', 'Koefisien', 'Harga', 'Jumlah']:
                # Filter out materials mistaken for codes
                if code not in ['Pasir', 'Floor', 'Semen', 'Batu', 'Kayu', 'Paku', 'Cat', 'Keramik', 'Pipa', 'Besi', 'Hollow', 'Rangka', 'Papan', 'List', 'Ubin', 'Homogenous', 'Plamur', 'Profil', 'Sealant', 'Engsel', 'Kunci', 'Genteng', 'Baja', 'Serat', 'Roof', 'Kran', 'NYM', 'Conduit', 'T', 'Socket', 'Klem', 'Fischer', 'L', 'Las', 'Saklar', 'Flexible']:
                     if '.' in code or 'User' in prefix or 'User' in code:
                        # Check if it looks like an item description
                        is_likely_item = "Pek." in desc or "Pemasangan" in desc or "Pembuatan" in desc or "Penggalian" in desc or "Urukan" in desc or "Beton" in desc or "Pembesian" in desc
                        
                        if is_likely_item:
                            is_start_line = True
                            # If we were in an item, close it (though we prefer D line to close)
                            # If we hit a new start without D, the previous one was incomplete.
                            if current_item:
                                # Incomplete item, maybe save it anyway? 
                                # Or discard. Let's discard to be safe or append if it has components.
                                pass 

                            current_item = {
                                "code": (prefix + code).strip(),
                                "name": desc.strip(),
                                "unit": "ls",
                                "category": "General",
                                "description": desc.strip(),
                                "basePrice": 0,
                                "overheadPercentage": 0,
                                "profitPercentage": 0,
                                "isActive": True,
                                "components": []
                            }
                            
                            unit_match = unit_pattern.search(desc)
                            if unit_match:
                                u = unit_match.group(1).lower()
                                if u == "m'": u = "m1"
                                current_item['unit'] = u
                            
                            current_section = None
        
        if is_start_line:
            continue

        # Parse Components
        if current_item and current_section:
            # We expect lines like:
            # Pekerja	L.01	OH	0.100	 152,900.00 	 15,290.00 
            # Split by tab is best if file is tab separated
            parts = original_line.strip().split('\t')
            
            # If split by tab results in few parts, maybe it's space separated or mixed
            if len(parts) < 4:
                # Try regex for component line
                # Name ... Code ... Unit ... Coef ... Price ... Total
                # This is hard because Name can contain spaces.
                # But usually Code, Unit, Coef, Price are at the end.
                pass
            else:
                # Clean parts
                parts = [p.strip() for p in parts if p.strip()]
                
                # We need at least Name, Unit, Coef, Price
                # Sometimes Code is missing or merged
                # Expected: [Name, Code, Unit, Coef, Price, Total]
                # Or: [Name, Unit, Coef, Price, Total] (if code missing)
                
                if len(parts) >= 5:
                    # Heuristic to identify columns
                    # Price and Total are usually the last two and are numbers
                    try:
                        price_str = parts[-2].replace(',', '')
                        coef_str = parts[-3].replace(',', '.') # Coef might use comma as decimal in ID
                        
                        # Check if coef_str is actually unit?
                        # Let's look at structure:
                        # Name | Code | Unit | Coef | Price | Total
                        # 0    | 1    | 2    | 3    | 4     | 5
                        
                        # If Code is present:
                        # Pekerja | L.01 | OH | 0.100 | 152,900 | 15,290
                        
                        name = parts[0]
                        code = ""
                        unit = ""
                        coef = 0.0
                        price = 0.0
                        
                        # Try to parse from right to left
                        total_val = float(parts[-1].replace(',', ''))
                        price_val = float(parts[-2].replace(',', ''))
                        
                        # Coef is usually at -3
                        # But sometimes unit is there?
                        # Coef is a number.
                        
                        # Let's try to find the coefficient
                        # It's usually a small number.
                        
                        # Case 1: 6 parts (Name, Code, Unit, Coef, Price, Total)
                        if len(parts) >= 6:
                            code = parts[1]
                            unit = parts[2]
                            try:
                                coef = float(parts[3].replace(',', '')) # Assuming dot decimal in file based on previous read
                                # Wait, previous read showed "0.100". So dot decimal.
                            except:
                                # Maybe parts[3] is not coef
                                pass
                        
                        # Case 2: 5 parts (Name, Unit, Coef, Price, Total) - Code missing
                        elif len(parts) == 5:
                            unit = parts[1]
                            try:
                                coef = float(parts[2].replace(',', ''))
                            except:
                                pass
                                
                        # Refined parsing:
                        # Find the index of the coefficient (it's a number)
                        # It should be before Price.
                        
                        # Let's assume the last two are Price and Total.
                        # The one before Price is Coef.
                        # The one before Coef is Unit.
                        # The one before Unit is Code (optional).
                        # The rest at start is Name.
                        
                        price_idx = -2
                        coef_idx = -3
                        unit_idx = -4
                        
                        price = float(parts[price_idx].replace(',', ''))
                        coef = float(parts[coef_idx].replace(',', '')) # Assuming dot decimal
                        unit = parts[unit_idx]
                        
                        # Name is everything before unit (minus code if exists)
                        # If there is a part between Name and Unit, it's Code.
                        
                        remaining_parts = parts[:unit_idx]
                        if len(remaining_parts) > 1:
                            # Assume last of remaining is Code
                            code = remaining_parts[-1]
                            name = " ".join(remaining_parts[:-1])
                        elif len(remaining_parts) == 1:
                            name = remaining_parts[0]
                            code = "-"
                        else:
                            name = "Unknown"
                            
                        # Add component
                        current_item['components'].append({
                            "name": name,
                            "code": code,
                            "unit": unit,
                            "coefficient": coef,
                            "price": price,
                            "category": current_section
                        })
                        
                    except ValueError:
                        # Not a valid component line
                        pass

    return items

items = parse_ahs(r'd:\2. NATA_PROJECTAPP\PM_LABHA\MLPHoma\AHS.txt')

# Write to JSON
with open(r'd:\2. NATA_PROJECTAPP\PM_LABHA\MLPHoma\AHSP_IMPORT_TEMPLATE.json', 'w', encoding='utf-8') as f:
    json.dump(items, f, indent=2)

print(f"Successfully parsed {len(items)} items with components.")
