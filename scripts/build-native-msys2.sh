#!/usr/bin/env bash
# Build a local Windows x64 libimobiledevice payload from pinned upstream sources.
# Run only from an MSYS2 UCRT64 shell (normally via Construire-outils-libimobiledevice-Windows.cmd).
set -Eeuo pipefail

fail() {
  printf '\nERREUR: %s\n' "$*" >&2
  exit 1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
LOCK_FILE="$SCRIPT_DIR/native-sources.lock"

[[ "${MSYSTEM:-}" == "UCRT64" ]] || fail "Lancez ce script dans l'environnement MSYS2 UCRT64 (Windows x64)."
[[ "${MSYSTEM_CARCH:-}" == "x86_64" ]] || fail "L'architecture MSYS2 doit être x86_64."
[[ "${MINGW_PREFIX:-}" == "/ucrt64" ]] || fail "Préfixe MSYS2 inattendu : ${MINGW_PREFIX:-absent}. UCRT64 est requis."
[[ -f "$LOCK_FILE" ]] || fail "Fichier de versions absent : $LOCK_FILE"

command -v pacman >/dev/null 2>&1 || fail "pacman est absent : lancez le shell MSYS2 UCRT64."

# Use signed MSYS2 packages for the compiler and build dependencies. Source code
# for NovaUnlock's native tools is fetched separately from the upstream GitHub org
# and checked against the commit pins in native-sources.lock.
packages=(
  base-devel
  git
  make
  libtool
  autoconf
  automake-wrapper
  mingw-w64-ucrt-x86_64-gcc
  mingw-w64-ucrt-x86_64-pkgconf
  mingw-w64-ucrt-x86_64-curl
  mingw-w64-ucrt-x86_64-libxml2
  mingw-w64-ucrt-x86_64-libzip
  mingw-w64-ucrt-x86_64-openssl
  mingw-w64-ucrt-x86_64-libusb
)

printf 'Installation/vérification des outils de compilation MSYS2...\n'
pacman -S --needed "${packages[@]}"
for command_name in git autoconf make pkgconf ldd objdump; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Commande absente après installation MSYS2 : $command_name"
done

# Keep intermediate build files outside the checkout: autotools and pkg-config
# behave poorly when their prefix contains Windows paths with spaces.
WORK_ROOT="$(mktemp -d /tmp/novaunlock-native.XXXXXX)"
SOURCE_ROOT="$WORK_ROOT/sources"
PREFIX="$WORK_ROOT/prefix"
PAYLOAD="$WORK_ROOT/payload"
LOG_ROOT="$WORK_ROOT/logs"
mkdir -p "$SOURCE_ROOT" "$PREFIX" "$PAYLOAD" "$LOG_ROOT"

keep_failure_logs() {
  local status=$?
  if (( status != 0 )); then
    local destination="$REPO_ROOT/.native-build/logs"
    mkdir -p "$destination"
    cp -f "$LOG_ROOT"/*.log "$destination/" 2>/dev/null || true
    printf '\nLes journaux de compilation sont conservés dans :\n  %s\n' "$destination" >&2
  fi
  rm -rf -- "$WORK_ROOT"
  return "$status"
}
trap keep_failure_logs EXIT

export PATH="$PREFIX/bin:$MINGW_PREFIX/bin:$PATH"
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig:$PREFIX/share/pkgconfig:$MINGW_PREFIX/lib/pkgconfig:$MINGW_PREFIX/share/pkgconfig"
export PKG_CONFIG_LIBDIR="$PKG_CONFIG_PATH"

# Clone each official release tag and verify its resolved commit before running
# any upstream build script. A moved/replaced tag therefore fails closed.
while read -r project version expected_sha; do
  [[ -z "${project:-}" || "$project" == \#* ]] && continue
  [[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]] || fail "SHA de source invalide dans $LOCK_FILE pour $project"

  source_dir="$SOURCE_ROOT/$project"
  printf '\nRécupération de %s %s depuis libimobiledevice/%s...\n' "$project" "$version" "$project"
  git clone --quiet --depth 1 --branch "$version" \
    "https://github.com/libimobiledevice/$project.git" "$source_dir" || \
    fail "Impossible de cloner la version épinglée $project $version."

  actual_sha="$(git -C "$source_dir" rev-parse HEAD)"
  [[ "$actual_sha" == "$expected_sha" ]] || \
    fail "$project $version ne correspond pas au commit épinglé (attendu $expected_sha, reçu $actual_sha)."
done < "$LOCK_FILE"

jobs="$(nproc 2>/dev/null || printf '2')"
[[ "$jobs" =~ ^[1-9][0-9]*$ ]] || jobs=2

build_component() {
  local project="$1"
  local source_dir="$SOURCE_ROOT/$project"
  local configure_log="$LOG_ROOT/${project}-configure.log"
  local build_log="$LOG_ROOT/${project}-build.log"
  local install_log="$LOG_ROOT/${project}-install.log"
  local configure_args=("--prefix=$PREFIX")

  # Python bindings and interactive readline support are not used by NovaUnlock.
  # Disabling them avoids unrelated build dependencies and an unnecessary GPL DLL.
  if [[ "$project" == "libplist" || "$project" == "libimobiledevice" ]]; then
    configure_args+=(--without-cython)
  fi
  if [[ "$project" == "libimobiledevice" ]]; then
    configure_args+=(--without-readline)
  fi

  # The pinned 1.0.0 release joins -O2 and -DWIN32 without a space.
  # Patch only verified sources, before autogen generates configure/Makefiles.
  if [[ "$project" == "idevicerestore" ]]; then
    local source_patch="$SCRIPT_DIR/patches/idevicerestore-1.0.0-win32-cflags.patch"
    if ! git -C "$source_dir" apply --check "$source_patch" ||
       ! git -C "$source_dir" apply "$source_patch"; then
      fail "Application du correctif CFLAGS Windows de $project échouée."
    fi
  fi

  printf '\nCompilation de %s...\n' "$project"
  if ! (cd "$source_dir" && ./autogen.sh "${configure_args[@]}") >"$configure_log" 2>&1; then
    tail -n 80 "$configure_log" >&2 || true
    fail "Configuration de $project échouée."
  fi
  if ! (cd "$source_dir" && make V=1 -j"$jobs") >"$build_log" 2>&1; then
    tail -n 80 "$build_log" >&2 || true
    fail "Compilation de $project échouée."
  fi
  if ! (cd "$source_dir" && make install) >"$install_log" 2>&1; then
    tail -n 80 "$install_log" >&2 || true
    fail "Installation locale de $project échouée."
  fi
}

# Dependency order follows the upstream stack: plist/glue/tatsu/usbmuxd first,
# then the app-facing tools and recovery/restore components.
for project in \
  libplist \
  libimobiledevice-glue \
  libtatsu \
  libusbmuxd \
  libimobiledevice \
  libirecovery \
  libideviceactivation \
  idevicerestore; do
  build_component "$project"
done

required_tools=(
  idevice_id.exe
  ideviceinfo.exe
  ideviceactivation.exe
  idevicebackup2.exe
  idevicerestore.exe
  irecovery.exe
)
optional_tools=(ideviceenterrecovery.exe)

for tool in "${required_tools[@]}"; do
  [[ -f "$PREFIX/bin/$tool" ]] || fail "L'outil attendu n'a pas été construit : $tool"
  architecture_info="$(objdump -f "$PREFIX/bin/$tool")" || fail "Impossible de lire l'architecture de $tool."
  if ! grep -qi 'architecture: i386:x86-64' <<<"$architecture_info"; then
    fail "$tool n'est pas un exécutable Windows x64 reconnu."
  fi
done

for tool in "${required_tools[@]}" "${optional_tools[@]}"; do
  [[ -f "$PREFIX/bin/$tool" ]] && cp -L "$PREFIX/bin/$tool" "$PAYLOAD/$tool"
done

# Copy only runtime DLLs reachable from the selected executables. System Windows
# DLLs are not bundled. Any unresolved dependency stops the build before staging.
declare -A visited_dependencies=()
declare -A msys_runtime_packages=()
resolve_dependencies() {
  local binary="$1"
  local ldd_output dependency basename owner
  ldd_output="$(ldd "$binary" 2>&1)" || fail "Impossible d'analyser les dépendances de $(basename "$binary")."
  if grep -qi 'not found' <<<"$ldd_output"; then
    printf '%s\n' "$ldd_output" >&2
    fail "DLL manquante dans les dépendances de $(basename "$binary")."
  fi

  while IFS= read -r dependency; do
    [[ -f "$dependency" ]] || continue
    case "$dependency" in
      "$PREFIX"/bin/*.dll|"$MINGW_PREFIX"/bin/*.dll) ;;
      *) continue ;;
    esac

    basename="${dependency##*/}"
    [[ -n "${visited_dependencies[${basename,,}]+x}" ]] && continue
    visited_dependencies["${basename,,}"]=1
    cp -L "$dependency" "$PAYLOAD/$basename"

    case "$dependency" in
      "$MINGW_PREFIX"/bin/*)
        owner="$(pacman -Qoq "$dependency" 2>/dev/null || true)"
        [[ -n "$owner" ]] && msys_runtime_packages["$owner"]=1
        ;;
    esac

    resolve_dependencies "$dependency"
  done < <(
    sed -n -E 's/^.* => (.*) \(0x[[:xdigit:]]+\)$/\1/p' <<<"$ldd_output"
  )
}

for tool in "${required_tools[@]}" "${optional_tools[@]}"; do
  [[ -f "$PREFIX/bin/$tool" ]] && resolve_dependencies "$PREFIX/bin/$tool"
done

dll_count="$(find "$PAYLOAD" -maxdepth 1 -type f -iname '*.dll' | wc -l | tr -d '[:space:]')"
(( dll_count > 0 )) || fail "Aucune DLL d'exécution n'a été collectée."

# Retain all upstream COPYING/LICENSE texts and identify their exact source pins.
notice_file="$PAYLOAD/NOTICE.txt"
{
  cat <<'NOTICE_HEADER'
NovaUnlock — native Windows tools

This payload was built locally from release sources in the official
https://github.com/libimobiledevice organization. Source commit IDs are pinned
in scripts/native-sources.lock. A local patch to idevicerestore 1.0.0 adds
the missing space between -O2 and -DWIN32 in configure.ac (see
scripts/patches/idevicerestore-1.0.0-win32-cflags.patch).
The tools and bundled libraries retain their
respective licenses; see the notices and license texts below.

NOTICE_HEADER
  while read -r project version commit; do
    [[ -z "${project:-}" || "$project" == \#* ]] && continue
    printf '\n===== %s %s =====\nSource: https://github.com/libimobiledevice/%s/tree/%s\nCommit: %s\n' \
      "$project" "$version" "$project" "$version" "$commit"
    found_license=0
    while IFS= read -r -d '' license_path; do
      found_license=1
      printf '\n----- %s / %s -----\n' "$project" "${license_path##*/}"
      cat "$license_path"
      printf '\n'
    done < <(find "$SOURCE_ROOT/$project" -maxdepth 1 -type f \
      \( -iname 'COPYING*' -o -iname 'LICENSE*' -o -iname 'NOTICE*' \) -print0 | sort -z)
    (( found_license == 1 )) || fail "Aucun fichier de licence trouvé pour $project."
  done < "$LOCK_FILE"

  printf '\n===== MSYS2 runtime dependency packages =====\n'
  for package in "${!msys_runtime_packages[@]}"; do
    printf '\n----- %s -----\n' "$package"
    pacman -Qi "$package" 2>/dev/null | awk -F ':[[:space:]]*' \
      '/^(Name|Version|Licenses)[[:space:]]*:/ { print $1 ": " $2 }'
    while IFS= read -r license_path; do
      [[ -f "$license_path" ]] || continue
      case "${license_path##*/}" in
        COPYING*|COPYRIGHT*|LICENSE*|NOTICE*)
          printf '\n----- %s / %s -----\n' "$package" "${license_path##*/}"
          cat "$license_path"
          printf '\n'
          ;;
      esac
    done < <(pacman -Qlq "$package" 2>/dev/null | grep -E '/share/(licenses|doc)/' || true)
  done
} > "$notice_file"

# Validate the staged payload before replacing any existing local native files.
for tool in "${required_tools[@]}"; do
  [[ -s "$PAYLOAD/$tool" ]] || fail "Payload incomplet : $tool"
done
[[ -s "$notice_file" ]] || fail "Les notices/licences n'ont pas été générées."

native_dir="$REPO_ROOT/native/libimobiledevice"
mkdir -p "$native_dir"
# Remove only old executable/DLL payload files. Documentation and user files stay.
find "$native_dir" -maxdepth 1 -type f \
  \( -iname '*.exe' -o -iname '*.dll' -o -iname 'NOTICE.txt' \) -delete
cp -L "$PAYLOAD"/* "$native_dir/"

printf '\nPayload Windows x64 construit et installé dans :\n  %s\n' "$native_dir"
printf 'Outils requis : %s exécutables ; DLL collectées : %s\n' "${#required_tools[@]}" "$dll_count"
printf 'Notices et licences : %s\n' "$native_dir/NOTICE.txt"
printf '\nAucun appareil iOS n’a été testé. Lancez ensuite Creer-installateur-Windows.cmd sur Windows.\n'
