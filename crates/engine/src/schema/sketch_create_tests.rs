use serde_json::json;

use super::{SplineReverseParams, SplineReverseResult};
use crate::Session;
use crate::schema::tests::{assert_keys, assert_strict_keeps_todays_errors, conforms};
use crate::schema::{ParamCheck, input_schema_for, output_schema_for};

#[test]
fn schemas_and_the_key_check_agree() {
    assert_keys(input_schema_for::<SplineReverseParams>(), &["curve", "sketch"]);
}

#[test]
fn strict_keeps_todays_errors() {
    assert_strict_keeps_todays_errors(&[
        ("sketch.spline.reverse", json!({"curve": 5})),
        ("sketch.spline.reverse", json!({"curve": null})),
        ("sketch.spline.reverse", json!({"curve": "nope"})),
        ("sketch.spline.reverse", json!({"curve": "l1"})),
    ]);
}

#[test]
fn spline_reverse_reply_matches_its_schema() {
    let mut s = Session { param_check: ParamCheck::Warn, ..Session::default() };
    let run = |s: &mut Session, id: &str, p: serde_json::Value| s.execute(id, &p).unwrap_or_else(|e| panic!("{id}: {e}"));
    run(&mut s, "sketch.create", json!({"plane": "XY"}));
    let c = run(&mut s, "sketch.spline.fit_point", json!({"points": [[0, 0], [10, 5], [20, 0]]}));
    let spline = c["curves"][0].as_str().unwrap_or_else(|| panic!("{c}")).to_string();
    let schema = output_schema_for::<SplineReverseResult>();
    let schema = schema.as_value();
    let r = run(&mut s, "sketch.spline.reverse", json!({"curve": spline}));
    assert!(conforms(schema, schema, &r), "{r} doesn't match {schema}");
    assert!(r.get("param_warnings").is_none(), "{r}");
    let r = run(&mut s, "sketch.spline.reverse", json!({"curve": spline, "unknown": 1}));
    assert!(conforms(schema, schema, &r), "{r} doesn't match {schema}");
    assert!(r["param_warnings"].as_array().is_some_and(|w| !w.is_empty()), "{r}");
}

#[test]
fn construction_line_contracts_and_replies_match() {
    use super::{ConstructionLineParams, ConstructionLineResult};
    assert_keys(
        input_schema_for::<ConstructionLineParams>(),
        &["alternate", "angle", "at", "curve", "curve2", "mode", "near", "sketch", "solution", "through"],
    );
    let schema = output_schema_for::<ConstructionLineResult>();
    let schema = schema.as_value();
    let mut s = Session { param_check: ParamCheck::Strict, ..Session::default() };
    s.execute("sketch.create", &json!({"plane":"XY"})).unwrap();
    for (id, p) in [
        ("sketch.construction_line", json!({"at":[0,0],"through":[5,5]})),
        ("sketch.construction_line.horizontal", json!({"at":[0,10]})),
        ("sketch.construction_line.angle", json!({"at":[10,10],"angle":30})),
    ] {
        let r = s.execute(id, &p).unwrap();
        assert!(conforms(schema, schema, &r), "{r}");
    }
    assert!(s.execute("sketch.construction_line", &json!({"at":[0,0],"mode":"unknown"})).is_err());
}

#[test]
fn polyline_contract_preserves_closed_profile_and_undo() {
    use super::{PolylineParams, PolylineResult};
    assert_keys(input_schema_for::<PolylineParams>(), &["closed", "connect", "construction", "ids", "infer", "points", "sketch"]);
    let mut s = Session { param_check: ParamCheck::Strict, ..Session::default() };
    s.execute("sketch.create", &json!({"plane":"XY"})).unwrap();
    let reply = s.execute("sketch.polyline", &json!({"points":[[0,0],[40,0],[40,30],[0,30]],"closed":true})).unwrap();
    let schema = output_schema_for::<PolylineResult>();
    assert!(conforms(schema.as_value(), schema.as_value(), &reply), "{reply}");
    assert_eq!(reply["curves"].as_array().unwrap().len(), 4);
    let sketch = s.model.state().sketch(s.active_sketch.unwrap()).unwrap().sketch.clone();
    assert_eq!(sketch.curves.len(), 4);
    assert!(s.execute("sketch.polyline", &json!({"points":[[0,0],[0,0]]})).is_err());
    assert_eq!(s.model.state().sketch(s.active_sketch.unwrap()).unwrap().sketch.curves.len(), 4);
    s.execute("edit.undo", &json!({})).unwrap();
    assert!(s.model.state().sketch(s.active_sketch.unwrap()).unwrap().sketch.curves.is_empty());
    s.execute("edit.redo", &json!({})).unwrap();
    assert_eq!(s.model.state().sketch(s.active_sketch.unwrap()).unwrap().sketch.curves.len(), 4);
}
