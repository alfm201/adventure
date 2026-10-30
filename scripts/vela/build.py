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
    str(root / 'src/policies/vela/native/bridge.cpp'), '-O3', '-std=c++20', '-ffp-contract=off', '-msimd128', '-flto',
    '-fexceptions', '-sDISABLE_EXCEPTION_CATCHING=0', '-sFILESYSTEM=0',
    '-sASYNCIFY=1', '-sASYNCIFY_STACK_SIZE=131072', '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=worker,node',
    '-sALLOW_MEMORY_GROWTH=1', '-sMAXIMUM_MEMORY=536870912', '-sINITIAL_MEMORY=16777216', '-sSTACK_SIZE=2097152',
    '-sEXPORTED_FUNCTIONS=["_malloc","_free","_state_ptr","_values_ptr","_init_model","_evaluate_state","_last_error","_last_depth","_last_capped","_last_nodes"]',
    '-sEXPORTED_RUNTIME_METHODS=["HEAPU8","HEAP32","HEAPF64","UTF8ToString","ccall"]',
    '-o', str(root / 'src/policies/vela/vela.mjs'),
], cwd=root, env=env, check=True)
loader = root / 'src/policies/vela/vela.mjs'
loader.write_text('\n'.join(line.rstrip() for line in loader.read_text(encoding='utf-8').splitlines()).rstrip() + '\n', encoding='utf-8', newline='\n')
update_manifest()
