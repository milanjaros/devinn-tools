"""Validate an Ad Hoc profile and prepare xcodebuild export settings on the CI Mac."""
import datetime
import os
from pathlib import Path
import plistlib
import shutil

temp = Path(os.environ['RUNNER_TEMP'])
with (temp / 'profile.plist').open('rb') as stream:
    profile = plistlib.load(stream)
team = profile['TeamIdentifier'][0]
bundle = os.environ['BUNDLE_ID']
entitlements = profile['Entitlements']
if entitlements['application-identifier'] != f'{team}.{bundle}':
    raise SystemExit('Profile App ID does not match IOS_BUNDLE_ID (an explicit App ID is required).')
if not profile.get('ProvisionedDevices') or entitlements.get('get-task-allow', False):
    raise SystemExit('Provide an Ad Hoc distribution profile with registered devices, not a development/App Store profile.')
if profile['ExpirationDate'] <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None):
    raise SystemExit('The provisioning profile has expired.')
uuid = profile['UUID']
destination = Path.home() / 'Library/MobileDevice/Provisioning Profiles'
destination.mkdir(parents=True, exist_ok=True)
shutil.copyfile(temp / 'profile.mobileprovision', destination / f'{uuid}.mobileprovision')
with open(os.environ['GITHUB_ENV'], 'a', encoding='utf-8') as stream:
    stream.write(f'IOS_TEAM={team}\nIOS_PROFILE_UUID={uuid}\n')
with (temp / 'ExportOptions.plist').open('wb') as stream:
    plistlib.dump({'method': 'release-testing', 'teamID': team, 'signingStyle': 'manual',
                  'signingCertificate': 'Apple Distribution',
                  'provisioningProfiles': {bundle: uuid}}, stream)
