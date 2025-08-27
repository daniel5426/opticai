


CREATE TABLE "guest_lines" (
    "line_code"                      INTEGER NOT NULL
   ,"order_code"                     INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"item_qty"                       REAL NOT NULL DEFAULT 1
   ,"item_price"                     REAL NOT NULL DEFAULT 0
   ,"total_for_line"                 REAL NOT NULL DEFAULT 0
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"bar_code"                       TEXT
   ,PRIMARY KEY ("line_code") 
);

CREATE TABLE "optic_tv_order_type" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"type_is_default"                TEXT DEFAULT '0'
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_payment_terms" (
    "code"                           INTEGER NOT NULL
   ,"from_sum"                       REAL NOT NULL DEFAULT 0
   ,"to_sum"                         REAL NOT NULL DEFAULT 0
   ,"advance_precent"                REAL NOT NULL DEFAULT 0
   ,"payments_number"                INTEGER NOT NULL DEFAULT 0
   ,"default_payments"               INTEGER NOT NULL DEFAULT 0
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_clens_item_limit" (
    "code"                           INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"diam_from"                      REAL NOT NULL
   ,"diam_to"                        REAL NOT NULL
   ,"diam_every"                     REAL NOT NULL
   ,"bc_from"                        REAL NOT NULL
   ,"bc_to"                          REAL NOT NULL
   ,"bc_every"                       REAL NOT NULL
   ,"power_from"                     REAL NOT NULL
   ,"power_to"                       REAL NOT NULL
   ,"power_every"                    REAL NOT NULL
   ,"cyl_from"                       REAL NOT NULL
   ,"cyl_to"                         REAL NOT NULL
   ,"cyl_every"                      REAL NOT NULL
   ,"ax_from"                        INTEGER NOT NULL
   ,"ax_to"                          INTEGER NOT NULL
   ,"ax_every"                       INTEGER NOT NULL
   ,"add_from"                       REAL NOT NULL
   ,"add_to"                         REAL NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"connection_code"                INTEGER
   ,"add_every"                      REAL
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_clens_item_color" (
    "code"                           INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"color_name"                     TEXT NOT NULL
   ,"connection_code"                INTEGER
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_clens_function" (
    "name"                           TEXT NOT NULL
   ,"code"                           TEXT NOT NULL
   ,"item_order"                     INTEGER NOT NULL
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_clens_group" (
    "name"                           TEXT NOT NULL
   ,"code"                           TEXT NOT NULL
   ,"item_order"                     INTEGER NOT NULL
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_contact_mater" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_clens_item_mater" (
    "code"                           INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"mater_name"                     TEXT NOT NULL
   ,"connection_code"                INTEGER
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_edge_width" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"edge_width"                     INTEGER DEFAULT 0
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_contact_remark" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_contact_bc" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_menu_premission" (
    "item_name"                      TEXT NOT NULL
   ,"level_1"                        TEXT NOT NULL DEFAULT '1'
   ,"level_2"                        TEXT NOT NULL DEFAULT '1'
   ,"level_3"                        TEXT NOT NULL DEFAULT '1'
   ,"level_4"                        TEXT NOT NULL DEFAULT '1'
   ,"level_5"                        TEXT NOT NULL DEFAULT '1'
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("item_name") 
);

CREATE TABLE "t_merge_account" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"branch_code"                    INTEGER NOT NULL
   ,"account_code"                   INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"last_update"                    TEXT
   ,"row_date"                       TEXT NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE "t_ox_sales" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"account_code"                   INTEGER NOT NULL
   ,"buy_date"                       TEXT NOT NULL
   ,"buy_sum"                        REAL
   ,"form_type"                      TEXT
);

CREATE TABLE "t_email_pattern" (
    "code"                           INTEGER NOT NULL
   ,"pattern_title"                  TEXT NOT NULL
   ,"pattern_text"                   TEXT
   ,"pattern_file"                   TEXT
   ,"is_default"                     TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

COMMIT;


