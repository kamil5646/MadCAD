# MadCAD checks

Run all of them before a release (the Windows build runs the function and interface checks too):

    bash packaging/madcad/check.sh           # build, unit tests, function checks, interface checks
    bash packaging/madcad/check.sh --quick   # the same without the unit tests
    bash packaging/madcad/check.sh --full    # also the engine unit tests (about 25 minutes)

## Function checks (`t_*.py`)

Each basic function in many variants (extrude directions and operations, revolve, fillet, chamfer,
shell, hole, press-pull, move, mirror, pattern, sketch tools, constraints, dimensions, history
edits, undo). Every case runs through `solidcraft-cli eval` and checks the bodies' count, volume,
closed shells and expected errors. `MADCAD_CLI` names another CLI than `target/release/solidcraft-cli`.

## Interface checks (`ui/`)

A private MadCAD window (its own settings, recovery and control folders) worked the way a user
works it: ribbon buttons, letter shortcuts, clicks in the view, typed values, Tab and Shift+Tab,
Enter, Esc, undo and redo, the timeline, the right-click menu, save and open. Each check starts
from an empty design and checks the design that comes out. The run also fails on:

- a button or key that does nothing visible, or answers with a message about its inputs;
- a message the Polish interface shows in English (`ui/untranslated-ok.txt` lists the allowed ones);
- a panic in the app's log.

    python3 packaging/madcad/qa/ui/test_ui.py [binary] [-k part-of-a-name ...]

On a Mac the screen must be unlocked: a locked screen's windows get no clicks.

## Unit tests

`cargo test -p solidcraft-ui-egui` runs SolidCraft's scenarios from SolidCraft's own defaults
(`scenario::upstream_defaults`); MadCAD's defaults are checked by `prefs::madcad_defaults` and
by the interface checks above.
