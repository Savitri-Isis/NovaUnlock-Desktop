#!/usr/bin/env bash
# Offline regression test: bash scripts/tests/idevicerestore-win32-stat.sh
#
# Without the patch, idevicerestore 1.0.0 does not build on Windows:
# src/common.h hides <sys/stat.h> behind "#else", but src/idevicerestore.c uses
# struct stat and stat() under -DWIN32 ("storage size of 'fst' isn't known").
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/src" "$work/stub/sys"
# Relevant excerpt from the pinned upstream src/common.h.
cat > "$work/src/common.h" <<'FIXTURE'
char *generate_guid(void);

#ifdef WIN32
#include <windows.h>
#include <unistd.h>
#define __mkdir(path, mode) mkdir(path)
#ifndef sleep
#define sleep(x) Sleep(x*1000)
#endif
#define __usleep(x) Sleep(x/1000)
#else
#include <sys/stat.h>
#define __mkdir(path, mode) mkdir(path, mode)
#define __usleep(x) usleep(x)
#endif

int mkdir_with_parents(const char *dir, int mode);
FIXTURE
# Minimal stand-ins for the headers MinGW provides, so the same C code can be
# compiled offline with the host compiler.
cat > "$work/stub/windows.h" <<'FIXTURE'
#ifndef STUB_WINDOWS_H
#define STUB_WINDOWS_H
#define Sleep(x) 0
#endif
FIXTURE
cat > "$work/stub/unistd.h" <<'FIXTURE'
#ifndef STUB_UNISTD_H
#define STUB_UNISTD_H
#endif
FIXTURE
cat > "$work/stub/sys/stat.h" <<'FIXTURE'
#ifndef STUB_SYS_STAT_H
#define STUB_SYS_STAT_H
struct stat { long st_size; };
int stat(const char *path, struct stat *buf);
#endif
FIXTURE
# Same usages as the pinned src/idevicerestore.c (load_version_data, ...).
cat > "$work/probe.c" <<'FIXTURE'
#include <string.h>

#include "common.h"

int probe(void)
{
	struct stat fst;
	struct stat st;
	if (stat(".", &st) < 0) {
		return -1;
	}
	memset(&st, '\0', sizeof(struct stat));
	return stat(".", &fst) == 0;
}
FIXTURE
compile_probe() {
  "${CC:-gcc}" -DWIN32 -I "$work/stub" -I "$work/src" -c "$work/probe.c" -o "$work/probe.o"
}
# The test must detect the defect: unpatched sources cannot compile the probe.
if compile_probe 2>"$work/unpatched.log"; then
  echo 'ERROR: les sources amont non corrigées compilent : le test ne détecte plus le défaut.' >&2
  exit 1
fi
if ! grep -qE "incomplete type|isn't known" "$work/unpatched.log"; then
  echo 'ERROR: erreur de compilation inattendue avant correctif ; l’extrait amont a changé.' >&2
  cat "$work/unpatched.log" >&2
  exit 1
fi
patch_file="$SCRIPT_DIR/../patches/idevicerestore-1.0.0-win32-stat.patch"
git -C "$work" apply --check "$patch_file"
git -C "$work" apply "$patch_file"
if ! compile_probe; then
  echo 'ERROR: stat/struct stat restent inconnus sous WIN32 après le correctif.' >&2
  exit 1
fi
# Fail closed if the source no longer matches (including double application).
if git -C "$work" apply --check "$patch_file" 2>/dev/null; then
  echo 'ERROR: patch unexpectedly accepted already-patched source' >&2
  exit 1
fi
printf 'PASS: stat() et struct stat sont déclarés sous WIN32 pour idevicerestore.\n'
