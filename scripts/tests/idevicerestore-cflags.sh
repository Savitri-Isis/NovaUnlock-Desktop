#!/usr/bin/env bash
# Offline regression test: bash scripts/tests/idevicerestore-cflags.sh
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
# Relevant excerpt from the pinned upstream configure.ac.
cat > "$work/configure.ac" <<'FIXTURE'
GLOBAL_CFLAGS="-Wno-multichar -O2"
case ${host_os} in
  *mingw32*|*cygwin*)
    AC_MSG_RESULT([yes])
    win32=true
    GLOBAL_CFLAGS+="-DWIN32 -D__LITTLE_ENDIAN__=1"
    AC_LDFLAGS+="-static-libgcc"
    ;;
  darwin*)
FIXTURE
patch_file="$SCRIPT_DIR/../patches/idevicerestore-1.0.0-win32-cflags.patch"
git -C "$work" apply --check "$patch_file"
git -C "$work" apply "$patch_file"
# Execute only the flag assignments, not the autoconf macros.
source <(grep -E '^[[:space:]]*GLOBAL_CFLAGS' "$work/configure.ac")
read -r -a flags <<< "$GLOBAL_CFLAGS"
[[ "${flags[*]}" == '-Wno-multichar -O2 -DWIN32 -D__LITTLE_ENDIAN__=1' ]]
printf '#ifndef WIN32\n#error Missing WIN32\n#endif\nint main(void) { return 0; }\n' |
  "${CC:-gcc}" "${flags[@]}" -x c -c -o "$work/probe.o" -
# Fail closed if the source no longer matches (including double application).
if git -C "$work" apply --check "$patch_file" 2>/dev/null; then
  echo 'ERROR: patch unexpectedly accepted already-patched source' >&2
  exit 1
fi
printf 'PASS: Windows CFLAGS remain separate and compile successfully.\n'
