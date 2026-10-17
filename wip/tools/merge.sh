#!/bin/bash
# usage: merge.sh <out.html> <agent-dir-name>...   Three-way merges each agent's copy onto the real file using work/base.html as the common ancestor.
D=/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad
OUT="$1"; shift
cp /home/user/checklist-app/index.html "$OUT"
for a in "$@"; do
  git merge-file -L current -L base -L "$a" "$OUT" "$D/work/base.html" "$D/work/$a/index.html"
  rc=$?
  if [ $rc -lt 0 ]; then echo "merge error for $a"; exit 2; fi
  echo "merged $a: $rc conflict(s)"
done
grep -c '^<<<<<<<' "$OUT" | sed 's/^/conflict markers left: /'
