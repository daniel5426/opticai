#!/usr/bin/env bash
set -euo pipefail

readonly MDBTOOLS_VERSION="1.0.1"
readonly MDBTOOLS_SHA256="750cbf793bf5b7e296fdc359124393a0aef89ee663b7741ba4b1ca2ce30b3b37"
readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly HELPER_DIR="$ROOT_DIR/native/optitech-mdb-exporter"
readonly OUTPUT_DIR="$HELPER_DIR/dist/win-x64"
readonly WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

mkdir -p "$OUTPUT_DIR"
ARCHIVE="$WORK_DIR/mdbtools.tar.gz"
curl --fail --location --silent --show-error \
  "https://github.com/mdbtools/mdbtools/archive/refs/tags/v${MDBTOOLS_VERSION}.tar.gz" \
  --output "$ARCHIVE"
echo "$MDBTOOLS_SHA256  $ARCHIVE" | sha256sum --check --status
tar -xzf "$ARCHIVE" -C "$WORK_DIR"

MDBTOOLS_DIR="$WORK_DIR/mdbtools-${MDBTOOLS_VERSION}"
PREFIX="$WORK_DIR/prefix"
pushd "$MDBTOOLS_DIR" >/dev/null
# MDB Tools v1.0.1 predates current MinGW headers.  Correct its Windows
# spawnv alias and supply the MinGW locale_t spelling before generating files.
perl -0pi -e 's/-D_spawnv=spawnv/-D_spawnv=_spawnv/' configure.ac
perl -0pi -e 's{(#define MDB_DEPRECATED\(type, funcname\) type __attribute__\(\(deprecated\)\) funcname\n)}{$1\n#ifdef __MINGW32__\n  #include <stdlib.h>\n  #ifndef locale_t\n    typedef _locale_t locale_t;\n  #endif\n#endif\n}' include/mdbtools.h.in
perl -pi -e 's/CFLAGS="\$CFLAGS -D_spawnv=_spawnv"/CFLAGS="\$CFLAGS -D_spawnv=_spawnv -DHAVE_ICONV" LIBS="\$LIBS -liconv"/' configure.ac
perl -0pi -e 's/HAVE_ICONV_H=0\n/HAVE_ICONV_H=0\nAS_CASE([\$host], [*mingw*], [HAVE_ICONV_H=1], [])\n/' configure.ac
grep -F -- '-D_spawnv=_spawnv' configure.ac >/dev/null
grep -F -- 'typedef _locale_t locale_t;' include/mdbtools.h.in >/dev/null
grep -F -- '-DHAVE_ICONV' configure.ac >/dev/null
autoreconf -i -f
# MinGW provides iconv in libiconv rather than the C runtime. MDB Tools v1.0.1
# cannot detect it reliably there, so the source patch enables the known DLL.
./configure --prefix="$PREFIX" --disable-static --enable-shared
grep -F -- '#define MDBTOOLS_H_HAVE_ICONV_H 1' include/mdbtools.h >/dev/null
grep -F -- '-liconv' src/libmdb/Makefile >/dev/null
make -j"$(nproc)"
make install
popd >/dev/null

gcc -O2 -Wall -Wextra \
  -I"$PREFIX/include" \
  $(pkg-config --cflags glib-2.0) \
  "$HELPER_DIR/main.c" \
  -L"$PREFIX/lib" -lmdb $(pkg-config --libs glib-2.0) \
  -o "$OUTPUT_DIR/optitech-mdb-exporter.exe"

copy_deps() {
  local binary="$1"
  while IFS= read -r dependency; do
    [[ -f "$dependency" ]] || continue
    local destination="$OUTPUT_DIR/$(basename "$dependency")"
    if [[ ! -f "$destination" ]]; then
      cp "$dependency" "$destination"
      copy_deps "$dependency"
    fi
  done < <(ldd "$binary" | awk '/=> \/(mingw64|ucrt64)\/bin\// { print $3 }')
}

MDB_DLL="$(find "$PREFIX" -type f -name 'libmdb-*.dll' | head -n 1)"
[[ -n "$MDB_DLL" ]] || { echo "libmdb DLL was not built" >&2; exit 1; }
cp "$MDB_DLL" "$OUTPUT_DIR/"
copy_deps "$OUTPUT_DIR/optitech-mdb-exporter.exe"
copy_deps "$OUTPUT_DIR/libmdb-3.dll"
cp "$MDBTOOLS_DIR/COPYING.LIB" "$OUTPUT_DIR/COPYING.LIB"
cp "$HELPER_DIR/THIRD_PARTY_NOTICES.md" "$OUTPUT_DIR/THIRD_PARTY_NOTICES.md"
mkdir -p "$OUTPUT_DIR/runtime-licenses"
for package in glib2 libiconv gettext pcre2 zlib gcc-libs mingw-w64-crt; do
  license_dir="/mingw64/share/licenses/$package"
  [[ -d "$license_dir" ]] && cp -R "$license_dir" "$OUTPUT_DIR/runtime-licenses/$package"
done
cat > "$OUTPUT_DIR/SOURCE_AND_BUILD.md" <<EOF
MDB Tools libmdb source: https://github.com/mdbtools/mdbtools/archive/refs/tags/v${MDBTOOLS_VERSION}.tar.gz
SHA-256: ${MDBTOOLS_SHA256}

Runtime DLL source packages: MSYS2 MINGW64 glib2, libiconv, gettext, pcre2,
zlib, gcc-libs, and mingw-w64-crt. Their applicable license texts are in
runtime-licenses/ and sources are available from https://packages.msys2.org/.

Build this folder on Windows with scripts/build-optitech-reader.sh in an MSYS2
MINGW64 environment. The Prysm helper source is native/optitech-mdb-exporter.
EOF
