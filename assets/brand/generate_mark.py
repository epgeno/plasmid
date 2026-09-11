import math
import os
import subprocess

def polar_to_cart(cx, cy, r, angle_deg):
    rad = math.radians(angle_deg)
    return cx + r * math.cos(rad), cy + r * math.sin(rad)

def describe_arc(cx, cy, r, start_deg, end_deg):
    x1, y1 = polar_to_cart(cx, cy, r, start_deg)
    x2, y2 = polar_to_cart(cx, cy, r, end_deg)
    
    # normalize angle span
    span = (end_deg - start_deg) % 360
    large_arc = 1 if span > 180 else 0
    sweep = 1  # clockwise
    
    return f"M {x1:.2f} {y1:.2f} A {r:.2f} {r:.2f} 0 {large_arc} {sweep} {x2:.2f} {y2:.2f}"

def build_plasmid_mark_svg():
    cx, cy = 256, 256
    r_outer = 172
    r_mid = 148
    r_inner = 124
    
    # 4 distinct Merkle / genomic sectors with precision cuts
    sectors = [
        {"name": "payload", "start": 14, "end": 96, "accent": False},
        {"name": "p2p_mcs", "start": 104, "end": 188, "accent": True},  # Accent: P2P transfer node
        {"name": "ori",     "start": 196, "end": 272, "accent": False},
        {"name": "merkle",  "start": 280, "end": 6,   "accent": False},
    ]
    
    # SVG Elements
    paths = []
    
    # Primary Ink colors
    c_dark = "#0F172A"       # Slate 900
    c_subtle = "#64748B"     # Slate 500
    c_faint = "#CBD5E1"      # Slate 300
    c_accent = "#2563EB"     # Electric Royal Blue
    
    # 1. Base pair rungs (radial struts connecting inner and outer strands)
    rungs = []
    for sec in sectors:
        s_deg = sec["start"]
        e_deg = sec["end"]
        span = (e_deg - s_deg) % 360
        # step roughly every 7.5 degrees
        num_rungs = int(span / 7.2)
        step = span / (num_rungs + 1)
        
        for i in range(1, num_rungs + 1):
            deg = (s_deg + i * step) % 360
            ox, oy = polar_to_cart(cx, cy, r_outer, deg)
            ix, iy = polar_to_cart(cx, cy, r_inner, deg)
            
            # Subtle variation: alternating full rungs and accented midpoint nodes
            if i % 2 == 1:
                rungs.append(f'<line x1="{ox:.2f}" y1="{oy:.2f}" x2="{ix:.2f}" y2="{iy:.2f}" stroke="{c_faint}" stroke-width="2" stroke-linecap="round" />')
            else:
                mx, my = polar_to_cart(cx, cy, r_mid, deg)
                rungs.append(f'<line x1="{ox:.2f}" y1="{oy:.2f}" x2="{ix:.2f}" y2="{iy:.2f}" stroke="{c_subtle}" stroke-width="2" stroke-linecap="round" />')
                rungs.append(f'<circle cx="{mx:.2f}" cy="{my:.2f}" r="2.5" fill="{c_accent if sec["accent"] and i==4 else c_dark}" />')
    
    # 2. Outer and Inner Strands (The double helix backbone)
    strands = []
    for sec in sectors:
        s = sec["start"]
        e = sec["end"]
        # Outer arc
        d_out = describe_arc(cx, cy, r_outer, s, e)
        # Inner arc
        d_in = describe_arc(cx, cy, r_inner, s, e)
        
        str_color = c_accent if sec["accent"] else c_dark
        strands.append(f'<path d="{d_out}" fill="none" stroke="{str_color}" stroke-width="4.5" stroke-linecap="round" />')
        strands.append(f'<path d="{d_in}" fill="none" stroke="{str_color}" stroke-width="4.5" stroke-linecap="round" />')
        
        # Terminal nodes at segment boundaries (Restriction enzyme cut sites / P2P socket ports)
        ox1, oy1 = polar_to_cart(cx, cy, r_outer, s)
        ix1, iy1 = polar_to_cart(cx, cy, r_inner, s)
        ox2, oy2 = polar_to_cart(cx, cy, r_outer, e)
        ix2, iy2 = polar_to_cart(cx, cy, r_inner, e)
        
        # Caps/bridges at the boundaries
        strands.append(f'<line x1="{ox1:.2f}" y1="{oy1:.2f}" x2="{ix1:.2f}" y2="{iy1:.2f}" stroke="{str_color}" stroke-width="3" stroke-linecap="round" />')
        strands.append(f'<line x1="{ox2:.2f}" y1="{oy2:.2f}" x2="{ix2:.2f}" y2="{iy2:.2f}" stroke="{str_color}" stroke-width="3" stroke-linecap="round" />')

    # 3. Outer Orbit Merkle Hash Index Markers (Subtle tick marks at coordinates)
    ticks = []
    r_tick_start = r_outer + 12
    r_tick_end = r_outer + 20
    for deg in range(0, 360, 15):
        # Skip ticks near sector cut boundaries
        near_gap = any(min(abs((deg - s["start"]) % 360), abs((deg - s["end"]) % 360)) < 5 for s in sectors)
        if near_gap:
            continue
        is_cardinal = (deg % 90 == 0)
        t_len = 10 if is_cardinal else 5
        tx1, ty1 = polar_to_cart(cx, cy, r_outer + 10, deg)
        tx2, ty2 = polar_to_cart(cx, cy, r_outer + 10 + t_len, deg)
        t_color = c_accent if (is_cardinal and deg == 0) else (c_dark if is_cardinal else c_subtle)
        t_width = "2.5" if is_cardinal else "1.5"
        ticks.append(f'<line x1="{tx1:.2f}" y1="{ty1:.2f}" x2="{tx2:.2f}" y2="{ty2:.2f}" stroke="{t_color}" stroke-width="{t_width}" stroke-linecap="round" />')

    # 4. Central Core: Merkle DAG & Circular Coordinate SSOT Origin
    core = []
    # Central reticle coordinate ring (dashed)
    core.append(f'<circle cx="{cx}" cy="{cy}" r="64" fill="none" stroke="{c_faint}" stroke-width="1.5" stroke-dasharray="4 6" />')
    
    # 4-node Merkle branch network in the center
    # Root node at center top, splitting down to 2 intermediate, then to outer ring
    node_top = (cx, cy - 32)
    node_mid_l = (cx - 26, cy + 8)
    node_mid_r = (cx + 26, cy + 8)
    node_bot = (cx, cy + 40)
    
    core.append(f'<line x1="{node_top[0]}" y1="{node_top[1]}" x2="{node_mid_l[0]}" y2="{node_mid_l[1]}" stroke="{c_subtle}" stroke-width="2" stroke-linecap="round" />')
    core.append(f'<line x1="{node_top[0]}" y1="{node_top[1]}" x2="{node_mid_r[0]}" y2="{node_mid_r[1]}" stroke="{c_subtle}" stroke-width="2" stroke-linecap="round" />')
    core.append(f'<line x1="{node_mid_l[0]}" y1="{node_mid_l[1]}" x2="{node_bot[0]}" y2="{node_bot[1]}" stroke="{c_subtle}" stroke-width="2" stroke-linecap="round" />')
    core.append(f'<line x1="{node_mid_r[0]}" y1="{node_mid_r[1]}" x2="{node_bot[0]}" y2="{node_bot[1]}" stroke="{c_subtle}" stroke-width="2" stroke-linecap="round" />')
    
    # Center nodes
    core.append(f'<circle cx="{node_top[0]}" cy="{node_top[1]}" r="6" fill="#FFFFFF" stroke="{c_accent}" stroke-width="3" />')
    core.append(f'<circle cx="{node_mid_l[0]}" cy="{node_mid_l[1]}" r="5" fill="#FFFFFF" stroke="{c_dark}" stroke-width="2.5" />')
    core.append(f'<circle cx="{node_mid_r[0]}" cy="{node_mid_r[1]}" r="5" fill="#FFFFFF" stroke="{c_dark}" stroke-width="2.5" />')
    core.append(f'<circle cx="{node_bot[0]}" cy="{node_bot[1]}" r="5" fill="#FFFFFF" stroke="{c_dark}" stroke-width="2.5" />')
    
    # Tiny center coordinate origin
    core.append(f'<circle cx="{cx}" cy="{cy}" r="2" fill="{c_subtle}" />')

    # Assemble Full Standalone SVG
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#FFFFFF" rx="104" />
  <g id="merkle-ticks">
    {''.join(ticks)}
  </g>
  <g id="base-pair-rungs">
    {''.join(rungs)}
  </g>
  <g id="dna-backbone">
    {''.join(strands)}
  </g>
  <g id="merkle-core">
    {''.join(core)}
  </g>
</svg>"""
    return svg

if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))
    svg_content = build_plasmid_mark_svg()
    svg_path = os.path.join(out_dir, "plasmid-mark.svg")
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"Wrote {svg_path}")
