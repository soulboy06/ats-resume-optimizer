"""Check/apply only the two OTP email templates; never print SMTP credentials."""
import argparse
import json
import os
from pathlib import Path
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'qcjlagocvexlwbjvonps'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='Apply the prepared templates to the Supabase project')
    args = parser.parse_args()
    desired = {
        'mailer_subjects_confirmation': 'CheckATS · 注册验证码 / Verify your email',
        'mailer_subjects_recovery': 'CheckATS · 重置密码验证码 / Password reset code',
        'mailer_templates_confirmation_content': (ROOT/'supabase/email-templates/confirmation.html').read_text(encoding='utf8'),
        'mailer_templates_recovery_content': (ROOT/'supabase/email-templates/recovery.html').read_text(encoding='utf8'),
    }
    for value in (desired['mailer_templates_confirmation_content'],desired['mailer_templates_recovery_content']):
        assert '{{ .Token }}' in value and '.ConfirmationURL' not in value
    token = os.environ.get('SUPABASE_ACCESS_TOKEN')
    if not token:
        print('Templates valid locally. Live project not checked: SUPABASE_ACCESS_TOKEN is unavailable.')
        return 2
    url = f'https://api.supabase.com/v1/projects/{PROJECT}/config/auth'
    headers = {'Authorization':'Bearer '+token,'Content-Type':'application/json'}
    def request(method, data=None):
        body = json.dumps(data).encode('utf8') if data is not None else None
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise SystemExit(f'Supabase management request failed (HTTP {error.code}). Response body suppressed.')
    current = request('GET')
    print('Email confirmation enabled:',bool(current.get('mailer_autoconfirm') is False))
    for name in ('confirmation','recovery'):
        value = current.get('mailer_templates_'+name+'_content','')
        print(name+':', 'code visible' if '{{ .Token }}' in value else 'code not visible')
    if not args.apply:
        print('Read-only check complete; use --apply to update only the two email templates.')
        return 0
    backup = ROOT/'tmp/auth-email-backup.json'
    backup.parent.mkdir(parents=True,exist_ok=True)
    if backup.exists():
        raise SystemExit('An email-template backup already exists. Preserve/rename it before applying another update.')
    backup.write_text(json.dumps({k:current.get(k) for k in desired},ensure_ascii=False,indent=2),encoding='utf8')
    request('PATCH', desired)
    updated = request('GET')
    if any(updated.get(k)!=v for k,v in desired.items()):
        raise SystemExit('Template update could not be verified. Review the project settings; prior template fields are saved locally.')
    print('Both OTP templates applied and verified. Existing SMTP, confirmation requirements and other settings were preserved.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
