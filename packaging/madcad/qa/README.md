# MadCAD function checks

Each basic function in many variants (extrude directions and operations, revolve, fillet, chamfer,
shell, hole, press-pull, move, mirror, pattern, sketch tools, constraints, dimensions, history
edits, undo). Every case runs through `solidcraft-cli eval` and checks the bodies' count, volume,
closed shells and expected errors. Run after a release build:

    cd packaging/madcad/qa && for t in t_solid.py t_sketch.py t_hist.py; do python3 $t | grep -v '^OK'; done
