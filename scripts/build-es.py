# Merges translation batches (JSON files given as args) into src/lib/i18n/es.ts.
import json, re, sys
p = "src/lib/i18n/es.ts"
cur = {}
src = open(p).read()
for m in re.finditer(r'^\s*("(?:[^"\\\n]|\\.)*")\s*:\s*("(?:[^"\\\n]|\\.)*"),?\s*$', src, re.M):
    cur[json.loads(m.group(1))] = json.loads(m.group(2))
for f in sys.argv[1:]:
    cur.update(json.load(open(f)))
lines = [f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}," for k, v in sorted(cur.items(), key=lambda kv: kv[0].lower())]
open(p, "w").write(
    "// Spanish text. The English text is the key; missing keys fall back to English.\n"
    "// Run `npm run i18n:check` to list English text that has no Spanish yet.\n"
    "export const es: Record<string, string> = {\n" + "\n".join(lines) + "\n}\n")
print(len(cur), "translations")
