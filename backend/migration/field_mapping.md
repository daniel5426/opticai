# Database Migration Field Mapping

This document maps fields from the old optical database schema to the new PostgreSQL schema. The mapping is organized by migration parts and functionality.

## Executive Summary

The old database is a legacy optical management system with:
- Client data stored in `account` table with various account types
- Exam data stored in `optic_device_data` table
- Reference/prescription data in `optic_reference` table
- Lookup tables with "optic_tv_" prefix for various optical components
- Appointment data in `diary_timetab` table

The new database is a modern multi-clinic system with:
- Company → Clinic → Client hierarchy
- JSON-based exam data storage
- Separated concerns for orders, referrals, appointments
- Modern authentication and role-based access

## Part 1 Mapping: Core Tables and Device Data

### 1. Client Data Migration

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

### 2. Optical Exam Data Migration

**Source:** `optic_device_data` table → **Target:** `optical_exams` + `exam_layout_instances.exam_data`

This is complex as old data has multiple exam types in one record, new system uses JSON structure.

| Old Field | New Location | Transformation | Notes |
|-----------|--------------|----------------|-------|
| `account_code` | `optical_exams.client_id` | Map via client mapping | - |
| `data_date` | `optical_exams.exam_date` | Parse date | - |
| **Objective Data** | `exam_data.objective` | JSON structure | - |
| `ob_sph_right` | `exam_data.objective.r_sph` | Parse float | - |
| `ob_sph_left` | `exam_data.objective.l_sph` | Parse float | - |
| `ob_cyl_right` | `exam_data.objective.r_cyl` | Parse float | - |
| `ob_cyl_left` | `exam_data.objective.l_cyl` | Parse float | - |
| `ob_ax_right` | `exam_data.objective.r_ax` | Direct | - |
| `ob_ax_left` | `exam_data.objective.l_ax` | Direct | - |
| **Keratometer Data** | `exam_data.keratometer` | JSON structure | - |
| `cr_rv_right` | `exam_data.keratometer.r_k1` | Direct | - |
| `cr_rv_left` | `exam_data.keratometer.l_k1` | Direct | - |
| `cr_rh_right` | `exam_data.keratometer.r_k2` | Direct | - |
| `cr_rh_left` | `exam_data.keratometer.l_k2` | Direct | - |
| `cr_ax_right` | `exam_data.keratometer.r_axis` | Direct | - |
| `cr_ax_left` | `exam_data.keratometer.l_axis` | Direct | - |
| **Subjective Data** | `exam_data.subjective` | JSON structure | - |
| `sb_sph_right` | `exam_data.subjective.r_sph` | Parse float | - |
| `sb_sph_left` | `exam_data.subjective.l_sph` | Parse float | - |
| `sb_cyl_right` | `exam_data.subjective.r_cyl` | Parse float | - |
| `sb_cyl_left` | `exam_data.subjective.l_cyl` | Parse float | - |
| `sb_ax_right` | `exam_data.subjective.r_ax` | Direct | - |
| `sb_ax_left` | `exam_data.subjective.l_ax` | Direct | - |
| `sb_pris_right` | `exam_data.subjective.r_pris` | Direct | - |
| `sb_pris_left` | `exam_data.subjective.l_pris` | Direct | - |
| `sb_base_right` | `exam_data.subjective.r_base` | Direct | - |
| `sb_base_left` | `exam_data.subjective.l_base` | Direct | - |
| `sb_va_right` | `exam_data.subjective.r_va` | Parse float | - |
| `sb_va_left` | `exam_data.subjective.l_va` | Parse float | - |
| `sb_va` | `exam_data.subjective.comb_va` | Parse float | - |
| **Addition Data** | `exam_data.addition` | JSON structure | - |
| `read_right` | `exam_data.addition.r_read` | Direct | - |
| `read_left` | `exam_data.addition.l_read` | Direct | - |
| **PD Data** | Multiple locations | Split data | - |
| `pd_f_right` | `exam_data.subjective.r_pd_far` | Direct | - |
| `pd_f_left` | `exam_data.subjective.l_pd_far` | Direct | - |
| `pd_f` | `exam_data.subjective.comb_pd_far` | Direct | - |
| `pd_n_right` | `exam_data.subjective.r_pd_close` | Direct | - |
| `pd_n_left` | `exam_data.subjective.l_pd_close` | Direct | - |
| `pd_n` | `exam_data.subjective.comb_pd_close` | Direct | - |
| **Old Refraction Data** | `exam_data.old-refraction` | JSON structure | - |
| `or_sph_right` | `exam_data.old-refraction.r_sph` | Parse float | - |
| `or_sph_left` | `exam_data.old-refraction.l_sph` | Parse float | - |
| `or_cyl_right` | `exam_data.old-refraction.r_cyl` | Parse float | - |
| `or_cyl_left` | `exam_data.old-refraction.l_cyl` | Parse float | - |
| `or_ax_right` | `exam_data.old-refraction.r_ax` | Direct | - |
| `or_ax_left` | `exam_data.old-refraction.l_ax` | Direct | - |
| `or_add_right` | `exam_data.old-refraction.r_ad` | Direct | - |
| `or_add_left` | `exam_data.old-refraction.l_ad` | Direct | - |
| `or_va_r` | `exam_data.old-refraction.r_va` | Parse float | - |
| `or_va_l` | `exam_data.old-refraction.l_va` | Parse float | - |
| `or_va_b` | `exam_data.old-refraction.comb_va` | Parse float | - |

### 3. Lookup Tables Migration

Multiple "optic_tv_" tables → corresponding "lookup_" tables

| Old Table | New Table | Field Mapping |
|-----------|-----------|---------------|
| `optic_tv_lens_supplier` | `lookup_supplier` | `name` → `name` |
| `optic_tv_lens_model` | `lookup_lens_model` | `name` → `name` |
| `optic_tv_lens_mater` | `lookup_material` | `name` → `name` |
| `optic_tv_lens_color` | `lookup_color` | `name` → `name` |
| `optic_tv_lens_coat` | `lookup_coating` | `name` → `name` |
| `optic_tv_frame_model` | `lookup_frame_model` | `name` → `name` |
| `optic_tv_frame_manuf` | `lookup_manufacturer` | `name` → `name` |
| `optic_tv_contact_type` | `lookup_contact_lens_type` | `name` → `name` |
| `optic_tv_contact_model` | `lookup_contact_lens_type` | `name` → `name` |
| `optic_tv_contact_manuf` | `lookup_manufacturer` | `name` → `name` |
| `optic_tv_contact_color` | `lookup_color` | `name` → `name` |
| `optic_tv_contact_mater` | `lookup_contact_eye_material` | `name` → `name` |
| `optic_tv_clean_sol` | `lookup_cleaning_solution` | `name` → `name` |
| `optic_tv_dis_sol` | `lookup_disinfection_solution` | `name` → `name` |
| `optic_tv_wash_sol` | `lookup_rinsing_solution` | `name` → `name` |
| `optic_tv_order_type` | `lookup_order_type` | `name` → `name` |

## Part 2 Mapping: Reference and File Data

### 4. Referral Data Migration

**Source:** `optic_reference` table → **Target:** `referrals` table

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `account_code` | `client_id` | Map via client mapping | - |
| `branch_code` | `clinic_id` | Map to clinic | - |
| `reference_date` | `date` | Parse date | - |
| `address_to` | `recipient` | Direct | - |
| `reference_remark` | `referral_notes` | Direct | - |
| `presc_code` | - | Link to prescription | Need to map prescription data |

### 5. File Data Migration

**Source:** `account_files` + `account_files_blob` → **Target:** `files` table

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `account_code` | `client_id` | Map via client mapping | - |
| `branch_code` | `clinic_id` | Map to clinic | - |
| `file_date` | `upload_date` | Parse date | - |
| `file_description` | `file_name` | Direct | - |
| `file_remark` | `notes` | Direct | - |
| `employee_code` | `uploaded_by` | Map to user | Need user mapping |

### 6. Medical Notes Migration

**Source:** `account_memos` → **Target:** `medical_logs` table

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `account_code` | `client_id` | Map via client mapping | - |
| `branch_code` | `clinic_id` | Map to clinic | - |
| `memo_date` | `log_date` | Parse date | - |
| `memo_remark` | `log` | Direct | - |
| `employee_code` | `user_id` | Map to user | - |

## Part 3 Mapping: Appointment Data

### 7. Appointment Migration

**Source:** `diary_timetab` table → **Target:** `appointments` table

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `account_code` | `client_id` | Map via client mapping | - |
| `branch_code` | `clinic_id` | Map to clinic | - |
| `line_date` | `date` | Parse date | - |
| `line_time` | `time` | Direct | - |
| `line_remark` | `note` | Direct | - |
| `reception_employee` | `user_id` | Map to user | - |
| `tester_code` | - | Use for exam_name | Map to exam type |

## Part 4 Mapping: System Data

### 8. User/Employee Migration

**Source:** Various employee tables → **Target:** `users` table

Since old system doesn't have structured user table, will need to extract from:
- `account` table where `account_type` = 'E' (employee)
- Employee codes from various tables

| Old Field | New Field | Transformation | Notes |
|-----------|-----------|----------------|-------|
| `first_name` + `last_name` | `full_name` | Concatenate | From account table |
| `user_name` | `username` | Direct | From account table |
| `e_mail` | `email` | Direct | From account table |
| `mobile_phone` | `phone` | Direct | From account table |
| `user_password` | `password` | Hash | Need to hash passwords |
| `permission_level` | `role` | Map permissions | Transform to role names |

## Default Values and Business Logic

### Company/Clinic Setup
- Create default company: "Migrated Optical Clinic"
- Create default clinic for each branch_code found
- Assign all data to appropriate clinic

### Family Creation
- Group clients by `head_of_family` field
- Create family records for grouped clients

### Default Exam Layout
- Create default exam layout for clinic
- All migrated exams use this layout

## Data Transformation Notes

### Date Parsing
Old system uses TEXT dates, need to parse various formats:
- 'YYYY-MM-DD'
- 'DD/MM/YYYY'
- Handle null/empty dates

### Boolean Conversion
Old system uses '1'/'0' text, convert to proper booleans

### Number Parsing
Convert TEXT numbers to proper numeric types, handle empty/null values

### JSON Structure
Create proper exam_data JSON following exam_data.md specifications

## Migration Strategy

1. **Pre-migration validation**
   - Check data integrity
   - Validate required fields
   - Check for duplicate accounts

2. **Company/Clinic Setup**
   - Create company and clinics first
   - Map branch_codes to clinic_ids

3. **User Migration**
   - Extract users from account table
   - Create password hashes
   - Assign to clinics

4. **Client Migration**
   - Migrate client data
   - Create family records
   - Link families to clients

5. **Lookup Data Migration**
   - Migrate all lookup tables
   - Handle duplicates

6. **Exam Data Migration**
   - Create exam records
   - Build JSON exam_data
   - Link to clients

7. **Supporting Data**
   - Migrate appointments
   - Migrate files
   - Migrate medical logs
   - Migrate referrals

8. **Post-migration cleanup**
   - Verify data integrity
   - Update sequences
   - Create indexes

This mapping provides the foundation for the migration script. Each section can be implemented incrementally with proper error handling and rollback capabilities.
