#!/usr/bin/env bash
# Offline regression test: bash scripts/tests/idevicerestore-win32-libs.sh
#
# Without the patch, linking idevicerestore on Windows fails: src/socket.c calls
# winsock (socket(), htons(), ...) but src/Makefile.am never links ws2_32.
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/src"
# Relevant excerpt from the pinned upstream src/Makefile.am.
cat > "$work/src/Makefile.am" <<'FIXTURE'
AM_CFLAGS = \
	$(GLOBAL_CFLAGS) \
	$(libirecovery_CFLAGS) \
	$(libcurl_CFLAGS)

AM_LDFLAGS = \
	$(AC_LDFLAGS) \
	$(libirecovery_LIBS) \
	$(libimobiledevice_LIBS) \
	$(libplist_LIBS) \
	$(libzip_LIBS) \
	$(zlib_LIBS) \
	$(openssl_LIBS) \
	$(libcurl_LIBS)

AM_LDADD = $(AC_LDADD)

bin_PROGRAMS = idevicerestore
FIXTURE
patch_file="$SCRIPT_DIR/../patches/idevicerestore-1.0.0-win32-libs.patch"
git -C "$work" apply --check "$patch_file"
git -C "$work" apply "$patch_file"
# ws2_32 must stay in AM_LDFLAGS directly after libcurl, where the linker
# resolves the winsock symbols used by src/socket.c.
if [[ "$(grep -c 'ws2_32' "$work/src/Makefile.am")" != 1 ]] ||
   ! grep -qE '^[[:space:]]*\$\(libcurl_LIBS\) -lws2_32$' "$work/src/Makefile.am"; then
  echo 'ERROR: -lws2_32 absent ou mal placé dans AM_LDFLAGS après le correctif.' >&2
  exit 1
fi
if git -C "$work" apply --check "$patch_file" 2>/dev/null; then
  echo 'ERROR: patch unexpectedly accepted already-patched source' >&2
  exit 1
fi
# Optional extra proof when a MinGW cross-compiler is installed: winsock links
# only with the flag the patch adds.
mingw_cc="${MINGW_CC:-x86_64-w64-mingw32-gcc}"
if command -v "$mingw_cc" >/dev/null 2>&1; then
  cat > "$work/winsock.c" <<'FIXTURE'
#include <winsock2.h>
int main(void) { return socket(AF_INET, SOCK_STREAM, IPPROTO_TCP) == INVALID_SOCKET; }
FIXTURE
  if ! "$mingw_cc" -c "$work/winsock.c" -o "$work/winsock.o" 2>/dev/null; then
    printf 'INFO: %s est présent mais compile mal winsock2.h ; vérification de l’édition de liens ignorée.\n' "$mingw_cc"
  else
    if "$mingw_cc" "$work/winsock.o" -o "$work/winsock.exe" 2>"$work/link.log"; then
      echo 'ERROR: les appels winsock se lient sans -lws2_32 : le correctif serait inutile.' >&2
      exit 1
    fi
    if ! grep -qiE 'socket|htons' "$work/link.log"; then
      echo 'ERROR: échec de liaison sans rapport avec winsock ; vérification abandonnée.' >&2
      cat "$work/link.log" >&2
      exit 1
    fi
    if ! "$mingw_cc" "$work/winsock.o" -lws2_32 -o "$work/winsock.exe" 2>"$work/link.log"; then
      echo 'ERROR: -lws2_32 ne résout pas les appels winsock.' >&2
      cat "$work/link.log" >&2
      exit 1
    fi
  fi
fi
printf 'PASS: ws2_32 est lié pour socket.c dans les sources Windows épinglées.\n'
