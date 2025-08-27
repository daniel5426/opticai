CREATE TABLE "diary_tv_holiday" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"name"                           TEXT NOT NULL
   ,"holiday_date"                   TEXT
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"block_type"                     TEXT DEFAULT '0'
   ,"block_from"                     TEXT
   ,"block_to"                       TEXT
);

CREATE TABLE "account_tv_memo_type" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"file_pattern"                   TEXT
   ,"is_active"                      TEXT NOT NULL
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"type_is_default"                TEXT DEFAULT '0'
   ,"sms_type_code"                  INTEGER
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account_tv_memo_reason" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account_tv_file_status" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account_tv_file_class" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"pbrush_pattern"                 TEXT
   ,"word_pattern"                   TEXT
   ,"excel_pattern"                  TEXT
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account_tv_agreement_type" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"file_pattern"                   TEXT
   ,"is_active"                      TEXT NOT NULL
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"type_is_default"                TEXT DEFAULT '0'
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account_memos" (
    "code"                           INTEGER NOT NULL
   ,"branch_code"                    INTEGER NOT NULL
   ,"account_code"                   INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"employee_code"                  INTEGER
   ,"memo_date"                      TEXT
   ,"memo_type"                      TEXT
   ,"memo_reason"                    TEXT
   ,"memo_remark"                    TEXT
   ,"sent_by_mail"                   TEXT NOT NULL DEFAULT '0'
   ,"sent_by_email"                  TEXT NOT NULL DEFAULT '0'
   ,"sent_by_fax"                    TEXT NOT NULL DEFAULT '0'
   ,"sent_by_phone"                  TEXT NOT NULL DEFAULT '0'
   ,"sent_by_sms"                    TEXT NOT NULL DEFAULT '0'
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"sent_by_label"                  TEXT DEFAULT '0'
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account_main_blob" (
    "code"                           INTEGER NOT NULL
   ,"account_code"                   INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"file_blob"                      BLOB
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account_files_blob" (
    "code"                           INTEGER NOT NULL
   ,"file_blob"                      BLOB
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account_files" (
    "code"                           INTEGER NOT NULL
   ,"branch_code"                    INTEGER NOT NULL
   ,"account_code"                   INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"employee_code"                  INTEGER
   ,"option_code"                    INTEGER NOT NULL
   ,"file_date"                      TEXT
   ,"file_class"                     TEXT
   ,"file_description"               TEXT
   ,"file_remark"                    TEXT
   ,"file_status"                    TEXT
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"follow_up_date"                 TEXT
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account_chart" (
    "account_code"                   INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"chart_text"                     TEXT
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("account_code","account_type") 
);

CREATE TABLE "account_agreements" (
    "code"                           INTEGER NOT NULL
   ,"branch_code"                    INTEGER NOT NULL
   ,"account_code"                   INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"employee_code"                  INTEGER
   ,"start_date"                     TEXT
   ,"end_date"                       TEXT
   ,"agreement_type"                 TEXT
   ,"agreement_remark"               TEXT
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"branch_code"                    INTEGER NOT NULL
   ,"account_code"                   INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"acc_name"                       TEXT
   ,"contact_man"                    TEXT
   ,"first_name"                     TEXT
   ,"last_name"                      TEXT
   ,"id_number"                      TEXT
   ,"birth_date"                     TEXT
   ,"sex"                            TEXT NOT NULL DEFAULT '1'
   ,"phone1"                         TEXT
   ,"phone2"                         TEXT
   ,"phone3"                         TEXT
   ,"mobile_phone"                   TEXT
   ,"city"                           TEXT
   ,"street"                         TEXT
   ,"house_num"                      INTEGER
   ,"apartment_num"                  INTEGER
   ,"entrance"                       TEXT
   ,"pob"                            TEXT
   ,"zip_code"                       TEXT
   ,"discount_type"                  INTEGER
   ,"check_blocked"                  TEXT NOT NULL DEFAULT '0'
   ,"credit_blocked"                 TEXT NOT NULL DEFAULT '0'
   ,"e_mail"                         TEXT
   ,"web_site"                       TEXT
   ,"remarks"                        TEXT
   ,"money_key"                      TEXT
   ,"magnetic_card"                  TEXT
   ,"tax_precent"                    REAL
   ,"tax_date"                       TEXT
   ,"last_action"                    TEXT DEFAULT CURRENT_TIMESTAMP
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"center_code"                    INTEGER
   ,"head_of_family"                 INTEGER
   ,"send_mail"                      TEXT NOT NULL DEFAULT '1'
   ,"discount_precent"               INTEGER DEFAULT 0
   ,"discount_on_bottom"             TEXT NOT NULL DEFAULT '1'
   ,"price_include_vat"              TEXT NOT NULL DEFAULT '1'
   ,"bank_branch"                    TEXT
   ,"main_cash"                      TEXT NOT NULL DEFAULT '0'
   ,"open_date"                      TEXT DEFAULT CURRENT_DATE
   ,"acc_sort_group"                 TEXT
   ,"turn_name"                      TEXT
   ,"old_oo_code"                    INTEGER
   ,"last_memo_date"                 TEXT
   ,"user_name"                      TEXT
   ,"permission_level"               INTEGER DEFAULT 1
   ,"user_password"                  TEXT
   ,"server_ip"                      TEXT
   ,"connection_code"                INTEGER
   ,"rrbs_code"                      INTEGER
   ,"confirmation_code"              INTEGER
   ,"occupation"                     TEXT
   ,"hobby"                          TEXT
   ,"work_place"                     TEXT
   ,"hidden_remarks"                 TEXT
   ,"account_status"                 TEXT
   ,"file_location"                  TEXT
   ,"lab_type"                       TEXT DEFAULT '0'
   ,"last_mail"                      TEXT
   ,"last_visit"                     TEXT
);

CREATE TABLE "optic_labs_interface" (
    "interface_code"                 INTEGER NOT NULL
   ,"interface_name"                 TEXT NOT NULL
   ,"default_folder"                 TEXT
   ,"interface_bmp"                  TEXT
   ,PRIMARY KEY ("interface_code") 
);

CREATE TABLE "optic_labs_interface_for_station" (
    "station_name"                   TEXT NOT NULL
   ,"interface_code"                 INTEGER NOT NULL
   ,"interface_folder"               TEXT
   ,"interface_active"               TEXT NOT NULL DEFAULT '0'
   ,PRIMARY KEY ("station_name","interface_code") 
);

CREATE TABLE "t_lens_item_price" (
    "code"                           INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"from_diam"                      INTEGER NOT NULL DEFAULT 0
   ,"to_diam"                        INTEGER NOT NULL DEFAULT 0
   ,"from_sph"                       REAL NOT NULL DEFAULT 0
   ,"to_sph"                         REAL NOT NULL DEFAULT 0
   ,"to_cyl"                         REAL NOT NULL DEFAULT 0
   ,"bar_code"                       TEXT
   ,"supplier_price"                 REAL
   ,"recommend_price"                REAL
   ,"net_price1"                     REAL
   ,"net_price2"                     REAL
   ,"net_price3"                     REAL
   ,"net_price4"                     REAL
   ,"net_price5"                     REAL
   ,"net_price6"                     REAL
   ,"net_price7"                     REAL
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"connection_row"                 INTEGER
   ,"connection_col"                 INTEGER
   ,"diam_header"                    TEXT
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_lens_item_coat" (
    "code"                           INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"coat_name"                      TEXT NOT NULL
   ,"bar_code"                       TEXT
   ,"supplier_price"                 REAL
   ,"recommend_price"                REAL
   ,"net_price1"                     REAL
   ,"net_price2"                     REAL
   ,"net_price3"                     REAL
   ,"net_price4"                     REAL
   ,"net_price5"                     REAL
   ,"net_price6"                     REAL
   ,"net_price7"                     REAL
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"connection_code"                INTEGER
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_lens_item_color" (
    "code"                           INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"color_name"                     TEXT NOT NULL
   ,"bar_code"                       TEXT
   ,"supplier_price"                 REAL
   ,"recommend_price"                REAL
   ,"net_price1"                     REAL
   ,"net_price2"                     REAL
   ,"net_price3"                     REAL
   ,"net_price4"                     REAL
   ,"net_price5"                     REAL
   ,"net_price6"                     REAL
   ,"net_price7"                     REAL
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"connection_code"                INTEGER
   ,"only_in_factory"                TEXT DEFAULT '0'
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_lens_item_diam" (
    "code"                           INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"from_diam"                      INTEGER NOT NULL DEFAULT 0
   ,"to_diam"                        INTEGER NOT NULL DEFAULT 0
   ,"supplier_price"                 REAL
   ,"recommend_price"                REAL
   ,"bar_code"                       TEXT
   ,"net_price1"                     REAL
   ,"net_price2"                     REAL
   ,"net_price3"                     REAL
   ,"net_price4"                     REAL
   ,"net_price5"                     REAL
   ,"net_price6"                     REAL
   ,"net_price7"                     REAL
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"connection_code"                INTEGER
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_lens_item_pris" (
    "code"                           INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"from_pris"                      REAL NOT NULL DEFAULT 0
   ,"to_pris"                        REAL NOT NULL DEFAULT 0
   ,"supplier_price"                 REAL
   ,"recommend_price"                REAL
   ,"bar_code"                       TEXT
   ,"net_price1"                     REAL
   ,"net_price2"                     REAL
   ,"net_price3"                     REAL
   ,"net_price4"                     REAL
   ,"net_price5"                     REAL
   ,"net_price6"                     REAL
   ,"net_price7"                     REAL
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"connection_code"                INTEGER
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_lens_item_supplement" (
    "code"                           INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"add_name"                       TEXT NOT NULL
   ,"supplier_price"                 REAL
   ,"recommend_price"                REAL
   ,"bar_code"                       TEXT
   ,"net_price1"                     REAL
   ,"net_price2"                     REAL
   ,"net_price3"                     REAL
   ,"net_price4"                     REAL
   ,"net_price5"                     REAL
   ,"net_price6"                     REAL
   ,"net_price7"                     REAL
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"connection_code"                INTEGER
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_lens_item_cyl" (
    "code"                           INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"from_cyl"                       REAL NOT NULL DEFAULT 0
   ,"supplier_price"                 REAL
   ,"recommend_price"                REAL
   ,"bar_code"                       TEXT
   ,"net_price1"                     REAL
   ,"net_price2"                     REAL
   ,"net_price3"                     REAL
   ,"net_price4"                     REAL
   ,"net_price5"                     REAL
   ,"net_price6"                     REAL
   ,"net_price7"                     REAL
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"connection_code"                INTEGER
   ,"for_every"                      REAL DEFAULT 1
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_lens_item_add" (
    "code"                           INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"from_add"                       REAL NOT NULL DEFAULT 0
   ,"supplier_price"                 REAL
   ,"recommend_price"                REAL
   ,"bar_code"                       TEXT
   ,"net_price1"                     REAL
   ,"net_price2"                     REAL
   ,"net_price3"                     REAL
   ,"net_price4"                     REAL
   ,"net_price5"                     REAL
   ,"net_price6"                     REAL
   ,"net_price7"                     REAL
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"connection_code"                INTEGER
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_lens_supplement" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_lens_item_limit" (
    "code"                           INTEGER NOT NULL
   ,"item_code"                      INTEGER NOT NULL
   ,"from_diam"                      INTEGER NOT NULL DEFAULT 0
   ,"to_diam"                        INTEGER NOT NULL DEFAULT 0
   ,"from_sph"                       REAL NOT NULL DEFAULT 0
   ,"to_sph"                         REAL NOT NULL DEFAULT 0
   ,"to_cyl"                         REAL NOT NULL DEFAULT 0
   ,"from_add"                       REAL NOT NULL DEFAULT 0
   ,"to_add"                         REAL NOT NULL DEFAULT 0
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"from_segment"                   INTEGER DEFAULT 0
   ,"to_segment"                     INTEGER DEFAULT 0
   ,"connection_code"                INTEGER
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_presc_prices" (
    "code"                           INTEGER NOT NULL
   ,"presc_code"                     INTEGER NOT NULL
   ,"item_code"                      INTEGER
   ,"item_type"                      TEXT NOT NULL
   ,"income_group"                   TEXT
   ,"bar_code"                       TEXT
   ,"item_qty"                       REAL NOT NULL DEFAULT 1
   ,"item_name"                      TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"item_price"                     REAL
   ,"supplier_price"                 REAL
   ,"recommend_price"                REAL
   ,"connection_code"                INTEGER
   ,"supplyby"                       TEXT DEFAULT '0'
   ,"supplied"                       TEXT DEFAULT '0'
   ,"s_item_price"                   REAL
   ,"s_recommend_price"              REAL
   ,"s_supplier_price"               REAL
   ,"line_discount"                  REAL DEFAULT 0
   ,"line_after_discount"            REAL DEFAULT 0
   ,"employee_1"                     INTEGER
   ,"employee_2"                     INTEGER
   ,"employee_3"                     INTEGER
   ,"employee_4"                     INTEGER
   ,"employee_5"                     INTEGER
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "prlens_manuf" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"manuf_name"                     TEXT NOT NULL
   ,"items_currency"                 TEXT NOT NULL
   ,"last_update"                    TEXT
   ,"customer_remarks"               TEXT
   ,"general_remarks"                TEXT
   ,"ftp_server_ip"                  TEXT
   ,"ftp_user_name"                  TEXT
   ,"ftp_password"                   TEXT
   ,"is_active"                      TEXT DEFAULT '1'
   ,"last_export_date"               TEXT
   ,"calc_cyl_sign"                  TEXT DEFAULT '0'
);

CREATE TABLE "prlens_tv_coat" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"recommend_price"                REAL
   ,"price_1"                        REAL
   ,"price_2"                        REAL
   ,"price_3"                        REAL
   ,"price_4"                        REAL
   ,"price_5"                        REAL
   ,"price_6"                        REAL
   ,"price_7"                        REAL
);

CREATE TABLE "prlens_tv_color" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"recommend_price"                REAL
   ,"price_1"                        REAL
   ,"price_2"                        REAL
   ,"price_3"                        REAL
   ,"price_4"                        REAL
   ,"price_5"                        REAL
   ,"price_6"                        REAL
   ,"price_7"                        REAL
);

CREATE TABLE "prlens_tv_supplement" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"recommend_price"                REAL
   ,"price_1"                        REAL
   ,"price_2"                        REAL
   ,"price_3"                        REAL
   ,"price_4"                        REAL
   ,"price_5"                        REAL
   ,"price_6"                        REAL
   ,"price_7"                        REAL
);
