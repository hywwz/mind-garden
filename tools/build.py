"""Build shared HTML and, optionally, the portable PWA from repository sources."""
from pathlib import Path
import argparse, subprocess, sys

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--web',action='store_true',help='also build the iPad / PWA web distribution')
args=parser.parse_args()
scripts=['work/life/build.py']+(['web/build.py'] if args.web else [])
for script in scripts:
    subprocess.run([sys.executable,str(ROOT/script)],cwd=ROOT,check=True)
print('Build completed. Generated files are under outputs/ and, with --web, web/dist/.')
