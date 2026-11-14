//! MadCAD: anonymous usage statistics (Preferences ▸ General ▸ Statistics).
//!
//! At each start of a release build, a background thread sends one small JSON record to
//! [`ENDPOINT`]: a random installation number (made on the first start, not derived from the
//! computer or the user), the version, the system and processor, the interface language, and the
//! previous session's length and how many times each tool was started. Nothing about designs,
//! files, names, paths or the computer is sent, and the server keeps no IP addresses. An app left
//! open sends a short record once a day. With the box off nothing is recorded or sent.
//!
//! Development builds never send (`update::release_build`), nor the browser build, nor a run with
//! `MADCAD_STATS=0` (the interface checks set it). A failed send stays silent and is not retried.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::SolveApp;

/// Where the records go.
pub const ENDPOINT: &str = "https://madcad.madmagsystem.pl/api/stats/v1/";
/// An app left open sends again after this long.
const HEARTBEAT_S: f64 = 24.0 * 3600.0;
/// How often the session in progress is copied into `memo` (written with the state file).
const KEEP_EVERY_S: f64 = 60.0;
/// At most this many different tools are counted in one session.
const MAX_COMMANDS: usize = 200;
/// A session longer than this counts as this long (a computer left on for weeks).
const MAX_SESSION_S: u64 = 7 * 24 * 3600;

/// Kept in the app's state file beside the preferences (`usage_stats`), not in them: the
/// Preferences window's Cancel and the settings profiles never touch it.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Memo {
    /// The random installation number (32 hex digits), made on the first start that sends.
    pub id: String,
    /// The session in progress as last kept: the next start sends it.
    pub session: Session,
}

/// One session: how long the app was open and how often each tool was started.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Session {
    pub seconds: u64,
    pub commands: BTreeMap<String, u32>,
}

impl Session {
    fn is_empty(&self) -> bool {
        self.seconds == 0 && self.commands.is_empty()
    }
}

/// This run's state.
#[derive(Default)]
pub struct Stats {
    /// What is written to the state file.
    pub memo: Memo,
    started: bool,
    /// Never sends in this run (development build, browser, `MADCAD_STATS=0`, no HTTP client).
    off: bool,
    /// When this session began and when it was last kept or sent (Unix seconds).
    began: f64,
    kept: f64,
    sent: f64,
    counts: BTreeMap<String, u32>,
    changed: bool,
    /// The records sent in this run (tests read them instead of the network).
    #[cfg(test)]
    pub(crate) outbox: Vec<serde_json::Value>,
}

/// Records may be sent from this run at all (the preference aside).
fn allowed(app: &SolveApp) -> bool {
    if cfg!(target_arch = "wasm32") || std::env::var("MADCAD_STATS").is_ok_and(|v| v == "0") {
        return false;
    }
    if cfg!(test) {
        return true;
    }
    crate::update::release_build() && app.services.agent_http.is_some()
}

/// Recording and sending are on now.
fn on(app: &SolveApp) -> bool {
    !app.stats.off && app.preferences.send_stats
}

/// A tool or file action was started: count it for this session.
pub fn used(app: &mut SolveApp, id: &str) {
    if !on(app) || id.is_empty() || id.len() > 64 {
        return;
    }
    let counts = &mut app.stats.counts;
    if counts.len() >= MAX_COMMANDS && !counts.contains_key(id) {
        return;
    }
    let n = counts.entry(id.to_string()).or_default();
    *n = n.saturating_add(1);
    app.stats.changed = true;
}

/// Per frame: the first frame sends the previous session; later frames keep this session in
/// `memo` now and then, and send again once a day.
pub fn tick(app: &mut SolveApp) {
    let now = crate::update::unix_now();
    if !app.stats.started {
        app.stats.started = true;
        app.stats.off = !allowed(app);
        app.stats.began = now;
        app.stats.kept = now;
        app.stats.sent = now;
        // The last run's session is sent once, whatever happens to the send.
        let previous = std::mem::take(&mut app.stats.memo.session);
        if on(app) {
            send(app, "start", Some(previous));
        }
        return;
    }
    if !on(app) {
        return;
    }
    if app.stats.changed || now - app.stats.kept >= KEEP_EVERY_S {
        app.stats.changed = false;
        app.stats.kept = now;
        app.stats.memo.session = Session { seconds: session_seconds(app, now), commands: app.stats.counts.clone() };
    }
    if now - app.stats.sent >= HEARTBEAT_S {
        app.stats.sent = now;
        send(app, "day", None);
    }
}

fn session_seconds(app: &SolveApp, now: f64) -> u64 {
    ((now - app.stats.began).max(0.0) as u64).min(MAX_SESSION_S)
}

/// The record `send` posts.
pub fn record(app: &mut SolveApp, event: &str, previous: Option<&Session>) -> serde_json::Value {
    if app.stats.memo.id.len() != 32 {
        app.stats.memo.id = new_id();
    }
    let mut v = json!({
        "id": app.stats.memo.id,
        "event": event,
        "version": crate::update::current_version(),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "lang": crate::i18n::language(),
    });
    if let Some(p) = previous.filter(|p| !p.is_empty())
        && let Some(o) = v.as_object_mut()
    {
        o.insert("previous".into(), json!({ "seconds": p.seconds.min(MAX_SESSION_S), "commands": p.commands }));
    }
    v
}

fn send(app: &mut SolveApp, event: &str, previous: Option<Session>) {
    let body = record(app, event, previous.as_ref());
    #[cfg(test)]
    {
        app.stats.outbox.push(body);
    }
    #[cfg(all(not(test), not(target_arch = "wasm32")))]
    {
        let Some(http) = app.services.agent_http.clone() else { return };
        let request = crate::agent_chat::backend::HttpRequest {
            method: "POST",
            url: ENDPOINT.into(),
            headers: vec![("Content-Type".into(), "application/json".into())],
            body: Some(body.to_string().into_bytes()),
            timeout_s: 15,
        };
        let _ = std::thread::Builder::new().name("madcad-stats".into()).spawn(move || {
            if let Err(e) = http(&request) {
                log::debug!("usage statistics not sent: {e}");
            }
        });
    }
    #[cfg(all(not(test), target_arch = "wasm32"))]
    {
        let _ = body;
    }
}

/// 128 random bits as 32 hex digits, from the standard library's per-process random keys.
fn new_id() -> String {
    use std::hash::{BuildHasher, Hasher};
    let part = |salt: u64| {
        let mut h = std::collections::hash_map::RandomState::new().build_hasher();
        h.write_u64(salt);
        h.write_u128(web_time::SystemTime::now().duration_since(web_time::UNIX_EPOCH).map_or(0, |d| d.as_nanos()));
        h.finish()
    };
    format!("{:016x}{:016x}", part(1), part(2))
}

/// Preferences ▸ General: the box and what it sends.
pub fn prefs_rows(app: &mut SolveApp, ui: &mut egui::Ui) {
    crate::ui_kit::checkbox(ui, crate::i18n::tr("stats.send"), &mut app.preferences.send_stats);
    crate::ui_kit::text(ui, crate::i18n::tr("stats.note"), crate::ui_kit::Text::Hint("stats"));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_first_frame_sends_the_last_session_and_counts_start_over() {
        let mut h = crate::scenario::Harness::new();
        h.app.stats = Stats::default();
        h.app.preferences.send_stats = true;
        h.app.stats.memo.session = Session { seconds: 125, commands: [("sketch.line".to_string(), 3)].into() };
        tick(&mut h.app);
        let sent = h.app.stats.outbox.clone();
        assert_eq!(sent.len(), 1, "{sent:?}");
        let r = &sent[0];
        assert_eq!(r["event"], "start");
        assert_eq!(r["id"].as_str().unwrap().len(), 32);
        assert!(r["id"].as_str().unwrap().chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(r["previous"]["seconds"], 125);
        assert_eq!(r["previous"]["commands"]["sketch.line"], 3);
        assert_eq!(r["os"], std::env::consts::OS);
        assert!(h.app.stats.memo.session.is_empty());
        // The same installation number next time.
        let id = h.app.stats.memo.id.clone();
        used(&mut h.app, "feature.extrude");
        used(&mut h.app, "feature.extrude");
        tick(&mut h.app);
        assert_eq!(h.app.stats.memo.session.commands.get("feature.extrude"), Some(&2));
        assert_eq!(record(&mut h.app, "day", None)["id"], id.as_str());
    }

    #[test]
    fn off_records_and_sends_nothing() {
        let mut h = crate::scenario::Harness::new();
        h.app.stats = Stats::default();
        h.app.preferences.send_stats = false;
        h.app.stats.memo.session = Session { seconds: 60, commands: BTreeMap::new() };
        tick(&mut h.app);
        used(&mut h.app, "sketch.line");
        tick(&mut h.app);
        assert!(h.app.stats.outbox.is_empty());
        assert!(h.app.stats.counts.is_empty());
        assert!(h.app.stats.memo.session.is_empty());
    }

    #[test]
    fn an_empty_session_sends_no_previous_part() {
        let mut h = crate::scenario::Harness::new();
        h.app.stats = Stats::default();
        h.app.preferences.send_stats = true;
        tick(&mut h.app);
        assert!(h.app.stats.outbox[0].get("previous").is_none());
    }

    #[test]
    fn ids_differ() {
        assert_ne!(new_id(), new_id());
        assert_eq!(new_id().len(), 32);
    }
}
