#!/usr/bin/env python3
"""Make one day's chart-fact post for Tempify's Instagram.

    python3 render-chart-card.py posts/2026-11-24

The folder holds post.json, which names the song (README.md has the fields), and can be
anywhere. This finds the song in Tempify's Hot 100 index (src/assets/hot-100-songs.json in this
repo), so no chart number ever comes from memory, works out the answer letter and the artist's
biggest hit, looks up the record's cover, and writes into the same folder:

    reel.mp4               the Reel: 1080 by 1920, about 13 seconds, silent. Instagram adds the
                           song from its own music library when the bot posts it.
    reel-cover.jpg         the Reel's cover, its first frame
    1.jpg  2.jpg  3.jpg    the same three as pictures for a post, 1080 by 1350. JPEG, since
                           that's the only kind Instagram's API takes.
    art.jpg                the record's cover from the Cover Art Archive, when there is one
    caption.txt            the caption, with no answer in it
    poll.json              the poll's four choices, the way Instagram's poll_attachment takes them
    facts.json             what the pictures say, answer letter included, to look back on

It stops with a plain message when the song isn't in the index, rather than guess. --index <path>
reads another copy of the index.

Chrome draws tempify-chart-card.html at twice the size and Pillow brings it down, which keeps the
words sharp, the way the link card and App Store art are made. ffmpeg joins the Reel's stills
into the video. Needs Google Chrome, Pillow and ffmpeg. Written November 2, 2026.
"""
import io
import json
import re
import shutil
import ssl
import subprocess
import sys
import tempfile
import time
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, pathname2url, urlopen

from PIL import Image, ImageCms

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE = Path(__file__).resolve().parent
CARD = HERE / "tempify-chart-card.html"
POST, REEL, SCALE = (1080, 1350), (1080, 1920), 2
SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()

FIRST_DAY = date(2026, 4, 28)  # Tempify's day #1, as in src/lib/date.js
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]

# The four letters, as on the dial in the HTML and in the poll.
ZONES = [("A", "Top 10"), ("B", "#11 to #40"), ("C", "#41 to #100"), ("D", "Never charted")]

# The Reel, in seconds: the question, a countdown of 3, 2, 1, then the answer and today's game,
# with short fades between.
QUESTION, TICK, ANSWER, PLAY = 3.0, 1.0, 4.6, 3.4
FADE_TO_ANSWER, FADE_TO_PLAY = 0.3, 0.4

# MusicBrainz asks every caller to name itself.
AGENT = "TempifyChartCard/1.0 ( https://tempify.me )"

# With the poll, Instagram shows the caption as the poll's question, so it leads with it.
CAPTION_POLL = """Where did “{song}” by {artist} peak on the Hot 100? Vote, then see the answer.

It was one of the five songs in yesterday's Hit or Miss. Today's five are up at tempify.me (link in bio).

#hot100 #musictrivia #{tag}"""

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


def tls():
    """python.org's Python on a Mac ships without certificates until someone runs its installer
    step, so fall back to the ones macOS keeps."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    if Path("/etc/ssl/cert.pem").exists():
        return ssl.create_default_context(cafile="/etc/ssl/cert.pem")
    return ssl.create_default_context()


def fetch(url, timeout=20):
    request = Request(url, headers={"User-Agent": AGENT, "Accept": "application/json"})
    with urlopen(request, timeout=timeout, context=tls()) as res:
        return res.read()


def search(kind, query):
    return json.loads(fetch(f"https://musicbrainz.org/ws/2/{kind}?fmt=json&limit=100&query=" + quote(query)))


def credited(credits, who):
    """Whether a MusicBrainz credit names the artist, and isn't a various-artists record."""
    name = norm(" ".join(c.get("name", "") + " " + c.get("joinphrase", "") for c in credits or []))
    return bool(re.search(rf"\b{re.escape(who)}\b", name)) and "various artists" not in name


def release_groups(post):
    """MusicBrainz release groups to take the cover from, best first. A Hot 100 hit came out as a
    single, so its single leads. Then the artist's own studio albums with the song, oldest first,
    which is the only record a song that never charted has. Greatest hits, live albums and
    various-artists records are left out, so none of them stands in for the record."""
    if post.get("art_release_group"):
        return [post["art_release_group"]]
    song, artist = post["song"], post["artist"]
    want, who = norm(song), norm(artist)

    found = search("release-group", f'releasegroup:"{song}" AND artist:"{artist}" AND primarytype:single')
    singles = [g for g in found.get("release-groups", [])
               if g.get("score", 0) >= 90 and norm(g.get("title", "")) == want
               and not g.get("secondary-types") and credited(g.get("artist-credit"), who)]
    singles.sort(key=lambda g: g.get("first-release-date") or "9999")

    time.sleep(1.1)  # MusicBrainz takes one request a second
    found = search("recording", f'recording:"{song}" AND artist:"{artist}" AND primarytype:album AND status:official')
    albums = {}
    for rec in found.get("recordings", []):
        if rec.get("score", 0) < 90 or norm(rec.get("title", "")) != want:
            continue
        for rel in rec.get("releases", []):
            group = rel.get("release-group", {})
            if (rel.get("status") != "Official" or group.get("primary-type") != "Album"
                    or group.get("secondary-types") or not credited(rel.get("artist-credit"), who)):
                continue
            day = rel.get("date") or "9999"
            albums[group["id"]] = min(day, albums.get(group["id"], day))

    picks = [g["id"] for g in singles] + sorted(albums, key=albums.get)
    return list(dict.fromkeys(picks))[:6]


def find_art(post, folder):
    """The record's front cover from the Cover Art Archive, saved as art.jpg. The covers belong to
    their labels; the archive adds no terms of its own. Returns the release group used, or None
    when there's no cover to show (the answer then shows without one)."""
    if post.get("art") is False:
        return None
    try:
        groups = release_groups(post)
    except Exception as e:  # MusicBrainz down or slow: go on without a cover
        print(f"No cover: MusicBrainz didn't answer ({e}).")
        return None
    for group in groups:
        try:
            image = fetch(f"https://coverartarchive.org/release-group/{group}/front-500", timeout=30)
            Image.open(io.BytesIO(image)).convert("RGB").save(folder / "art.jpg", "JPEG", quality=92)
            return group
        except Exception:
            continue
    print("No cover found. The answer shows without one.")
    return None


def chrome(url, out, scratch, size):
    args = [
        CHROME, "--headless", "--disable-gpu", "--hide-scrollbars", "--force-color-profile=srgb",
        f"--force-device-scale-factor={SCALE}", "--allow-file-access-from-files",
        "--virtual-time-budget=3000", f"--user-data-dir={scratch / 'profile'}",
        f"--window-size={size[0]},{size[1]}", f"--screenshot={out}", url,
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


def shoot(data, scratch, slide, size, reel=False, count=0):
    """One picture of the card, drawn at twice the size and brought down."""
    query = f"?slide={slide}" + ("&format=reel" if reel else "") + (f"&count={count}" if count else "")
    raw = scratch / "raw.png"
    chrome("file://" + pathname2url(str(CARD)) + query + "#" + quote(json.dumps(data)), raw, scratch, size)
    big = Image.open(raw)
    if big.size != (size[0] * SCALE, size[1] * SCALE):
        fail(f"Chrome drew {big.size}")
    return big.convert("RGB").resize(size, Image.LANCZOS)


def save_jpeg(image, path):
    # Full color detail (no subsampling) keeps the thin blue type clean.
    image.save(path, "JPEG", quality=92, subsampling=0, icc_profile=SRGB, optimize=True)


def make_reel(stills, out):
    """Joins the Reel's six stills into the video Instagram wants: H.264 at 30 frames a second,
    with a silent AAC track for the song to replace."""
    ffmpeg = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
    if not Path(ffmpeg).exists():
        fail("The Reel needs ffmpeg. Install it with: brew install ffmpeg")
    question = QUESTION + 3 * TICK
    to_answer = question - FADE_TO_ANSWER
    to_play = to_answer + ANSWER - FADE_TO_PLAY
    total = to_play + PLAY
    inputs = []
    for path, seconds in zip(stills, (QUESTION, TICK, TICK, TICK, ANSWER, PLAY)):
        inputs += ["-loop", "1", "-framerate", "30", "-t", f"{seconds}", "-i", str(path)]
    inputs += ["-f", "lavfi", "-t", f"{total:.2f}", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"]
    video = "fps=30,settb=AVTB,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1"
    # The answer lands with a small push in, 6% larger and settling over its first 0.6 seconds.
    push = "zoompan=z='if(lte(on,18),1.06-0.06*on/18,1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30"
    graph = (
        f"[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0,{video}[q];"
        f"[4:v]{push},{video}[a];"
        f"[5:v]{video}[p];"
        f"[q][a]xfade=transition=fade:duration={FADE_TO_ANSWER}:offset={to_answer:.2f}[qa];"
        f"[qa][p]xfade=transition=fade:duration={FADE_TO_PLAY}:offset={to_play:.2f}[v]"
    )
    result = subprocess.run([
        ffmpeg, "-y", "-loglevel", "error", *inputs, "-filter_complex", graph,
        "-map", "[v]", "-map", "6:a", "-c:v", "libx264", "-profile:v", "high", "-preset", "slow",
        "-crf", "18", "-r", "30", "-pix_fmt", "yuv420p", "-colorspace", "bt709",
        "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "aac", "-b:a", "128k",
        "-t", f"{total:.2f}", "-movflags", "+faststart", str(out),
    ], capture_output=True, text=True)
    if result.returncode != 0:
        fail(f"ffmpeg couldn't make the Reel:\n{result.stderr[-2000:]}")


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
    poll = post.get("poll", True)
    (folder / "art.jpg").unlink(missing_ok=True)
    art = find_art(post, folder)
    data = {
        "song": post["song"],
        "artist": post["artist"],
        "puzzle": (yesterday - FIRST_DAY).days + 1,
        "peak": peak,
        "answer": letter,
        "facts": facts_for(row, post),
        "biggest": biggest_for(rows, row, post),
        "dare": "A" if letter in "CD" else "D",
        "poll": poll,
        "art": "file://" + pathname2url(str(folder / "art.jpg")) if art else None,
    }

    scratch = Path(tempfile.mkdtemp(prefix="tempify-chart-"))
    try:
        for n in (1, 2, 3):
            save_jpeg(shoot(data, scratch, n, POST), folder / f"{n}.jpg")
        stills = []
        for slide, count in ((1, 0), (1, 3), (1, 2), (1, 1), (2, 0), (3, 0)):
            still = scratch / f"reel-{slide}-{count}.png"
            shoot(data, scratch, slide, REEL, reel=True, count=count).save(still)
            stills.append(still)
        save_jpeg(Image.open(stills[0]), folder / "reel-cover.jpg")
        make_reel(stills, folder / "reel.mp4")
    finally:
        shutil.rmtree(scratch, ignore_errors=True)

    facts = {**data, "art": art}
    (folder / "facts.json").write_text(json.dumps(facts, indent=2, ensure_ascii=False) + "\n")
    choices = {f"option_{z.lower()}": f"{z}. {label}" for z, label in ZONES}
    (folder / "poll.json").write_text(json.dumps(choices, ensure_ascii=False) + "\n")
    tag = re.sub(r"[^a-z0-9]", "", norm(post["artist"]))
    (folder / "caption.txt").write_text(
        (CAPTION_POLL if poll else CAPTION).format(song=post["song"], artist=post["artist"], tag=tag) + "\n")

    said = f"#{peak}" if peak else "never charted"
    print(f"{post['song']} by {post['artist']}: {said}, answer {letter}"
          + (f" ({row[0]} by {row[1]} in the index)" if row else ""))
    if data["biggest"]:
        b = data["biggest"]
        print(f"Their biggest: {b['title']}, {b['detail']}")
    print(f"Cover: Cover Art Archive release group {art}" if art else "Cover: none")
    print(f"Wrote reel.mp4, reel-cover.jpg, 1.jpg to 3.jpg, caption.txt, poll.json and facts.json in {folder}")


if __name__ == "__main__":
    main()
