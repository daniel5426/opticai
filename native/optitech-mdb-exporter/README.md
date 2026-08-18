# Prysm OptiTech MDB exporter

This helper uses the LGPL-licensed `libmdb` API from MDB Tools 1.0.1 directly.
It deliberately does not contain or invoke the GPL `mdb-export` utility.

The Windows build script dynamically links `libmdb-3.dll` and includes the
corresponding LGPL notices and source/build information in the Electron package.
