"""Stable trilingual copy for public unsubscribe pages, independent of the renderer."""
COPY = {
    'he': {'unsubscribe_action': 'הסרה', 'unsubscribe_success': 'הוסרת בהצלחה',
           'unsubscribe_description': 'לא יישלחו אליך עוד הודעות שיווקיות בערוץ זה מהעסק הזה.'},
    'en': {'unsubscribe_action': 'Unsubscribe', 'unsubscribe_success': 'You are unsubscribed',
           'unsubscribe_description': 'You will no longer receive marketing messages from this business on this channel.'},
    'fr': {'unsubscribe_action': 'Se désinscrire', 'unsubscribe_success': 'Désinscription confirmée',
           'unsubscribe_description': 'Vous ne recevrez plus de messages marketing de cette entreprise sur ce canal.'},
}


def page(completed=False):
    if completed:
        body = ''.join(f'<section lang="{lang}" dir="{"rtl" if lang == "he" else "ltr"}"><h2>{text["unsubscribe_success"]}</h2><p>{text["unsubscribe_description"]}</p></section>' for lang, text in COPY.items())
    else:
        body = '<form method="post"><button>' + ' · '.join(v['unsubscribe_action'] for v in COPY.values()) + '</button></form>'
    return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prysm</title><main style="font:18px sans-serif;max-width:32rem;margin:4rem auto;padding:1rem;text-align:center"><h1>Prysm</h1>' + body + '</main>'
