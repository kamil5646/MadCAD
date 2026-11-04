"""MadCAD interface checks: each one starts from an empty design and works the window the way a
user does (buttons, shortcuts, clicks in the view, typed values, Tab, Enter, Esc), then checks
the design that comes out.

    python3 packaging/madcad/qa/ui/test_ui.py [binary] [-k name ...]
"""

import json
import math
import sys

from madcad_ui import App, Failure, default_binary, expect, near, needs_quick_frames, run, test

PI = math.pi


def rect_sketch(a, x0=0, y0=0, x1=40, y1=20, plane="XY"):
    a.ex("sketch.create", plane=plane)
    a.ex("sketch.rectangle.two_point", p0=[x0, y0], p1=[x1, y1])
    a.ex("sketch.finish")
    a.wait_idle()


def no_dialog(a, what):
    expect(a.soon(lambda: a.dialog() is None), f"{what}: the window is still open ({a.dialog_kind()}), status: {a.status()}")


# ---------------------------------------------------------------- feature windows by keyboard


@test
def extrude_typed_value_and_enter(a):
    rect_sketch(a)
    a.key("E")
    expect(a.soon(lambda: a.dialog_kind() == "Extrude"), f"E opened {a.dialog_kind()}")
    a.type("15")
    a.key("Enter")
    no_dialog(a, "Enter")
    expect(a.volume_near(40 * 20 * 15), f"volume {a.volume()} != 12000")


@test
def extrude_escape_leaves_nothing(a):
    rect_sketch(a)
    a.key("E")
    a.type("15")
    a.key("Escape")
    no_dialog(a, "Esc")
    expect(a.soon(lambda: a.volume() == 0 and not a.bodies()), f"Esc left bodies: {a.volume()}")


@test
def extrude_tab_keeps_the_keyboard(a):
    rect_sketch(a)
    a.key("E")
    a.type("15")
    a.key("Tab")
    a.type("7")
    a.key("Enter")
    no_dialog(a, "Enter after Tab")
    expect(a.volume_near(40 * 20 * 7), f"after 15, Tab, 7: volume {a.volume()} (7 was lost?)")


@test
def extrude_two_sides_tab_and_shift_tab(a):
    rect_sketch(a)
    a.key("E")
    a.click(a.handle("dialog:Direction"))
    a.click(a.handle("dialog:Direction:Two Sides"))
    a.click(a.handle("dialog:Distance"))
    a.key("A", cmd=True)
    a.type("12")
    a.key("Tab")
    a.type("6")
    a.key("Tab")
    a.type("4")
    a.key("Tab", shift=True)
    a.type("8")
    a.key("Enter")
    no_dialog(a, "Enter")
    expect(a.volume_near(40 * 20 * (4 + 8)), f"4 and 8 typed with Tab/Shift+Tab: volume {a.volume()} != 9600")


@test
def extrude_ok_button(a):
    rect_sketch(a)
    a.button("solid.extrude")
    a.type("5")
    a.click(a.handle("dialog:ok"))
    no_dialog(a, "OK")
    expect(a.volume_near(4000), f"volume {a.volume()}")


@test
def extrude_cancel_button(a):
    rect_sketch(a)
    a.button("solid.extrude")
    a.type("5")
    a.click(a.handle("dialog:cancel"))
    no_dialog(a, "Cancel")
    expect(a.soon(lambda: not a.bodies()), "Cancel left a body")


@test
def extrude_cut_from_a_face_sketch(a):
    a.block(40, 20, 10)
    a.ex("sketch.create", plane={"face": [20, 10, 10]})
    a.wait_idle(1.2)
    a.key("C")
    a.click(a.w(20, 10, 10))
    a.click(a.w(25, 10, 10))
    a.key("Escape")
    cs = [c for c in curves(a) if c.get("type") == "circle"]
    expect(len(cs) == 1, f"circle on the face: {cs}")
    r = cs[0]["radius"]
    a.button("sketch.finish")
    a.key("E")
    a.click(a.handle("dialog:Operation"))
    a.click(a.handle("dialog:Operation:Cut"))
    a.click(a.handle("dialog:Distance"))
    a.key("A", cmd=True)
    a.type("4")
    a.key("Enter")
    no_dialog(a, "Enter")
    want = 8000 - PI * r * r * 4
    # The mesh's circle is a polygon a little inside the true one.
    expect(a.volume_near(want, 4), f"cut 4 mm into the block: volume {a.volume()} != {want:.1f}")


@test
def press_pull_on_a_face(a):
    a.block(40, 20, 10)
    a.key("Q")
    a.click(a.w(20, 10, 10))
    a.type("5")
    a.key("Enter")
    no_dialog(a, "Enter")
    expect(a.volume_near(40 * 20 * 15), f"pull the top 5 mm: volume {a.volume()} != 12000")


@test
def fillet_one_edge(a):
    a.block(40, 20, 10)
    a.key("F")
    a.click(a.w(20, 0, 10))
    a.type("3")
    a.key("Enter")
    no_dialog(a, "Enter")
    want = 8000 - (4 - PI) * 9 / 4 * 40
    # The volume is the mesh's: the rounded edge is a few facets, a little under the true arc.
    expect(a.volume_near(want, 4), f"R3 on a 40 mm edge: volume {a.volume()} != {want:.1f}")


@test
def chamfer_one_edge(a):
    a.block(40, 20, 10)
    a.button("solid.chamfer")
    a.click(a.w(20, 0, 10))
    a.type("2")
    a.key("Enter")
    no_dialog(a, "Enter")
    expect(a.volume_near(8000 - 2 * 40, 1), f"2 mm chamfer on a 40 mm edge: volume {a.volume()} != 7920")


@test
def shell_top_face(a):
    a.block(40, 20, 10)
    a.button("solid.shell")
    a.click(a.w(20, 10, 10))
    a.type("2")
    a.key("Enter")
    no_dialog(a, "Enter")
    want = 8000 - 36 * 16 * 8
    expect(a.volume_near(want, 1), f"2 mm shell open at the top: volume {a.volume()} != {want}")


@test
def hole_on_top_face(a):
    a.block(40, 20, 10)
    a.key("H")
    a.click(a.w(20, 10, 10))
    a.wait_idle(0.8)
    a.key("Enter")
    no_dialog(a, "Enter")
    v = a.volume()
    expect(0 < v < 8000 - 1, f"the hole removed nothing: volume {v}")


@test
def offset_plane_typed(a):
    a.block(40, 20, 10)
    a.button("construct.plane.offset")
    a.click(a.w(20, 10, 10))
    a.type("25")
    a.key("Enter")
    no_dialog(a, "Enter")
    tl = a.timeline()
    expect(any("plane" in str(t).lower() for t in tl[-1:]), f"no plane in the timeline: {tl[-1:]}")


@test
def move_body_typed(a):
    a.block(40, 20, 10)
    a.key("M")
    a.click(a.w(20, 10, 10))
    a.type("30")
    a.key("Enter")
    no_dialog(a, "Enter")
    b = a.bodies()
    expect(len(b) == 1 and a.volume_near(8000), f"move changed the volume: {a.volume()}")
    expect(any(t.get("error") is None for t in a.timeline()[-1:]), "move failed")


# ---------------------------------------------------------------- undo, redo, delete


@test
def undo_and_redo_keys(a):
    rect_sketch(a)
    a.key("E")
    a.type("10")
    a.key("Enter")
    expect(a.volume_near(8000), f"volume {a.volume()}")
    a.key("Z", cmd=True)
    expect(a.soon(lambda: a.volume() == 0), f"Ctrl+Z left volume {a.volume()}")
    a.key("Y", cmd=True)
    expect(a.volume_near(8000), f"Ctrl+Y: volume {a.volume()}")
    a.key("Z", cmd=True)
    a.key("Z", cmd=True, shift=True)
    expect(a.volume_near(8000), f"Ctrl+Shift+Z: volume {a.volume()}")


@test
def repeat_last_command(a):
    rect_sketch(a)
    a.key("E")
    a.type("10")
    a.key("Enter")
    a.key("R", shift=True)
    expect(a.soon(lambda: a.dialog_kind() == "Extrude"), f"Shift+R opened {a.dialog_kind()}")
    a.key("Escape")


# ---------------------------------------------------------------- sketch by keyboard and mouse


def sketch_ui(a):
    a.open_sketch_ui("XY")


def curves(a):
    return (a.sketch() or {}).get("curves", [])


def points(a):
    return {p["id"]: p["at"] for p in (a.sketch() or {}).get("points", [])}


@test
def sketch_rectangle_typed_with_tab(a):
    sketch_ui(a)
    a.key("R")
    a.click(a.s(0, 0))
    a.move(a.s(30, 20))
    a.move(a.s(31, 21))
    a.type("40")
    a.key("Tab")
    a.type("25")
    a.key("Enter")
    a.key("Escape")
    pts = sorted(tuple(round(v, 3) for v in p) for k, p in points(a).items() if k != "origin")
    expect(pts == [(0, 0), (0, 25), (40, 0), (40, 25)], f"40 Tab 25 made corners {pts}")


@test
def sketch_line_length_and_angle(a):
    sketch_ui(a)
    a.key("L")
    a.click(a.s(0, 0))
    a.move(a.s(30, 10))
    a.move(a.s(31, 11))
    a.type("50")
    a.key("Tab")
    a.type("30")
    a.key("Enter")
    a.key("Escape")
    a.key("Escape")
    ends = [p for k, p in points(a).items() if k not in ("origin",) and abs(p[0]) + abs(p[1]) > 1]
    want = (50 * math.cos(math.radians(30)), 50 * math.sin(math.radians(30)))
    expect(any(near(p[0], want[0], 0.01) and near(p[1], want[1], 0.01) for p in ends), f"50 Tab 30: points {ends}")


@test
def sketch_line_shift_tab_goes_back(a):
    sketch_ui(a)
    a.key("L")
    a.click(a.s(0, 0))
    a.move(a.s(30, 10))
    a.move(a.s(31, 11))
    a.type("50")
    a.key("Tab")
    a.type("30")
    a.key("Tab", shift=True)
    a.type("20")
    a.key("Enter")
    a.key("Escape")
    a.key("Escape")
    ends = [p for k, p in points(a).items() if k != "origin" and abs(p[0]) + abs(p[1]) > 1]
    want = (20 * math.cos(math.radians(30)), 20 * math.sin(math.radians(30)))
    expect(any(near(p[0], want[0], 0.01) and near(p[1], want[1], 0.01) for p in ends), f"50 Tab 30 Shift+Tab 20: points {ends}")


@test
def sketch_circle_typed(a):
    sketch_ui(a)
    a.key("C")
    a.click(a.s(0, 0))
    a.move(a.s(10, 0))
    a.move(a.s(11, 0))
    a.type("30")
    a.key("Enter")
    a.key("Escape")
    cs = [c for c in curves(a) if c.get("type") == "circle"]
    expect(len(cs) == 1, f"circles: {cs}")
    r = cs[0].get("radius")
    expect(r is not None and (near(r, 15, 0.01) or near(r, 30, 0.01)), f"typed 30, circle {cs[0]}")


@test
def sketch_escape_ends_the_tool(a):
    sketch_ui(a)
    a.key("L")
    expect(a.tool(), "L started no tool")
    a.key("Escape")
    expect(not a.tool(), f"Esc left the tool {a.tool()}")
    expect(a.doc().get("active_sketch") is not None, "one Esc left the sketch too")
    a.key("Escape")
    expect(a.doc().get("active_sketch") is not None, "a slow second Esc left the sketch")


@test
def sketch_escape_twice_finishes_it(a):
    needs_quick_frames(a, "two Escapes within 0.4 s")
    sketch_ui(a)
    a.key("R")
    a.click(a.s(0, 0))
    a.click(a.s(30, 20))
    a.key("Escape")
    a.escape_twice()
    expect(a.soon(lambda: a.doc().get("active_sketch") is None), "Esc Esc left the sketch open")
    expect(len(a.doc().get("sketches", [])) == 1, "Esc Esc lost the sketch")


@test
def sketch_undo_in_sketch(a):
    sketch_ui(a)
    a.key("R")
    a.click(a.s(0, 0))
    a.click(a.s(30, 20))
    a.key("Escape")
    n = len(curves(a))
    expect(n == 4, f"rectangle by two clicks: {n} curves")
    a.key("Z", cmd=True)
    expect(len(curves(a)) == 0, f"Ctrl+Z in the sketch left {len(curves(a))} curves")


@test
def sketch_dimension_typed(a):
    sketch_ui(a)
    a.key("L")
    a.click(a.s(0, 0))
    a.click(a.s(30, 0))
    a.key("Escape")
    a.key("Escape")
    a.key("D")
    a.click(a.s(15, 0))
    a.click(a.s(15, -8))
    # The value box takes the keyboard once the dimension is placed (a slow computer needs a moment).
    a.wait_idle(1.0)
    a.type("45")
    a.key("Enter")
    a.key("Escape")
    # The line starts on the origin, where the click snapped.
    xs = sorted({round(p[0], 3) for p in points(a).values()})
    expect(xs and near(xs[-1] - xs[0], 45, 0.01), f"dimension 45 on a 30 mm line: x {xs}")


@test
def sketch_finish_then_extrude(a):
    sketch_ui(a)
    a.key("R")
    a.click(a.s(0, 0))
    a.click(a.s(30, 20))
    a.key("Escape")
    a.button("sketch.finish")
    expect(a.soon(lambda: a.doc().get("active_sketch") is None), "Finish left the sketch open")
    a.key("E")
    a.type("10")
    a.key("Enter")
    expect(a.volume_near(6000, 1), f"volume {a.volume()} != 6000")



# ---------------------------------------------------------------- more feature windows


def origin_row(a, name):
    """Click a plane or axis of the Origin in the browser, unfolding the Origin when it is folded."""
    a.wait_idle(0.5)
    if "row:" + name not in a.handles("row:"):
        a.click(a.handle("fold:Origin"))
    a.click(a.handle("row:" + name))


@test
def revolve_about_an_axis(a):
    rect_sketch(a, 10, 0, 20, 30, plane="XZ")
    a.button("solid.revolve")
    a.click(a.handle("dialog:row:Axis"))
    # The origin's axes are hidden at first: the Z axis is picked in the browser, as a user does.
    origin_row(a, "Z")
    a.key("Enter")
    no_dialog(a, "Enter")
    want = PI * (20 * 20 - 10 * 10) * 30
    expect(a.volume_near(want, want * 0.01), f"ring r10..20 h30: volume {a.volume()} != {want:.0f}")


@test
def mirror_body_on_a_plane(a):
    a.block(40, 20, 10)
    a.button("solid.mirror")
    a.click(a.w(20, 10, 10))
    a.click(a.handle("dialog:row:Mirror Plane"))
    origin_row(a, "YZ")
    a.key("Enter")
    no_dialog(a, "Enter")
    expect(a.volume_near(16000, 2), f"block and its mirror image: volume {a.volume()} != 16000")


@test
def rectangular_pattern_of_a_body(a):
    a.block(40, 20, 10)
    a.button("solid.pattern.rectangular")
    a.click(a.w(20, 10, 10))
    a.click(a.handle("dialog:row:Direction"))
    a.click(a.w(20, 0, 0))
    a.wait_idle(0.8)
    a.key("Enter")
    no_dialog(a, "Enter")
    v = a.volume()
    expect(v >= 16000 - 2 and abs(v / 8000 - round(v / 8000)) < 0.001, f"copies of an 8000 mm3 block: volume {v}")


@test
def edit_a_feature_from_the_timeline(a):
    rect_sketch(a)
    a.key("E")
    a.type("10")
    a.key("Enter")
    needs_quick_frames(a, "a double click")
    a.click(a.handle("timeline:Extrude1"), double=True)
    a.wait_idle(0.8)
    expect(a.soon(lambda: a.dialog_kind() == "Extrude"), f"double click on Extrude1 opened {a.dialog_kind()}")
    a.click(a.handle("dialog:Distance"))
    a.key("A", cmd=True)
    a.type("25")
    a.key("Enter")
    no_dialog(a, "Enter")
    expect(a.volume_near(40 * 20 * 25), f"edited to 25: volume {a.volume()}")
    expect(len(a.timeline()) == 2, f"the edit added features: {[t['name'] for t in a.timeline()]}")


@test
def context_menu_runs_an_item(a):
    a.block(40, 20, 10)
    a.click(a.w(20, 10, 10), button="right")
    a.wait_idle(0.6)
    menu = a.call("ui.menu")
    labels = [i.get("id") for i in menu.get("items", [])]
    expect("solid.extrude" in labels, f"menu on a face: {labels}")
    a.call("ui.menuPick", item="solid.shell")
    a.wait_idle(0.6)
    expect(a.soon(lambda: a.dialog_kind() == "Shell"), f"Shell from the menu opened {a.dialog_kind()}")
    a.key("Escape")


@test
def delete_a_feature_with_the_key(a):
    rect_sketch(a)
    a.key("E")
    a.type("10")
    a.key("Enter")
    a.click(a.handle("timeline:Extrude1"))
    a.key("Delete")
    a.wait_idle(0.6)
    if (a.call("ui.confirm", check=False) or {}).get("pending"):
        a.call("ui.confirm", accept=True)
        a.wait_idle(0.6)
    expect(a.soon(lambda: not a.bodies()), f"Delete left {len(a.bodies())} bodies")
    a.key("Z", cmd=True)
    expect(a.volume_near(8000), f"undo after Delete: volume {a.volume()}")


@test
def click_selects_and_escape_clears(a):
    a.block(40, 20, 10)
    a.click(a.w(20, 10, 10))
    a.soon(lambda: len(a.call("ui.selection")["selection"]) == 1)
    sel = a.call("ui.selection")["selection"]
    expect(len(sel) == 1 and sel[0]["type"] == "face", f"click on the top: {sel}")
    a.key("Escape")
    expect(a.soon(lambda: not a.call("ui.selection")["selection"]), "Esc kept the selection")


@test
def save_and_open_keep_the_design(a):
    import os
    import tempfile

    rect_sketch(a)
    a.key("E")
    a.type("12")
    a.key("Enter")
    no_dialog(a, "Enter")
    expect(a.volume_near(40 * 20 * 12), f"before saving: volume {a.volume()}")
    path = os.path.join(tempfile.mkdtemp(prefix="madcad-ui-save-"), "test.sc")
    a.ex("file.save", path=path)
    expect(os.path.getsize(path) > 0, "nothing saved")
    a.new()
    expect(not a.bodies(), "the new design is not empty")
    a.ex("doc.open", path=path)
    a.wait_idle(1.5)
    expect(a.volume_near(40 * 20 * 12), f"reopened: volume {a.volume()}")


@test
def save_view_and_restore_view_buttons(a):
    a.block()
    a.click(a.handle("tab:VIEW"))
    a.button("view.apply")
    expect(a.status() and "`" not in a.status(), f"Restore View with no saved view says: {a.status()}")
    a.button("view.save")
    st = a.status() or ""
    expect(st and "`" not in st and "camera" not in st, f"Save View says: {st}")
    a.key("1", cmd=True)
    a.button("view.apply")
    items = [i.get("label") for i in (a.call("ui.menu") or {}).get("items", [])]
    expect(len(items) == 1, f"Restore View lists the saved view: {items}")
    a.call("ui.menu", close=True)


# ---------------------------------------------------------------- every button and shortcut

# Buttons that open the system's file window, which the test cannot answer.
FILE_WINDOWS = {
    "file.insert_mesh", "file.insert_step", "sketch.insert_dxf", "sketch.insert_svg", "canvas.insert",
    "pointcloud.insert", "parts.library", "canvas.decal", "sketch.import_image",
}


def state(a):
    i = a.inspect()
    status = i.get("status") if isinstance(i.get("status"), dict) else {}
    return {
        "dialog": i.get("dialog"),
        "tool": i.get("tool"),
        "doc": (a.doc().get("revision"), a.doc().get("active_sketch")),
        "camera": json.dumps(i.get("camera")),
        "handles": set(a.handles("")),
        "status": (status or {}).get("text"),
        "error": bool((status or {}).get("error")),
        "menu": bool((a.call("ui.menu") or {}).get("items")),
        "file": i.get("file_dialog_open"),
    }


def press_and_back(a, name, start):
    """Press a button or key: it must do something you can see (a window, a tool, a menu, a
    message, a change), and no message about its inputs. Then put it away."""
    before = state(a)
    start()
    a.wait_idle(0.6)
    after = state(a)
    problems = []
    seen = (
        after["dialog"] != before["dialog"]
        or after["tool"] != before["tool"]
        or after["doc"] != before["doc"]
        or after["camera"] != before["camera"]
        or after["menu"]
        or after["file"]
        or after["status"] != before["status"]
        or len(after["handles"] - before["handles"]) > 0
    )
    if not seen:
        problems.append("nothing happened")
    text = after["status"] or ""
    if after["status"] != before["status"] and ("`" in text or " must be " in text or " is required" in text):
        problems.append(f"says: {text}")
    if a.proc.poll() is not None:
        problems.append("the app exited")
    a.call("ui.menu", close=True)
    for _ in range(2):
        if a.dialog() or a.tool() or len(set(a.handles("dialog:"))) > 0:
            a.key("Escape")
    return problems


@test
def every_model_button_does_something(a):
    a.block(40, 20, 10)
    bad = []
    for tab in [k for k in a.handles("tab:") if k[4:].isupper()]:
        a.click(a.handle(tab))
        a.wait_idle(1.0)
        for name in sorted(a.handles("button:")):
            command = name[len("button:"):]
            if command in FILE_WINDOWS:
                continue
            p = press_and_back(a, command, lambda: a.click(a.handle(name)))
            if p:
                bad.append(f"{tab[4:]}/{command}: {', '.join(p)}")
            # Back to the plain block for the next button.
            if a.doc().get("active_sketch") is not None or len(a.timeline()) != 2 or not a.volume_near(8000):
                a.new()
                a.block(40, 20, 10)
                a.click(a.handle(tab))
                a.wait_idle(1.0)
            a.call("ui.menu", close=True)
    expect(not bad, "buttons:\n    " + "\n    ".join(bad))


@test
def every_sketch_button_does_something(a):
    a.open_sketch_ui("XY")
    a.ex("sketch.rectangle.two_point", p0=[0, 0], p1=[40, 20])
    a.ex("sketch.circle.center", center=[60, 10], radius=8)
    bad = []
    for name in sorted(a.handles("button:")):
        command = name[len("button:"):]
        if command in FILE_WINDOWS or command in ("sketch.finish", "sketch.cancel"):
            continue
        p = press_and_back(a, command, lambda: a.click(a.handle(name)))
        if a.doc().get("active_sketch") is None:
            bad.append(f"{command}: left the sketch")
            a.new()
            a.open_sketch_ui("XY")
            a.ex("sketch.rectangle.two_point", p0=[0, 0], p1=[40, 20])
            a.ex("sketch.circle.center", center=[60, 10], radius=8)
        if p:
            bad.append(f"{command}: {', '.join(p)}")
    expect(not bad, "sketch buttons:\n    " + "\n    ".join(bad))


@test
def every_letter_shortcut_starts_its_command(a):
    a.block(40, 20, 10)
    keys = {}
    for c in a.call("engine.commands"):
        r = a.call("ui.shortcut", command=c["id"])
        for k in (r or {}).get("keys", []):
            if len(k) == 1 and k.isalpha():
                keys[k] = c["id"]
    bad = []
    for k, command in sorted(keys.items()):
        # Render's own keys (paint, pick up) work in the Render workspace only.
        if command.startswith("render.") or command in ("appearance.paint", "appearance.pick_up"):
            continue
        sketch = command.startswith("sketch.")
        if sketch and a.doc().get("active_sketch") is None:
            a.ex("sketch.create", plane="XY")
            a.ex("sketch.line", points=[[0, 0], [30, 0]])
            a.wait_idle(1)
        if not sketch and a.doc().get("active_sketch") is not None:
            a.ex("sketch.finish")
            a.wait_idle()
        p = press_and_back(a, command, lambda: a.key(k))
        if p:
            bad.append(f"{k} ({command}): {', '.join(p)}")
    expect(not bad, "keys:\n    " + "\n    ".join(bad))


# ---------------------------------------------------------------- view keys


@test
def view_keys_turn_the_camera(a):
    a.block()
    seen = set()
    for k in "1234567":
        a.key(k, cmd=True)
        a.wait_idle(0.6)
        cam = a.inspect().get("camera")
        seen.add(json.dumps(cam, sort_keys=True))
    expect(len(seen) == 7, f"Ctrl+1..7 gave {len(seen)} different views")
    a.key("F6")


if __name__ == "__main__":
    args = sys.argv[1:]
    only = []
    if "-k" in args:
        i = args.index("-k")
        only = args[i + 1 :]
        args = args[:i]
    binary = args[0] if args else default_binary()
    app = App(binary)
    try:
        ok = run(app, only)
    finally:
        app.close()
    sys.exit(0 if ok else 1)
