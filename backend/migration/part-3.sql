CREATE TABLE "prlens_tv_diam" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"from_diam"                      INTEGER NOT NULL DEFAULT 0
   ,"to_diam"                        INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE "prlens_tv_pris" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"from_pris"                      REAL NOT NULL
   ,"to_pris"                        REAL NOT NULL
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

CREATE TABLE "prlens_tv_columns" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"model_code"                     INTEGER NOT NULL
   ,"from_diam"                      INTEGER NOT NULL DEFAULT 0
   ,"to_diam"                        INTEGER NOT NULL DEFAULT 0
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"diam_header"                    TEXT
);

CREATE TABLE "prlens_tv_rows" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"mater_code"                     INTEGER NOT NULL
   ,"from_sph"                       REAL NOT NULL
   ,"to_sph"                         REAL NOT NULL
   ,"to_cyl"                         REAL NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
);

CREATE TABLE "optic_lab_definitions" (
    "code"                           INTEGER NOT NULL
   ,"is_lab"                         TEXT NOT NULL DEFAULT '0'
   ,"lab_ip"                         TEXT
   ,"lab_username"                   TEXT
   ,"lab_password"                   TEXT
   ,"dont_order_st"                  INTEGER
   ,"need_order_st"                  INTEGER
   ,"sent_to_lab_st"                 INTEGER
   ,"wait_for_job_st"                INTEGER
   ,"received_st"                    INTEGER
   ,"give_st"                        INTEGER
   ,"ready_st"                       INTEGER
   ,"sent_st"                        INTEGER
   ,"delay_st"                       INTEGER
   ,"received_active"                TEXT NOT NULL
   ,"give_active"                    TEXT NOT NULL
   ,"at_work_active"                 TEXT NOT NULL
   ,"ready_active"                   TEXT NOT NULL
   ,"sent_active"                    TEXT NOT NULL
   ,"delay_active"                   TEXT NOT NULL
   ,"print_active"                   TEXT NOT NULL
   ,"at_work_color"                  INTEGER
   ,"ready_color"                    INTEGER
   ,"sent_color"                     INTEGER
   ,"delay_color"                    INTEGER
   ,"wait_color"                     INTEGER
   ,"branch_is_lab"                  TEXT DEFAULT '0'
   ,"shop_dispatch_s"                INTEGER
   ,"shop_dispatch_r"                INTEGER
   ,"lab_dispatch_s"                 INTEGER
   ,"lab_dispatch_r"                 INTEGER
   ,"detail_level"                   TEXT DEFAULT '1'
   ,"print_type"                     TEXT DEFAULT '0'
   ,"external_lab_dispatch"          INTEGER
   ,"auto_print"                     TEXT DEFAULT '0'
   ,"file_save_as"                   TEXT DEFAULT '0'
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_database_codes" (
    "code_type"                      TEXT NOT NULL
   ,"next_code"                      INTEGER NOT NULL DEFAULT 1
   ,PRIMARY KEY ("code_type") 
);

CREATE TABLE "t_parameter" (
    "par_group"                      TEXT NOT NULL
   ,"par_owner"                      TEXT NOT NULL
   ,"par_name"                       TEXT NOT NULL
   ,"par_val"                        TEXT
   ,"par_type"                       TEXT NOT NULL
   ,PRIMARY KEY ("par_group","par_owner","par_name") 
);

CREATE TABLE "optic_device_types" (
    "device_code"                    INTEGER NOT NULL
   ,"device_manuf"                   TEXT NOT NULL
   ,"device_type"                    TEXT NOT NULL
   ,"device_delay"                   INTEGER NOT NULL
   ,"default_folder"                 TEXT
   ,"need_folder"                    TEXT NOT NULL DEFAULT '0'
   ,"device_model"                   TEXT
   ,"need_com"                       TEXT DEFAULT '1'
   ,"com_settings"                   TEXT
   ,"com_handshaking"                INTEGER
   ,PRIMARY KEY ("device_code") 
);

CREATE TABLE "optic_tv_order_priority" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account_tv_status" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account_tv_file_location" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "account_tv_occupation" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_sms_prefix" (
    "code"                           INTEGER NOT NULL
   ,"phone_prefix"                   TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_sms_types" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"text_pattern"                   TEXT
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "diary_card" (
    "diary_code"                     INTEGER NOT NULL
   ,"diary_name"                     TEXT NOT NULL
   ,"day_1_remark"                   TEXT
   ,"day_2_remark"                   TEXT
   ,"day_3_remark"                   TEXT
   ,"day_4_remark"                   TEXT
   ,"day_5_remark"                   TEXT
   ,"day_6_remark"                   TEXT
   ,"day_7_remark"                   TEXT
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"branch_code"                    INTEGER
   ,"default_tester"                 INTEGER
   ,PRIMARY KEY ("diary_code") 
);

CREATE TABLE "diary_timetab" (
    "code"                           INTEGER NOT NULL
   ,"diary_code"                     INTEGER NOT NULL
   ,"line_date"                      TEXT NOT NULL
   ,"line_time"                      TEXT NOT NULL
   ,"line_lock"                      TEXT NOT NULL DEFAULT '0'
   ,"line_mark"                      TEXT NOT NULL DEFAULT '0'
   ,"account_code"                   INTEGER
   ,"account_type"                   TEXT
   ,"reception_employee"             INTEGER
   ,"parent_code"                    INTEGER
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"oper_code"                      INTEGER
   ,"line_remark"                    TEXT
   ,"branch_code"                    INTEGER
   ,"line_status"                    TEXT DEFAULT '0'
   ,"tester_code"                    INTEGER
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "diary_deleted" (
    "code"                           INTEGER NOT NULL
   ,"diary_code"                     INTEGER
   ,"line_date"                      TEXT
   ,"line_time"                      TEXT
   ,"account_code"                   INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"reception_employee"             INTEGER
   ,"oper_code"                      INTEGER
   ,"line_remark"                    TEXT
   ,"branch_code"                    INTEGER
   ,"deleted_branch"                 INTEGER
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"tester_code"                    INTEGER
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "guest_account" (
    "created_by"                     TEXT NOT NULL
   ,"was_imported"                   TEXT NOT NULL DEFAULT '0'
   ,"was_exported"                   TEXT NOT NULL DEFAULT '0'
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
   ,PRIMARY KEY ("account_code") 
);

CREATE TABLE "guest_next_code" (
    "code_type"                      TEXT NOT NULL
   ,"next_code"                      INTEGER NOT NULL DEFAULT 1
   ,PRIMARY KEY ("code_type") 
);

CREATE TABLE "guest_orders" (
    "account_code"                   INTEGER NOT NULL
   ,"order_code"                     INTEGER NOT NULL
   ,"sum_include_vat"                REAL NOT NULL DEFAULT 0
   ,"sum_paied"                      REAL NOT NULL DEFAULT 0
   ,"sum_advance"                    REAL NOT NULL DEFAULT 0
   ,"payments_qty"                   INTEGER NOT NULL DEFAULT 1
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("order_code") 
);
