# Rebuilds the app from app.html + api.js + app.js.
# Output: ../www/index.html (Android app) and ./siteflow.html (hosted web version, no <head> wrapper).
import os
here = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(here, 'app.html'), encoding='utf-8').read()
# api.js (API client) is bundled ahead of app.js, which uses it.
js = '\n'.join(open(os.path.join(here, f), encoding='utf-8').read() for f in ('api.js', 'app.js'))
page = html.replace('/*__APP_JS__*/', js)
open(os.path.join(here, 'siteflow.html'), 'w', encoding='utf-8').write(page)
head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<meta name="theme-color" content="#0E6B6F">\n'
        '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n')
i = page.index('</style>') + len('</style>')
full = head + page[:i] + '\n</head>\n<body>\n' + page[i:] + '\n</body>\n</html>\n'
open(os.path.join(here, '..', 'www', 'index.html'), 'w', encoding='utf-8').write(full)
print('Built www/index.html and web-src/siteflow.html')
