from pathlib import Path
import os
import subprocess
from delivery import update_manifest

root = Path(__file__).resolve().parents[2]
sdk = root / '.tools/emsdk-main'
env = os.environ.copy()
env['EM_CONFIG'] = str(sdk / '.emscripten')
env['EM_CACHE'] = str(sdk / 'upstream/emscripten/cache')
subprocess.run([
    'python', str(sdk / 'upstream/emscripten/em++.py'),
    str(root / 'src/policies/vela/native/bridge.cpp'), '-O3', '-std=c++17', '-ffp-contract=off',
    '-fexceptions', '-sDISABLE_EXCEPTION_CATCHING=0', '-sFILESYSTEM=0',
    '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=worker,node',
    '-sALLOW_MEMORY_GROWTH=1', '-sMAXIMUM_MEMORY=2147483648', '-sINITIAL_MEMORY=16777216',
    '-sEXPORTED_FUNCTIONS=["_malloc","_free","_state_ptr","_values_ptr","_init_model","_evaluate_state","_last_error"]',
    '-sEXPORTED_RUNTIME_METHODS=["HEAPU8","HEAP32","HEAPF64","UTF8ToString"]',
    '-o', str(root / 'src/policies/vela/vela.mjs'),
], cwd=root, env=env, check=True)
update_manifest()
