CREATE TABLE "t_permission" (
    "just_for_application"           INTEGER NOT NULL
   ,"o_type"                         TEXT NOT NULL
   ,"o_name"                         TEXT NOT NULL
   ,"o_description"                  TEXT NOT NULL
   ,"o_addinfo"                      TEXT
   ,"level1"                         TEXT NOT NULL DEFAULT '0'
   ,"level2"                         TEXT NOT NULL DEFAULT '0'
   ,"level3"                         TEXT NOT NULL DEFAULT '0'
   ,"level4"                         TEXT NOT NULL DEFAULT '0'
   ,"level5"                         TEXT NOT NULL DEFAULT '0'
   ,"disp_type"                      TEXT
   ,PRIMARY KEY ("o_name") 
);

CREATE TABLE "t_internet_prm" (
    "par_name"                       TEXT NOT NULL
   ,"par_val"                        TEXT
   ,PRIMARY KEY ("par_name") 
);

CREATE TABLE "t_turn" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_sort_group" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_profile_list" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_profile_design" (
    "profile_code"                   INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"option_code"                    INTEGER NOT NULL
   ,"option_index"                   INTEGER NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,PRIMARY KEY ("profile_code","account_type","option_code") 
);

CREATE TABLE "t_merge_definition" (
    "code"                           INTEGER NOT NULL DEFAULT 1
   ,"branch_username"                TEXT
   ,"branch_password"                TEXT
   ,"last_days"                      INTEGER
   ,"last_exec_date"                 TEXT
   ,"last_export_date"               TEXT
   ,"alert_days"                     INTEGER
   ,"rr_url"                         TEXT
   ,"branch_code"                    INTEGER DEFAULT 1
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_income_group" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"row_type"                       TEXT DEFAULT 'B'
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_employee_jobs" (
    "code"                           INTEGER NOT NULL
   ,"employee_code"                  INTEGER NOT NULL
   ,"job_code"                       INTEGER NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_employee_branch" (
    "code"                           INTEGER NOT NULL
   ,"employee_code"                  INTEGER NOT NULL
   ,"branch_code"                    INTEGER NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_account_option_qty" (
    "option_code"                    INTEGER NOT NULL
   ,"option_qty"                     INTEGER
   ,"code"                           INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"account_code"                   INTEGER NOT NULL
   ,PRIMARY KEY ("option_code","code","account_type") 
);

CREATE TABLE "t_account_history" (
    "item_index"                     INTEGER NOT NULL
   ,"internal_code"                  INTEGER NOT NULL
   ,"account_code"                   INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"account_name"                   TEXT NOT NULL
   ,PRIMARY KEY ("item_index") 
);

CREATE TABLE "t_acc_sort_group" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_wash_sol" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_visit_reason" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_treatment_type" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_test_board" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_order_status" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"status_color"                   INTEGER DEFAULT 16777215
   ,"sms_type_code"                  INTEGER
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_lens_supplier" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_lens_model" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_lens_mater" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_lens_color" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_lens_coat" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_glasses_function" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"addition_type"                  TEXT DEFAULT 'N'
   ,"is_default"                     TEXT DEFAULT '0'
   ,"pd_type"                        TEXT DEFAULT 'N'
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_frame_supplier" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_frame_model" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_frame_manuf" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_frame_color" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_dis_sol" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_contact_type" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"box_for_days"                   INTEGER DEFAULT 0
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_contact_model" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_contact_manuf" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_contact_color" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_tv_clean_sol" (
    "code"                           INTEGER NOT NULL
   ,"name"                           TEXT NOT NULL
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_reference" (
    "code"                           INTEGER NOT NULL
   ,"branch_code"                    INTEGER NOT NULL
   ,"account_code"                   INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"reference_date"                 TEXT
   ,"address_to"                     TEXT
   ,"reference_remark"               TEXT
   ,"presc_code"                     INTEGER
   ,"is_active"                      TEXT NOT NULL DEFAULT '1'
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,"connected_to"                   TEXT DEFAULT '0'
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "optic_referance_blob" (
    "code"                           INTEGER NOT NULL
   ,"file_blob"                      BLOB
   ,"last_action"                    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   ,PRIMARY KEY ("code") 
);
