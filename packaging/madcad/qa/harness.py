import json, subprocess, sys, math, os, tempfile
CLI = os.path.expanduser('~/Developer/MadCAD8/target/release/solidcraft-cli')
def C(cmd, **p): return {"command": cmd, "params": p}
def sk(plane="XY", **k): return C("sketch.create", plane=plane, **k)
def rect(x0, y0, x1, y1): return C("sketch.rectangle.two_point", p0=[x0, y0], p1=[x1, y1])
def circ(x, y, r): return C("sketch.circle.center", center=[x, y], radius=r)
def fin(): return C("sketch.finish")
def ext(d, **k): return C("solid.extrude", distance=d, **k)
BLOCK = [sk(), rect(0, 0, 100, 60), fin(), ext(30)]   # 100x60x30, volume 180000
PI = math.pi
results = []
def run(name, cmds, vol=None, bodies=1, err=False, tol=2e-3, bbox=None, check=None):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump({"commands": cmds}, f); path = f.name
    p = subprocess.run([CLI, 'eval', path], capture_output=True, text=True, timeout=120)
    os.unlink(path)
    problems = []
    try:
        d = json.loads(p.stdout)
    except Exception:
        d = None
    if d is None:
        msg = (p.stderr or p.stdout).strip().splitlines()[-1:] if (p.stderr or p.stdout) else ['no output']
        if not err: problems.append('run failed: ' + ' '.join(msg)[:200])
    else:
        errs = [f"{t.get('name')}: {t['error']}" for t in d.get('timeline', []) if t.get('error')]
        if err and not errs: problems.append('expected an error, got none')
        if not err and errs: problems.append('feature error: ' + '; '.join(errs)[:300])
        if not err:
            bs = d.get('bodies', [])
            if bodies is not None and len(bs) != bodies: problems.append(f'bodies {len(bs)} != {bodies}')
            for b in bs:
                if not b.get('closed'): problems.append(f"{b['name']} not closed")
            if vol is not None:
                v = sum(b.get('volume_mm3', 0) for b in bs)
                if abs(v - vol) > tol * max(abs(vol), 1): problems.append(f'volume {v:.2f} != {vol:.2f}')
            if bbox is not None and bs:
                lo = [min(b['bbox']['min'][i] for b in bs) for i in range(3)]
                hi = [max(b['bbox']['max'][i] for b in bs) for i in range(3)]
                for i in range(3):
                    if bbox[0][i] is not None and abs(lo[i] - bbox[0][i]) > 1e-3: problems.append(f'bbox min {lo} != {bbox[0]}'); break
                    if bbox[1][i] is not None and abs(hi[i] - bbox[1][i]) > 1e-3: problems.append(f'bbox max {hi} != {bbox[1]}'); break
            if check: 
                m = check(d)
                if m: problems.append(m)
    results.append((name, problems))
    print(('OK  ' if not problems else 'FAIL') + f' {name}' + ('' if not problems else ' -> ' + ' | '.join(problems)), flush=True)
    return d
def summary():
    bad = [r for r in results if r[1]]
    print(f'\n{len(results) - len(bad)}/{len(results)} passed')
