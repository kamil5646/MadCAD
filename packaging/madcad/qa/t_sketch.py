from harness import *
V=180000
def sk_status(d, name='Sketch1'):
    s=[x for x in d['sketches'] if x['name']==name]
    return s[0] if s else None
def solved(name='Sketch1', dof=None):
    def f(d):
        s=sk_status(d,name)
        if not s: return 'no sketch'
        if s['status']!='solved': return f"sketch {s['status']}"
        if dof is not None and s['dof']!=dof: return f"dof {s['dof']} != {dof}"
    return f
L=lambda pts, **k: C('sketch.line', points=pts, **k)
# --- Linia / polilinia
run('line closed triangle', [sk(), L([[0,0],[40,0],[0,30]], closed=True), fin(), ext(10)], 0.5*40*30*10)
run('polyline closed', [sk(), C('sketch.polyline', points=[[0,0],[40,0],[40,30],[0,30]], closed=True), fin(), ext(10)], 40*30*10)
run('line chain closing on start', [sk(), L([[0,0],[40,0],[40,30],[0,30],[0,0]]), fin(), ext(10)], 40*30*10)
run('separate lines joined', [sk(), L([[0,0],[40,0]]), L([[40,0],[40,30]]), L([[40,30],[0,30]]), L([[0,30],[0,0]]), fin(), ext(10)], 40*30*10)
run('line expression point', [C('parameters.change', name='w', expression='40 mm'), sk(), L([[0,0],['w',0],['w',30],[0,30]], closed=True), fin(), ext(10)], 40*30*10)
run('zero length line', [sk(), L([[0,0],[0,0]])], err=True)
# --- Prostokąt / okrąg / łuk
run('rect reversed corners', [sk(), rect(100,60,0,0), fin(), ext(30)], V)
run('rect negative coords', [sk(), rect(-50,-30,50,30), fin(), ext(30)], V, bbox=([-50,-30,0],[50,30,30]))
run('rect center', [sk(), C('sketch.rectangle.center', center=[0,0], corner=[50,30]), fin(), ext(30)], V)
run('rect degenerate', [sk(), rect(0,0,100,0)], err=True)
run('circle 3 points', [sk(), C('sketch.circle.three_point', p0=[10,0], p1=[0,10], p2=[-10,0]), fin(), ext(10)], PI*100*10)
run('circle zero radius', [sk(), circ(0,0,0)], err=True)
run('arc + line D shape', [sk(), L([[0,0],[40,0]]), C('sketch.arc.three_point', start=[40,0], end=[0,0], through=[20,20]), fin(), ext(10)], PI*400/2*10)
run('two circles overlap', [sk(), circ(0,0,10), circ(15,0,10), fin(), ext(10, profiles='all')], None, check=lambda d: None if d['bodies'][0]['volume_mm3'] < 2*PI*100*10 else 'overlap counted twice')
run('slot', [sk(), C('sketch.slot.center_to_center', p0=[0,0], p1=[40,0], width=10), fin(), ext(10)], (40*10+PI*25)*10)
# --- Zaokrąglenie szkicu
run('sketch fillet corner', [sk(), rect(0,0,100,60), C('sketch.fillet', point='p1', radius=10), fin(), ext(30)], V-(100-PI*100/4)*30)
run('sketch fillet 4 corners', [sk(), rect(0,0,100,60), C('sketch.fillet', points=['p1','p2','p3','p4'], radius=10), fin(), ext(30)], V-4*(100-PI*100/4)*30)
run('sketch fillet lines', [sk(), rect(0,0,100,60), C('sketch.fillet', a='l1', b='l2', radius=5), fin(), ext(30)], V-(25-PI*25/4)*30)
run('sketch fillet too big', [sk(), rect(0,0,100,60), C('sketch.fillet', point='p1', radius=80)], err=True)
# --- Odsunięcie
run('offset outward', [sk(), rect(0,0,100,60), C('sketch.offset', curves=['l1'], distance=5, side=[-10,-10]), fin(), ext(30, profiles='all')], 110*70*30)
run('offset inward', [sk(), rect(0,0,100,60), C('sketch.offset', curves=['l1'], distance=5, side=[50,30]), fin(), ext(30, profiles=[{'point':[50,30]}])], 90*50*30)
run('offset circle', [sk(), circ(0,0,10), C('sketch.offset', curves=['c1'], distance=5, side=[0,0]), fin(), ext(10, profiles=[{'point':[0,0]}])], PI*25*10)
run('offset symmetric', [sk(), rect(0,0,100,60), C('sketch.offset', curves=['l1'], distance=5, symmetric=True), fin()], None, check=solved(), bodies=0)
run('offset too far in', [sk(), circ(0,0,10), C('sketch.offset', curves=['c1'], distance=15, side=[0,0])], err=True)
# --- Przytnij
run('trim cross', [sk(), rect(0,0,100,60), L([[50,-20],[50,80]]), C('sketch.trim', curve='l5', at=[50,-10]), C('sketch.trim', curve='l5', at=[50,70]), fin(), ext(30, profiles='all')], V)
run('trim rectangle side', [sk(), rect(0,0,100,60), L([[50,0],[50,60]]), C('sketch.trim', curve='l1', at=[75,0]), fin()], None, check=solved(), bodies=0)
run('trim circle', [sk(), circ(0,0,10), L([[-20,0],[20,0]]), C('sketch.trim', curve='c1', at=[0,-10]), C('sketch.trim', curve='l1', at=[-15,0]), C('sketch.trim', curve='l1', at=[15,0]), fin(), ext(10)], PI*100/2*10)
# --- Lustro / szyki szkicu
run('sketch mirror', [sk(), L([[0,0],[40,0],[40,30],[0,30]]), C('sketch.mirror', entities=['l1','l2','l3'], line='y'), fin(), ext(10)], 80*30*10)
run('sketch mirror circle', [sk(), circ(20,0,5), C('sketch.mirror', entities=['c1'], line='y'), fin(), ext(10, profiles='all')], 2*PI*25*10, bodies=2)
run('sketch pattern circular', [sk(), circ(30,0,5), C('sketch.pattern.circular', entities=['c1'], center=[0,0], count=6), fin(), ext(10, profiles='all')], 6*PI*25*10, bodies=6)
run('sketch pattern circular 180', [sk(), circ(30,0,5), C('sketch.pattern.circular', entities=['c1'], center=[0,0], count=3, angle=180), fin(), ext(10, profiles='all')], 3*PI*25*10, bodies=3)
run('sketch pattern rect', [sk(), circ(0,0,4), C('sketch.pattern.rectangular', entities=['c1'], count=4, spacing=20, count2=3, spacing2=15), fin(), ext(10, profiles='all')], 12*PI*16*10, bodies=12)
run('pattern holes in plate', [sk(), rect(-10,-10,100,60), circ(0,0,4), C('sketch.pattern.rectangular', entities=['c1'], count=4, spacing=25, count2=3, spacing2=25), fin(), ext(10)], (110*70-12*PI*16)*10)
# --- Wymiary i wiązania
run('dimension resizes', [sk(), rect(0,0,100,60), C('sketch.dimension', entities=['l1'], value=50), fin(), ext(30, profiles='all')], None, check=lambda d: None if abs(d['bodies'][0]['bbox']['max'][0]-d['bodies'][0]['bbox']['min'][0]-50)<1e-6 else f"width {d['bodies'][0]['bbox']}")
run('dimension radius', [sk(), circ(0,0,10), C('sketch.dimension', entities=['c1'], type='diameter', value=30), fin(), ext(10)], PI*225*10)
run('dimension named param', [sk(), rect(0,0,100,60), C('sketch.dimension', entities=['l1'], value='szer = 80'), fin(), ext(30), C('parameters.change', name='szer', expression='40 mm')], 40*60*30)
run('dimension angle', [sk(), L([[0,0],[40,0]]), L([[0,0],[30,30]]), C('sketch.dimension', entities=['l1','l2'], type='angle', value='30 deg'), fin()], None, check=solved(), bodies=0)
run('fully constrained rect', [sk(), rect(0,0,100,60), C('sketch.dimension', entities=['l1'], value=100), C('sketch.dimension', entities=['l2'], value=60), C('sketch.constraint.coincident', a='p1', b='origin')], None, check=solved(dof=0), bodies=0)
run('horizontal', [sk(), L([[0,0],[40,5]]), C('sketch.constraint.horizontal_vertical', line='l1')], None, check=solved(), bodies=0)
run('vertical', [sk(), L([[0,0],[5,40]]), C('sketch.constraint.horizontal_vertical', line='l1', mode='vertical')], None, check=solved(), bodies=0)
run('perpendicular', [sk(), L([[0,0],[40,0]]), L([[40,0],[45,30]]), C('sketch.constraint.perpendicular', a='l1', b='l2')], None, check=solved(), bodies=0)
run('parallel', [sk(), L([[0,0],[40,0]]), L([[0,10],[40,15]]), C('sketch.constraint.parallel', a='l1', b='l2')], None, check=solved(), bodies=0)
run('equal', [sk(), circ(0,0,10), circ(30,0,5), C('sketch.constraint.equal', a='c1', b='c2'), fin(), ext(10, profiles='all')], 2*PI*100*10, bodies=2)
run('tangent', [sk(), L([[-20,12],[20,12]]), circ(0,0,10), C('sketch.constraint.tangent', a='l1', b='c1')], None, check=solved(), bodies=0)
run('coincident', [sk(), L([[0,0],[40,0]]), L([[41,1],[40,30]]), C('sketch.constraint.coincident', a='l1.end', b='l2.start')], None, check=solved(), bodies=0)
run('over constrained', [sk(), L([[0,0],[40,0]]), C('sketch.constraint.horizontal_vertical', line='l1'), C('sketch.constraint.horizontal_vertical', line='l1', mode='vertical')], err=True)
run('conflicting dims', [sk(), rect(0,0,100,60), C('sketch.dimension', entities=['l1'], value=100), C('sketch.dimension', entities=['l3'], value=50)], err=True)
# --- Rzutuj
run('project face edges', BLOCK+[sk({'face':[50,30,30]}), fin(), ext(10, operation='join', profiles='all')], 240000)
run('project edge + extrude', BLOCK+[C('construct.plane.offset', base='XY', offset=50, name='P1'), sk('P1'), C('sketch.project', refs=[{'body':'Body1'}]), fin(), ext(10, profiles='all')], V+60000, bodies=2)
summary()
