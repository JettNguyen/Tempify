#!/usr/bin/env python3
"""Make one day's chart-fact post for Tempify's Instagram.

    python3 render-chart-card.py posts/2026-11-24

The folder holds post.json, which names the song (README.md has the fields), and can be
anywhere. This finds the song in Tempify's Hot 100 index (src/assets/hot-100-songs.json in this
repo), so no chart number ever comes from memory, works out the answer letter and the artist's
biggest hit, and writes into the same folder:

    1.jpg  2.jpg  3.jpg    the three pictures, 1080 by 1350, in posting order. JPEG, since
                           that's the only kind Instagram's API takes.
    caption.txt            the caption, with no answer in it
    facts.json             what the pictures say, answer letter included, to look back on

It stops with a plain message when the song isn't in the index, rather than guess. --index <path>
reads another copy of the index.

Chrome draws tempify-chart-card.html at twice the size and Pillow brings it down, which keeps the
words sharp, the way the link card and App Store art are made. Needs Google Chrome and Pillow.
Written November 2, 2026.
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote
from urllib.request import pathname2url

from PIL import Image, ImageCms

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE = Path(__file__).resolve().parent
CARD = HERE / "tempify-chart-card.html"
W, H, SCALE = 1080, 1350, 2
SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()

FIRST_DAY = date(2026, 4, 28)  # Tempify's day #1, as in src/lib/date.js
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]

# The four letters, as on the dial in the HTML.
ZONES = [("A", "Top 10"), ("B", "#11 to #40"), ("C", "#41 to #100"), ("D", "Never charted")]

CAPTION = """Where did “{song}” by {artist} peak on the Hot 100?

A. Top 10
B. #11 to #40
C. #41 to #100
D. Never charted

Comment your letter, then swipe for the answer.

It was one of the five songs in yesterday's Hit or Miss. Today's five are up at tempify.me (link in bio).

#hot100 #musictrivia #{tag}"""


def fail(message):
    raise SystemExit(f"\n{message}\n")


def norm(text):
    text = text.lower().replace("&", " and ")
    text = re.sub(r"[’'`]", "", text)
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def find_index(argv):
    if "--index" in argv:
        return Path(argv[argv.index("--index") + 1]).expanduser()
    return HERE.parent.parent / "src" / "assets" / "hot-100-songs.json"


def look_up(rows, post):
    """The index row for the post's song, or None when it never charted."""
    title = norm(post.get("index_title") or post["song"])
    artist = norm(post["artist"])

    def by_artist(row):
        return re.search(rf"\b{re.escape(artist)}\b", norm(row[1])) is not None

    hits = [r for r in rows if norm(r[0]) == title and by_artist(r)]
    if not hits:
        # A longer title in the index: "Sweet Caroline (Good Times Never Seemed So Good)".
        hits = [r for r in rows if "(" in r[0] and norm(r[0].split("(")[0]) == title and by_artist(r)]
    hits.sort(key=lambda r: (r[2], -r[4], -r[3]))

    if post.get("never_charted"):
        if hits:
            r = hits[0]
            fail(f"post.json says it never charted, but the index has {r[0]} by {r[1]} at #{r[2]}.\n"
                 "Take never_charted out, or pick another song.")
        return None
    if not hits:
        theirs = sorted({r[0] for r in rows if by_artist(r)})
        listed = "\n  ".join(theirs[:40]) or "(nothing by that artist either)"
        fail(f"{post['song']} by {post['artist']} isn't in the Hot 100 index.\n"
             f"If the index has it under a longer name, set index_title in post.json. "
             f"If it really never charted, set \"never_charted\": true.\n"
             f"What the index has by {post['artist']}:\n  {listed}")
    return hits[0]


def weeks(n, what):
    return f"{n} week{'' if n == 1 else 's'} {what}"


def facts_for(row, post):
    if row is None:
        return f"Released in {post['year']}" if post.get("year") else ""
    first = date.fromisoformat(row[5])
    since = f"First charted {MONTHS[first.month - 1]} {first.year}."
    if row[2] == 1:
        return f"{weeks(row[4], 'at #1')}. {since}"
    return f"{weeks(row[3], 'on the chart')}. {since}"


def biggest_for(rows, row, post):
    """The artist's own biggest hit, when it did better than this song. Credits shared with
    someone else don't count, so "Queen's biggest" means Queen alone."""
    artist = norm(post["artist"])
    theirs = [r for r in rows if norm(r[1]) == artist and r is not row]
    if not theirs:
        return None
    best = min(theirs, key=lambda r: (r[2], -r[4], -r[3]))
    if row is not None and best[2] >= row[2]:
        return None
    detail = f"#1 for {best[4]} week{'' if best[4] == 1 else 's'}" if best[2] == 1 else f"#{best[2]}"
    return {"artist": post["artist"], "title": best[0], "detail": detail}


def answer_letter(peak):
    if peak is None:
        return "D"
    return "A" if peak <= 10 else "B" if peak <= 40 else "C"


def chrome(url, out, scratch):
    args = [
        CHROME, "--headless", "--disable-gpu", "--hide-scrollbars", "--force-color-profile=srgb",
        f"--force-device-scale-factor={SCALE}", "--allow-file-access-from-files",
        "--virtual-time-budget=3000", f"--user-data-dir={scratch / 'profile'}",
        f"--window-size={W},{H}", f"--screenshot={out}", url,
    ]
    log = scratch / "chrome.log"
    with open(log, "w") as f:
        proc = subprocess.Popen(args, stdout=f, stderr=subprocess.STDOUT)
    try:
        # Chrome writes the file and then does not quit, so wait for its line saying so.
        deadline = time.time() + 90
        while time.time() < deadline:
            if "bytes written to file" in log.read_text(errors="ignore"):
                return
            if proc.poll() is not None:
                break
            time.sleep(0.2)
        fail(f"Chrome wrote nothing. Its log:\n{log.read_text(errors='ignore')[-2000:]}")
    finally:
        proc.kill()
        proc.wait()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--index" in sys.argv:
        args.remove(sys.argv[sys.argv.index("--index") + 1])
    if len(args) != 1:
        fail("Usage: python3 render-chart-card.py posts/<date>   (the folder with post.json)")
    folder = Path(args[0]).expanduser().resolve()
    if folder.suffix == ".json":
        folder = folder.parent
    try:
        post = json.loads((folder / "post.json").read_text())
    except FileNotFoundError:
        fail(f"No post.json in {folder}")
    for key in ("date", "song", "artist"):
        if not str(post.get(key, "")).strip():
            fail(f"post.json needs \"{key}\".")

    index = find_index(sys.argv)
    if not index.exists():
        fail(f"Can't find the Hot 100 index at {index}.\n"
             "Run this from a copy of the Tempify repo, or pass --index <path to hot-100-songs.json>.")
    rows = json.loads(index.read_text())

    row = look_up(rows, post)
    peak = row[2] if row else None
    letter = answer_letter(peak)
    yesterday = date.fromisoformat(post["date"]) - timedelta(days=1)
    data = {
        "song": post["song"],
        "artist": post["artist"],
        "puzzle": (yesterday - FIRST_DAY).days + 1,
        "peak": peak,
        "answer": letter,
        "facts": facts_for(row, post),
        "biggest": biggest_for(rows, row, post),
        "dare": "A" if letter in "CD" else "D",
    }

    scratch = Path(tempfile.mkdtemp(prefix="tempify-chart-"))
    try:
        for n in (1, 2, 3):
            raw = scratch / f"{n}.png"
            url = "file://" + pathname2url(str(CARD)) + f"?slide={n}#" + quote(json.dumps(data))
            chrome(url, raw, scratch)
            big = Image.open(raw)
            if big.size != (W * SCALE, H * SCALE):
                fail(f"Chrome drew {big.size}")
            # Full color detail (no subsampling) keeps the thin blue type clean.
            big.convert("RGB").resize((W, H), Image.LANCZOS).save(
                folder / f"{n}.jpg", "JPEG", quality=92, subsampling=0, icc_profile=SRGB, optimize=True)
    finally:
        shutil.rmtree(scratch, ignore_errors=True)

    (folder / "facts.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    tag = re.sub(r"[^a-z0-9]", "", norm(post["artist"]))
    (folder / "caption.txt").write_text(
        CAPTION.format(song=post["song"], artist=post["artist"], tag=tag) + "\n")

    said = f"#{peak}" if peak else "never charted"
    print(f"{post['song']} by {post['artist']}: {said}, answer {letter}"
          + (f" ({row[0]} by {row[1]} in the index)" if row else ""))
    if data["biggest"]:
        b = data["biggest"]
        print(f"Their biggest: {b['title']}, {b['detail']}")
    print(f"Wrote 1.jpg, 2.jpg, 3.jpg, caption.txt and facts.json in {folder}")


if __name__ == "__main__":
    main()
