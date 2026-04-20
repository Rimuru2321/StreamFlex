import re
import os

with open('script.js', 'r', encoding='utf-8') as f:
    code = f.read()

funcs_to_extract = ['loadProfileView', 'loadUpcoming', 'loadRecommendations']

# Find all declarations to export
# We will just do a bulk regex to prepend "export "
# Since we only care about top level, we will split by lines and only affect lines without leading spaces
lines = code.split('\n')
new_lines = []
exports = []

for i, line in enumerate(lines):
    if line.startswith('const ') or line.startswith('let ') or line.startswith('function ') or line.startswith('async function ') or line.startswith('var '):
        # check if it's already exported
        if not line.startswith('export '):
            # Also extract the name so we can build the import statement
            m = re.match(r'^(?:async\s+)?(?:const|let|var|function)\s+([a-zA-Z0-9_]+)', line)
            if m:
                name = m.group(1)
                exports.append(name)
            
            # Avoid exporting runIntro which is an IIFE: (function runIntro
            if not line.startswith('('):
                line = 'export ' + line
    new_lines.append(line)

code_exported = '\n'.join(new_lines)

# Now extract the functions exactly
def extract_func(name, text):
    m = re.search(r'export (?:async )?function ' + name + r'\s*\([^)]*\)\s*\{', text)
    if not m:
        return '', text
    start = m.start()
    braces = 0
    in_func = False
    end = -1
    for i in range(start, len(text)):
        if text[i] == '{':
            in_func = True
            braces += 1
        elif text[i] == '}':
            braces -= 1
            if in_func and braces == 0:
                end = i + 1
                break
    func_code = text[start:end]
    # Replace the function in text with import statement placeholder
    # Wait, replacing with placeholder is better later. Let's just remove it.
    text = text[:start] + f"/* {name} extracted to views/{name}.js */\n" + text[end:]
    return func_code, text

f_prof, code_exported = extract_func('loadProfileView', code_exported)
f_upc, code_exported = extract_func('loadUpcoming', code_exported)
f_rec, code_exported = extract_func('loadRecommendations', code_exported)

# Remove "export " from the extracted functions so they can be exported normally or default
f_prof = f_prof.replace('export async function', 'export async function') # keep export
f_upc = f_upc.replace('export async function', 'export async function')
f_rec = f_rec.replace('export async function', 'export async function')

# Add setters for mutated variables
setters = """
export function setWatchHistory(v) { watchHistory = v; }
export function setCurrentData(v) { currentData = v; }
export function setIsPersonSearch(v) { isPersonSearch = v; }
"""
code_exported = code_exported + '\n' + setters

# Build import block
# To avoid cyclic import errors breaking linting, we just import what we need. Since we extracted names, let's just dump them all
import_vars = ', '.join(set(exports))
import_block = f"""import {{ 
  {import_vars}, 
  setWatchHistory, 
  setCurrentData, 
  setIsPersonSearch 
}} from '../script.js';\n\n"""

# Apply mutations in scripts
def mutate_script(js_code):
    js_code = js_code.replace("watchHistory = watchHistory.filter", "setWatchHistory(watchHistory.filter")
    js_code = js_code.replace("watchHistory=[];", "setWatchHistory([]);")
    js_code = js_code.replace("currentData = filtered;", "setCurrentData(filtered);")
    js_code = js_code.replace("isPersonSearch = true;", "setIsPersonSearch(true);")
    js_code = js_code.replace("isPersonSearch = false;", "setIsPersonSearch(false);")
    js_code = js_code.replace("SFStorage.setItem('watchHistory', JSON.stringify(watchHistory));", "SFStorage.setItem('watchHistory', JSON.stringify(watchHistory));") # wait, filter replacement will leave a syntax error if not closed
    return js_code

# Better manual replacements:
f_prof = f_prof.replace("watchHistory = watchHistory.filter(h=>h.id!==parseInt(btn.dataset.id));", "setWatchHistory(watchHistory.filter(h=>h.id!==parseInt(btn.dataset.id)));")
f_prof = f_prof.replace("watchHistory=[]; SFStorage.setItem", "setWatchHistory([]); SFStorage.setItem")
f_rec = f_rec.replace("currentData = filtered;", "setCurrentData(filtered);")
# add import block
f_prof = import_block + f_prof
f_upc = import_block + f_upc
f_rec = import_block + f_rec

# Add imports to top of script.js
script_imports = """import { loadProfileView } from './views/perfil.js';
import { loadUpcoming } from './views/estrenos.js';
import { loadRecommendations } from './views/para-ti.js';
"""
code_exported = script_imports + '\n' + code_exported

with open('views/perfil.js', 'w', encoding='utf-8') as f: f.write(f_prof)
with open('views/estrenos.js', 'w', encoding='utf-8') as f: f.write(f_upc)
with open('views/para-ti.js', 'w', encoding='utf-8') as f: f.write(f_rec)
with open('script.js', 'w', encoding='utf-8') as f: f.write(code_exported)

print("Modularization complete.")
