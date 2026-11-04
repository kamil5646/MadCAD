//! MadCAD: ribbon buttons that only report something say it in the status line (a button
//! that shows nothing looks broken).

use serde_json::json;

use crate::scenario::Harness;

fn block() -> Harness {
    let mut h = Harness::new();
    h.app.home.open = false;
    for (id, p) in [
        ("sketch.create", json!({"plane": "XY"})),
        ("sketch.rectangle.two_point", json!({"p0": [0, 0], "p1": [40, 20]})),
        ("sketch.finish", json!({})),
        ("solid.extrude", json!({"distance": 10})),
    ] {
        h.app.run(id, p).unwrap();
    }
    h.frames(2);
    h
}

fn status(h: &Harness) -> (String, bool) {
    h.app.status.as_ref().map(|s| (s.0.to_string(), s.2)).unwrap_or_default()
}

#[test]
fn inspect_design_says_what_the_design_holds() {
    let mut h = block();
    h.app.start("document.inspect");
    h.frames(1);
    let (text, error) = status(&h);
    assert!(text.contains("1 bodies") && text.contains("1 sketches") && text.contains("2 features"), "{text}");
    assert!(!error && !text.contains('`'), "{text}");
}

#[test]
fn check_contact_answers_when_nothing_passes_through() {
    let mut h = block();
    h.app.start("contact.check");
    h.frames(1);
    let (text, error) = status(&h);
    assert!(text.starts_with("Check Contact:") && !error, "{text}");
}

// ---- the interface checks' flows, by clicks and keys as packaging/madcad/qa/ui does them

fn handles(prefix: &str) -> Vec<(String, f64, f64)> {
    crate::scenario::handles(prefix).into_iter().map(|(n, p)| (n, p.x as f64, p.y as f64)).collect()
}

fn click(h: &mut Harness, name: &str, double: bool) {
    let Some((_, x, y)) = handles(name).into_iter().find(|(n, _, _)| n == name) else {
        panic!("`{name}` is not on screen: {:?}", handles("").iter().map(|x| x.0.clone()).filter(|n| n.starts_with(name.split(':').next().unwrap())).collect::<Vec<_>>())
    };
    h.call("ui.click", json!({"x": x, "y": y, "double": double}));
    h.frames(4);
}

fn key(h: &mut Harness, k: &str) {
    h.call("ui.key", json!({"key": k}));
    h.frames(4);
}

fn kind(h: &Harness) -> String {
    h.app.dialog.as_ref().map(|d| format!("{:?}", d.kind).split([' ', '{', '(']).next().unwrap_or("").to_string()).unwrap_or_default()
}

#[test]
fn revolve_takes_enter_after_the_axis_is_picked_in_the_browser() {
    let mut h = Harness::new();
    h.app.home.open = false;
    h.app.preferences.hide_origin = true;
    h.call("ui.resize", json!({"width": 1600, "height": 1000}));
    for (id, p) in [
        ("sketch.create", json!({"plane": "XZ"})),
        ("sketch.rectangle.two_point", json!({"p0": [10, 0], "p1": [20, 30]})),
        ("sketch.finish", json!({})),
    ] {
        h.app.run(id, p).unwrap();
    }
    h.frames(3);
    h.app.start("solid.revolve");
    h.frames(4);
    click(&mut h, "dialog:row:Axis", false);
    if !handles("row:Z").iter().any(|(n, _, _)| n == "row:Z") {
        click(&mut h, "fold:Origin", false);
    }
    click(&mut h, "row:Z", false);
    h.settle();
    let focused = h.ctx.memory(|m| m.focused());
    key(&mut h, "Enter");
    h.settle();
    assert!(h.app.dialog.is_none(), "Enter left {} open (focus {focused:?}), status {:?}, inputs {:?}", kind(&h), h.app.status,
        h.app.dialog.as_ref().map(|d| d.inputs.iter().map(|i| (i.label, i.items.len())).collect::<Vec<_>>()));
}

#[test]
fn a_double_click_on_a_history_item_edits_it() {
    let mut h = block();
    h.call("ui.resize", json!({"width": 1600, "height": 1000}));
    h.frames(3);
    click(&mut h, "timeline:Extrude1", true);
    h.settle();
    assert_eq!(kind(&h), "Extrude", "status {:?}", h.app.status);
}
