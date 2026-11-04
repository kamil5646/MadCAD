"""Drive a private MadCAD window through its control channel, as a user would: clicks, keys and
typed text, then read back what the design became. Python standard library only.

The app runs with its own settings and recovery folders, so the tests never touch the user's.
"""

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))


class Failure(Exception):
    pass


class Skip(Exception):
    """A check this computer can't make (said in the report, not counted as failed)."""


def needs_quick_frames(app, what):
    """Double clicks and double Escapes are timed (0.4 s): a window that takes longer per frame
    can't show them."""
    frame = app.inspect().get("frame_ms") or 0
    if frame > 120:
        raise Skip(f"{what}: frames take {frame:.0f} ms here")


class App:
    def __init__(self, binary, port=28077):
        self.binary = binary
        self.port = port
        self.work = tempfile.mkdtemp(prefix="madcad-ui-")
        self.log_path = os.path.join(self.work, "app.log")
        env = dict(os.environ)
        env.update(
            SOLIDCRAFT_SETTINGS_DIR=os.path.join(self.work, "settings"),
            SOLIDCRAFT_RECOVERY_DIR=os.path.join(self.work, "recovery"),
            SOLIDCRAFT_CONTROL_PORT=str(port),
            SOLIDCRAFT_CONTROL_DIR=os.path.join(self.work, "control"),
        )
        for d in ("settings", "recovery", "control"):
            os.makedirs(os.path.join(self.work, d), exist_ok=True)
        self.proc = subprocess.Popen([binary], env=env, stdout=open(self.log_path, "w"), stderr=subprocess.STDOUT)
        self.n = 0
        self.sock = None
        deadline = time.time() + 60
        while time.time() < deadline:
            try:
                self._connect()
                break
            except (OSError, FileNotFoundError):
                if self.proc.poll() is not None:
                    raise Failure("the app exited at start:\n" + self.log())
                time.sleep(0.5)
        else:
            raise Failure("no control channel after 60 s")
        # The same window on every computer (a CI runner's screen is small): input comes through
        # the control channel, so the window may be larger than the screen.
        self.call("ui.resize", check=False, width=1600, height=1000)
        self.wait_idle(1.0)

    def _token(self):
        name = os.path.join(self.work, "control", f"{self.port}.token")
        if os.path.exists(name):
            return open(name).read().strip()
        raise FileNotFoundError("token")

    def _connect(self):
        tok = self._token()
        s = socket.create_connection(("127.0.0.1", self.port), timeout=120)
        self.sock, self.f, self.n = s, s.makefile("r", encoding="utf-8"), 0
        self.tok = tok
        self.call("ui.inspect")

    def call(self, method, check=True, **params):
        req = {"id": self.n, "method": method, "params": params}
        if self.n == 0:
            req["token"] = self.tok
        self.n += 1
        self.sock.sendall((json.dumps(req) + "\n").encode())
        line = self.f.readline()
        if not line:
            raise Failure(f"{method}: the app closed the channel\n" + self.log()[-3000:])
        r = json.loads(line)
        if not r.get("ok"):
            if check:
                raise Failure(f"{method} {params}: {r.get('error')}")
            return None
        return r.get("result")

    def close(self):
        try:
            self.call("app.quit", check=False)
        except Exception:
            pass
        try:
            self.proc.wait(10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        shutil.rmtree(self.work, ignore_errors=True)

    def log(self):
        try:
            return open(self.log_path, encoding="utf-8", errors="replace").read()
        except OSError:
            return ""

    # Input, as the user gives it.
    def click(self, xy, **kw):
        if xy is None:
            raise Failure("nothing to click: the point is not on screen")
        self.call("ui.click", x=xy[0], y=xy[1], **kw)
        self.wait_idle()

    def move(self, xy):
        self.call("ui.move", x=xy[0], y=xy[1])
        self.wait_idle()

    def key(self, k, **mods):
        self.call("ui.key", key=k, **mods)
        # Two Escapes within 0.4 s finish a sketch: a test that means one Escape at a time waits
        # them apart (`escape_twice` presses the pair on purpose).
        self.wait_idle(0.6 if k == "Escape" else 0.35)

    def escape_twice(self):
        self.call("ui.key", key="Escape")
        self.call("ui.key", key="Escape")
        self.wait_idle()

    def type(self, text):
        self.call("ui.text", text=text)
        self.wait_idle()

    def wait_idle(self, t=0.35):
        """Give the window `t` seconds, then wait (up to 30 s) until nothing is loading, previewing
        or computing: a slow computer finishes a command later than a fast one."""
        time.sleep(t)
        for _ in range(300):
            i = self.call("ui.inspect")
            if not (i.get("file_busy") or i.get("computing") or (i.get("preview") or {}).get("pending")):
                return i
            time.sleep(0.1)
        return i

    # Where things are.
    def handles(self, prefix=""):
        return {h["name"]: (h["x"], h["y"]) for h in self.call("ui.handles", prefix=prefix)}

    def handle(self, name):
        # A slow computer draws the frame that shows it a moment later.
        for _ in range(25):
            h = self.handles(name)
            if name in h:
                return h[name]
            time.sleep(0.2)
        raise Failure(f"`{name}` is not on screen; near it: {sorted(h)[:12]}")

    def at(self, **where):
        return self.call("ui.at", check=False, **where)

    def button(self, command):
        self.click(self.handle("button:" + command))
        self.wait_idle(0.5)

    # What there is.
    def inspect(self):
        return self.call("ui.inspect")

    def dialog(self):
        d = self.inspect().get("dialog")
        return d or None

    def dialog_kind(self):
        d = self.dialog()
        if not d:
            return None
        m = re.match(r"Dialog \{ kind: (\w+)", d)
        return m.group(1) if m else d[:40]

    def tool(self):
        return self.inspect().get("tool")

    def doc(self):
        return self.call("document.inspect")

    def volume(self):
        r = self.call("engine.execute", check=False, command="inspect.center_of_mass", params={})
        return round(r["volume"], 1) if r else 0.0

    def soon(self, check, t=8.0):
        """Whether `check()` comes true within `t` seconds: a slow computer draws the frame that
        closes a window or shows a result later than a fast one."""
        deadline = time.time() + t
        while True:
            if check():
                return True
            if time.time() > deadline:
                return False
            time.sleep(0.25)

    def volume_near(self, want, tol=0.5, t=8.0):
        return self.soon(lambda: near(self.volume(), want, tol), t)

    def bodies(self):
        return self.doc().get("bodies", [])

    def timeline(self):
        return self.doc().get("timeline", [])

    def ex(self, command, **params):
        return self.call("engine.execute", command=command, params=params)

    def sketch(self):
        return self.call("engine.execute", check=False, command="sketch.inspect", params={})

    def status(self):
        s = self.inspect().get("status")
        return (s or {}).get("text") if isinstance(s, dict) else s

    # Starting points.
    def new(self):
        for _ in range(3):
            if self.dialog() or self.tool():
                self.key("Escape")
        self.ex("file.new")
        if self.inspect().get("home"):
            self.click(self.handle("home:new"))
        self.call("ui.view", view="home")
        if "tab:MODEL" in self.handles("tab:"):
            self.click(self.handle("tab:MODEL"))
        self.wait_idle()

    def block(self, x=40, y=20, z=10):
        """A box from (0,0,0) to (x,y,z), made by commands (not under test here)."""
        self.ex("sketch.create", plane="XY")
        self.ex("sketch.rectangle.two_point", p0=[0, 0], p1=[x, y])
        self.ex("sketch.finish")
        self.ex("solid.extrude", distance=z)
        self.wait_idle()
        if abs(self.volume() - x * y * z) > 0.5:
            raise Failure(f"block {x}x{y}x{z}: volume {self.volume()}")

    def open_sketch_ui(self, plane="XY"):
        self.button("sketch.create")
        # A slow computer shows the planes to pick a moment after the button.
        self.click(self._point(f"the {plane} plane", plane=plane))
        self.wait_idle(1.5)
        if self.doc().get("active_sketch") is None:
            raise Failure("no sketch is being edited after picking the plane")

    def _point(self, what, **where):
        for _ in range(25):
            p = self.at(**where)
            if p is not None:
                return p
            time.sleep(0.2)
        raise Failure(f"{what} is not on screen")

    def s(self, x, y):
        return self._point(f"sketch point {x},{y}", sketch=[x, y])

    def w(self, x, y, z):
        return self._point(f"world point {x},{y},{z}", world=[x, y, z])


def near(a, b, tol=0.5):
    return a is not None and b is not None and abs(a - b) <= tol


def expect(cond, what):
    if not cond:
        raise Failure(what)


TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


def screen_locked():
    """macOS hands a locked screen's windows no clicks: the view tests can't run then."""
    if sys.platform != "darwin":
        return False
    try:
        out = subprocess.run(["ioreg", "-n", "Root", "-d1", "-a"], capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return False
    i = out.find("CGSSessionScreenIsLocked")
    return i >= 0 and "<true/>" in out[i : i + 80]


def diagnose(app, tag):
    """What the window showed when a check failed: its state, and a screenshot into the folder
    MADCAD_UI_SHOTS names (the CI keeps them)."""
    if os.environ.get("MADCAD_UI_DEBUG") != "1":
        return
    try:
        i = app.inspect()
        print(f"  dialog={i.get('dialog')!r:.300} tool={i.get('tool')} status={i.get('status')}", flush=True)
        d = app.doc()
        print(f"  timeline={[(t.get('name'), t.get('error')) for t in d.get('timeline', [])]} bodies={len(d.get('bodies', []))}"
              f" active_sketch={d.get('active_sketch')} path={d.get('path')}", flush=True)
        print(f"  dialog handles={sorted(app.handles('dialog:'))[:30]}", flush=True)
        shots = os.environ.get("MADCAD_UI_SHOTS")
        if shots:
            os.makedirs(shots, exist_ok=True)
            r = app.call("ui.screenshot", check=False, path=os.path.join(shots, tag + ".png"))
            print(f"  screenshot: {r}", flush=True)
            time.sleep(1.0)
        tail = [l for l in app.log().splitlines() if "WARN" in l or "ERROR" in l][-8:]
        if tail:
            print("  log:\n    " + "\n    ".join(tail), flush=True)
    except Exception as e:  # noqa: BLE001
        print(f"  (no diagnosis: {e})", flush=True)


def run(app, only=None):
    if screen_locked():
        print("FAIL the screen is locked: unlock it (the app gets no clicks while it is), then run again")
        return False
    passed, failed = 0, []
    app.call("ui.untranslated", check=False, record=True)
    frame = app.inspect().get("frame_ms")
    print(f"frame time {frame} ms", flush=True)
    for fn in TESTS:
        name = fn.__name__
        if only and not any(o in name for o in only):
            continue
        t0 = time.time()
        # A check that fails is run once more from an empty design: a window on a slow computer
        # (a CI runner drawing without a graphics card) can miss a moment. "2nd try" says so.
        for attempt in (1, 2):
            try:
                app.new()
                fn(app)
                passed += 1
                note = " (2nd try)" if attempt == 2 else ""
                print(f"OK   {name} ({time.time() - t0:.1f} s){note}", flush=True)
                break
            except Skip as e:
                passed += 1
                print(f"SKIP {name}: {e}", flush=True)
                break
            except Exception as e:  # noqa: BLE001 - every failure is reported, the run goes on
                msg = str(e) if isinstance(e, Failure) else traceback.format_exc(limit=3)
                if app.proc.poll() is not None:
                    failed.append(name)
                    print(f"FAIL {name}: {msg}\nthe app has exited:\n" + app.log()[-4000:])
                    return False
                diagnose(app, f"{name}-{attempt}")
                for _ in range(3):
                    try:
                        app.key("Escape")
                    except Exception:
                        break
                if attempt == 2:
                    failed.append(name)
                    print(f"FAIL {name}: {msg}", flush=True)
    # Every message the Polish interface showed in English along the way.
    missing = app.call("ui.untranslated", check=False, record=False) or []
    allowed = set()
    allow_file = os.path.join(HERE, "untranslated-ok.txt")
    if os.path.exists(allow_file):
        allowed = {line.strip() for line in open(allow_file, encoding="utf-8") if line.strip() and not line.startswith("#")}
    missing = [m for m in missing if m not in allowed]
    if missing:
        failed.append("untranslated")
        print(f"FAIL {len(missing)} message(s) shown in English:\n  " + "\n  ".join(missing[:200]))
    panics = [line for line in app.log().splitlines() if "panicked" in line]
    if panics:
        failed.append("panics in the log")
        print("FAIL the log has panics:\n  " + "\n  ".join(panics[:10]))
    print(f"\n{passed}/{passed + len(failed)} passed" + (f"; failed: {', '.join(failed)}" if failed else ""))
    return not failed


def default_binary():
    for p in [
        os.path.join(ROOT, "target", "release", "solidcraft"),
        os.path.join(ROOT, "target", "release", "solidcraft.exe"),
    ]:
        if os.path.exists(p):
            return p
    sys.exit("build first: cargo build --release -p solidcraft")
