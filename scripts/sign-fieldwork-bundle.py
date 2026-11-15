"""Sign a Play App Bundle using the existing private Agrighar upload key."""
from pathlib import Path
import os,subprocess,sys,shutil
root=Path(__file__).resolve().parent.parent
private=root/'.fieldwork-private/android-signing'
key=private/'agrighar-fieldwork.jks';password=private/'signing-password.txt'
if not key.is_file() or not password.is_file():raise RuntimeError('Existing release signing material is required')
target=Path(sys.argv[2]);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(sys.argv[1],target)
java=Path(os.environ.get('JAVA_HOME','/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home'))/'bin'
env={**os.environ,'FIELDWORK_KEY_PASSWORD':password.read_text().strip()}
subprocess.run([str(java/'jarsigner'),'-keystore',str(key),'-storepass:env','FIELDWORK_KEY_PASSWORD','-keypass:env','FIELDWORK_KEY_PASSWORD',str(target),'agrighar-fieldwork'],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
subprocess.run([str(java/'jarsigner'),'-verify',str(target)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
print('Signed app bundle:',target)
