/* OpticPlus profile for the shared, read-only LGPL libmdb reader. */
#include <mdbtools.h>
#include <glib.h>
#include <glib/gstdio.h>
#include <errno.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define op_mkdir(p) g_mkdir(p, 0700)

#define OP_BIND_SIZE (1024 * 1024)
typedef struct { const char *name; const char *key; const char *parent; } OpTable;
static const OpTable op_tables[] = {
  {"cust_list", "numw", NULL}, {"checks", "bdikanum", "numw"},
  {"adchecks", "bdikanum", "numw"}, {"orders", "rnum", "numw"},
  {"person_remarks", NULL, "numw"}, {"tb_comp", "rnum", "wnum"},
  {"tb_gnrl_tests", "rnum", "wnum"}, {"tb_quest", "rnum", "wnum"},
  {"proposals", "rnum", "numw"}, {"tb_kabala", "wnum", "@rnum"},
  {"items_sales", "wrnum", "@numw"}, {"tb_date_list", "wnum", "codel"},
  {"SAPAKIM", "rnum", NULL}, {"tb_ad_catalog", "wnum", NULL},
  {"tb_catalog", "wnum", NULL}, {"tb_upd_amount", "wnum", NULL},
  {"employees", "EmployeeID", NULL}, {"presence", "rnum", NULL},
  {"presence_back", NULL, NULL}, {"presence_type", "pnum", NULL},
  {"BANK_LIST", NULL, NULL}, {"CREDIT_LIST", NULL, NULL},
  {"tb_hsapakim", "wnum", NULL}, {"tb_q_checks", "wnum", NULL},
  {"tb_amlot", NULL, NULL}, {"TT  TELEFONE  SAPAKIM", NULL, NULL},
  {"companyn", NULL, NULL}, {"doc_title", NULL, NULL},
  {"add_num", NULL, NULL}, {"add_order", NULL, NULL}, {NULL, NULL, NULL}
};

static void op_json(FILE *f, const char *s) {
  fputc('"', f);
  for (const unsigned char *p = (const unsigned char *)(s ? s : ""); *p; p++) {
    if (*p == '"' || *p == '\\') { fputc('\\', f); fputc(*p, f); }
    else if (*p < 32) fprintf(f, "\\u%04x", *p);
    else fputc(*p, f);
  }
  fputc('"', f);
}
static void op_csv(FILE *f, const char *s) {
  fputc('"', f);
  for (const char *p = s ? s : ""; *p; p++) { if (*p == '"') fputc('"', f); fputc(*p, f); }
  fputc('"', f);
}
static MdbTableDef *op_table(MdbHandle *db, const char *name) {
  for (guint i = 0; i < db->catalog->len; i++) {
    MdbCatalogEntry *e = g_ptr_array_index(db->catalog, i);
    if (e->object_type == MDB_TABLE && !g_ascii_strcasecmp(e->object_name, name)) {
      MdbTableDef *t = mdb_read_table(e);
      if (!t || !mdb_read_columns(t)) return NULL;
      return t;
    }
  }
  return NULL;
}
static int op_column(MdbTableDef *t, const char *name) {
  for (guint i = 0; i < t->num_cols; i++) {
    MdbColumn *c = g_ptr_array_index(t->columns, i);
    if (!g_ascii_strcasecmp(c->name, name)) return (int)i;
  }
  return -1;
}
static char **op_bind(MdbTableDef *t, int **lengths) {
  char **values = g_new0(char *, t->num_cols);
  *lengths = g_new0(int, t->num_cols);
  for (guint i = 0; i < t->num_cols; i++) {
    values[i] = g_malloc0(OP_BIND_SIZE);
    mdb_bind_column(t, i + 1, values[i], &(*lengths)[i]);
  }
  mdb_rewind_table(t);
  return values;
}
static void op_unbind(MdbTableDef *t, char **v, int *lengths) {
  for (guint i = 0; i < t->num_cols; i++) g_free(v[i]);
  g_free(v); g_free(lengths); mdb_free_tabledef(t);
}
static int op_allowed_column(const char *table, const char *column) {
  /* Configuration can contain email credentials and license keys. */
  if (!g_ascii_strcasecmp(table, "add_order"))
    return !g_ascii_strcasecmp(column, "maam") || !g_ascii_strcasecmp(column, "order_num");
  return TRUE;
}
static int op_has_core(MdbHandle *db) {
  for (int i = 0; i < 4; i++) {
    MdbTableDef *t = op_table(db, op_tables[i].name);
    if (!t) return FALSE;
    int ok = op_column(t, op_tables[i].key) >= 0;
    if (i) ok = ok && op_column(t, "numw") >= 0;
    else ok = ok && op_column(t, "fname") >= 0 && op_column(t, "pname") >= 0;
    mdb_free_tabledef(t);
    if (!ok) return FALSE;
  }
  return TRUE;
}
static void op_links(MdbHandle *db, FILE *f) {
  MdbTableDef *t = op_table(db, "MSysObjects");
  if (!t) { fputs("[]", f); return; }
  int *lengths; char **v = op_bind(t, &lengths);
  int type = op_column(t, "Type"), database = op_column(t, "Database"), first = TRUE;
  fputc('[', f);
  if (type >= 0 && database >= 0) while (mdb_fetch_row(t)) {
    if (atoi(v[type]) != 6 || !*v[database]) continue;
    if (!first) fputc(',', f);
    op_json(f, v[database]); first = FALSE;
  }
  fputc(']', f); op_unbind(t, v, lengths);
}
static int op_compare_id(gconstpointer a, gconstpointer b) {
  long long x = *(const long long *)a, y = *(const long long *)b;
  return (x > y) - (x < y);
}
static GHashTable *op_select_clients(MdbHandle *db, int limit, FILE *schema, GHashTable *requested) {
  MdbTableDef *t = op_table(db, "cust_list");
  int *lengths; char **v = op_bind(t, &lengths);
  int col = op_column(t, "numw");
  GArray *ids = g_array_new(FALSE, FALSE, sizeof(long long));
  while (mdb_fetch_row(t)) {
    if (requested && !g_hash_table_contains(requested, v[col])) continue;
    long long id = g_ascii_strtoll(v[col], NULL, 10); g_array_append_val(ids, id);
  }
  if (requested && ids->len != g_hash_table_size(requested)) {
    g_array_free(ids, TRUE); op_unbind(t, v, lengths); return NULL;
  }
  g_array_sort(ids, op_compare_id);
  GHashTable *selected = g_hash_table_new_full(g_str_hash, g_str_equal, g_free, NULL);
  fputs("\"selected_client_ids\":[", schema);
  guint n = limit > 0 && (guint)limit < ids->len ? (guint)limit : ids->len;
  for (guint i = 0; i < n; i++) {
    long long id = g_array_index(ids, long long, i);
    if (i) fputc(',', schema);
    fprintf(schema, "%lld", id);
    g_hash_table_add(selected, g_strdup_printf("%lld", id));
  }
  fputs("],", schema); g_array_free(ids, TRUE); op_unbind(t, v, lengths);
  return selected;
}
static int op_export(MdbHandle *db, const char *dir, int limit, GHashTable *requested) {
  char file[4096];
  snprintf(file, sizeof(file), "%s/tables", dir); if (op_mkdir(file) && errno != EEXIST) return 5;
  snprintf(file, sizeof(file), "%s/raw", dir); if (op_mkdir(file) && errno != EEXIST) return 5;
  snprintf(file, sizeof(file), "%s/source-schema.json", dir);
  FILE *schema = g_fopen(file, "wb"); if (!schema) return 5;
  fputs("{\"extractor_version\":2,", schema);
  GHashTable *clients = op_select_clients(db, limit, schema, requested);
  if (!clients) { fclose(schema); return 8; }
  GHashTable *orders = g_hash_table_new_full(g_str_hash, g_str_equal, g_free, NULL);
  fputs("\"tables\":[", schema);
  int first_table = TRUE, rc = 0;
  for (const OpTable *plan = op_tables; plan->name; plan++) {
    MdbTableDef *t = op_table(db, plan->name); if (!t) continue;
    if (!first_table) fputc(',', schema); first_table = FALSE;
    fputs("{\"name\":", schema); op_json(schema, plan->name);
    fprintf(schema, ",\"header_rows\":%u,\"columns\":[", t->num_rows);
    int first_col = TRUE;
    for (guint c = 0; c < t->num_cols; c++) {
      MdbColumn *col = g_ptr_array_index(t->columns, c);
      if (!first_col) fputc(',', schema); first_col = FALSE;
      fputs("{\"name\":", schema); op_json(schema, col->name);
      fprintf(schema, ",\"type\":%d,\"disposition\":", col->col_type);
      op_json(schema, op_allowed_column(plan->name, col->name) ? "preserved" : "excluded_secret");
      fputc('}', schema);
    }
    fputc(']', schema);
    snprintf(file, sizeof(file), "%s/tables/%s.csv", dir, plan->name);
    FILE *csv = g_fopen(file, "wb");
    snprintf(file, sizeof(file), "%s/raw/%s.jsonl", dir, plan->name);
    FILE *raw = g_fopen(file, "wb");
    if (!csv || !raw) { if (csv) fclose(csv); if (raw) fclose(raw); mdb_free_tabledef(t); rc = 5; break; }
    int *lengths; char **v = op_bind(t, &lengths); first_col = TRUE;
    for (guint c = 0; c < t->num_cols; c++) {
      MdbColumn *col = g_ptr_array_index(t->columns, c);
      if (!op_allowed_column(plan->name, col->name)) continue;
      if (!first_col) fputc(',', csv); first_col = FALSE; op_csv(csv, col->name);
    }
    fputs("\r\n", csv);
    long enumerated = 0, exported = 0;
    int key = plan->key ? op_column(t, plan->key) : -1;
    int parent = plan->parent ? op_column(t, plan->parent + (plan->parent[0] == '@')) : -1;
    while (mdb_fetch_row(t)) {
      enumerated++;
      if (limit > 0 || requested) {
        if (!strcmp(plan->name, "cust_list") && !g_hash_table_contains(clients, v[key])) continue;
        if (parent >= 0 && !g_hash_table_contains(plan->parent[0] == '@' ? orders : clients, v[parent])) continue;
        /* Clinic-wide/unkeyed histories cannot be patient-scoped safely. */
        if (!plan->parent && strcmp(plan->name, "cust_list") &&
            (!strcmp(plan->name, "presence") || !strcmp(plan->name, "presence_back"))) continue;
      }
      if (!strcmp(plan->name, "orders") && key >= 0) g_hash_table_add(orders, g_strdup(v[key]));
      int row_start; size_t row_size;
      MdbField *fields = g_new0(MdbField, t->num_cols);
      if (mdb_find_row(db, t->cur_row - 1, &row_start, &row_size) ||
          mdb_crack_row(t, row_start & 0x1fff, row_size, fields) < 0) {
        g_free(fields); rc = 6; break;
      }
      gboolean *nulls = g_new0(gboolean, t->num_cols);
      for (guint c = 0; c < t->num_cols; c++) nulls[fields[c].colnum] = fields[c].is_null;
      fputc('{', raw); first_col = TRUE;
      for (guint c = 0; c < t->num_cols; c++) {
        MdbColumn *col = g_ptr_array_index(t->columns, c);
        if (!op_allowed_column(plan->name, col->name)) continue;
        if (lengths[c] >= OP_BIND_SIZE - 1) { rc = 7; break; }
        if (!first_col) { fputc(',', raw); fputc(',', csv); } first_col = FALSE;
        op_json(raw, col->name); fputc(':', raw);
        if (col->col_type != MDB_BOOL && nulls[c]) fputs("null", raw);
        else if (col->col_type == MDB_BOOL) fputs(atoi(v[c]) ? "true" : "false", raw);
        else if (col->col_type == MDB_OLE || col->col_type == MDB_BINARY || col->col_type == MDB_COMPLEX)
          fputs("{\"archive_only\":true}", raw);
        else op_json(raw, v[c]);
        op_csv(csv, col->col_type != MDB_BOOL && nulls[c] ? "" : col->col_type == MDB_BOOL ? (atoi(v[c]) ? "true" : "false") :
          (col->col_type == MDB_OLE || col->col_type == MDB_BINARY || col->col_type == MDB_COMPLEX) ? "[archive_only]" : v[c]);
      }
      fputs(",\"__date_serials\":{", raw); gboolean first_date = TRUE;
      for (guint c = 0; c < t->num_cols; c++) {
        MdbColumn *col = g_ptr_array_index(t->columns, c);
        if (!op_allowed_column(plan->name, col->name) || col->col_type != MDB_DATETIME || nulls[c] || col->cur_value_len != 8) continue;
        double serial = mdb_get_double(db->pg_buf, col->cur_value_start);
        if (!isfinite(serial)) { rc = 8; break; }
        if (!first_date) fputc(',', raw); first_date = FALSE;
        op_json(raw, col->name); fprintf(raw, ":%.17g", serial);
      }
      fputs("}}\n", raw); fputs("\r\n", csv);
      g_free(fields); g_free(nulls); if (rc) break; exported++;
    }
    fprintf(schema, ",\"enumerated_rows\":%ld,\"row_count\":%ld}", enumerated, exported);
    if (ferror(csv) || ferror(raw)) rc = 5;
    fclose(csv); fclose(raw); op_unbind(t, v, lengths);
    if (rc) break;
    fputs("{\"table\":", stdout); op_json(stdout, plan->name); fprintf(stdout, ",\"rows\":%ld}\n", exported); fflush(stdout);
  }
  fputs("],\"excluded_tables\":[\"pass\"],\"unrecognized_tables\":[", schema);
  int first_unknown = TRUE;
  for (guint i = 0; i < db->catalog->len; i++) {
    MdbCatalogEntry *entry = g_ptr_array_index(db->catalog, i);
    if (!entry || entry->object_type != MDB_TABLE || !mdb_is_user_table(entry) || !g_ascii_strcasecmp(entry->object_name, "pass")) continue;
    int known = FALSE;
    for (const OpTable *p = op_tables; p->name; p++) if (!g_ascii_strcasecmp(p->name, entry->object_name)) known = TRUE;
    if (known) continue;
    MdbTableDef *t = mdb_read_table(entry);
    if (!t || !mdb_read_columns(t)) { rc = 6; break; }
    long count = 0; while (mdb_fetch_row(t)) count++;
    if (!first_unknown) fputc(',', schema); first_unknown = FALSE;
    fputs("{\"name\":", schema); op_json(schema, entry->object_name);
    fprintf(schema, ",\"row_count\":%ld,\"disposition\":\"archive_only\",\"columns\":[", count);
    for (guint c = 0; c < t->num_cols; c++) {
      MdbColumn *col = g_ptr_array_index(t->columns, c);
      if (c) fputc(',', schema); op_json(schema, col->name);
    }
    fputs("]}", schema); mdb_free_tabledef(t);
  }
  fputs("]}", schema);
  if (ferror(schema)) rc = 5;
  fclose(schema); g_hash_table_destroy(clients); g_hash_table_destroy(orders);
  return rc;
}

int opticplus_main(int argc, char **argv) {
  const char *file = NULL, *output = NULL; int limit = 0, probe = FALSE;
  GHashTable *requested = NULL;
  for (int i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "--db") && i + 1 < argc) file = argv[++i];
    else if (!strcmp(argv[i], "--output") && i + 1 < argc) output = argv[++i];
    else if (!strcmp(argv[i], "--client-limit") && i + 1 < argc) {
      char *end; long n = strtol(argv[++i], &end, 10);
      if (*end || n < 1 || n > 2147483647) return 2;
      limit = (int)n;
    } else if (!strcmp(argv[i], "--client-id") && i + 1 < argc) {
      char *end; long n = strtol(argv[++i], &end, 10);
      if (*end || n < 1 || n > 2147483647) return 2;
      if (!requested) requested = g_hash_table_new_full(g_str_hash, g_str_equal, g_free, NULL);
      char *id = g_strdup_printf("%ld", n);
      if (g_hash_table_contains(requested, id)) { g_free(id); return 2; }
      g_hash_table_add(requested, id);
    } else if (!strcmp(argv[i], "--probe")) probe = TRUE;
  }
  if (!file || (!probe && !output) || (requested && limit)) return 2;
  MdbHandle *db = mdb_open(file, MDB_NOFLAGS); if (!db) return 3;
  mdb_set_bind_size(db, OP_BIND_SIZE);
  mdb_set_date_fmt(db, "%Y-%m-%dT%H:%M:%S"); mdb_set_shortdate_fmt(db, "%Y-%m-%d");
  mdb_read_catalog(db, MDB_TABLE);
  int core = op_has_core(db), rc = 0;
  if (probe) {
    fprintf(stdout, "{\"backend\":%s,\"links\":", core ? "true" : "false");
    op_links(db, stdout);
    if (core) {
      MdbTableDef *t = op_table(db, "cust_list"); long count = 0;
      while (mdb_fetch_row(t)) count++;
      fprintf(stdout, ",\"clients\":%ld", count); mdb_free_tabledef(t);
    }
    fputs("}\n", stdout);
  } else if (!core) rc = 4;
  else { if (op_mkdir(output) && errno != EEXIST) rc = 5; else rc = op_export(db, output, limit, requested); }
  mdb_close(db);
  if (requested) g_hash_table_destroy(requested);
  if (rc) fprintf(stderr, "OpticPlus extraction failed (%d); no complete bundle was produced.\n", rc);
  return rc;
}
