# Rebuilds the app from app.html + api.js + app.js.
# Output: ../www/index.html (Android app) and ./siteflow.html (hosted web version, no <head> wrapper).
# Client demo: the same app with demo-api.js in place of api.js, so the workflow runs in the browser
# on sample data with no server:
#   ../demo/SiteFlow-Demo.html      standalone file to open or send
#   ../demo/siteflow-demo-page.html page body without the <head> wrapper, for hosting as a shared link
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, '..')
html = open(os.path.join(here, 'app.html'), encoding='utf-8').read()


def read(name):
    return open(os.path.join(here, name), encoding='utf-8').read()


def full_document(page):
    head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '<meta name="theme-color" content="#0E6B6F">\n'
            '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
            'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n')
    i = page.index('</style>') + len('</style>')
    return head + page[:i] + '\n</head>\n<body>\n' + page[i:] + '\n</body>\n</html>\n'


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(text)


DEMO_GATES = ("client_signoff", "legal_approval", "no_open_major_problems")


def demo_template():
    """The /template payload, built from the backend's own config so the demo never drifts from it."""
    sys.path.insert(0, os.path.join(root, 'backend'))
    from app import stage_config as sc
    from app import template_config as tc
    from app import workflow_config as wc
    return {
        "id": tc.TEMPLATE_ID, "version": tc.TEMPLATE_VERSION, "steps": tc.WORKFLOW_STEPS,
        "stages": [{"name": s["name"], "weight": s["weight"],
                    "checklist": [{"id": i["id"], "label": i["label"]} for i in s["checklist"]]} for s in tc.STAGES],
        "checklist_states": tc.CHECKLIST_STATES, "problems": tc.PROBLEMS,
        "severities": tc.SEVERITIES, "min_photos": tc.MIN_PHOTOS,
        "max_photo_mb": wc.MAX_PHOTO_MB, "max_video_mb": wc.MAX_VIDEO_MB,
        "photo_types": wc.PHOTO_TYPES, "video_types": wc.VIDEO_TYPES,
        "red_flag_rules": wc.RED_FLAG_RULES,
        "workflow": {"review_sla_hours": wc.REVIEW_SLA_HOURS, "visit_interval_days": wc.VISIT_INTERVAL_DAYS,
                     "rework_limit": wc.REWORK_LIMIT},
        # The 18-stage flow (as /template serves it) and, for the demo's own engine, the full stage rules.
        "phases": sc.PHASES,
        "flow": [{"key": s["key"], "number": s["number"], "label": s["label"], "phase": s["phase"]} for s in sc.STAGES],
        # The v3 demo (frozen) reads one `gate` per stage and knows only the v3 gate types.
        "stage_flow": [
            {**{k: v for k, v in s.items() if k != "gates"},
             "gate": next((g for g in s["gates"] if g in DEMO_GATES), None)}
            for s in sc.STAGES
        ],
        "business_timezone": wc.BUSINESS_TIMEZONE,
        "signoff": {"sla_days": wc.CLIENT_SIGNOFF_SLA_DAYS, "invite_ttl_days": wc.INVITE_CODE_TTL_DAYS,
                    "invite_max_attempts": wc.INVITE_MAX_ATTEMPTS, "attachment_types": wc.SIGNOFF_ATTACHMENT_TYPES,
                    "max_attachment_mb": wc.MAX_SIGNOFF_ATTACHMENT_MB, "confirmation_text": wc.SIGNOFF_CONFIRMATION_TEXT},
    }


# App: api.js (API client) is bundled ahead of app.js, which uses it.
page = html.replace('/*__APP_JS__*/', read('api.js') + '\n' + read('icons.js') + '\n' + read('app.js'))
write(os.path.join(here, 'siteflow.html'), page)
write(os.path.join(root, 'www', 'index.html'), full_document(page))

# Demo: same app, in-browser API with sample data.
demo_js = f'const DEMO_TEMPLATE = {json.dumps(demo_template(), ensure_ascii=False)};\n' + read('demo-api.js') + '\n' + read('icons.js') + '\n' + read('app.js')
demo = html.replace('<title>SiteFlow</title>', '<title>SiteFlow Demo</title>', 1).replace('/*__APP_JS__*/', demo_js)
write(os.path.join(root, 'demo', 'siteflow-demo-page.html'), demo)
write(os.path.join(root, 'demo', 'SiteFlow-Demo.html'), full_document(demo))

print('Built www/index.html, web-src/siteflow.html and demo/SiteFlow-Demo.html')
