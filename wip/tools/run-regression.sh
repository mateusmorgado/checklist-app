#!/bin/bash
# usage: run-regression.sh /abs/path/to/index.html   -> runs every old suite against that file, prints only failures + summary
F="${1:?html file}"
D=/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad
T=$(mktemp -d "$D/regress.XXXX")
fail=0
for t in t8 t9 t11 t14 t15 t16 t18 t19 t21 t24 t25; do
  sed "s#file:///home/user/checklist-app/index.html#file://$F#g" "$D/$t.cjs" > "$T/$t.cjs"
  sed -i "s#require('./pw/#require('$D/pw/#g; s#process.cwd()+'/pw/#'$D/pw/#g" "$T/$t.cjs"
  out=$(cd "$D" && timeout 240 node "$T/$t.cjs" 2>&1)
  bad=$(echo "$out" | grep -E "^FAIL |PAGEERR|Error:|TimeoutError|FAILS: [1-9]" | grep -v "no eval/Function in source")
  if [ -n "$bad" ]; then echo "[$t] FAILURES:"; echo "$bad" | head -8; fail=1; else echo "[$t] ok"; fi
done
rm -rf "$T"
exit $fail
