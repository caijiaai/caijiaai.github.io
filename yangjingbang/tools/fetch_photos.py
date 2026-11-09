# 下载选定的公有领域照片（Wikimedia Commons），并写 photos/photos.json（出处、授权、日期）
import json, time, urllib.request, os, re, sys
UA = 'ZujieBainianFilm/1.0 (documentary research; non-commercial)'
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
hits = json.load(open(os.path.join(H, 'commons_hits.json')))
PICK = {
  'creek': 'File:Yang-King-Pang, Shanghai (NYPL Hades-2359389-4043745).jpg',
  'quay': 'File:Shanghai - Quai du Yang-king-pang - Max Nössler - 272.jpg',
  'dock': 'File:Tcitp d482 hopkins dunn & co at yang-king-pang.jpg',
  'avenue': 'File:Shanghai trolleybus number B320 - 1935.png',
  'avenue2': 'File:Avenue Edward VII (Shanghai).JPG',
}
out = {}
for k, title in PICK.items():
    h = hits[title]; url = (h['thumb'] if (h['w'] or 0) > 1600 else h['url']).replace('thumb.wikimedia.org', 'upload.wikimedia.org').split('?')[0]
    ext = os.path.splitext(url.split('?')[0])[1].lower() or '.jpg'; fn = k + ext
    if not os.path.exists(os.path.join(H, 'photos', fn)):
     for i in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r: open(os.path.join(H, 'photos', fn), 'wb').write(r.read()); break
        except urllib.error.HTTPError as e:
            if e.code == 429: w = int(e.headers.get('retry-after', '30')) + 5; print('429 wait', w, file=sys.stderr); time.sleep(w); continue
            raise
    clean = lambda s: re.sub(r'<[^>]+>', '', s or '').strip()
    out[k] = dict(file=fn, title=title, page=h['page'], license=h['license'], date=clean(h['date'])[:60], artist=clean(h['artist'])[:120], credit=f"{clean(h['date'])[:20]} · {h['license']}")
    print(k, fn, h['license'], file=sys.stderr); time.sleep(6)
json.dump(out, open(os.path.join(H, 'photos', 'photos.json'), 'w'), ensure_ascii=False, indent=1)
