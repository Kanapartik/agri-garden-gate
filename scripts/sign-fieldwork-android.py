"""Sign a release APK; private signing material stays outside tracked source."""
from pathlib import Path
import os, secrets, subprocess, sys
root=Path(__file__).resolve().parent.parent
private=root/'.fieldwork-private'/'android-signing';private.mkdir(parents=True,exist_ok=True);private.chmod(0o700)
key=private/'agrighar-fieldwork.jks';password=private/'signing-password.txt'
java=Path(os.environ.get('JAVA_HOME','/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home'))
sdk=Path(os.environ.get('ANDROID_HOME','/opt/homebrew/share/android-commandlinetools'))
if not key.exists():
 if password.exists():raise RuntimeError('Signing state needs coordinator review; existing password file retained.')
 password.write_text(secrets.token_urlsafe(36));password.chmod(0o600)
 env={**os.environ,'FIELDWORK_KEY_PASSWORD':password.read_text()}
 subprocess.run([str(java/'bin/keytool'),'-genkeypair','-keystore',str(key),'-alias','agrighar-fieldwork','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Agrighar Fieldwork, O=Agrivah, C=NG','-storepass:env','FIELDWORK_KEY_PASSWORD','-keypass:env','FIELDWORK_KEY_PASSWORD'],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 key.chmod(0o600)
source=Path(sys.argv[1]);target=Path(sys.argv[2]);target.parent.mkdir(parents=True,exist_ok=True)
aligned=target.with_suffix('.aligned.apk')
subprocess.run([str(sdk/'build-tools/36.0.0/zipalign'),'-f','-p','4',str(source),str(aligned)],check=True)
env={**os.environ,'JAVA_HOME':str(java)}
subprocess.run([str(sdk/'build-tools/36.0.0/apksigner'),'sign','--ks',str(key),'--ks-key-alias','agrighar-fieldwork','--ks-pass','file:'+str(password),'--out',str(target),str(aligned)],env=env,check=True)
aligned.unlink()
sidecar=target.with_suffix(target.suffix+'.idsig')
if sidecar.exists():sidecar.unlink()
subprocess.run([str(sdk/'build-tools/36.0.0/apksigner'),'verify','--verbose',str(target)],env=env,check=True)
print('Signed APK:',target)
