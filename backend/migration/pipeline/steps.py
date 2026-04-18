from .common import *


def migrate_lookups(db: Session, csv_dir: str):
    t0 = time.time()
    print("[lookups] starting...", flush=True)
    simple_mappings: List[Tuple[str, Any]] = [
        ("optic_tv_lens_supplier.csv", LookupSupplier),
        ("optic_tv_lens_model.csv", LookupLensModel),
        ("optic_tv_lens_mater.csv", LookupMaterial),
        ("optic_tv_lens_color.csv", LookupColor),
        ("optic_tv_lens_coat.csv", LookupCoating),
        ("optic_tv_frame_model.csv", LookupFrameModel),
        ("optic_tv_frame_manuf.csv", LookupManufacturer),
        ("optic_tv_contact_type.csv", LookupContactLensType),
        ("optic_tv_contact_model.csv", LookupContactEyeLensType),
        ("optic_tv_contact_manuf.csv", LookupManufacturer),
        ("optic_tv_contact_color.csv", LookupColor),
        ("optic_tv_contact_mater.csv", LookupContactEyeMaterial),
        ("optic_tv_clean_sol.csv", LookupCleaningSolution),
        ("optic_tv_dis_sol.csv", LookupDisinfectionSolution),
        ("optic_tv_wash_sol.csv", LookupRinsingSolution),
        ("optic_tv_order_type.csv", LookupOrderType),
        ("account_tv_memo_type.csv", LookupReferralType),
    ]
    for filename, model in simple_mappings:
        rows = read_csv(csv_dir, filename)
        print(f"[lookups] {filename}: {len(rows)} rows", flush=True)
        for r in rows:
            name = (r.get("name") or "").strip()
            upsert_lookup_simple(db, model, name)
    print(f"[lookups] done in {time.time()-t0:.2f}s", flush=True)


def collect_branch_codes(csv_dir: str) -> List[str]:
    codes: List[str] = []
    seen = set()
    for r in read_csv_streaming(csv_dir, "account.csv"):
        bc = r.get("branch_code")
        if bc and bc not in seen:
            codes.append(bc)
            seen.add(bc)
    print(f"[accounts] distinct branch codes: {len(codes)}", flush=True)
    return codes


def migrate_clients_and_families(db: Session, csv_dir: str, company: Company, return_only: bool = False, target_clinic_id: Optional[int] = None) -> Tuple[Dict[str, int], Dict[str, int]]:
    # Returns: account_code -> client_id, head_of_family -> family_id
    t0 = time.time()
    account_to_client: Dict[str, int] = {}
    head_to_family: Dict[str, int] = {}
    row_count = 0

    if return_only:
        print("[accounts] return_only mode enabled — mapping existing clients", flush=True)
        all_clients = db.execute(select(Client)).scalars().all()
        by_national_id: Dict[str, List[Client]] = {}
        by_email: Dict[str, List[Client]] = {}
        by_mobile: Dict[str, List[Client]] = {}
        by_home: Dict[str, List[Client]] = {}
        by_work: Dict[str, List[Client]] = {}
        by_name_dob: Dict[Tuple[str, str, Optional[datetime.date]], List[Client]] = {}

        def norm_phone(s: Optional[str]) -> Optional[str]:
            if not s:
                return None
            digits = "".join(ch for ch in str(s) if ch.isdigit())
            return digits or None

        def norm_email(s: Optional[str]) -> Optional[str]:
            if not s:
                return None
            s2 = str(s).strip().lower()
            return s2 or None

        for c in all_clients:
            if c.national_id:
                by_national_id.setdefault(c.national_id, []).append(c)
            em = norm_email(c.email)
            if em:
                by_email.setdefault(em, []).append(c)
            m = norm_phone(c.phone_mobile)
            if m:
                by_mobile.setdefault(m, []).append(c)
            h = norm_phone(c.phone_home)
            if h:
                by_home.setdefault(h, []).append(c)
            w = norm_phone(c.phone_work)
            if w:
                by_work.setdefault(w, []).append(c)
            fn = (c.first_name or "").strip()
            ln = (c.last_name or "").strip()
            key = (fn, ln, c.date_of_birth)
            by_name_dob.setdefault(key, []).append(c)

        def find_client_for_row(r: Dict[str, Any]) -> Optional[Client]:
            nid = (r.get("id_number") or None)
            if nid and nid in by_national_id:
                return by_national_id[nid][0]
            em = norm_email(r.get("e_mail"))
            if em and em in by_email:
                return by_email[em][0]
            m = norm_phone(r.get("mobile_phone"))
            if m and m in by_mobile:
                return by_mobile[m][0]
            h = norm_phone(r.get("phone1"))
            if h and h in by_home:
                return by_home[h][0]
            w = norm_phone(r.get("phone2"))
            if w and w in by_work:
                return by_work[w][0]
            fn = (r.get("first_name") or "").strip()
            ln = (r.get("last_name") or "").strip()
            dob = parse_date(r.get("birth_date"))
            key = (fn, ln, dob)
            if fn or ln:
                cand = by_name_dob.get(key)
                if cand:
                    return cand[0]
            return None

        rows_iter = read_csv_streaming(csv_dir, "account.csv")
        for r in rows_iter:
            row_count += 1
            if not is_client_account(r):
                continue
            acc = r.get("account_code")
            if acc is None:
                continue
            client = find_client_for_row(r)
            if client is None:
                continue
            account_to_client[str(acc)] = client.id

        rows_iter = read_csv_streaming(csv_dir, "account.csv")
        for r in rows_iter:
            if not is_client_account(r):
                continue
            head = r.get("head_of_family")
            if not head or head in head_to_family:
                continue
            acc_head = str(head)
            cid = account_to_client.get(acc_head)
            if not cid:
                continue
            c = db.get(Client, cid)
            if c and c.family_id:
                head_to_family[acc_head] = c.family_id

        print(f"[accounts] mapped existing clients: {len(account_to_client)} from {row_count} rows in {time.time()-t0:.2f}s", flush=True)
        return account_to_client, head_to_family

    # Create clinics first based on branch codes present
    branch_to_clinic: Dict[str, int] = {}
    if target_clinic_id is not None:
        branch_codes = collect_branch_codes(csv_dir)
        for bc in branch_codes:
            branch_to_clinic[bc] = target_clinic_id
        print(f"[accounts] mapping all branch codes to target clinic {target_clinic_id}", flush=True)
    else:
        for bc in collect_branch_codes(csv_dir):
            clinic = get_or_create_clinic(db, company, bc)
            branch_to_clinic[bc] = clinic.id
        print(f"[accounts] clinics created/ensured: {len(branch_to_clinic)}", flush=True)

    # Pre-compute a preferred last name per head_of_family for naming the family
    # Preference: if a row's account_code equals head_of_family and has last_name -> priority 0
    # Otherwise any row in that head group with last_name -> priority 1
    head_name_pref: Dict[str, Tuple[int, str]] = {}
    rows_iter = read_csv_streaming(csv_dir, "account.csv")
    for r in rows_iter:
        row_count += 1
        if not is_client_account(r):
            continue
        head = r.get("head_of_family")
        if head:
            head = str(head).strip()
        if not head:
            continue
        last_name = (r.get("last_name") or "").strip()
        if not last_name:
            continue
        priority = 1
        try:
            if str(r.get("account_code")).strip() == head:
                priority = 0
        except Exception:
            priority = 1
        current = head_name_pref.get(head)
        if current is None or priority < current[0]:
            head_name_pref[head] = (priority, last_name)
    print(f"[accounts] total rows: {row_count}", flush=True)

    # First pass: create families by head_of_family
    family_count = 0
    pending = 0
    batch_families: List[Tuple[Family, str]] = []
    rows_iter = read_csv_streaming(csv_dir, "account.csv")
    for r in rows_iter:
        if not is_client_account(r):
            continue
        head = r.get("head_of_family")
        if head:
            head = str(head).strip()
        if head and head not in head_to_family:
            clinic_id = branch_to_clinic.get(r.get("branch_code"))
            # Use preferred last name for family name
            family_last = None
            pref = head_name_pref.get(head)
            if pref:
                family_last = pref[1]
            if not family_last:
                family_last = (r.get("last_name") or "").strip()
            family_name = family_last if family_last else "משפחה"
            fam = Family(
                company_id=company.id,
                clinic_id=clinic_id,
                name=family_name,
                notes="Migrated family",
            )
            batch_families.append((fam, head))
            pending += 1
            if pending % 5000 == 0:
                families_only = [f[0] for f in batch_families]
                db.bulk_save_objects(families_only, return_defaults=True)
                db.flush()
                for fam_obj, head_val in batch_families:
                    head_to_family[head_val] = fam_obj.id
                batch_families.clear()
                pending = 0
            family_count += 1
            if family_count % 1000 == 0:
                print(f"[accounts] families created: {family_count}", flush=True)
    if batch_families:
        families_only = [f[0] for f in batch_families]
        db.bulk_save_objects(families_only, return_defaults=True)
        db.flush()
        for fam_obj, head_val in batch_families:
            head_to_family[head_val] = fam_obj.id
    db.commit()

    # Second pass: create clients
    client_count = 0
    pending = 0
    batch_clients: List[Tuple[Dict[str, Any], str, int]] = []
    rows_iter = read_csv_streaming(csv_dir, "account.csv")
    batch_size = min(30000, int(os.environ.get("CSV_MAX_ROWS", "5000")))
    try:
        for r in rows_iter:
            if not is_client_account(r):
                continue
            bc = r.get("branch_code")
            clinic_id = branch_to_clinic.get(bc)

            gender = None
            sx = (r.get("sex") or "").strip()
            if sx == "1":
                gender = "male"
            elif sx == "2":
                gender = "female"

            address_number = None
            house_num = r.get("house_num")
            apt = r.get("apartment_num")
            if house_num:
                address_number = str(house_num)
                if apt:
                    address_number = f"{address_number}/{apt}"

            raw_account_code = r.get("account_code")
            if raw_account_code is None:
                continue
            account_code = str(raw_account_code).strip()
            if not account_code:
                continue
            
            try:
                composite_id = create_composite_client_id(clinic_id, account_code)
            except ValueError as e:
                print(f"[accounts] Skipping account_code '{account_code}': {e}", flush=True)
                continue
            
            client_dict = {
                "id": composite_id,
                "company_id": company.id,
                "clinic_id": clinic_id,
                "first_name": r.get("first_name") or None,
                "last_name": r.get("last_name") or None,
                "gender": gender,
                "national_id": r.get("id_number") or None,
                "date_of_birth": parse_date(r.get("birth_date")),
                "address_city": r.get("city") or None,
                "address_street": r.get("street") or None,
                "address_number": address_number,
                "postal_code": r.get("zip_code") or None,
                "phone_home": r.get("phone1") or None,
                "phone_work": r.get("phone2") or None,
                "phone_mobile": r.get("mobile_phone") or None,
                "email": r.get("e_mail") or None,
                "price_list": None,
                "discount_percent": parse_int(r.get("discount_precent")) or 0,
                "blocked_checks": parse_bool_flag(r.get("check_blocked")),
                "blocked_credit": parse_bool_flag(r.get("credit_blocked")),
                "sorting_group": r.get("acc_sort_group") or None,
                "file_creation_date": parse_date(r.get("open_date")),
                "occupation": r.get("occupation") or None,
                "status": r.get("account_status") or None,
                "notes": r.get("remarks") or None,
                "file_location": r.get("file_location") or None,
                "family_id": head_to_family.get(str(r.get("head_of_family")).strip() if r.get("head_of_family") else None),
            }
            batch_clients.append((client_dict, account_code, composite_id))
            pending += 1
            if pending % batch_size == 0:
                print(f"[accounts] flushing batch of {len(batch_clients)} clients", flush=True)
                clients_dicts = [c[0] for c in batch_clients]
                db.bulk_insert_mappings(Client, clients_dicts)
                db.flush()
                
                for _, acc_code, comp_id in batch_clients:
                    account_to_client[acc_code] = comp_id
                
                batch_clients.clear()
                pending = 0
            client_count += 1
            if client_count % 1000 == 0:
                print(f"[accounts] clients created: {client_count}", flush=True)
    finally:
        if batch_clients:
            print(f"[accounts] flushing final batch of {len(batch_clients)} clients", flush=True)
            clients_dicts = [c[0] for c in batch_clients]
            db.bulk_insert_mappings(Client, clients_dicts)
            db.flush()
            print(f"[accounts] mapping {len(batch_clients)} client IDs", flush=True)
            
            for _, acc_code, comp_id in batch_clients:
                account_to_client[acc_code] = comp_id
            
            print(f"[accounts] committing final batch", flush=True)
        db.commit()
        print(f"[accounts] commit completed", flush=True)
        
        try:
            max_id_result = db.execute(text("SELECT MAX(id) FROM clients")).scalar()
            max_id = max_id_result if max_id_result else 0
            if max_id > 0:
                db.execute(text(f"SELECT setval('clients_id_seq', {max_id})"))
                db.commit()
                print(f"[accounts] Updated clients_id_seq to {max_id}", flush=True)
        except Exception as e:
            print(f"[accounts] Warning: Could not update sequence: {e}", flush=True)

    print(f"[accounts] families: {family_count}, clients: {client_count}, took {time.time()-t0:.2f}s", flush=True)
    return account_to_client, head_to_family


def migrate_optical_exams(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int):
    t0 = time.time()
    valid_account_codes = set(account_to_client.keys())
    sample_mapping_keys = list(valid_account_codes)[:5] if valid_account_codes else []
    print(f"[exams] filtering exams to {len(valid_account_codes)} valid account codes, sample keys: {sample_mapping_keys}", flush=True)
    expanded_rows = load_expanded_eye_tests(csv_dir, valid_account_codes)
    print(f"[exams] loaded {len(expanded_rows)} expanded exam rows", flush=True)
    
    clinic_to_layout: Dict[int, int] = {}

    count = 0
    pending = 0
    batch_exams: List[Tuple[OpticalExam, Dict[str, Any], Optional[int]]] = []
    batch_instances: List[ExamLayoutInstance] = []
    rows_iter = read_csv_streaming(csv_dir, "optic_eye_tests.csv")
    skipped_count = 0
    sample_missing_codes = []
    for r in rows_iter:
        raw_account_code = r.get("account_code")
        if raw_account_code is None:
            skipped_count += 1
            if len(sample_missing_codes) < 5:
                sample_missing_codes.append(("None", "missing"))
            continue
        account_code = str(raw_account_code).strip()
        if not account_code:
            skipped_count += 1
            if len(sample_missing_codes) < 5:
                sample_missing_codes.append((str(raw_account_code), "empty_after_strip"))
            continue
        if account_code not in valid_account_codes:
            skipped_count += 1
            if len(sample_missing_codes) < 5:
                sample_missing_codes.append((account_code, "not_in_mapping"))
            continue
        client_id = account_to_client[account_code]
        if client_id is None:
            skipped_count += 1
            if len(sample_missing_codes) < 5:
                sample_missing_codes.append((account_code, "null_client_id"))
            continue

        branch_code = r.get("branch_code") or None
        clinic_id = None
        if branch_code and branch_code in branch_to_clinic:
            clinic_id = branch_to_clinic[branch_code]

        exam_date = parse_date(r.get("test_date"))
        exam_code_value = r.get("code")
        expanded_row = None
        if exam_code_value is not None:
            expanded_row = expanded_rows.get(str(exam_code_value).strip())
        
        dominant_eye_raw = r.get("dominant_eye")
        dominant_eye = None
        if dominant_eye_raw:
            dominant_eye_str = str(dominant_eye_raw).strip().upper()
            if dominant_eye_str in ("R", "L", "RIGHT", "LEFT"):
                dominant_eye = "R" if dominant_eye_str in ("R", "RIGHT") else "L"
        
        test_reason = r.get("test_reason")
        test_name = "Migrated Exam"
        if test_reason:
            test_reason_str = str(test_reason).strip()
            if test_reason_str:
                test_name = test_reason_str

        exam = OpticalExam(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user_id,
            exam_date=exam_date,
            test_name=test_name,
            dominant_eye=dominant_eye,
            type="exam",
        )
        data = build_exam_data_from_eye_tests(r, expanded_row)
        batch_exams.append((exam, data, clinic_id))
        pending += 1
        if pending % 5000 == 0:
            exams_only = [e[0] for e in batch_exams if e[0].client_id is not None]
            if exams_only:
                db.bulk_save_objects(exams_only, return_defaults=True)
                db.flush()
                saved_exams = set(exams_only)
                for exam_obj, exam_data, exam_clinic_id in batch_exams:
                    if exam_obj not in saved_exams:
                        continue
                    if exam_clinic_id:
                        if exam_clinic_id not in clinic_to_layout:
                            clinic = db.get(Clinic, exam_clinic_id)
                            layout = get_or_create_default_exam_layout(db, clinic)
                            clinic_to_layout[exam_clinic_id] = layout.id
                        layout_id = clinic_to_layout[exam_clinic_id]
                    else:
                        if None not in clinic_to_layout:
                            layout = get_or_create_default_exam_layout(db, None)
                            clinic_to_layout[None] = layout.id
                        layout_id = clinic_to_layout[None]
                    layout_instance = ExamLayoutInstance(
                        exam_id=exam_obj.id,
                        layout_id=layout_id,
                        is_active=True,
                        order=0,
                        exam_data=exam_data,
                    )
                    batch_instances.append(layout_instance)
            db.bulk_save_objects(batch_instances, return_defaults=True)
            db.flush()
            batch_exams.clear()
            batch_instances.clear()
            pending = 0

        count += 1
        if count % 500 == 0:
            print(f"[exams] processed: {count}", flush=True)
    if batch_exams:
        exams_only = [e[0] for e in batch_exams if e[0].client_id is not None]
        if exams_only:
            db.bulk_save_objects(exams_only, return_defaults=True)
            db.flush()
            saved_exams = set(exams_only)
            for exam_obj, exam_data, exam_clinic_id in batch_exams:
                if exam_obj not in saved_exams:
                    continue
                if exam_clinic_id:
                    if exam_clinic_id not in clinic_to_layout:
                        clinic = db.get(Clinic, exam_clinic_id)
                        layout = get_or_create_default_exam_layout(db, clinic)
                        clinic_to_layout[exam_clinic_id] = layout.id
                    layout_id = clinic_to_layout[exam_clinic_id]
                else:
                    if None not in clinic_to_layout:
                        layout = get_or_create_default_exam_layout(db, None)
                        clinic_to_layout[None] = layout.id
                    layout_id = clinic_to_layout[None]
                layout_instance = ExamLayoutInstance(
                    exam_id=exam_obj.id,
                    layout_id=layout_id,
                    is_active=True,
                    order=0,
                    exam_data=exam_data,
                )
                batch_instances.append(layout_instance)
            if batch_instances:
                db.bulk_save_objects(batch_instances, return_defaults=True)
    db.commit()
    debug_msg = ""
    if sample_missing_codes:
        debug_msg = f", sample missing codes: {sample_missing_codes[:3]}"
    print(f"[exams] inserted total: {count}, skipped: {skipped_count}{debug_msg}, took {time.time()-t0:.2f}s", flush=True)


def migrate_contact_lens_orders(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int) -> Dict[str, int]:
    t0 = time.time()
    valid_account_codes = set(account_to_client.keys())
    print(f"[cl_orders] filtering orders to {len(valid_account_codes)} valid account codes", flush=True)
    rows_iter = read_csv_streaming(csv_dir, "optic_contact_presc.csv")
    presc_code_to_order_id: Dict[str, int] = {}
    count = 0
    skipped_count = 0
    pending = 0
    for r in rows_iter:
        raw_account_code = r.get("account_code")
        if raw_account_code is None:
            skipped_count += 1
            continue
        account_code = str(raw_account_code).strip()
        if not account_code or account_code not in valid_account_codes:
            skipped_count += 1
            continue
        client_id = account_to_client[account_code]
        if client_id is None:
            skipped_count += 1
            continue
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        order_date = parse_date(r.get("presc_date"))

        supply_branch = r.get("supply_branch")
        supply_in_clinic_id = branch_to_clinic.get(supply_branch) if supply_branch in (branch_to_clinic or {}) else None

        order_status = clean_legacy_text(r.get("order_status"))
        advisor = clean_legacy_text(r.get("advisor_code"))
        priority = clean_legacy_text(r.get("order_iner_priority"))
        approval_date = parse_date(r.get("given_at"))
        guaranteed_date = parse_date(r.get("promise_to_date"))
        cleaning_solution = clean_legacy_text(r.get("clean_sol"))
        disinfection_solution = clean_legacy_text(r.get("dis_sol"))
        rinsing_solution = clean_legacy_text(r.get("wash_sol"))
        notes = clean_legacy_text(r.get("order_remarks"))
        supplier_notes = clean_legacy_text(r.get("presc_remark"))

        l_lens_type = clean_legacy_text(r.get("left_type"))
        l_model = clean_legacy_text(r.get("left_model"))
        l_supplier = clean_legacy_text(r.get("left_manuf"))
        l_material = clean_legacy_text(r.get("left_mater"))
        l_color = clean_legacy_text(r.get("left_color"))
        l_quantity = parse_int(r.get("left_qty"))
        l_order_quantity = parse_int(r.get("left_order_qty"))
        r_lens_type = clean_legacy_text(r.get("right_type"))
        r_model = clean_legacy_text(r.get("right_model"))
        r_supplier = clean_legacy_text(r.get("right_manuf"))
        r_material = clean_legacy_text(r.get("right_mater"))
        r_color = clean_legacy_text(r.get("right_color"))
        r_quantity = parse_int(r.get("right_qty"))
        r_order_quantity = parse_int(r.get("right_order_qty"))
        
        treatment_type = r.get("treatment_type")
        order_type = "contact_lens"
        if treatment_type:
            treatment_type_str = str(treatment_type).strip()
            if treatment_type_str:
                order_type = treatment_type_str

        order = ContactLensOrder(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user_id,
            order_date=order_date,
            type=order_type,
            l_lens_type=l_lens_type,
            l_model=l_model,
            l_supplier=l_supplier,
            l_material=l_material,
            l_color=l_color,
            l_quantity=l_quantity,
            l_order_quantity=l_order_quantity,
            r_lens_type=r_lens_type,
            r_model=r_model,
            r_supplier=r_supplier,
            r_material=r_material,
            r_color=r_color,
            r_quantity=r_quantity,
            r_order_quantity=r_order_quantity,
            order_status=order_status,
            advisor=advisor,
            supply_in_clinic_id=supply_in_clinic_id,
            priority=priority,
            guaranteed_date=guaranteed_date,
            approval_date=approval_date,
            cleaning_solution=cleaning_solution,
            disinfection_solution=disinfection_solution,
            rinsing_solution=rinsing_solution,
            notes=notes,
            supplier_notes=supplier_notes,
        )
        data: Dict[str, Any] = {}

        order_block = {
            "cleaning_solution": cleaning_solution,
            "disinfection_solution": disinfection_solution,
            "rinsing_solution": rinsing_solution,
            "priority": priority,
            "approval_date": to_iso_date_string(r.get("given_at")),
            "promise_to_date": to_iso_date_string(r.get("promise_to_date")),
            "order_status": order_status,
            "advisor": advisor,
            "notes": notes,
        }
        if any(v is not None for v in order_block.values()):
            data["contact-lens-order"] = order_block

        details_block = {
            "l_lens_type": l_lens_type,
            "l_model": l_model,
            "l_supplier": l_supplier,
            "l_material": l_material,
            "l_color": l_color,
            "l_quantity": l_quantity,
            "l_order_quantity": l_order_quantity,
            "r_lens_type": r_lens_type,
            "r_model": r_model,
            "r_supplier": r_supplier,
            "r_material": r_material,
            "r_color": r_color,
            "r_quantity": r_quantity,
            "r_order_quantity": r_order_quantity,
        }
        if any(v is not None for v in details_block.values()):
            data["contact-lens-details"] = details_block

        exam_block = {
            "l_bc": parse_optical_float(r.get("left_bc1")),
            "l_bc_2": parse_optical_float(r.get("left_bc2")),
            "l_oz": clean_legacy_text(r.get("left_oz")),
            "l_diam": parse_float(r.get("left_diam")),
            "l_sph": parse_optical_float(r.get("left_sph")),
            "l_cyl": parse_optical_float(r.get("left_cyl")),
            "l_ax": parse_int(r.get("left_ax")),
            "l_va": clean_legacy_text(r.get("left_va")),
            "l_read_ad": parse_float(r.get("left_read")),
            "l_j": clean_legacy_text(r.get("left_j")),
            "r_bc": parse_optical_float(r.get("right_bc1")),
            "r_bc_2": parse_optical_float(r.get("right_bc2")),
            "r_oz": clean_legacy_text(r.get("right_oz")),
            "r_diam": parse_float(r.get("right_diam")),
            "r_sph": parse_optical_float(r.get("right_sph")),
            "r_cyl": parse_optical_float(r.get("right_cyl")),
            "r_ax": parse_int(r.get("right_ax")),
            "r_va": clean_legacy_text(r.get("right_va")),
            "r_read_ad": parse_float(r.get("right_read")),
            "r_j": clean_legacy_text(r.get("right_j")),
            "comb_va": parse_float(r.get("mid_va")),
        }
        if any(v is not None for v in exam_block.values()):
            data["contact-lens-exam"] = exam_block

        ker_block = {
            "l_rv": parse_float(r.get("cr_left_rv")),
            "l_rh": parse_float(r.get("cr_left_rh")),
            "l_avg": parse_float(r.get("cr_left_avg")),
            "l_cyl": parse_float(r.get("cr_left_cyl")),
            "l_ax": parse_int(r.get("cr_left_ax")),
            "l_ecc": parse_float(r.get("cr_left_ecc")),
            "r_rv": parse_float(r.get("cr_right_rv")),
            "r_rh": parse_float(r.get("cr_right_rh")),
            "r_avg": parse_float(r.get("cr_right_avg")),
            "r_cyl": parse_float(r.get("cr_right_cyl")),
            "r_ax": parse_int(r.get("cr_right_ax")),
            "r_ecc": parse_float(r.get("cr_right_ecc")),
        }
        if any(v is not None for v in ker_block.values()):
            data["keratometer-contact-lens"] = ker_block

        schirmer_block = {
            "r_mm": parse_float(r.get("sirmer_right")),
            "r_but": parse_float(r.get("sirmer_right_but")),
            "l_mm": parse_float(r.get("sirmer_left")),
            "l_but": parse_float(r.get("sirmer_left_but")),
        }
        if any(v is not None for v in schirmer_block.values()):
            data["schirmer-test"] = schirmer_block

        diam_block = {
            "corneal_diameter": parse_float(r.get("cornia_diam")),
            "pupil_diameter": parse_float(r.get("pupil_diameter")) if r.get("pupil_diameter") not in (None, "") else parse_float(r.get("pupil_distance")),
        }
        if any(v is not None for v in diam_block.values()):
            data["contact-lens-diameters"] = diam_block

        if data:
            order.order_data = data
        db.add(order)
        pending += 1
        if pending % 500 == 0:
            db.flush()
            pending = 0
        db.flush()
        code = str(r.get("code")) if r.get("code") else None
        if code:
            presc_code_to_order_id[code] = order.id

        try:
            total_sum = parse_float(r.get("total_sum"))
            discount_sum = parse_float(r.get("discount_sum"))
            advance_sum = parse_float(r.get("advance_sum"))
            num_payments = parse_int(r.get("num_payments"))
            if any(v is not None for v in (total_sum, discount_sum, advance_sum, num_payments)):
                billing = Billing(
                    order_id=None,
                    contact_lens_id=order.id,
                    total_before_discount=(total_sum + (discount_sum or 0.0)) if total_sum is not None else None,
                    discount_amount=discount_sum,
                    discount_percent=None,
                    total_after_discount=total_sum,
                    prepayment_amount=advance_sum,
                    installment_count=num_payments,
                    notes=r.get("order_remarks") or None,
                )
                db.add(billing)
                db.flush()

                right_price = parse_float(r.get("right_lens_price"))
                left_price = parse_float(r.get("left_lens_price"))
                rl_discount = parse_float(r.get("rlens_discount"))
                ll_discount = parse_float(r.get("llens_discount"))
                right_qty = parse_int(r.get("right_qty")) or 0
                left_qty = parse_int(r.get("left_qty")) or 0

                if right_price is not None and right_qty > 0:
                    oli = OrderLineItem(
                        billings_id=billing.id,
                        sku=None,
                        description=r.get("right_model") or r.get("right_type") or "Right lens",
                        supplied_by=r.get("right_manuf") or None,
                        supplied=None,
                        price=right_price,
                        quantity=float(right_qty),
                        discount=rl_discount,
                        line_total=(right_price * float(right_qty)) - (rl_discount or 0.0),
                    )
                    db.add(oli)

                if left_price is not None and left_qty > 0:
                    oli = OrderLineItem(
                        billings_id=billing.id,
                        sku=None,
                        description=r.get("left_model") or r.get("left_type") or "Left lens",
                        supplied_by=r.get("left_manuf") or None,
                        supplied=None,
                        price=left_price,
                        quantity=float(left_qty),
                        discount=ll_discount,
                        line_total=(left_price * float(left_qty)) - (ll_discount or 0.0),
                    )
                    db.add(oli)
        except Exception:
            pass
        count += 1
        if count % 1000 == 0:
            print(f"[cl_orders] inserted: {count}", flush=True)
    db.commit()
    print(f"[cl_orders] inserted total: {count}, skipped: {skipped_count}, took {time.time()-t0:.2f}s", flush=True)
    return presc_code_to_order_id


def migrate_regular_orders(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int):
    t0 = time.time()
    rows_iter = read_csv_streaming(csv_dir, "optic_glasses_presc.csv")
    count = 0
    skipped_count = 0

    for r in rows_iter:
        account_code = clean_legacy_text(r.get("account_code"))
        if not account_code or account_code not in account_to_client:
            skipped_count += 1
            continue

        client_id = account_to_client[account_code]
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        order_date = parse_date(r.get("presc_date"))
        dominant_eye_raw = clean_legacy_text(r.get("dominant_eye"))
        dominant_eye = dominant_eye_raw.upper() if dominant_eye_raw and dominant_eye_raw.upper() in {"R", "L"} else None
        order_type = clean_legacy_text(r.get("order_type")) or clean_legacy_text(r.get("glasses_function")) or "glasses"

        frame_width, frame_bridge, frame_height = parse_frame_dimensions(r.get("frame_size"))

        final_prescription = {
            "r_sph": parse_optical_float(r.get("right_sph")),
            "l_sph": parse_optical_float(r.get("left_sph")),
            "r_cyl": parse_optical_float(r.get("right_cyl")),
            "l_cyl": parse_optical_float(r.get("left_cyl")),
            "r_ax": parse_int(r.get("right_ax")),
            "l_ax": parse_int(r.get("left_ax")),
            "r_pris": parse_float(r.get("right_pris")),
            "l_pris": parse_float(r.get("left_pris")),
            "r_base": clean_legacy_text(r.get("right_base")),
            "l_base": clean_legacy_text(r.get("left_base")),
            "r_va": parse_visual_acuity(r.get("right_va")),
            "l_va": parse_visual_acuity(r.get("left_va")),
            "r_ad": parse_float(r.get("right_add")) if clean_legacy_text(r.get("right_add")) else parse_float(r.get("right_read")),
            "l_ad": parse_float(r.get("left_add")) if clean_legacy_text(r.get("left_add")) else parse_float(r.get("left_read")),
            "r_pd": parse_float(r.get("right_pd")),
            "l_pd": parse_float(r.get("left_pd")),
            "r_high": parse_float(r.get("right_high")),
            "l_high": parse_float(r.get("left_high")),
            "r_diam": parse_float(r.get("right_diam")),
            "l_diam": parse_float(r.get("left_diam")),
            "comb_va": parse_visual_acuity(r.get("mid_va")),
            "comb_pd": parse_float(r.get("pd_far")),
            "comb_high": None,
        }

        lens = {
            "right_model": clean_legacy_text(r.get("lens_model_right")),
            "left_model": clean_legacy_text(r.get("lens_model_left")),
            "color": clean_legacy_text(r.get("lens_color")),
            "coating": clean_legacy_text(r.get("lens_coat")),
            "material": clean_legacy_text(r.get("lens_mater")),
            "supplier": clean_legacy_text(r.get("lens_supplier")),
        }

        frame = {
            "color": clean_legacy_text(r.get("frame_color")),
            "supplier": clean_legacy_text(r.get("frame_supplier")),
            "model": clean_legacy_text(r.get("frame_model")),
            "manufacturer": clean_legacy_text(r.get("frame_manuf")),
            "supplied_by": clean_legacy_text(r.get("frame_supply_by")),
            "bridge": frame_bridge if frame_bridge is not None else parse_float(r.get("frame_bridge")),
            "width": frame_width if frame_width is not None else parse_float(r.get("frame_width")),
            "height": frame_height if frame_height is not None else parse_float(r.get("frame_height")),
            "length": parse_float(r.get("frame_length")),
        }

        notes = clean_legacy_text(r.get("order_remarks")) or clean_legacy_text(r.get("presc_remark"))
        lens_order_notes = clean_legacy_text(r.get("presc_remark"))
        details = {
            "branch": clean_legacy_text(r.get("current_branch")) or clean_legacy_text(r.get("branch_code")),
            "supplier_status": clean_legacy_text(r.get("lab_status")),
            "bag_number": clean_legacy_text(r.get("bag_number")),
            "advisor": clean_legacy_text(r.get("advisor_code")),
            "delivered_by": clean_legacy_text(r.get("giver_code")),
            "technician": clean_legacy_text(r.get("tech_code")),
            "delivered_at": to_iso_date_string(r.get("delivere_date")),
            "warranty_expiration": to_iso_date_string(r.get("end_of_warranty")),
            "delivery_location": clean_legacy_text(r.get("supply_branch")),
            "manufacturing_lab": clean_legacy_text(r.get("manuf_branch")),
            "order_status": clean_legacy_text(r.get("order_status")),
            "priority": clean_legacy_text(r.get("order_iner_priority")),
            "promised_date": to_iso_date_string(r.get("promise_to_date")),
            "approval_date": to_iso_date_string(r.get("confirmation_date")),
            "notes": notes,
            "lens_order_notes": lens_order_notes,
        }

        order_data: Dict[str, Any] = {}
        if any(v is not None for v in final_prescription.values()):
            order_data["final-prescription"] = final_prescription
        if any(v is not None for v in lens.values()):
            order_data["lens"] = lens
        if any(v is not None for v in frame.values()):
            order_data["frame"] = frame
        if any(v is not None for v in details.values()):
            order_data["details"] = details

        order = Order(
            client_id=client_id,
            clinic_id=clinic_id,
            order_date=order_date,
            type=order_type,
            dominant_eye=dominant_eye,
            user_id=admin_user_id,
            order_data=order_data,
        )
        db.add(order)
        db.flush()

        total_sum = parse_float(r.get("total_sum"))
        discount_sum = parse_float(r.get("discount_sum"))
        advance_sum = parse_float(r.get("advance_sum"))
        num_payments = parse_int(r.get("num_payments"))

        if any(v is not None for v in (total_sum, discount_sum, advance_sum, num_payments)):
            billing = Billing(
                order_id=order.id,
                total_before_discount=(total_sum + (discount_sum or 0.0)) if total_sum is not None else None,
                discount_amount=discount_sum,
                discount_percent=None,
                total_after_discount=total_sum,
                prepayment_amount=advance_sum,
                installment_count=num_payments,
                notes=notes,
            )
            db.add(billing)
            db.flush()

            line_items = [
                (
                    clean_legacy_text(r.get("lens_model_right")) or clean_legacy_text(r.get("right_lens_type")) or "Right lens",
                    clean_legacy_text(r.get("lens_supplier")),
                    parse_float(r.get("right_lens_price")),
                    1.0,
                    parse_float(r.get("rlens_discount")),
                ),
                (
                    clean_legacy_text(r.get("lens_model_left")) or clean_legacy_text(r.get("left_lens_type")) or "Left lens",
                    clean_legacy_text(r.get("lens_supplier")),
                    parse_float(r.get("left_lens_price")),
                    1.0,
                    parse_float(r.get("llens_discount")),
                ),
                (
                    clean_legacy_text(r.get("frame_model")) or "Frame",
                    clean_legacy_text(r.get("frame_supplier")),
                    parse_float(r.get("frame_price")),
                    1.0,
                    parse_float(r.get("frame_discount")),
                ),
                (
                    "Supplements",
                    None,
                    parse_float(r.get("supplements_price")),
                    1.0,
                    None,
                ),
            ]

            for description, supplied_by, price, quantity, discount in line_items:
                if price is None:
                    continue
                db.add(
                    OrderLineItem(
                        billings_id=billing.id,
                        sku=None,
                        description=description,
                        supplied_by=supplied_by,
                        supplied=None,
                        price=price,
                        quantity=quantity,
                        discount=discount,
                        line_total=(price * quantity) - (discount or 0.0),
                    )
                )

        count += 1
        if count % 1000 == 0:
            print(f"[orders] inserted: {count}", flush=True)

    db.commit()
    print(f"[orders] inserted total: {count}, skipped: {skipped_count}, took {time.time()-t0:.2f}s", flush=True)


def enrich_from_contact_lens_chk(db: Session, csv_dir: str, account_to_client: Dict[str, int], presc_code_to_order_id: Dict[str, int]):
    t0 = time.time()
    rows_iter = read_csv_streaming(csv_dir, "optic_contact_lens_chk.csv")
    updated_exams = 0
    updated_orders = 0
    for r in rows_iter:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        presc_code = str(r.get("contact_presc_code")) if r.get("contact_presc_code") else None
        order = None
        order_date = None
        if presc_code and presc_code in presc_code_to_order_id:
            order = db.get(ContactLensOrder, presc_code_to_order_id[presc_code])
            if order:
                order_date = order.order_date

        date_guess = parse_date(r.get("last_action")) or order_date
        eye = (r.get("tested_eye") or "").strip().upper()

        exam = None
        if client_id:
            exams = db.execute(select(OpticalExam).where(OpticalExam.client_id == client_id)).scalars().all()
            if exams:
                if date_guess:
                    best = None
                    best_delta = None
                    for e in exams:
                        if e.exam_date is None:
                            continue
                        delta = abs((e.exam_date - date_guess).days)
                        if best is None or delta < best_delta:
                            best = e
                            best_delta = delta
                    exam = best
                else:
                    exam = exams[-1]

        if exam:
            li = db.execute(select(ExamLayoutInstance).where(ExamLayoutInstance.exam_id == exam.id)).scalars().first()
            if li:
                data = dict(li.exam_data or {})
                over = dict(data.get("over-refraction")) if data.get("over-refraction") else {}
                if eye == "R":
                    over.update({
                        "r_sph": parse_float(r.get("or_sph")),
                        "r_cyl": parse_float(r.get("or_cyl")),
                        "r_ax": parse_int(r.get("or_ax")),
                        "r_va": parse_float(r.get("chk_va")),
                        "r_add": parse_float(r.get("chk_add")),
                    })
                elif eye == "L":
                    over.update({
                        "l_sph": parse_float(r.get("or_sph")),
                        "l_cyl": parse_float(r.get("or_cyl")),
                        "l_ax": parse_int(r.get("or_ax")),
                        "l_va": parse_float(r.get("chk_va")),
                        "l_add": parse_float(r.get("chk_add")),
                    })
                if parse_float(r.get("chk_va")) is not None:
                    over["comb_va"] = parse_float(r.get("chk_va"))
                if any(v is not None for v in over.values()):
                    data["over-refraction"] = over
                    li.exam_data = data
                    db.add(li)
                    updated_exams += 1

        if order:
            data = dict(order.order_data or {})
            exam_block = dict(data.get("contact-lens-exam") or {})
            details_block = dict(data.get("contact-lens-details") or {})
            order_block = dict(data.get("contact-lens-order") or {})

            if eye == "R":
                exam_block.update({
                    "r_bc": r.get("lens_bc_1") or exam_block.get("r_bc"),
                    "r_bc_2": r.get("lens_bc_2") or exam_block.get("r_bc_2"),
                    "r_diam": parse_float(r.get("lens_diam")) if exam_block.get("r_diam") is None else exam_block.get("r_diam"),
                    "r_sph": parse_float(r.get("lens_sph")) if exam_block.get("r_sph") is None else exam_block.get("r_sph"),
                    "r_cyl": parse_float(r.get("lens_cyl")) if exam_block.get("r_cyl") is None else exam_block.get("r_cyl"),
                    "r_ax": parse_int(r.get("lens_ax")) if exam_block.get("r_ax") is None else exam_block.get("r_ax"),
                })
                if not details_block.get("r_lens_type"):
                    details_block["r_lens_type"] = r.get("lens_type") or None
                if not details_block.get("r_model"):
                    details_block["r_model"] = r.get("lens_model") or None
                if not details_block.get("r_supplier"):
                    details_block["r_supplier"] = r.get("lens_supplier") or None
            elif eye == "L":
                exam_block.update({
                    "l_bc": r.get("lens_bc_1") or exam_block.get("l_bc"),
                    "l_bc_2": r.get("lens_bc_2") or exam_block.get("l_bc_2"),
                    "l_diam": parse_float(r.get("lens_diam")) if exam_block.get("l_diam") is None else exam_block.get("l_diam"),
                    "l_sph": parse_float(r.get("lens_sph")) if exam_block.get("l_sph") is None else exam_block.get("l_sph"),
                    "l_cyl": parse_float(r.get("lens_cyl")) if exam_block.get("l_cyl") is None else exam_block.get("l_cyl"),
                    "l_ax": parse_int(r.get("lens_ax")) if exam_block.get("l_ax") is None else exam_block.get("l_ax"),
                })
                if not details_block.get("l_lens_type"):
                    details_block["l_lens_type"] = r.get("lens_type") or None
                if not details_block.get("l_model"):
                    details_block["l_model"] = r.get("lens_model") or None
                if not details_block.get("l_supplier"):
                    details_block["l_supplier"] = r.get("lens_supplier") or None

            notes_parts: List[str] = []
            if r.get("trial_sct"):
                notes_parts.append(str(r.get("trial_sct")))
            if r.get("chk_comment"):
                notes_parts.append(str(r.get("chk_comment")))
            if notes_parts:
                existing = order_block.get("notes") or ""
                joined = "; ".join([p for p in notes_parts if p])
                order_block["notes"] = (existing + ("; " if existing and joined else "") + joined) or None

            if exam_block:
                data["contact-lens-exam"] = exam_block
            if details_block:
                data["contact-lens-details"] = details_block
            if order_block:
                data["contact-lens-order"] = order_block
            order.order_data = data
            db.add(order)
            updated_orders += 1

    db.commit()
    print(f"[cl_chk] enriched exams: {updated_exams}, orders: {updated_orders}, took {time.time()-t0:.2f}s", flush=True)

def migrate_referrals(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int):
    t0 = time.time()
    rows_iter = read_csv_streaming(csv_dir, "optic_reference.csv")
    presc_rows = list(read_csv_streaming(csv_dir, "optic_presc_prices.csv"))
    print(f"[referrals] presc_rows: {len(presc_rows)}", flush=True)
    # Group prescription notes by presc_code
    presc_map: Dict[str, List[str]] = {}
    for pr in presc_rows:
        code = str(pr.get("presc_code")) if pr.get("presc_code") else None
        if not code:
            continue
        item_name = (pr.get("item_name") or "").strip()
        if not item_name:
            continue
        presc_map.setdefault(code, []).append(item_name)

    count = 0
    pending = 0
    for r in rows_iter:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        date = parse_date(r.get("reference_date"))
        recipient = r.get("address_to") or None
        notes = r.get("reference_remark") or None

        presc_code = str(r.get("presc_code")) if r.get("presc_code") else None
        prescription_notes = "; ".join(presc_map[presc_code]) if presc_code and presc_code in presc_map else None

        referral = Referral(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user_id,
            referral_notes=notes or "",
            prescription_notes=prescription_notes,
            date=date,
            type="general",
            recipient=recipient,
            referral_data={},
        )
        db.add(referral)
        pending += 1
        if pending % 1000 == 0:
            db.flush()
            pending = 0
        db.flush()

        # Attach prescription notes into referral_data if available
        if prescription_notes:
            referral.referral_data = {"prescription_notes": prescription_notes}
            db.add(referral)
        count += 1
        if count % 1000 == 0:
            print(f"[referrals] inserted: {count}", flush=True)
    db.commit()
    print(f"[referrals] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate_files(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int):
    t0 = time.time()
    file_blob_map = load_file_blob_map(csv_dir)
    rows_iter = read_csv_streaming(csv_dir, "account_files.csv")
    count = 0
    pending = 0
    batch: List[File] = []
    for r in rows_iter:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        upload_date = parse_date(r.get("file_date"))
        raw_filename = r.get("file_description")
        if raw_filename and raw_filename.strip():
            file_name = raw_filename.strip()
        else:
            # Use the original code as fallback if description is missing
            file_name = f"legacy-file-{r.get('code', 'unknown')}"
        notes = r.get("file_remark") or None
        file_code = clean_legacy_text(r.get("code")) or file_name
        saved_path, file_size, file_type, saved_name = write_legacy_blob_file(
            file_code,
            file_name,
            file_blob_map.get(file_code),
        )

        f = File(
            client_id=client_id,
            clinic_id=clinic_id,
            file_name=saved_name or file_name,
            file_path=saved_path or f"/legacy/{r.get('code') or file_name}",
            file_size=file_size,
            file_type=file_type,
            upload_date=datetime.combine(upload_date, datetime.min.time()) if upload_date else None,
            uploaded_by=admin_user_id,
            notes=notes,
        )
        batch.append(f)
        pending += 1
        if pending % 2000 == 0:
            db.bulk_save_objects(batch, return_defaults=True)
            db.flush()
            batch.clear()
        count += 1
        if count % 1000 == 0:
            print(f"[files] staged: {count}", flush=True)
    if batch:
        db.bulk_save_objects(batch, return_defaults=True)
    db.commit()
    print(f"[files] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate_medical_logs(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int):
    t0 = time.time()
    rows_iter = read_csv_streaming(csv_dir, "account_memos.csv")
    count = 0
    pending = 0
    batch_m: List[MedicalLog] = []
    for r in rows_iter:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        log_date = parse_date(r.get("memo_date"))
        log = r.get("memo_remark") or ""

        m = MedicalLog(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user_id,
            log_date=log_date,
            log=log,
        )
        batch_m.append(m)
        pending += 1
        if pending % 5000 == 0:
            db.bulk_save_objects(batch_m, return_defaults=True)
            db.flush()
            batch_m.clear()
        count += 1
        if count % 1000 == 0:
            print(f"[memos] staged: {count}", flush=True)
    if batch_m:
        db.bulk_save_objects(batch_m, return_defaults=True)
    db.commit()
    print(f"[memos] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)


def migrate_appointments(db: Session, csv_dir: str, account_to_client: Dict[str, int], branch_to_clinic: Dict[str, int], admin_user_id: int):
    t0 = time.time()
    rows_iter = read_csv_streaming(csv_dir, "diary_timetab.csv")
    count = 0
    pending = 0
    batch_a: List[Appointment] = []
    for r in rows_iter:
        account_code = str(r.get("account_code")) if r.get("account_code") else None
        if not account_code or account_code not in account_to_client:
            continue
        client_id = account_to_client[account_code]
        clinic_id = branch_to_clinic.get(r.get("branch_code"))
        date = parse_date(r.get("line_date"))
        time_str = (r.get("line_time") or "").strip() or None
        note = r.get("line_remark") or None

        app = Appointment(
            client_id=client_id,
            clinic_id=clinic_id,
            user_id=admin_user_id,
            date=date,
            time=time_str,
            duration=30,
            exam_name=None,
            note=note,
        )
        batch_a.append(app)
        pending += 1
        if pending % 5000 == 0:
            db.bulk_save_objects(batch_a, return_defaults=True)
            db.flush()
            batch_a.clear()
        count += 1
        if count % 1000 == 0:
            print(f"[appointments] staged: {count}", flush=True)
    if batch_a:
        db.bulk_save_objects(batch_a, return_defaults=True)
    db.commit()
    print(f"[appointments] inserted total: {count}, took {time.time()-t0:.2f}s", flush=True)

