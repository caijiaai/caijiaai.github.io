# 在 Wikimedia Commons 检索老照片，记录出处与授权（遵守 429 retry-after，慢速请求）
import json, sys, time, urllib.request, urllib.parse, os
UA = 'ZujieBainianFilm/1.0 (documentary research; non-commercial)'
API = 'https://commons.wikimedia.org/w/api.php'
def get(params):
    url = API + '?' + urllib.parse.urlencode({**params, 'format': 'json'})
    for k in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: w = int(e.headers.get('retry-after', '30')) + 5; print('429, wait', w, file=sys.stderr); time.sleep(w); continue
            raise
    raise SystemExit('rate limited')
out = {}
for q in sys.argv[2:]:
    d = get({'action': 'query', 'list': 'search', 'srnamespace': 6, 'srlimit': 25, 'srsearch': q})
    titles = [x['title'] for x in d['query']['search']]
    print('==', q, len(titles), file=sys.stderr)
    for i in range(0, len(titles), 10):
        time.sleep(3)
        info = get({'action': 'query', 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 1600, 'titles': '|'.join(titles[i:i + 10])})
        for p in info['query']['pages'].values():
            ii = (p.get('imageinfo') or [{}])[0]; m = ii.get('extmetadata', {})
            g = lambda k: (m.get(k) or {}).get('value', '')
            out[p['title']] = dict(q=q, page=ii.get('descriptionurl'), url=ii.get('url'), thumb=ii.get('thumburl'), w=ii.get('width'), h=ii.get('height'),
                                   license=g('LicenseShortName'), usage=g('UsageTerms'), date=g('DateTimeOriginal')[:200], artist=g('Artist')[:200], desc=g('ImageDescription')[:400])
    time.sleep(5)
json.dump(out, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print('saved', len(out), file=sys.stderr)
