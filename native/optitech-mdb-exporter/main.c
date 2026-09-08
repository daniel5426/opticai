/* Prysm OptiTech Reader.
 * Uses the LGPL-licensed libmdb API directly; it does not invoke mdb-export.
 */
#include <errno.h>
#include <glib.h>
#include <mdbtools.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <direct.h>
#define mkdir_one(path) _mkdir(path)
#else
#include <sys/stat.h>
#define mkdir_one(path) mkdir(path, 0700)
#endif
#include "../../backend/migration/optitech/export-plan.h"

#define BIND_SIZE 16384
#define MAX_SELECTED 256

typedef struct { char *name; int index; } SelectedColumn;
typedef struct {
  GHashTable *values;
  GHashTable *frp_values;
  size_t count;
} ClientIds;

static void json_string(FILE *out, const char *value) {
  fputc('"', out);
  for (const unsigned char *p = (const unsigned char *)(value ? value : ""); *p; ++p) {
    if (*p == '"' || *p == '\\') { fputc('\\', out); fputc(*p, out); }
    else if (*p == '\n') fputs("\\n", out);
    else if (*p == '\r') fputs("\\r", out);
    else if (*p == '\t') fputs("\\t", out);
    else if (*p < 0x20) fprintf(out, "\\u%04x", *p);
    else fputc(*p, out);
  }
  fputc('"', out);
}

static void csv_value(FILE *out, const char *value, int len) {
  if (!value || !len) return;
  int quote = 0;
  for (int i = 0; i < len; i++) if (value[i] == ',' || value[i] == '"' || value[i] == '\r' || value[i] == '\n') { quote = 1; break; }
  if (quote) fputc('"', out);
  for (int i = 0; i < len; i++) { if (value[i] == '"') fputc('"', out); fputc(value[i], out); }
  if (quote) fputc('"', out);
}

static int token_contains(const char *tokens, const char *needle) {
  size_t n = strlen(needle); const char *p = tokens;
  while ((p = strstr(p, needle))) {
    if ((p == tokens || p[-1] == ' ') && (p[n] == '\0' || p[n] == ' ')) return 1;
    p += n;
  }
  return 0;
}

static const ExportPlan *find_plan(const char *table_name) {
  for (const ExportPlan *plan = EXPORT_PLAN; plan->table; plan++)
    if (!strcmp(plan->table, table_name)) return plan;
  return NULL;
}

static int is_clinical_table(const char *table_name) {
  for (int i = 0; CLINICAL_TABLES[i]; i++)
    if (!strcmp(table_name, CLINICAL_TABLES[i])) return 1;
  return 0;
}

static int is_previous_dynamic_column(const char *table_name, const char *column_name) {
  if (strcmp(table_name, "tblCrdGlassChecksPrevs")) return 0;
  for (int slot = 1; slot <= 4; slot++) for (int p = 0; PREVIOUS_PREFIXES[p]; p++) {
    char name[MDB_MAX_OBJ_NAME + 1];
    snprintf(name, sizeof(name), "%s%d", PREVIOUS_PREFIXES[p], slot);
    if (!strcmp(name, column_name)) return 1;
  }
  return 0;
}

static int write_schema_inventory(MdbHandle *mdb, const char *output_dir) {
  char target[4096];
  snprintf(target, sizeof(target), "%s/source-schema.csv", output_dir);
  FILE *csv = fopen(target, "wb");
  if (!csv) return -1;
  fputs("table,column,disposition\r\n", csv);
  for (guint i = 0; i < mdb->catalog->len; i++) {
    MdbCatalogEntry *entry = g_ptr_array_index(mdb->catalog, i);
    if (!entry || entry->object_type != MDB_TABLE || !mdb_is_user_table(entry)) continue;
    MdbTableDef *table = mdb_read_table(entry);
    if (!table) continue;
    mdb_read_columns(table);
    const ExportPlan *plan = find_plan(entry->object_name);
    const int clinical = plan && is_clinical_table(entry->object_name);
    for (guint c = 0; c < table->num_cols; c++) {
      MdbColumn *column = g_ptr_array_index(table->columns, c);
      const int exported = plan && (clinical || token_contains(plan->columns, column->name) ||
        is_previous_dynamic_column(entry->object_name, column->name));
      csv_value(csv, entry->object_name, (int)strlen(entry->object_name)); fputc(',', csv);
      csv_value(csv, column->name, (int)strlen(column->name)); fputc(',', csv);
      fputs(exported ? (clinical ? "preserved" : "mapped") : "intentionally_excluded", csv);
      fputs("\r\n", csv);
    }
    mdb_free_tabledef(table);
  }
  fclose(csv);
  return 0;
}

static void add_previous_columns(SelectedColumn *selected, int *count, MdbTableDef *table) {
  for (int slot = 1; slot <= 4; slot++) for (int p = 0; PREVIOUS_PREFIXES[p]; p++) {
    char name[MDB_MAX_OBJ_NAME + 1]; snprintf(name, sizeof(name), "%s%d", PREVIOUS_PREFIXES[p], slot);
    for (unsigned int i = 0; i < table->num_cols; i++) {
      MdbColumn *column = g_ptr_array_index(table->columns, i);
      if (!strcmp(column->name, name)) { selected[*count].name = g_strdup(column->name); selected[*count].index = (int)i; (*count)++; break; }
    }
  }
}

static int select_columns(MdbTableDef *table, const ExportPlan *plan, SelectedColumn *selected) {
  int count = 0, clinical = 0;
  for (int i = 0; CLINICAL_TABLES[i]; i++) if (!strcmp(plan->table, CLINICAL_TABLES[i])) clinical = 1;
  for (unsigned int i = 0; i < table->num_cols; i++) {
    MdbColumn *column = g_ptr_array_index(table->columns, i);
    if ((clinical || token_contains(plan->columns, column->name)) && count < MAX_SELECTED) { selected[count].name = g_strdup(column->name); selected[count].index = (int)i; count++; }
  }
  if (!clinical && !strcmp(plan->table, "tblCrdGlassChecksPrevs")) add_previous_columns(selected, &count, table);
  return count;
}

static void ids_add(ClientIds *ids, long value) {
  gpointer key = GINT_TO_POINTER((gint)value);
  if (!g_hash_table_contains(ids->values, key)) { g_hash_table_add(ids->values, key); ids->count++; }
}
static int ids_has(const ClientIds *ids, long value) { return g_hash_table_contains(ids->values, GINT_TO_POINTER((gint)value)); }
static void related_id_add(GHashTable *values, long value) { g_hash_table_add(values, GINT_TO_POINTER((gint)value)); }
static int related_id_has(GHashTable *values, long value) { return g_hash_table_contains(values, GINT_TO_POINTER((gint)value)); }

static int find_column(const SelectedColumn *selected, int count, const char *name) { for (int i = 0; i < count; i++) if (!strcmp(selected[i].name, name)) return i; return -1; }

static int export_table(MdbHandle *mdb, const ExportPlan *plan, const char *output_dir, int client_limit, ClientIds *ids) {
  MdbTableDef *table = mdb_read_table_by_name(mdb, (gchar *)plan->table, MDB_TABLE);
  if (!table) return 0; /* Older OptiTech versions omit some optional catalog tables. */
  mdb_read_columns(table); mdb_rewind_table(table);
  SelectedColumn selected[MAX_SELECTED]; int selected_count = select_columns(table, plan, selected);
  if (!selected_count) { mdb_free_tabledef(table); return 0; }
  char target[4096]; snprintf(target, sizeof(target), "%s/tables/%s.csv", output_dir, plan->table);
  FILE *csv = fopen(target, "wb");
  if (!csv) { fprintf(stderr, "Could not write export table %s: %s\n", plan->table, strerror(errno)); mdb_free_tabledef(table); return -1; }
  char **values = g_malloc0(table->num_cols * sizeof(char *)); int *lengths = g_malloc0(table->num_cols * sizeof(int));
  for (unsigned int i = 0; i < table->num_cols; i++) { values[i] = g_malloc0(BIND_SIZE); if (mdb_bind_column(table, i + 1, values[i], &lengths[i]) == -1) { fclose(csv); return -1; } }
  for (int i = 0; i < selected_count; i++) { if (i) fputc(',', csv); csv_value(csv, selected[i].name, (int)strlen(selected[i].name)); } fputs("\r\n", csv);
  const int related_frp = plan->client_column && !strcmp(plan->client_column, "@FrpId");
  int client_index = plan->client_column ? find_column(selected, selected_count, related_frp ? "FrpId" : plan->client_column) : -1;
  int frp_index = !strcmp(plan->table, "tblCrdFrps") ? find_column(selected, selected_count, "FrpId") : -1;
  long rows = 0;
  while (mdb_fetch_row(table)) {
    if (!strcmp(plan->table, "tblPerData")) {
      long id = strtol(values[selected[0].index], NULL, 10);
      if (client_limit > 0 && (int)ids->count >= client_limit) break;
      ids_add(ids, id);
    } else if (related_frp && client_index >= 0 && !related_id_has(ids->frp_values, strtol(values[selected[client_index].index], NULL, 10))) continue;
    else if (client_index >= 0 && !ids_has(ids, strtol(values[selected[client_index].index], NULL, 10))) continue;
    if (frp_index >= 0) related_id_add(ids->frp_values, strtol(values[selected[frp_index].index], NULL, 10));
    for (int i = 0; i < selected_count; i++) { if (i) fputc(',', csv); int index = selected[i].index; csv_value(csv, values[index], lengths[index]); } fputs("\r\n", csv); rows++;
  }
  fclose(csv);
  printf("{\"event\":\"table\",\"table\":"); json_string(stdout, plan->table); printf(",\"rows\":%ld}\n", rows); fflush(stdout);
  for (unsigned int i = 0; i < table->num_cols; i++) g_free(values[i]); g_free(values); g_free(lengths);
  for (int i = 0; i < selected_count; i++) g_free(selected[i].name);
  mdb_free_tabledef(table);
  return (int)rows;
}

int main(int argc, char **argv) {
  (void)LOOKUP_TABLES; /* Consumed by the backend/PowerShell spec readers. */
  const char *db = NULL, *output = NULL; int limit = 0;
  for (int i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "--db") && i + 1 < argc) db = argv[++i];
    else if (!strcmp(argv[i], "--output") && i + 1 < argc) output = argv[++i];
    else if (!strcmp(argv[i], "--client-limit") && i + 1 < argc) limit = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--version")) { printf("prysm-optitech-mdb-exporter 1.1.0 (libmdb %s)\n", mdb_get_version()); return 0; }
  }
  if (!db || !output) { fputs("Usage: optitech-mdb-exporter --db FILE --output DIRECTORY [--client-limit N]\n", stderr); return 2; }
  char tables[4096]; snprintf(tables, sizeof(tables), "%s/tables", output); mkdir_one(output); if (mkdir_one(tables) && errno != EEXIST) { perror("Could not create tables directory"); return 2; }
  MdbHandle *mdb = mdb_open(db, MDB_NOFLAGS);
  if (!mdb) { fputs("The selected OptiTech database could not be read by the bundled compatibility reader.\n", stderr); return 3; }
  mdb_set_date_fmt(mdb, "%m/%d/%y %H:%M:%S"); mdb_set_shortdate_fmt(mdb, "%m/%d/%y"); mdb_set_bind_size(mdb, BIND_SIZE);
  mdb_read_catalog(mdb, MDB_TABLE);
  const char *required[] = {"tblPerData", "tblUsers", "tblCrdGlassChecks", "tblCrdClensChecks"};
  for (int i = 0; i < 4; i++) if (!mdb_read_table_by_name(mdb, (gchar *)required[i], MDB_TABLE)) { fprintf(stderr, "Selected database is not a supported OptiTech database. Missing: %s\n", required[i]); mdb_close(mdb); return 4; }
  ClientIds ids = {
    .values = g_hash_table_new(g_direct_hash, g_direct_equal),
    .frp_values = g_hash_table_new(g_direct_hash, g_direct_equal),
    .count = 0,
  };
  if (write_schema_inventory(mdb, output) < 0) { g_hash_table_destroy(ids.values); g_hash_table_destroy(ids.frp_values); mdb_close(mdb); return 5; }
  for (const ExportPlan *plan = EXPORT_PLAN; plan->table; plan++) if (export_table(mdb, plan, output, limit, &ids) < 0) { g_hash_table_destroy(ids.values); g_hash_table_destroy(ids.frp_values); mdb_close(mdb); return 5; }
  /* Electron derives the signed manifest from the exported CSV files. */
  g_hash_table_destroy(ids.values); g_hash_table_destroy(ids.frp_values); mdb_close(mdb); return 0;
}
