from harness import *
V=180000
F=BLOCK+[C('solid.fillet', edges=[[50,0,30]], radius=5), C('solid.hole', position=[50,30,30], diameter=10)]
fv=V-(25-PI*25/4)*100
run('base fillet+hole', F, fv-PI*25*30)
run('edit extrude taller', F+[C('timeline.edit', feature='Extrude1', set={'extent':{'distance':'40'}})], 100*60*40-(25-PI*25/4)*100-PI*25*40)
run('edit extrude shorter', F+[C('timeline.edit', feature='Extrude1', set={'extent':{'distance':'10'}})], 100*60*10-(25-PI*25/4)*100-PI*25*10)
run('edit fillet radius', F+[C('timeline.edit', feature='Fillet1', set={'radius':'8'})], V-(64-PI*64/4)*100-PI*25*30)
run('edit sketch rect via param', [C('parameters.change', name='w', expression='100 mm'), sk(), C('sketch.rectangle.two_point', p0=[0,0], p1=['w',60]), fin(), ext(30), C('solid.fillet', edges=[[50,0,30]], radius=5), C('parameters.change', name='w', expression='80 mm')], 80*60*30-(25-PI*25/4)*80)
run('delete hole', F+[C('timeline.delete', feature='Hole1')], fv)
run('suppress fillet', F+[C('timeline.suppress', feature='Fillet1')], V-PI*25*30)
run('roll back to extrude', F+[C('timeline.roll_to', feature='Extrude1')], V)
run('undo once', F+[C('edit.undo')], fv)
run('undo twice', F+[C('edit.undo'), C('edit.undo')], V)
run('undo redo', F+[C('edit.undo'), C('edit.undo'), C('edit.redo')], fv)
run('delete sketch leaves later features failing', F+[C('timeline.delete', feature='Sketch1')], err=True)
run('edit makes fillet fail', F+[C('timeline.edit', feature='Extrude1', set={'extent':{'distance':'4'}})], err=True)
summary()
