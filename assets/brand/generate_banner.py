import math
import os

def polar_to_cart(cx, cy, r, angle_deg):
    rad = math.radians(angle_deg)
    return cx + r * math.cos(rad), cy + r * math.sin(rad)

def describe_arc(cx, cy, r, start_deg, end_deg):
    x1, y1 = polar_to_cart(cx, cy, r, start_deg)
    x2, y2 = polar_to_cart(cx, cy, r, end_deg)
    span = (end_deg - start_deg) % 360
    large_arc = 1 if span > 180 else 0
    sweep = 1
    return f"M {x1:.2f} {y1:.2f} A {r:.2f} {r:.2f} 0 {large_arc} {sweep} {x2:.2f} {y2:.2f}"

def render_mark_group(cx, cy, scale=1.0):
    r_outer = 172 * scale
    r_mid = 148 * scale
    r_inner = 124 * scale
    
    sectors = [
        {"name": "payload", "start": 14, "end": 96, "accent": False},
        {"name": "p2p_mcs", "start": 104, "end": 188, "accent": True},
        {"name": "ori",     "start": 196, "end": 272, "accent": False},
        {"name": "merkle",  "start": 280, "end": 6,   "accent": False},
    ]
    
    c_dark = "#0F172A"
    c_subtle = "#64748B"
    c_faint = "#CBD5E1"
    c_accent = "#2563EB"
    
    elements = []
    
    # 1. Ticks
    for deg in range(0, 360, 15):
        near_gap = any(min(abs((deg - s["start"]) % 360), abs((deg - s["end"]) % 360)) < 5 for s in sectors)
        if near_gap:
            continue
        is_cardinal = (deg % 90 == 0)
        t_len = (10 if is_cardinal else 5) * scale
        tx1, ty1 = polar_to_cart(cx, cy, (r_outer + 10 * scale), deg)
        tx2, ty2 = polar_to_cart(cx, cy, (r_outer + 10 * scale + t_len), deg)
        t_color = c_accent if (is_cardinal and deg == 0) else (c_dark if is_cardinal else c_subtle)
        t_width = 2.5 * scale if is_cardinal else 1.5 * scale
        elements.append(f'<line x1="{tx1:.2f}" y1="{ty1:.2f}" x2="{tx2:.2f}" y2="{ty2:.2f}" stroke="{t_color}" stroke-width="{t_width:.2f}" stroke-linecap="round" />')

    # 2. Rungs
    for sec in sectors:
        s_deg = sec["start"]
        e_deg = sec["end"]
        span = (e_deg - s_deg) % 360
        num_rungs = int(span / 7.2)
        step = span / (num_rungs + 1)
        for i in range(1, num_rungs + 1):
            deg = (s_deg + i * step) % 360
            ox, oy = polar_to_cart(cx, cy, r_outer, deg)
            ix, iy = polar_to_cart(cx, cy, r_inner, deg)
            if i % 2 == 1:
                elements.append(f'<line x1="{ox:.2f}" y1="{oy:.2f}" x2="{ix:.2f}" y2="{iy:.2f}" stroke="{c_faint}" stroke-width="{2*scale:.2f}" stroke-linecap="round" />')
            else:
                mx, my = polar_to_cart(cx, cy, r_mid, deg)
                elements.append(f'<line x1="{ox:.2f}" y1="{oy:.2f}" x2="{ix:.2f}" y2="{iy:.2f}" stroke="{c_subtle}" stroke-width="{2*scale:.2f}" stroke-linecap="round" />')
                elements.append(f'<circle cx="{mx:.2f}" cy="{my:.2f}" r="{2.5*scale:.2f}" fill="{c_accent if sec["accent"] and i==4 else c_dark}" />')

    # 3. Strands
    for sec in sectors:
        s = sec["start"]
        e = sec["end"]
        d_out = describe_arc(cx, cy, r_outer, s, e)
        d_in = describe_arc(cx, cy, r_inner, s, e)
        str_color = c_accent if sec["accent"] else c_dark
        elements.append(f'<path d="{d_out}" fill="none" stroke="{str_color}" stroke-width="{4.5*scale:.2f}" stroke-linecap="round" />')
        elements.append(f'<path d="{d_in}" fill="none" stroke="{str_color}" stroke-width="{4.5*scale:.2f}" stroke-linecap="round" />')
        
        ox1, oy1 = polar_to_cart(cx, cy, r_outer, s)
        ix1, iy1 = polar_to_cart(cx, cy, r_inner, s)
        ox2, oy2 = polar_to_cart(cx, cy, r_outer, e)
        ix2, iy2 = polar_to_cart(cx, cy, r_inner, e)
        elements.append(f'<line x1="{ox1:.2f}" y1="{oy1:.2f}" x2="{ix1:.2f}" y2="{iy1:.2f}" stroke="{str_color}" stroke-width="{3*scale:.2f}" stroke-linecap="round" />')
        elements.append(f'<line x1="{ox2:.2f}" y1="{oy2:.2f}" x2="{ix2:.2f}" y2="{iy2:.2f}" stroke="{str_color}" stroke-width="{3*scale:.2f}" stroke-linecap="round" />')

    # 4. Core
    elements.append(f'<circle cx="{cx}" cy="{cy}" r="{64*scale:.2f}" fill="none" stroke="{c_faint}" stroke-width="{1.5*scale:.2f}" stroke-dasharray="{4*scale:.2f} {6*scale:.2f}" />')
    node_top = (cx, cy - 32 * scale)
    node_mid_l = (cx - 26 * scale, cy + 8 * scale)
    node_mid_r = (cx + 26 * scale, cy + 8 * scale)
    node_bot = (cx, cy + 40 * scale)
    
    elements.append(f'<line x1="{node_top[0]}" y1="{node_top[1]}" x2="{node_mid_l[0]}" y2="{node_mid_l[1]}" stroke="{c_subtle}" stroke-width="{2*scale:.2f}" stroke-linecap="round" />')
    elements.append(f'<line x1="{node_top[0]}" y1="{node_top[1]}" x2="{node_mid_r[0]}" y2="{node_mid_r[1]}" stroke="{c_subtle}" stroke-width="{2*scale:.2f}" stroke-linecap="round" />')
    elements.append(f'<line x1="{node_mid_l[0]}" y1="{node_mid_l[1]}" x2="{node_bot[0]}" y2="{node_bot[1]}" stroke="{c_subtle}" stroke-width="{2*scale:.2f}" stroke-linecap="round" />')
    elements.append(f'<line x1="{node_mid_r[0]}" y1="{node_mid_r[1]}" x2="{node_bot[0]}" y2="{node_bot[1]}" stroke="{c_subtle}" stroke-width="{2*scale:.2f}" stroke-linecap="round" />')
    
    elements.append(f'<circle cx="{node_top[0]}" cy="{node_top[1]}" r="{6*scale:.2f}" fill="#FFFFFF" stroke="{c_accent}" stroke-width="{3*scale:.2f}" />')
    elements.append(f'<circle cx="{node_mid_l[0]}" cy="{node_mid_l[1]}" r="{5*scale:.2f}" fill="#FFFFFF" stroke="{c_dark}" stroke-width="{2.5*scale:.2f}" />')
    elements.append(f'<circle cx="{node_mid_r[0]}" cy="{node_mid_r[1]}" r="{5*scale:.2f}" fill="#FFFFFF" stroke="{c_dark}" stroke-width="{2.5*scale:.2f}" />')
    elements.append(f'<circle cx="{node_bot[0]}" cy="{node_bot[1]}" r="{5*scale:.2f}" fill="#FFFFFF" stroke="{c_dark}" stroke-width="{2.5*scale:.2f}" />')
    elements.append(f'<circle cx="{cx}" cy="{cy}" r="{2*scale:.2f}" fill="{c_subtle}" />')
    
    return '\n'.join(elements)

def build_horizontal_banner_svg():
    # 1280 x 640 banner (2:1 aspect ratio, ideal for GitHub Social Preview & Readme)
    w, h = 1280, 640
    cx_mark = 280
    cy_mark = 320
    scale = 0.95
    mark_svg = render_mark_group(cx_mark, cy_mark, scale)
    
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
  <defs>
    <style>
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
      .font-brand {{
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }}
    </style>
  </defs>
  
  <!-- Clean Canvas -->
  <rect width="{w}" height="{h}" fill="#FFFFFF" />
  
  <!-- Subtle Grid Pattern Background (Biotech Laboratory Sheet) -->
  <g opacity="0.4">
    <line x1="0" y1="160" x2="{w}" y2="160" stroke="#F1F5F9" stroke-width="1" />
    <line x1="0" y1="320" x2="{w}" y2="320" stroke="#F1F5F9" stroke-width="1" />
    <line x1="0" y1="480" x2="{w}" y2="480" stroke="#F1F5F9" stroke-width="1" />
    <line x1="560" y1="0" x2="560" y2="{h}" stroke="#F1F5F9" stroke-width="1" />
    <line x1="920" y1="0" x2="920" y2="{h}" stroke="#F1F5F9" stroke-width="1" />
  </g>

  <!-- Left: Geometric Plasmid Merkle Mark -->
  <g id="logo-symbol">
    {mark_svg}
  </g>

  <!-- Right: Modern Editorial Typography & Lockup -->
  <g id="typography" class="font-brand" transform="translate(560, 0)">
    <!-- Metadata Org Tag -->
    <g transform="translate(0, 200)">
      <rect x="0" y="0" width="112" height="26" rx="6" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="12" y="17" font-size="11" font-weight="700" fill="#2563EB" letter-spacing="1.5">EPGENO ORG</text>
      <text x="126" y="17" font-size="11" font-weight="500" fill="#94A3B8" letter-spacing="1.0">RFC-0001 / BEP 52</text>
    </g>

    <!-- Main Title: PLASMID -->
    <text x="0" y="295" font-size="76" font-weight="800" fill="#0F172A" letter-spacing="-2.0">PLASMID</text>
    <text x="358" y="295" font-size="76" font-weight="400" fill="#2563EB" letter-spacing="-1.5">.wiki</text>

    <!-- Description -->
    <text x="2" y="345" font-size="21" font-weight="500" fill="#334155" letter-spacing="-0.3">
      Decentralized Genomic Wiki &amp; P2P Slicing Engine
    </text>

    <!-- Pillar Badges -->
    <g transform="translate(2, 385)">
      <!-- Badge 1: Merkle Streaming -->
      <rect x="0" y="0" width="154" height="32" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
      <circle cx="16" cy="16" r="4" fill="#2563EB" />
      <text x="28" y="20" font-size="12" font-weight="600" fill="#1E293B">16KB Merkle Slicing</text>

      <!-- Badge 2: Zero-Network Vault -->
      <rect x="166" y="0" width="146" height="32" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
      <circle cx="182" cy="16" r="4" fill="#0F172A" />
      <text x="194" y="20" font-size="12" font-weight="600" fill="#1E293B">Air-Gapped Vault</text>

      <!-- Badge 3: WebRTC Swarm -->
      <rect x="324" y="0" width="168" height="32" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
      <circle cx="340" cy="16" r="4" fill="#0F172A" />
      <text x="352" y="20" font-size="12" font-weight="600" fill="#1E293B">WebRTC Swarm P2P</text>
    </g>

    <!-- Footnote URL -->
    <text x="2" y="468" font-size="13" font-weight="500" fill="#94A3B8" letter-spacing="0.5">
      https://github.com/epgeno/plasmid
    </text>
  </g>
</svg>"""
    return svg

if __name__ == "__main__":
    out_dir = "/home/cycorld/projects/plasmid/assets/brand"
    banner_svg = build_horizontal_banner_svg()
    banner_path = os.path.join(out_dir, "plasmid-banner.svg")
    with open(banner_path, "w", encoding="utf-8") as f:
        f.write(banner_svg)
    print(f"Wrote {banner_path}")
