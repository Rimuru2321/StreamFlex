import re
with open('script.js', 'r', encoding='utf-8') as f: code = f.read()

# Make all top level const/let/var global by attaching to window
out = []
# Very simple regex replacement.
out = re.sub(r'^(const|let|var)\s+([a-zA-Z0-9_]+)\s*=', r'window.\2 =', code, flags=re.MULTILINE)
out = re.sub(r'^function\s+([a-zA-Z0-9_]+)\s*\(', r'window.\1 = function(', out, flags=re.MULTILINE)
out = re.sub(r'^async function\s+([a-zA-Z0-9_]+)\s*\(', r'window.\1 = async function(', out, flags=re.MULTILINE)

with open('script2.js', 'w', encoding='utf-8') as f:
    f.write(out)
print("Done")
