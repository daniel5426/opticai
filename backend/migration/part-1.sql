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

