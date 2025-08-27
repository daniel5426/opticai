# Comprehensive Database Migration Field Mapping

## 1. Client Data Migration
**Source:** `account` table → **Target:** `clients` table

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `account_code` | - | Skip | Will use auto-generated IDs |
| `branch_code` | `clinic_id` | Map to clinic | Will need clinic mapping logic |
| `account_type` | - | Filter | Only migrate 'A' (client) accounts |
| `first_name` | `first_name` | Direct | - |
| `last_name` | `last_name` | Direct | - |
| `id_number` | `national_id` | Direct | - |
| `birth_date` | `date_of_birth` | Parse date | Convert TEXT to DATE |
| `sex` | `gender` | Transform | '1'='male', '2'='female' |
| `phone1` | `phone_home` | Direct | - |
| `phone2` | `phone_work` | Direct | - |
| `phone3` | - | Skip | - |
| `mobile_phone` | `phone_mobile` | Direct | - |
| `e_mail` | `email` | Direct | - |
| `city` | `address_city` | Direct | - |
| `street` | `address_street` | Direct | - |
| `house_num` | `address_number` | Convert to string | - |
| `apartment_num` | - | Append to address_number | If exists, add to address_number |
| `zip_code` | `postal_code` | Direct | - |
| `discount_type` | - | Skip | Handle in pricing system |
| `discount_precent` | `discount_percent` | Direct | - |
| `check_blocked` | `blocked_checks` | Convert bool | '1' = true, '0' = false |
| `credit_blocked` | `blocked_credit` | Convert bool | '1' = true, '0' = false |
| `remarks` | `notes` | Direct | - |
| `occupation` | `occupation` | Direct | - |
| `account_status` | `status` | Direct | - |
| `file_location` | `file_location` | Direct | - |
| `acc_sort_group` | `sorting_group` | Direct | - |
| `open_date` | `file_creation_date` | Parse date | - |
| `head_of_family` | `family_id` | Map to family | Will need family creation logic |

## 2. Optical Exam Header Migration (UPDATED)
Primary sources moved away from `optic_device_data` (empty in your data). Use part-5 tables:

- `optic_eye_tests` (main per-exam record)
- `optic_exp_eyetests` (older/exported extended rows; optional augment)

**Target:** `optical_exams` table

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `account_code` | `client_id` | Map via client mapping | - |
| `account_type` | - | Skip | Only clients (A/CUST) |
| `test_date` | `exam_date` | Parse date | Convert TEXT to DATE |
| `dominant_eye` | `dominant_eye` | Direct | From `optic_eye_tests` |
| - | `test_name` | Default | Set to "Migrated Exam" |
| - | `dominant_eye` | Default | Set to null |
| - | `type` | Default | Set to "exam" |
| - | `user_id` | Default | Set to default admin user |
| - | `clinic_id` | Map via branch | From account.branch_code |

### Part-5 Mapping Addendum (supersedes older optic_device_data-based mappings)

- old-ref: from `optic_exp_eyetests` (`old*_type/source/lens/remark`) collapsed to a single component
- old-refraction: from `optic_eye_tests` `or_right_*`, `or_left_*`, `or_mid_va`
- objective: from `optic_eye_tests` `ob_*` (sph/cyl/ax and se when present)
- subjective: from `optic_eye_tests` `sb_*` (fa, pris/base, va, pd close/far)
- addition: from `optic_eye_tests` `add_*`
- keratometer-full: from `optic_eye_tests` `obj_k_*` (dpt/mm/mer)
- contact-lens-exam/details/diameters/schirmer/keratometer-contact: from `optic_contact_presc`
- over-refraction: from `optic_contact_lens_chk` (`or_*` and `res_*`)

New orders mapping added below.

## 3. old-ref Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.old-ref`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.old-ref.role` | Default | Set to null |
| - | `exam_data.old-ref.source` | Default | Set to "migrated" |
| - | `exam_data.old-ref.contacts` | Default | Set to null |

## 4. old-refraction Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.old-refraction`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `or_sph_right` | `exam_data.old-refraction.r_sph` | Parse float | Convert TEXT to FLOAT |
| `or_sph_left` | `exam_data.old-refraction.l_sph` | Parse float | Convert TEXT to FLOAT |
| `or_cyl_right` | `exam_data.old-refraction.r_cyl` | Parse float | Convert TEXT to FLOAT |
| `or_cyl_left` | `exam_data.old-refraction.l_cyl` | Parse float | Convert TEXT to FLOAT |
| `or_ax_right` | `exam_data.old-refraction.r_ax` | Direct | - |
| `or_ax_left` | `exam_data.old-refraction.l_ax` | Direct | - |
| - | `exam_data.old-refraction.r_pris` | Default | Set to null |
| - | `exam_data.old-refraction.l_pris` | Default | Set to null |
| - | `exam_data.old-refraction.r_base` | Default | Set to null |
| - | `exam_data.old-refraction.l_base` | Default | Set to null |
| `or_va_r` | `exam_data.old-refraction.r_va` | Parse float | Convert TEXT to FLOAT |
| `or_va_l` | `exam_data.old-refraction.l_va` | Parse float | Convert TEXT to FLOAT |
| `or_add_right` | `exam_data.old-refraction.r_ad` | Direct | - |
| `or_add_left` | `exam_data.old-refraction.l_ad` | Direct | - |
| `or_va_b` | `exam_data.old-refraction.comb_va` | Parse float | Convert TEXT to FLOAT |

## 5. old-refraction-extension Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.old-refraction-extension`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `or_sph_right` | `exam_data.old-refraction-extension.r_sph` | Parse float | Convert TEXT to FLOAT |
| `or_sph_left` | `exam_data.old-refraction-extension.l_sph` | Parse float | Convert TEXT to FLOAT |
| `or_cyl_right` | `exam_data.old-refraction-extension.r_cyl` | Parse float | Convert TEXT to FLOAT |
| `or_cyl_left` | `exam_data.old-refraction-extension.l_cyl` | Parse float | Convert TEXT to FLOAT |
| `or_ax_right` | `exam_data.old-refraction-extension.r_ax` | Direct | - |
| `or_ax_left` | `exam_data.old-refraction-extension.l_ax` | Direct | - |
| - | `exam_data.old-refraction-extension.r_pr_h` | Default | Set to null |
| - | `exam_data.old-refraction-extension.l_pr_h` | Default | Set to null |
| - | `exam_data.old-refraction-extension.r_base_h` | Default | Set to null |
| - | `exam_data.old-refraction-extension.l_base_h` | Default | Set to null |
| - | `exam_data.old-refraction-extension.r_pr_v` | Default | Set to null |
| - | `exam_data.old-refraction-extension.l_pr_v` | Default | Set to null |
| - | `exam_data.old-refraction-extension.r_base_v` | Default | Set to null |
| - | `exam_data.old-refraction-extension.l_base_v` | Default | Set to null |
| `or_va_r` | `exam_data.old-refraction-extension.r_va` | Parse float | Convert TEXT to FLOAT |
| `or_va_l` | `exam_data.old-refraction-extension.l_va` | Parse float | Convert TEXT to FLOAT |
| `or_add_right` | `exam_data.old-refraction-extension.r_ad` | Direct | - |
| `or_add_left` | `exam_data.old-refraction-extension.l_ad` | Direct | - |
| - | `exam_data.old-refraction-extension.r_j` | Default | Set to null |
| - | `exam_data.old-refraction-extension.l_j` | Default | Set to null |
| `pd_f_right` | `exam_data.old-refraction-extension.r_pd_far` | Direct | - |
| `pd_f_left` | `exam_data.old-refraction-extension.l_pd_far` | Direct | - |
| `pd_n_right` | `exam_data.old-refraction-extension.r_pd_close` | Direct | - |
| `pd_n_left` | `exam_data.old-refraction-extension.l_pd_close` | Direct | - |
| `or_va_b` | `exam_data.old-refraction-extension.comb_va` | Parse float | Convert TEXT to FLOAT |
| `pd_f` | `exam_data.old-refraction-extension.comb_pd_far` | Direct | - |
| `pd_n` | `exam_data.old-refraction-extension.comb_pd_close` | Direct | - |

## 6. objective Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.objective`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `ob_sph_right` | `exam_data.objective.r_sph` | Parse float | Convert TEXT to FLOAT |
| `ob_sph_left` | `exam_data.objective.l_sph` | Parse float | Convert TEXT to FLOAT |
| `ob_cyl_right` | `exam_data.objective.r_cyl` | Parse float | Convert TEXT to FLOAT |
| `ob_cyl_left` | `exam_data.objective.l_cyl` | Parse float | Convert TEXT to FLOAT |
| `ob_ax_right` | `exam_data.objective.r_ax` | Direct | - |
| `ob_ax_left` | `exam_data.objective.l_ax` | Direct | - |
| - | `exam_data.objective.r_se` | Calculate | Calculate spherical equivalent |
| - | `exam_data.objective.l_se` | Calculate | Calculate spherical equivalent |

## 7. subjective Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.subjective`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.subjective.r_fa` | Default | Set to null |
| - | `exam_data.subjective.l_fa` | Default | Set to null |
| - | `exam_data.subjective.r_fa_tuning` | Default | Set to null |
| - | `exam_data.subjective.l_fa_tuning` | Default | Set to null |
| `sb_sph_right` | `exam_data.subjective.r_sph` | Parse float | Convert TEXT to FLOAT |
| `sb_sph_left` | `exam_data.subjective.l_sph` | Parse float | Convert TEXT to FLOAT |
| `sb_cyl_right` | `exam_data.subjective.r_cyl` | Parse float | Convert TEXT to FLOAT |
| `sb_cyl_left` | `exam_data.subjective.l_cyl` | Parse float | Convert TEXT to FLOAT |
| `sb_ax_right` | `exam_data.subjective.r_ax` | Direct | - |
| `sb_ax_left` | `exam_data.subjective.l_ax` | Direct | - |
| `sb_pris_right` | `exam_data.subjective.r_pris` | Direct | - |
| `sb_pris_left` | `exam_data.subjective.l_pris` | Direct | - |
| `sb_base_right` | `exam_data.subjective.r_base` | Direct | - |
| `sb_base_left` | `exam_data.subjective.l_base` | Direct | - |
| `sb_va_right` | `exam_data.subjective.r_va` | Parse float | Convert TEXT to FLOAT |
| `sb_va_left` | `exam_data.subjective.l_va` | Parse float | Convert TEXT to FLOAT |
| - | `exam_data.subjective.r_ph` | Default | Set to null |
| - | `exam_data.subjective.l_ph` | Default | Set to null |
| `pd_n_right` | `exam_data.subjective.r_pd_close` | Direct | - |
| `pd_n_left` | `exam_data.subjective.l_pd_close` | Direct | - |
| `pd_f_right` | `exam_data.subjective.r_pd_far` | Direct | - |
| `pd_f_left` | `exam_data.subjective.l_pd_far` | Direct | - |
| `sb_va` | `exam_data.subjective.comb_va` | Parse float | Convert TEXT to FLOAT |
| - | `exam_data.subjective.comb_fa` | Default | Set to null |
| - | `exam_data.subjective.comb_fa_tuning` | Default | Set to null |
| `pd_n` | `exam_data.subjective.comb_pd_close` | Direct | - |
| `pd_f` | `exam_data.subjective.comb_pd_far` | Direct | - |

## 8. final-subjective Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.final-subjective`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.final-subjective.order_id` | Default | Set to null |
| `sb_sph_right` | `exam_data.final-subjective.r_sph` | Parse float | Convert TEXT to FLOAT |
| `sb_sph_left` | `exam_data.final-subjective.l_sph` | Parse float | Convert TEXT to FLOAT |
| `sb_cyl_right` | `exam_data.final-subjective.r_cyl` | Parse float | Convert TEXT to FLOAT |
| `sb_cyl_left` | `exam_data.final-subjective.l_cyl` | Parse float | Convert TEXT to FLOAT |
| `sb_ax_right` | `exam_data.final-subjective.r_ax` | Direct | - |
| `sb_ax_left` | `exam_data.final-subjective.l_ax` | Direct | - |
| - | `exam_data.final-subjective.r_pr_h` | Default | Set to null |
| - | `exam_data.final-subjective.l_pr_h` | Default | Set to null |
| - | `exam_data.final-subjective.r_base_h` | Default | Set to null |
| - | `exam_data.final-subjective.l_base_h` | Default | Set to null |
| - | `exam_data.final-subjective.r_pr_v` | Default | Set to null |
| - | `exam_data.final-subjective.l_pr_v` | Default | Set to null |
| - | `exam_data.final-subjective.r_base_v` | Default | Set to null |
| - | `exam_data.final-subjective.l_base_v` | Default | Set to null |
| `sb_va_right` | `exam_data.final-subjective.r_va` | Parse float | Convert TEXT to FLOAT |
| `sb_va_left` | `exam_data.final-subjective.l_va` | Parse float | Convert TEXT to FLOAT |
| - | `exam_data.final-subjective.r_j` | Default | Set to null |
| - | `exam_data.final-subjective.l_j` | Default | Set to null |
| `pd_f_right` | `exam_data.final-subjective.r_pd_far` | Direct | - |
| `pd_f_left` | `exam_data.final-subjective.l_pd_far` | Direct | - |
| `pd_n_right` | `exam_data.final-subjective.r_pd_close` | Direct | - |
| `pd_n_left` | `exam_data.final-subjective.l_pd_close` | Direct | - |
| `pd_f` | `exam_data.final-subjective.comb_pd_far` | Direct | - |
| `pd_n` | `exam_data.final-subjective.comb_pd_close` | Direct | - |
| `sb_va` | `exam_data.final-subjective.comb_va` | Parse float | Convert TEXT to FLOAT |

## 9. final-prescription Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.final-prescription`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.final-prescription.order_id` | Default | Set to null |
| `sb_sph_right` | `exam_data.final-prescription.r_sph` | Parse float | Convert TEXT to FLOAT |
| `sb_sph_left` | `exam_data.final-prescription.l_sph` | Parse float | Convert TEXT to FLOAT |
| `sb_cyl_right` | `exam_data.final-prescription.r_cyl` | Parse float | Convert TEXT to FLOAT |
| `sb_cyl_left` | `exam_data.final-prescription.l_cyl` | Parse float | Convert TEXT to FLOAT |
| `sb_ax_right` | `exam_data.final-prescription.r_ax` | Direct | - |
| `sb_ax_left` | `exam_data.final-prescription.l_ax` | Direct | - |
| `sb_pris_right` | `exam_data.final-prescription.r_pris` | Direct | - |
| `sb_pris_left` | `exam_data.final-prescription.l_pris` | Direct | - |
| `sb_base_right` | `exam_data.final-prescription.r_base` | Direct | - |
| `sb_base_left` | `exam_data.final-prescription.l_base` | Direct | - |
| `sb_va_right` | `exam_data.final-prescription.r_va` | Parse float | Convert TEXT to FLOAT |
| `sb_va_left` | `exam_data.final-prescription.l_va` | Parse float | Convert TEXT to FLOAT |
| `read_right` | `exam_data.final-prescription.r_ad` | Direct | - |
| `read_left` | `exam_data.final-prescription.l_ad` | Direct | - |
| `pd_f_right` | `exam_data.final-prescription.r_pd` | Direct | - |
| `pd_f_left` | `exam_data.final-prescription.l_pd` | Direct | - |
| - | `exam_data.final-prescription.r_high` | Default | Set to null |
| - | `exam_data.final-prescription.l_high` | Default | Set to null |
| - | `exam_data.final-prescription.r_diam` | Default | Set to null |
| - | `exam_data.final-prescription.l_diam` | Default | Set to null |
| `sb_va` | `exam_data.final-prescription.comb_va` | Parse float | Convert TEXT to FLOAT |
| `pd_f` | `exam_data.final-prescription.comb_pd` | Direct | - |
| - | `exam_data.final-prescription.comb_high` | Default | Set to null |

## 10. compact-prescription Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.compact-prescription`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.compact-prescription.referral_id` | Default | Set to null |
| `sb_sph_right` | `exam_data.compact-prescription.r_sph` | Parse float | Convert TEXT to FLOAT |
| `sb_sph_left` | `exam_data.compact-prescription.l_sph` | Parse float | Convert TEXT to FLOAT |
| `sb_cyl_right` | `exam_data.compact-prescription.r_cyl` | Parse float | Convert TEXT to FLOAT |
| `sb_cyl_left` | `exam_data.compact-prescription.l_cyl` | Parse float | Convert TEXT to FLOAT |
| `sb_ax_right` | `exam_data.compact-prescription.r_ax` | Direct | - |
| `sb_ax_left` | `exam_data.compact-prescription.l_ax` | Direct | - |
| `sb_pris_right` | `exam_data.compact-prescription.r_pris` | Direct | - |
| `sb_pris_left` | `exam_data.compact-prescription.l_pris` | Direct | - |
| `sb_base_right` | `exam_data.compact-prescription.r_base` | Direct | - |
| `sb_base_left` | `exam_data.compact-prescription.l_base` | Direct | - |
| `sb_va_right` | `exam_data.compact-prescription.r_va` | Parse float | Convert TEXT to FLOAT |
| `sb_va_left` | `exam_data.compact-prescription.l_va` | Parse float | Convert TEXT to FLOAT |
| `read_right` | `exam_data.compact-prescription.r_ad` | Direct | - |
| `read_left` | `exam_data.compact-prescription.l_ad` | Direct | - |
| `pd_f_right` | `exam_data.compact-prescription.r_pd` | Direct | - |
| `pd_f_left` | `exam_data.compact-prescription.l_pd` | Direct | - |
| `sb_va` | `exam_data.compact-prescription.comb_va` | Parse float | Convert TEXT to FLOAT |
| `pd_f` | `exam_data.compact-prescription.comb_pd` | Direct | - |

## 11. addition Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.addition`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.addition.r_fcc` | Default | Set to null |
| - | `exam_data.addition.l_fcc` | Default | Set to null |
| `read_right` | `exam_data.addition.r_read` | Direct | - |
| `read_left` | `exam_data.addition.l_read` | Direct | - |
| - | `exam_data.addition.r_int` | Default | Set to null |
| - | `exam_data.addition.l_int` | Default | Set to null |
| - | `exam_data.addition.r_bif` | Default | Set to null |
| - | `exam_data.addition.l_bif` | Default | Set to null |
| - | `exam_data.addition.r_mul` | Default | Set to null |
| - | `exam_data.addition.l_mul` | Default | Set to null |
| - | `exam_data.addition.r_j` | Default | Set to null |
| - | `exam_data.addition.l_j` | Default | Set to null |
| - | `exam_data.addition.r_iop` | Default | Set to null |
| - | `exam_data.addition.l_iop` | Default | Set to null |

## 12. retinoscop Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.retinoscop`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `ob_sph_right` | `exam_data.retinoscop.r_sph` | Parse float | Convert TEXT to FLOAT |
| `ob_sph_left` | `exam_data.retinoscop.l_sph` | Parse float | Convert TEXT to FLOAT |
| `ob_cyl_right` | `exam_data.retinoscop.r_cyl` | Parse float | Convert TEXT to FLOAT |
| `ob_cyl_left` | `exam_data.retinoscop.l_cyl` | Parse float | Convert TEXT to FLOAT |
| `ob_ax_right` | `exam_data.retinoscop.r_ax` | Direct | - |
| `ob_ax_left` | `exam_data.retinoscop.l_ax` | Direct | - |
| - | `exam_data.retinoscop.r_reflex` | Default | Set to null |
| - | `exam_data.retinoscop.l_reflex` | Default | Set to null |

## 13. retinoscop-dilation Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.retinoscop-dilation`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `ob_sph_right` | `exam_data.retinoscop-dilation.r_sph` | Parse float | Convert TEXT to FLOAT |
| `ob_sph_left` | `exam_data.retinoscop-dilation.l_sph` | Parse float | Convert TEXT to FLOAT |
| `ob_cyl_right` | `exam_data.retinoscop-dilation.r_cyl` | Parse float | Convert TEXT to FLOAT |
| `ob_cyl_left` | `exam_data.retinoscop-dilation.l_cyl` | Parse float | Convert TEXT to FLOAT |
| `ob_ax_right` | `exam_data.retinoscop-dilation.r_ax` | Direct | - |
| `ob_ax_left` | `exam_data.retinoscop-dilation.l_ax` | Direct | - |
| - | `exam_data.retinoscop-dilation.r_reflex` | Default | Set to null |
| - | `exam_data.retinoscop-dilation.l_reflex` | Default | Set to null |

## 14. uncorrected-va Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.uncorrected-va`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.uncorrected-va.r_fv` | Default | Set to null |
| - | `exam_data.uncorrected-va.l_fv` | Default | Set to null |
| - | `exam_data.uncorrected-va.r_iv` | Default | Set to null |
| - | `exam_data.uncorrected-va.l_iv` | Default | Set to null |
| - | `exam_data.uncorrected-va.r_nv_j` | Default | Set to null |
| - | `exam_data.uncorrected-va.l_nv_j` | Default | Set to null |

## 15. keratometer Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.keratometer`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `cr_rv_right` | `exam_data.keratometer.r_k1` | Direct | - |
| `cr_rh_right` | `exam_data.keratometer.r_k2` | Direct | - |
| `cr_ax_right` | `exam_data.keratometer.r_axis` | Direct | - |
| `cr_rv_left` | `exam_data.keratometer.l_k1` | Direct | - |
| `cr_rh_left` | `exam_data.keratometer.l_k2` | Direct | - |
| `cr_ax_left` | `exam_data.keratometer.l_axis` | Direct | - |

## 16. keratometer-full Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.keratometer-full`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `cr_rv_right` | `exam_data.keratometer-full.r_dpt_k1` | Direct | - |
| `cr_rh_right` | `exam_data.keratometer-full.r_dpt_k2` | Direct | - |
| `cr_rv_left` | `exam_data.keratometer-full.l_dpt_k1` | Direct | - |
| `cr_rh_left` | `exam_data.keratometer-full.l_dpt_k2` | Direct | - |
| - | `exam_data.keratometer-full.r_mm_k1` | Default | Set to null |
| - | `exam_data.keratometer-full.r_mm_k2` | Default | Set to null |
| - | `exam_data.keratometer-full.l_mm_k1` | Default | Set to null |
| - | `exam_data.keratometer-full.l_mm_k2` | Default | Set to null |
| `cr_ax_right` | `exam_data.keratometer-full.r_mer_k1` | Direct | - |
| `cr_ax_left` | `exam_data.keratometer-full.l_mer_k1` | Direct | - |
| - | `exam_data.keratometer-full.r_mer_k2` | Default | Set to null |
| - | `exam_data.keratometer-full.l_mer_k2` | Default | Set to null |
| - | `exam_data.keratometer-full.r_astig` | Default | Set to false |
| - | `exam_data.keratometer-full.l_astig` | Default | Set to false |

## 17. corneal-topography Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.corneal-topography`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.corneal-topography.l_note` | Default | Set to null |
| - | `exam_data.corneal-topography.r_note` | Default | Set to null |
| - | `exam_data.corneal-topography.title` | Default | Set to null |

## 18. cover-test Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.cover-test-cover-1-tab1`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.cover-test-cover-1-tab1.card_id` | Default | Set to "cover-1" |
| - | `exam_data.cover-test-cover-1-tab1.card_instance_id` | Default | Set to "tab1" |
| - | `exam_data.cover-test-cover-1-tab1.tab_index` | Default | Set to 0 |
| - | `exam_data.cover-test-cover-1-tab1.deviation_type` | Default | Set to null |
| - | `exam_data.cover-test-cover-1-tab1.deviation_direction` | Default | Set to null |
| - | `exam_data.cover-test-cover-1-tab1.fv_1` | Default | Set to null |
| - | `exam_data.cover-test-cover-1-tab1.fv_2` | Default | Set to null |
| - | `exam_data.cover-test-cover-1-tab1.nv_1` | Default | Set to null |
| - | `exam_data.cover-test-cover-1-tab1.nv_2` | Default | Set to null |

## 19. notes Component Migration
**Source:** `account_memos` table → **Target:** `exam_layout_instances.exam_data.notes-notes-1`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.notes-notes-1.card_instance_id` | Default | Set to "notes-1" |
| - | `exam_data.notes-notes-1.title` | Default | Set to "הערות" |
| `memo_remark` | `exam_data.notes-notes-1.note` | Direct | From account_memos |

## 20. anamnesis Component Migration
**Source:** `account_memos` table → **Target:** `exam_layout_instances.exam_data.anamnesis`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.anamnesis.medications` | Default | Set to null |
| - | `exam_data.anamnesis.allergies` | Default | Set to null |
| - | `exam_data.anamnesis.family_history` | Default | Set to null |
| - | `exam_data.anamnesis.previous_treatments` | Default | Set to null |
| - | `exam_data.anamnesis.lazy_eye` | Default | Set to null |
| - | `exam_data.anamnesis.contact_lens_wear` | Default | Set to false |
| - | `exam_data.anamnesis.started_wearing_since` | Default | Set to null |
| - | `exam_data.anamnesis.stopped_wearing_since` | Default | Set to null |
| `memo_remark` | `exam_data.anamnesis.additional_notes` | Direct | From account_memos where memo_type relates to anamnesis |

## 21. schirmer-test Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.schirmer-test`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.schirmer-test.r_mm` | Default | Set to null |
| - | `exam_data.schirmer-test.l_mm` | Default | Set to null |
| - | `exam_data.schirmer-test.r_but` | Default | Set to null |
| - | `exam_data.schirmer-test.l_but` | Default | Set to null |

## 22. contact-lens-diameters Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.contact-lens-diameters`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.contact-lens-diameters.pupil_diameter` | Default | Set to null |
| - | `exam_data.contact-lens-diameters.corneal_diameter` | Default | Set to null |
| - | `exam_data.contact-lens-diameters.eyelid_aperture` | Default | Set to null |

## 23. contact-lens-details Component Migration
**Source:** Contact lens lookup tables → **Target:** `exam_layout_instances.exam_data.contact-lens-details`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| From `optic_tv_contact_type` | `exam_data.contact-lens-details.l_lens_type` | Lookup | Map from contact type lookups |
| From `optic_tv_contact_model` | `exam_data.contact-lens-details.l_model` | Lookup | Map from contact model lookups |
| From `optic_tv_contact_manuf` | `exam_data.contact-lens-details.l_supplier` | Lookup | Map from contact manufacturer lookups |
| From `optic_tv_contact_mater` | `exam_data.contact-lens-details.l_material` | Lookup | Map from contact material lookups |
| From `optic_tv_contact_color` | `exam_data.contact-lens-details.l_color` | Lookup | Map from contact color lookups |
| - | `exam_data.contact-lens-details.l_quantity` | Default | Set to null |
| - | `exam_data.contact-lens-details.l_order_quantity` | Default | Set to null |
| - | `exam_data.contact-lens-details.l_dx` | Default | Set to false |
| From `optic_tv_contact_type` | `exam_data.contact-lens-details.r_lens_type` | Lookup | Map from contact type lookups |
| From `optic_tv_contact_model` | `exam_data.contact-lens-details.r_model` | Lookup | Map from contact model lookups |
| From `optic_tv_contact_manuf` | `exam_data.contact-lens-details.r_supplier` | Lookup | Map from contact manufacturer lookups |
| From `optic_tv_contact_mater` | `exam_data.contact-lens-details.r_material` | Lookup | Map from contact material lookups |
| From `optic_tv_contact_color` | `exam_data.contact-lens-details.r_color` | Lookup | Map from contact color lookups |
| - | `exam_data.contact-lens-details.r_quantity` | Default | Set to null |
| - | `exam_data.contact-lens-details.r_order_quantity` | Default | Set to null |
| - | `exam_data.contact-lens-details.r_dx` | Default | Set to false |

## 24. keratometer-contact-lens Component Migration
**Source:** `optic_device_data` table → **Target:** `exam_layout_instances.exam_data.keratometer-contact-lens`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `cr_rh_left` | `exam_data.keratometer-contact-lens.l_rh` | Direct | - |
| `cr_rv_left` | `exam_data.keratometer-contact-lens.l_rv` | Direct | - |
| - | `exam_data.keratometer-contact-lens.l_avg` | Calculate | Average of l_rh and l_rv |
| - | `exam_data.keratometer-contact-lens.l_cyl` | Default | Set to null |
| `cr_ax_left` | `exam_data.keratometer-contact-lens.l_ax` | Direct | - |
| - | `exam_data.keratometer-contact-lens.l_ecc` | Default | Set to null |
| `cr_rh_right` | `exam_data.keratometer-contact-lens.r_rh` | Direct | - |
| `cr_rv_right` | `exam_data.keratometer-contact-lens.r_rv` | Direct | - |
| - | `exam_data.keratometer-contact-lens.r_avg` | Calculate | Average of r_rh and r_rv |
| - | `exam_data.keratometer-contact-lens.r_cyl` | Default | Set to null |
| `cr_ax_right` | `exam_data.keratometer-contact-lens.r_ax` | Direct | - |
| - | `exam_data.keratometer-contact-lens.r_ecc` | Default | Set to null |

## 25. contact-lens-exam Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.contact-lens-exam`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.contact-lens-exam.comb_va` | Default | Set to null |
| - | `exam_data.contact-lens-exam.l_bc` | Default | Set to null |
| - | `exam_data.contact-lens-exam.l_bc_2` | Default | Set to null |
| - | `exam_data.contact-lens-exam.l_oz` | Default | Set to null |
| - | `exam_data.contact-lens-exam.l_diam` | Default | Set to null |
| - | `exam_data.contact-lens-exam.l_sph` | Default | Set to null |
| - | `exam_data.contact-lens-exam.l_cyl` | Default | Set to null |
| - | `exam_data.contact-lens-exam.l_ax` | Default | Set to null |
| - | `exam_data.contact-lens-exam.l_read_ad` | Default | Set to null |
| - | `exam_data.contact-lens-exam.l_va` | Default | Set to null |
| - | `exam_data.contact-lens-exam.l_j` | Default | Set to null |
| - | `exam_data.contact-lens-exam.r_bc` | Default | Set to null |
| - | `exam_data.contact-lens-exam.r_bc_2` | Default | Set to null |
| - | `exam_data.contact-lens-exam.r_oz` | Default | Set to null |
| - | `exam_data.contact-lens-exam.r_diam` | Default | Set to null |
| - | `exam_data.contact-lens-exam.r_sph` | Default | Set to null |
| - | `exam_data.contact-lens-exam.r_cyl` | Default | Set to null |
| - | `exam_data.contact-lens-exam.r_ax` | Default | Set to null |
| - | `exam_data.contact-lens-exam.r_read_ad` | Default | Set to null |
| - | `exam_data.contact-lens-exam.r_va` | Default | Set to null |
| - | `exam_data.contact-lens-exam.r_j` | Default | Set to null |

## 26. contact-lens-order Component Migration
**Source:** Lookup tables and settings → **Target:** `exam_layout_instances.exam_data.contact-lens-order`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.contact-lens-order.branch` | Default | Set to clinic name |
| - | `exam_data.contact-lens-order.supply_in_branch` | Default | Set to null |
| - | `exam_data.contact-lens-order.order_status` | Default | Set to null |
| - | `exam_data.contact-lens-order.advisor` | Default | Set to null |
| - | `exam_data.contact-lens-order.deliverer` | Default | Set to null |
| - | `exam_data.contact-lens-order.delivery_date` | Default | Set to null |
| - | `exam_data.contact-lens-order.priority` | Default | Set to null |
| - | `exam_data.contact-lens-order.guaranteed_date` | Default | Set to null |
| - | `exam_data.contact-lens-order.approval_date` | Default | Set to null |
| From `optic_tv_clean_sol` | `exam_data.contact-lens-order.cleaning_solution` | Lookup | Map from cleaning solution lookups |
| From `optic_tv_dis_sol` | `exam_data.contact-lens-order.disinfection_solution` | Lookup | Map from disinfection solution lookups |
| From `optic_tv_wash_sol` | `exam_data.contact-lens-order.rinsing_solution` | Lookup | Map from rinsing solution lookups |

## 27. sensation-vision-stability Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.sensation-vision-stability`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.sensation-vision-stability.r_sensation` | Default | Set to null |
| - | `exam_data.sensation-vision-stability.l_sensation` | Default | Set to null |
| - | `exam_data.sensation-vision-stability.r_vision` | Default | Set to null |
| - | `exam_data.sensation-vision-stability.l_vision` | Default | Set to null |
| - | `exam_data.sensation-vision-stability.r_stability` | Default | Set to null |
| - | `exam_data.sensation-vision-stability.l_stability` | Default | Set to null |
| - | `exam_data.sensation-vision-stability.r_movement` | Default | Set to null |
| - | `exam_data.sensation-vision-stability.l_movement` | Default | Set to null |
| - | `exam_data.sensation-vision-stability.r_recommendations` | Default | Set to null |
| - | `exam_data.sensation-vision-stability.l_recommendations` | Default | Set to null |

## 28. diopter-adjustment-panel Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.diopter-adjustment-panel`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.diopter-adjustment-panel.right_diopter` | Default | Set to null |
| - | `exam_data.diopter-adjustment-panel.left_diopter` | Default | Set to null |

## 29. fusion-range Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.fusion-range`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.fusion-range.fv_base_in` | Default | Set to null |
| - | `exam_data.fusion-range.fv_base_in_recovery` | Default | Set to null |
| - | `exam_data.fusion-range.fv_base_out` | Default | Set to null |
| - | `exam_data.fusion-range.fv_base_out_recovery` | Default | Set to null |
| - | `exam_data.fusion-range.nv_base_in` | Default | Set to null |
| - | `exam_data.fusion-range.nv_base_in_recovery` | Default | Set to null |
| - | `exam_data.fusion-range.nv_base_out` | Default | Set to null |
| - | `exam_data.fusion-range.nv_base_out_recovery` | Default | Set to null |

## 30. maddox-rod Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.maddox-rod`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.maddox-rod.c_r_h` | Default | Set to null |
| - | `exam_data.maddox-rod.c_r_v` | Default | Set to null |
| - | `exam_data.maddox-rod.c_l_h` | Default | Set to null |
| - | `exam_data.maddox-rod.c_l_v` | Default | Set to null |
| - | `exam_data.maddox-rod.wc_r_h` | Default | Set to null |
| - | `exam_data.maddox-rod.wc_r_v` | Default | Set to null |
| - | `exam_data.maddox-rod.wc_l_h` | Default | Set to null |
| - | `exam_data.maddox-rod.wc_l_v` | Default | Set to null |

## 31. stereo-test Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.stereo-test`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.stereo-test.fly_result` | Default | Set to false |
| - | `exam_data.stereo-test.circle_score` | Default | Set to null |
| - | `exam_data.stereo-test.circle_max` | Default | Set to null |

## 32. rg Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.rg`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.rg.rg_status` | Default | Set to null |
| - | `exam_data.rg.suppressed_eye` | Default | Set to null |

## 33. ocular-motor-assessment Component Migration
**Source:** No direct mapping → **Target:** `exam_layout_instances.exam_data.ocular-motor-assessment`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.ocular-motor-assessment.ocular_motility` | Default | Set to null |
| - | `exam_data.ocular-motor-assessment.acc_od` | Default | Set to null |
| - | `exam_data.ocular-motor-assessment.acc_os` | Default | Set to null |
| - | `exam_data.ocular-motor-assessment.npc_break` | Default | Set to null |
| - | `exam_data.ocular-motor-assessment.npc_recovery` | Default | Set to null |

## 34. old-contact-lenses Component Migration
**Source:** Contact lens lookup tables → **Target:** `exam_layout_instances.exam_data.old-contact-lenses`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| - | `exam_data.old-contact-lenses.l_bc` | Default | Set to null |
| - | `exam_data.old-contact-lenses.l_diam` | Default | Set to null |
| - | `exam_data.old-contact-lenses.l_sph` | Default | Set to null |
| - | `exam_data.old-contact-lenses.l_cyl` | Default | Set to null |
| - | `exam_data.old-contact-lenses.l_ax` | Default | Set to null |
| - | `exam_data.old-contact-lenses.l_va` | Default | Set to null |
| - | `exam_data.old-contact-lenses.l_j` | Default | Set to null |
| - | `exam_data.old-contact-lenses.r_bc` | Default | Set to null |
| - | `exam_data.old-contact-lenses.r_diam` | Default | Set to null |
| - | `exam_data.old-contact-lenses.r_sph` | Default | Set to null |
| - | `exam_data.old-contact-lenses.r_cyl` | Default | Set to null |
| - | `exam_data.old-contact-lenses.r_ax` | Default | Set to null |
| - | `exam_data.old-contact-lenses.r_va` | Default | Set to null |
| - | `exam_data.old-contact-lenses.r_j` | Default | Set to null |
| From `optic_tv_contact_type` | `exam_data.old-contact-lenses.r_lens_type` | Lookup | Map from contact type lookups |
| From `optic_tv_contact_type` | `exam_data.old-contact-lenses.l_lens_type` | Lookup | Map from contact type lookups |
| From `optic_tv_contact_model` | `exam_data.old-contact-lenses.r_model` | Lookup | Map from contact model lookups |
| From `optic_tv_contact_model` | `exam_data.old-contact-lenses.l_model` | Lookup | Map from contact model lookups |
| From `optic_tv_contact_manuf` | `exam_data.old-contact-lenses.r_supplier` | Lookup | Map from contact manufacturer lookups |
| From `optic_tv_contact_manuf` | `exam_data.old-contact-lenses.l_supplier` | Lookup | Map from contact manufacturer lookups |
| - | `exam_data.old-contact-lenses.comb_va` | Default | Set to null |
| - | `exam_data.old-contact-lenses.comb_j` | Default | Set to null |

## 35. over-refraction Component Migration (UPDATED)
**Sources:**
- `optic_contact_lens_chk` (`or_sph`, `or_cyl`, `or_ax`, and `res_*`) → map to over-refraction (pre/post as applicable)
**Target:** `exam_layout_instances.exam_data.over-refraction`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `or_sph_right` | `exam_data.over-refraction.r_sph` | Parse float | Convert TEXT to FLOAT |
| `or_sph_left` | `exam_data.over-refraction.l_sph` | Parse float | Convert TEXT to FLOAT |
| `or_cyl_right` | `exam_data.over-refraction.r_cyl` | Parse float | Convert TEXT to FLOAT |
| `or_cyl_left` | `exam_data.over-refraction.l_cyl` | Parse float | Convert TEXT to FLOAT |
| `or_ax_right` | `exam_data.over-refraction.r_ax` | Direct | - |
| `or_ax_left` | `exam_data.over-refraction.l_ax` | Direct | - |
| `or_va_r` | `exam_data.over-refraction.r_va` | Parse float | Convert TEXT to FLOAT |
| `or_va_l` | `exam_data.over-refraction.l_va` | Parse float | Convert TEXT to FLOAT |
| - | `exam_data.over-refraction.r_j` | Default | Set to null |
| - | `exam_data.over-refraction.l_j` | Default | Set to null |
| `or_va_b` | `exam_data.over-refraction.comb_va` | Parse float | Convert TEXT to FLOAT |
| - | `exam_data.over-refraction.comb_j` | Default | Set to null |
| `or_add_left` | `exam_data.over-refraction.l_add` | Direct | - |
| `or_add_right` | `exam_data.over-refraction.r_add` | Direct | - |
| - | `exam_data.over-refraction.l_florescent` | Default | Set to null |
| - | `exam_data.over-refraction.r_florescent` | Default | Set to null |
| - | `exam_data.over-refraction.l_bio_m` | Default | Set to null |
| - | `exam_data.over-refraction.r_bio_m` | Default | Set to null |

## Orders Data Migration (NEW)

### Regular Orders (Glasses)
**Source:** `optic_glasses_presc` → **Target:** `orders` + `orders.order_data`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `account_code` | `orders.client_id` | Map via client mapping | - |
| `branch_code` | `orders.clinic_id` | Map via clinic | - |
| `presc_date` | `orders.order_date` | Parse date | - |
| `dominant_eye` | `orders.dominant_eye` | Direct | - |
| - | `orders.type` | Default | "regular" |
| - | `orders.user_id` | Default | admin user |
| Final prescription | `order_data["final-prescription"]` | Map right/left sph/cyl/ax/pris/base/va/add/pd/high | From `right_*`/`left_*`, `mid_va`→`comb_va`, `pd_far`/`pd_near`→`comb_pd` |
| Lens | `order_data["lens"]` | supplier/material/model/color/coat/diameter | Map from lens_* fields |
| Frame | `order_data["frame"]` | model/manufacturer/color/bridge/width/height/length | Map from frame_* fields |
| Details | `order_data["details"]` | status/advisor/promise_to_date/remarks | From `order_status`, `advisor_code` (stringified), `promise_to_date`, `presc_remark` |

### Contact Lens Orders
**Source:** `optic_contact_presc` → **Target:** `contact_lens_orders` + `contact_lens_orders.order_data`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `account_code` | `contact_lens_orders.client_id` | Map via client mapping | - |
| `branch_code` | `contact_lens_orders.clinic_id` | Map via clinic | - |
| `presc_date` | `contact_lens_orders.order_date` | Parse date | - |
| `order_status` (int) | `contact_lens_orders.order_status` | Stringify | If lookup exists, map to text |
| `advisor_code` | `contact_lens_orders.advisor` | Stringify | If lookup exists, map |
| `supply_branch` | `contact_lens_orders.supply_in_clinic_id` | Map via clinic | - |
| `clean_sol`/`dis_sol`/`wash_sol` | `order_data["contact-lens-order"].{cleaning_solution,disinfection_solution,rinsing_solution}` | Direct | - |
| `order_iner_priority` | `order_data["contact-lens-order"].priority` | Stringify | - |
| `given_at` | `order_data["contact-lens-order"].approval_date` | Direct | - |
| `promise_to_date` | `order_data["contact-lens-order"].promise_to_date` | Direct | - |
| Left: `left_type, left_model, left_manuf, left_mater, left_color, left_qty, left_order_qty` | `order_data["contact-lens-details"]` l_* | Direct, parse ints | - |
| Right: `right_type, right_model, right_manuf, right_mater, right_color, right_qty, right_order_qty` | `order_data["contact-lens-details"]` r_* | Direct, parse ints | - |
| Left: `left_bc1, left_bc2, left_oz, left_diam, left_sph, left_cyl, left_ax, left_va, left_read, left_j` | `order_data["contact-lens-exam"]` l_* | Parse numbers where numeric | - |
| Right: `right_bc1, right_bc2, right_oz, right_diam, right_sph, right_cyl, right_ax, right_va, right_read, right_j` | `order_data["contact-lens-exam"]` r_* | Parse numbers where numeric | - |
| `mid_va` | `order_data["contact-lens-exam"].comb_va` | Parse float | - |
| Kerato Left: `cr_left_rv, cr_left_rh, cr_left_avg, cr_left_cyl, cr_left_ax, cr_left_ecc` | `order_data["keratometer-contact-lens"]` l_* | Parse numbers | - |
| Kerato Right: `cr_right_rv, cr_right_rh, cr_right_avg, cr_right_cyl, cr_right_ax, cr_right_ecc` | `order_data["keratometer-contact-lens"]` r_* | Parse numbers | - |
| `sirmer_right, sirmer_right_but, sirmer_left, sirmer_left_but` | `order_data["schirmer-test"]` | Parse floats | - |
| `cornia_diam`, `pupil_diameter`/`pupil_distance` | `order_data["contact-lens-diameters"]` | Parse floats; pupil uses coalesce | - |

### Contact Lens Checks Enrichment (NEW)
**Source:** `optic_contact_lens_chk` → **Target:** enrich `exam_layout_instances.exam_data` and `contact_lens_orders.order_data`

- Over-refraction per eye: if `tested_eye` == 'R' fill r_*; if 'L' fill l_* from `or_sph`, `or_cyl`, `or_ax`. Optional `chk_va` to r_va/l_va and `comb_va`; `chk_add` to r_add/l_add.
- Contact-lens-exam enrichment: from `lens_bc_1`, `lens_bc_2`, `lens_diam`, `lens_sph`, `lens_cyl`, `lens_ax` into the corresponding eye.
- Contact-lens-details fallback: from `lens_type`, `lens_model`, `lens_supplier` into r_/l_ if missing.
- Notes: append `trial_sct` and `chk_comment` into `order_data["contact-lens-order"].notes`.

## 36. Referral Data Migration
**Source:** `optic_reference` table → **Target:** `referrals` table

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `code` | - | Skip | Will use auto-generated IDs |
| `account_code` | `client_id` | Map via client mapping | - |
| `branch_code` | `clinic_id` | Map to clinic | - |
| `reference_date` | `date` | Parse date | Convert TEXT to DATE |
| `address_to` | `recipient` | Direct | - |
| `reference_remark` | `referral_notes` | Direct | - |
| `presc_code` | - | Skip | Will handle prescription separately |
| - | `user_id` | Default | Set to default admin user |
| - | `type` | Default | Set to "general" |

## 37. Prescription Data from References Migration
**Source:** `optic_presc_prices` table → **Target:** `referrals.referral_data`

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `presc_code` | - | Link to referral | Map to referral via presc_code |
| `item_name` | `referral_data.prescription_notes` | Direct | - |
| `item_price` | - | Skip | Price info not in new system |
| `item_qty` | - | Skip | Quantity not needed |

## 38. File Data Migration
**Source:** `account_files` + `account_files_blob` → **Target:** `files` table

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `account_code` | `client_id` | Map via client mapping | - |
| `branch_code` | `clinic_id` | Map to clinic | - |
| `file_date` | `upload_date` | Parse date | Convert TEXT to DATETIME |
| `file_description` | `file_name` | Direct | - |
| `file_remark` | `notes` | Direct | - |
| `employee_code` | `uploaded_by` | Default | Set to default admin user |
| - | `file_path` | Generate | Create path from file_name |
| - | `file_size` | Calculate | From blob if available |
| - | `file_type` | Extract | From file_name extension |

## 39. Medical Notes Migration
**Source:** `account_memos` → **Target:** `medical_logs` table

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `account_code` | `client_id` | Map via client mapping | - |
| `branch_code` | `clinic_id` | Map to clinic | - |
| `memo_date` | `log_date` | Parse date | Convert TEXT to DATE |
| `memo_remark` | `log` | Direct | - |
| `employee_code` | `user_id` | Default | Set to default admin user |

## 40. Appointment Migration
**Source:** `diary_timetab` table → **Target:** `appointments` table

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `account_code` | `client_id` | Map via client mapping | - |
| `branch_code` | `clinic_id` | Map to clinic | - |
| `line_date` | `date` | Parse date | Convert TEXT to DATE |
| `line_time` | `time` | Direct | - |
| `line_remark` | `note` | Direct | - |
| `reception_employee` | `user_id` | Default | Set to default admin user |
| `tester_code` | `exam_name` | Map | Map tester to exam type |
| - | `duration` | Default | Set to 30 minutes |

## 41-71. Lookup Tables Migration
All lookup tables follow the same pattern:

**Source:** `optic_tv_*` tables → **Target:** `lookup_*` tables

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `name` | `name` | Direct | - |

### Specific Lookup Mappings:
- `optic_tv_lens_supplier` → `lookup_supplier`
- `optic_tv_lens_model` → `lookup_lens_model`
- `optic_tv_lens_mater` → `lookup_material`
- `optic_tv_lens_color` → `lookup_color`
- `optic_tv_lens_coat` → `lookup_coating`
- `optic_tv_frame_model` → `lookup_frame_model`
- `optic_tv_frame_manuf` → `lookup_manufacturer`
- `optic_tv_contact_type` → `lookup_contact_lens_type`
- `optic_tv_contact_model` → `lookup_contact_eye_lens_type`
- `optic_tv_contact_manuf` → `lookup_manufacturer` (merge)
- `optic_tv_contact_color` → `lookup_color` (merge)
- `optic_tv_contact_mater` → `lookup_contact_eye_material`
- `optic_tv_clean_sol` → `lookup_cleaning_solution`
- `optic_tv_dis_sol` → `lookup_disinfection_solution`
- `optic_tv_wash_sol` → `lookup_rinsing_solution`
- `optic_tv_order_type` → `lookup_order_type`
- `account_tv_memo_type` → `lookup_referral_type`
- `optic_tv_frame_color` → `lookup_color` (merge)
- `optic_tv_frame_supplier` → `lookup_supplier` (merge)

## 72. Family Data Migration
**Source:** `account` table (grouped by `head_of_family`) → **Target:** `families` table

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `head_of_family` | - | Group by | Create family for each unique head_of_family |
| `branch_code` | `clinic_id` | Map to clinic | Family belongs to same clinic |
| - | `name` | Generate | Use head of family's last name + "Family" |
| - | `created_date` | Default | Use current date |
| - | `notes` | Default | Set to "Migrated family" |

## Default Values for New Fields

### Company Creation
- `name`: "Migrated Optical Company"
- `owner_full_name`: "System Administrator"
- `contact_email`: "admin@opticai.local"

### Clinic Creation
- `name`: "Branch {branch_code}"
- `unique_id`: "BRANCH_{branch_code}"
- `company_id`: Reference to created company

### Default Admin User
- `username`: "admin"
- `full_name`: "System Administrator"
- `role`: "company_ceo"
- `password`: Hashed default password

### Exam Layout
- `name`: "Default Migrated Layout"
- `layout_data`: Default layout JSON with all components listed above
- `is_default`: true
