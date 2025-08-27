CREATE TABLE "pbcattbl" (
    "pbt_tnam"                       TEXT NOT NULL
   ,"pbt_tid"                        INTEGER
   ,"pbt_ownr"                       TEXT NOT NULL
   ,"pbd_fhgt"                       INTEGER
   ,"pbd_fwgt"                       INTEGER
   ,"pbd_fitl"                       TEXT
   ,"pbd_funl"                       TEXT
   ,"pbd_fchr"                       INTEGER
   ,"pbd_fptc"                       INTEGER
   ,"pbd_ffce"                       TEXT
   ,"pbh_fhgt"                       INTEGER
   ,"pbh_fwgt"                       INTEGER
   ,"pbh_fitl"                       TEXT
   ,"pbh_funl"                       TEXT
   ,"pbh_fchr"                       INTEGER
   ,"pbh_fptc"                       INTEGER
   ,"pbh_ffce"                       TEXT
   ,"pbl_fhgt"                       INTEGER
   ,"pbl_fwgt"                       INTEGER
   ,"pbl_fitl"                       TEXT
   ,"pbl_funl"                       TEXT
   ,"pbl_fchr"                       INTEGER
   ,"pbl_fptc"                       INTEGER
   ,"pbl_ffce"                       TEXT
   ,"pbt_cmnt"                       TEXT
);

-- SQLite doesn't support GRANT statements - permissions handled at application level

CREATE TABLE "pbcatcol" (
    "pbc_tnam"                       TEXT NOT NULL
   ,"pbc_tid"                        INTEGER
   ,"pbc_ownr"                       TEXT NOT NULL
   ,"pbc_cnam"                       TEXT NOT NULL
   ,"pbc_cid"                        INTEGER
   ,"pbc_labl"                       TEXT
   ,"pbc_lpos"                       INTEGER
   ,"pbc_hdr"                        TEXT
   ,"pbc_hpos"                       INTEGER
   ,"pbc_jtfy"                       INTEGER
   ,"pbc_mask"                       TEXT
   ,"pbc_case"                       INTEGER
   ,"pbc_hght"                       INTEGER
   ,"pbc_wdth"                       INTEGER
   ,"pbc_ptrn"                       TEXT
   ,"pbc_bmap"                       TEXT
   ,"pbc_init"                       TEXT
   ,"pbc_cmnt"                       TEXT
   ,"pbc_edit"                       TEXT
   ,"pbc_tag"                        TEXT
);

CREATE TABLE "pbcatfmt" (
    "pbf_name"                       TEXT NOT NULL
   ,"pbf_frmt"                       TEXT
   ,"pbf_type"                       INTEGER
   ,"pbf_cntr"                       INTEGER
);

CREATE TABLE "pbcatvld" (
    "pbv_name"                       TEXT NOT NULL
   ,"pbv_vald"                       TEXT
   ,"pbv_type"                       INTEGER
   ,"pbv_cntr"                       INTEGER
   ,"pbv_msg"                        TEXT
);

CREATE TABLE "pbcatedt" (
    "pbe_name"                       TEXT NOT NULL
   ,"pbe_edit"                       TEXT
   ,"pbe_type"                       INTEGER
   ,"pbe_cntr"                       INTEGER
   ,"pbe_seqn"                       INTEGER NOT NULL
   ,"pbe_flag"                       INTEGER
   ,"pbe_work"                       TEXT
);

CREATE TABLE "t_version" (
    "version"                        TEXT NOT NULL
   ,"act_num"                        INTEGER
   ,"ver_ok"                         TEXT
   ,PRIMARY KEY ("version") 
);

CREATE TABLE "t_pob" (
    "pob_code"                       INTEGER PRIMARY KEY AUTOINCREMENT
   ,"zip_num"                        INTEGER
   ,"city_code"                      INTEGER
   ,"from_num"                       INTEGER
   ,"to_num"                         INTEGER
);

CREATE TABLE "t_streets" (
    "street_code"                    INTEGER PRIMARY KEY AUTOINCREMENT
   ,"street_num"                     TEXT
   ,"street_name"                    TEXT
   ,"city_code"                      INTEGER
   ,"street_alias"                   TEXT
);

CREATE TABLE "t_zipcode" (
    "zip_code"                       INTEGER PRIMARY KEY AUTOINCREMENT
   ,"zip_num"                        INTEGER
   ,"street_num"                     TEXT
   ,"city_code"                      INTEGER
   ,"from_num"                       INTEGER
   ,"to_num"                         INTEGER
);

CREATE TABLE "creator_pbcattbl" (
    "pbt_tnam"                       TEXT NOT NULL
   ,"pbt_tid"                        INTEGER
   ,"pbt_ownr"                       TEXT NOT NULL
   ,"pbd_fhgt"                       INTEGER
   ,"pbd_fwgt"                       INTEGER
   ,"pbd_fitl"                       TEXT
   ,"pbd_funl"                       TEXT
   ,"pbd_fchr"                       INTEGER
   ,"pbd_fptc"                       INTEGER
   ,"pbd_ffce"                       TEXT
   ,"pbh_fhgt"                       INTEGER
   ,"pbh_fwgt"                       INTEGER
   ,"pbh_fitl"                       TEXT
   ,"pbh_funl"                       TEXT
   ,"pbh_fchr"                       INTEGER
   ,"pbh_fptc"                       INTEGER
   ,"pbh_ffce"                       TEXT
   ,"pbl_fhgt"                       INTEGER
   ,"pbl_fwgt"                       INTEGER
   ,"pbl_fitl"                       TEXT
   ,"pbl_funl"                       TEXT
   ,"pbl_fchr"                       INTEGER
   ,"pbl_fptc"                       INTEGER
   ,"pbl_ffce"                       TEXT
   ,"pbt_cmnt"                       TEXT
);

CREATE TABLE "creator_pbcatcol" (
    "pbc_tnam"                       TEXT NOT NULL
   ,"pbc_tid"                        INTEGER
   ,"pbc_ownr"                       TEXT NOT NULL
   ,"pbc_cnam"                       TEXT NOT NULL
   ,"pbc_cid"                        INTEGER
   ,"pbc_labl"                       TEXT
   ,"pbc_lpos"                       INTEGER
   ,"pbc_hdr"                        TEXT
   ,"pbc_hpos"                       INTEGER
   ,"pbc_jtfy"                       INTEGER
   ,"pbc_mask"                       TEXT
   ,"pbc_case"                       INTEGER
   ,"pbc_hght"                       INTEGER
   ,"pbc_wdth"                       INTEGER
   ,"pbc_ptrn"                       TEXT
   ,"pbc_bmap"                       TEXT
   ,"pbc_init"                       TEXT
   ,"pbc_cmnt"                       TEXT
   ,"pbc_edit"                       TEXT
   ,"pbc_tag"                        TEXT
);

CREATE TABLE "creator_pbcatfmt" (
    "pbf_name"                       TEXT NOT NULL
   ,"pbf_frmt"                       TEXT
   ,"pbf_type"                       INTEGER
   ,"pbf_cntr"                       INTEGER
);

CREATE TABLE "creator_pbcatvld" (
    "pbv_name"                       TEXT NOT NULL
   ,"pbv_vald"                       TEXT
   ,"pbv_type"                       INTEGER
   ,"pbv_cntr"                       INTEGER
   ,"pbv_msg"                        TEXT
);

CREATE TABLE "creator_pbcatedt" (
    "pbe_name"                       TEXT NOT NULL
   ,"pbe_edit"                       TEXT
   ,"pbe_type"                       INTEGER
   ,"pbe_cntr"                       INTEGER
   ,"pbe_seqn"                       INTEGER NOT NULL
   ,"pbe_flag"                       INTEGER
   ,"pbe_work"                       TEXT
);

CREATE TABLE "t_discount_types" (
    "discount_code"                  INTEGER NOT NULL
   ,"discount_name"                  TEXT
   ,"last_action"                    TEXT DEFAULT CURRENT_TIMESTAMP
   ,"add_precent"                    REAL
   ,"round_level"                    INTEGER DEFAULT 0
   ,PRIMARY KEY ("discount_code") 
);

CREATE TABLE "t_city" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"city_code"                      INTEGER
   ,"city_name"                      TEXT NOT NULL
   ,"city_type"                      INTEGER
   ,"city_zipnum"                    INTEGER
);

CREATE TABLE "t_account_types" (
    "account_type"                   TEXT NOT NULL
   ,"account_name"                   TEXT NOT NULL
   ,"account_index"                  INTEGER
   ,"show_in_dddw"                   TEXT NOT NULL
   ,PRIMARY KEY ("account_type") 
);

CREATE TABLE "t_profile_options" (
    "option_code"                    INTEGER NOT NULL
   ,"option_name"                    TEXT NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"default_index"                  INTEGER NOT NULL
   ,"delete_enabled"                 TEXT NOT NULL DEFAULT '1'
   ,"scroll_enabled"                 TEXT NOT NULL DEFAULT '1'
   ,"print_enabled"                  TEXT NOT NULL DEFAULT '1'
   ,"insert_enabled"                 TEXT NOT NULL DEFAULT '1'
   ,"look_for_child"                 TEXT NOT NULL DEFAULT '1'
   ,"just_for_application"           INTEGER DEFAULT 0
   ,"picture_name"                   TEXT
   ,"show_qty"                       TEXT DEFAULT '0'
   ,"qty_table_name"                 TEXT
   ,"qty_column_name"                TEXT
   ,"qty_option_in_where"            TEXT DEFAULT '0'
   ,"table_or_form"                  TEXT DEFAULT 'F'
   ,"logic_name"                     TEXT
   ,"select_row"                     TEXT DEFAULT '1'
   ,PRIMARY KEY ("option_code","account_type") 
);

CREATE TABLE "t_profile_application" (
    "code"                           INTEGER NOT NULL
   ,"application_name"               TEXT NOT NULL
   ,"app_index"                      INTEGER NOT NULL
   ,PRIMARY KEY ("code") 
);

CREATE TABLE "t_job_types" (
    "application_code"               INTEGER NOT NULL
   ,"job_code"                       INTEGER NOT NULL
   ,"job_description"                TEXT NOT NULL
   ,PRIMARY KEY ("job_code") 
);

CREATE TABLE "optic_device_data" (
    "code"                           INTEGER PRIMARY KEY AUTOINCREMENT
   ,"account_code"                   INTEGER NOT NULL
   ,"account_type"                   TEXT NOT NULL
   ,"data_date"                      TEXT NOT NULL
   ,"ob_sph_right"                   TEXT
   ,"ob_sph_left"                    TEXT
   ,"ob_cyl_right"                   TEXT
   ,"ob_cyl_left"                    TEXT
   ,"ob_ax_right"                    INTEGER
   ,"ob_ax_left"                     INTEGER
   ,"cr_rv_right"                    REAL
   ,"cr_rv_left"                     REAL
   ,"cr_rh_right"                    REAL
   ,"cr_rh_left"                     REAL
   ,"cr_ax_right"                    INTEGER
   ,"cr_ax_left"                     INTEGER
   ,"sb_sph_right"                   TEXT
   ,"sb_sph_left"                    TEXT
   ,"sb_cyl_right"                   TEXT
   ,"sb_cyl_left"                    TEXT
   ,"read_right"                     REAL
   ,"read_left"                      REAL
   ,"sb_ax_right"                    INTEGER
   ,"sb_ax_left"                     INTEGER
   ,"sb_pris_right"                  REAL
   ,"sb_pris_left"                   REAL
   ,"sb_base_right"                  TEXT
   ,"sb_base_left"                   TEXT
   ,"pd_f_right"                     REAL
   ,"pd_f_left"                      REAL
   ,"pd_f"                           REAL
   ,"pd_n_right"                     REAL
   ,"pd_n_left"                      REAL
   ,"pd_n"                           REAL
   ,"sb_va_right"                    TEXT
   ,"sb_va_left"                     TEXT
   ,"sb_va"                          TEXT
   ,"or_sph_right"                   TEXT
   ,"or_sph_left"                    TEXT
   ,"or_cyl_right"                   TEXT
   ,"or_cyl_left"                    TEXT
   ,"or_ax_right"                    INTEGER
   ,"or_ax_left"                     INTEGER
   ,"or_add_right"                   REAL
   ,"or_add_left"                    REAL
   ,"or_va_b"                        TEXT
   ,"or_va_r"                        TEXT
   ,"or_va_l"                        TEXT
);

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


