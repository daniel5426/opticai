from .common import *
from .steps import *


def migrate(csv_dir: str, company_id: Optional[int] = None, clinic_id: Optional[int] = None):
    db = SessionLocal()
    try:
        # Optional performance mode for Postgres
        perf_mode = True
        return_only_clients = os.environ.get("RETURN_ONLY_CLIENTS", "0").lower() in ("1", "true", "yes", "y")
        if perf_mode:
            try:
                db.execute(text("SET synchronous_commit TO OFF"))
                # Bypass triggers/FKs for speed; ensure you trust input data
                db.execute(text("SET session_replication_role = replica"))
                db.commit()
                print("[perf] Enabled Postgres fast settings (synchronous_commit=off, replication_role=replica)")
            except Exception as e:
                print(f"[perf] Failed to enable fast settings: {e}")
        
        if clinic_id is not None:
            clinic = get_clinic_by_id(db, clinic_id)
            if not clinic:
                raise ValueError(f"Clinic with id {clinic_id} not found")
            if company_id is not None:
                if clinic.company_id != company_id:
                    raise ValueError(f"Clinic {clinic_id} does not belong to company {company_id}")
                company = get_company_by_id(db, company_id)
                if not company:
                    raise ValueError(f"Company with id {company_id} not found")
            else:
                company = get_company_by_id(db, clinic.company_id)
                if not company:
                    raise ValueError(f"Company with id {clinic.company_id} (from clinic) not found")
                company_id = company.id
            print(f"Using company: {company.name} (id: {company.id})")
            print(f"Using clinic: {clinic.name} (id: {clinic.id})")
        elif company_id is not None:
            company = get_company_by_id(db, company_id)
            if not company:
                raise ValueError(f"Company with id {company_id} not found")
            print(f"Using company: {company.name} (id: {company.id})")
            clinic = None
        else:
            company = get_or_create_company(db)
            print(f"Using/created company: {company.name} (id: {company.id})")
            clinic = None
        
        admin_user = get_or_create_admin_user(db, company)

        # Lookups first to satisfy FKs and choices
        migrate_lookups(db, csv_dir)

        # Clinics map (from accounts)
        branch_codes = collect_branch_codes(csv_dir)
        branch_to_clinic: Dict[str, int] = {}
        if clinic_id is not None:
            for bc in branch_codes:
                branch_to_clinic[bc] = clinic_id
            print(f"Mapping all branch codes to clinic {clinic_id}")
        else:
            for bc in branch_codes:
                clinic_obj = get_or_create_clinic(db, company, bc)
                branch_to_clinic[bc] = clinic_obj.id

        # Clients and families
        account_to_client, _ = migrate_clients_and_families(db, csv_dir, company, return_only=return_only_clients, target_clinic_id=clinic_id)
        print("Clients and families migrated")

        use_parallel = os.environ.get("MIGRATION_PARALLEL", "1").lower() in ("1", "true", "yes", "y")
        max_workers = int(os.environ.get("MIGRATION_WORKERS", "4"))
        
        if use_parallel and max_workers > 1:
            print(f"[parallel] Using {max_workers} workers for parallel migrations")
            
            def run_with_session(func, *args, **kwargs):
                session = SessionLocal()
                try:
                    if perf_mode:
                        try:
                            session.execute(text("SET synchronous_commit TO OFF"))
                            session.execute(text("SET session_replication_role = replica"))
                            session.commit()
                        except Exception:
                            pass
                    result = func(session, *args, **kwargs)
                    session.commit()
                    return result
                except Exception as e:
                    session.rollback()
                    raise e
                finally:
                    if perf_mode:
                        try:
                            session.execute(text("SET session_replication_role = origin"))
                            session.execute(text("SET synchronous_commit TO ON"))
                            session.commit()
                        except Exception:
                            pass
                    session.close()
            
            admin_user_id = admin_user.id
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_exams = executor.submit(
                    run_with_session,
                    migrate_optical_exams,
                    csv_dir, account_to_client, branch_to_clinic, admin_user_id
                )
                
                future_orders = executor.submit(
                    run_with_session,
                    migrate_contact_lens_orders,
                    csv_dir, account_to_client, branch_to_clinic, admin_user_id
                )

                future_regular_orders = executor.submit(
                    run_with_session,
                    migrate_regular_orders,
                    csv_dir, account_to_client, branch_to_clinic, admin_user_id
                )
                
                try:
                    future_exams.result()
                    print("[parallel] exams completed")
                except Exception as e:
                    print(f"[parallel] exams failed: {e}", flush=True)
                    raise
                
                try:
                    presc_code_to_order_id = future_orders.result()
                    print("[parallel] orders completed")
                except Exception as e:
                    print(f"[parallel] orders failed: {e}", flush=True)
                    raise

                try:
                    future_regular_orders.result()
                    print("[parallel] regular orders completed")
                except Exception as e:
                    print(f"[parallel] regular orders failed: {e}", flush=True)
                    raise
                
                future_enrich = executor.submit(
                    run_with_session,
                    enrich_from_contact_lens_chk,
                    csv_dir, account_to_client, presc_code_to_order_id
                )
                try:
                    future_enrich.result()
                    print("[parallel] Contact lens checks enrichment completed")
                except Exception as e:
                    print(f"[parallel] enrichment failed: {e}", flush=True)
                    raise
                
                if True:
                    future_referrals = executor.submit(
                        run_with_session,
                        migrate_referrals,
                        csv_dir, account_to_client, branch_to_clinic, admin_user_id
                    )
                    future_files = executor.submit(
                        run_with_session,
                        migrate_files,
                        csv_dir, account_to_client, branch_to_clinic, admin_user_id
                    )
                    future_logs = executor.submit(
                        run_with_session,
                        migrate_medical_logs,
                        csv_dir, account_to_client, branch_to_clinic, admin_user_id
                    )
                    future_appointments = executor.submit(
                        run_with_session,
                        migrate_appointments,
                        csv_dir, account_to_client, branch_to_clinic, admin_user_id
                    )
                    
                    for name, future in [
                        ("referrals", future_referrals),
                        ("files", future_files),
                        ("logs", future_logs),
                        ("appointments", future_appointments),
                    ]:
                        try:
                            future.result()
                            print(f"[parallel] {name} completed")
                        except Exception as e:
                            print(f"[parallel] {name} failed: {e}", flush=True)
                            raise
        else:
            admin_user_id = admin_user.id
            migrate_optical_exams(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
            print("Exams migrated")

            presc_code_to_order_id = migrate_contact_lens_orders(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
            print("Contact lens orders migrated")

            migrate_regular_orders(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
            print("Regular orders migrated")

            enrich_from_contact_lens_chk(db, csv_dir, account_to_client, presc_code_to_order_id)
            print("Contact lens checks enrichment applied")

            migrate_referrals(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
            print("Referrals and prescription notes migrated")
            migrate_files(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
            print("Files migrated")
            migrate_medical_logs(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
            print("Medical logs migrated")
            migrate_appointments(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
            print("Appointments migrated")

        print("Migration completed successfully.")
    finally:
        if 'perf_mode' in locals() and perf_mode:
            try:
                db.execute(text("SET session_replication_role = origin"))
                db.execute(text("SET synchronous_commit TO ON"))
                db.commit()
                print("[perf] Restored Postgres settings")
            except Exception as e:
                print(f"[perf] Failed to restore settings: {e}")
        db.close()


def cleanup_clinic_migration(clinic_id: int, company_id: Optional[int] = None, keep_clients: bool = True):
    db = SessionLocal()
    try:
        clinic = db.get(Clinic, clinic_id)
        if not clinic:
            raise ValueError(f"Clinic with id {clinic_id} not found")
        
        if company_id is not None and clinic.company_id != company_id:
            raise ValueError(f"Clinic {clinic_id} does not belong to company {company_id}")
        
        print(f"[cleanup] Starting cleanup for clinic: {clinic.name} (id: {clinic_id})")
        if keep_clients:
            print(f"[cleanup] Keep clients mode enabled - clients and families will not be deleted")
        t0 = time.time()
        
        perf_mode = os.environ.get("MIGRATION_PERF", "0") == "1"
        if perf_mode:
            try:
                db.execute(text("SET synchronous_commit TO OFF"))
                db.execute(text("SET session_replication_role = replica"))
                db.commit()
                print("[cleanup] Enabled Postgres fast settings")
            except Exception as e:
                print(f"[cleanup] Failed to enable fast settings: {e}")
        
        client_ids = db.execute(
            select(Client.id).where(Client.clinic_id == clinic_id)
        ).scalars().all()
        client_count = len(client_ids)
        print(f"[cleanup] Found {client_count} clients to delete")
        
        exams_count = 0
        contact_lens_orders_count = 0
        
        if client_count > 0:
            client_ids_list = list(client_ids)
            
            order_line_items_count = db.execute(
                select(func.count(OrderLineItem.id))
                .join(Billing)
                .join(ContactLensOrder)
                .where(ContactLensOrder.client_id.in_(client_ids_list))
            ).scalar() or 0
            order_line_items_count += db.execute(
                select(func.count(OrderLineItem.id))
                .join(Billing)
                .join(Order)
                .where(Order.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if order_line_items_count > 0:
                print(f"[cleanup] Deleting {order_line_items_count} order line items...")
                db.execute(
                    text("""
                        DELETE FROM order_line_item 
                        WHERE billings_id IN (
                            SELECT id FROM billings 
                            WHERE contact_lens_id IN (
                                SELECT id FROM contact_lens_orders 
                                WHERE client_id = ANY(:client_ids)
                            )
                            OR order_id IN (
                                SELECT id FROM orders 
                                WHERE client_id = ANY(:client_ids)
                            )
                        )
                    """),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            billings_count = db.execute(
                select(func.count(Billing.id))
                .where(
                    (Billing.contact_lens_id.in_(
                        select(ContactLensOrder.id).where(ContactLensOrder.client_id.in_(client_ids_list))
                    ))
                    | (Billing.order_id.in_(
                        select(Order.id).where(Order.client_id.in_(client_ids_list))
                    ))
                )
            ).scalar() or 0
            
            if billings_count > 0:
                print(f"[cleanup] Deleting {billings_count} billings...")
                db.execute(
                    text("""
                        DELETE FROM billings 
                        WHERE contact_lens_id IN (
                            SELECT id FROM contact_lens_orders 
                            WHERE client_id = ANY(:client_ids)
                        )
                        OR order_id IN (
                            SELECT id FROM orders 
                            WHERE client_id = ANY(:client_ids)
                        )
                    """),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            exam_instances_count = db.execute(
                select(func.count(ExamLayoutInstance.id))
                .join(OpticalExam)
                .where(OpticalExam.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if exam_instances_count > 0:
                print(f"[cleanup] Deleting {exam_instances_count} exam layout instances...")
                db.execute(
                    text("""
                        DELETE FROM exam_layout_instances 
                        WHERE exam_id IN (
                            SELECT id FROM optical_exams 
                            WHERE client_id = ANY(:client_ids)
                        )
                    """),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            exams_count = db.execute(
                select(func.count(OpticalExam.id))
                .where(OpticalExam.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if exams_count > 0:
                print(f"[cleanup] Deleting {exams_count} optical exams...")
                db.execute(
                    text("DELETE FROM optical_exams WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            contact_lens_orders_count = db.execute(
                select(func.count(ContactLensOrder.id))
                .where(ContactLensOrder.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if contact_lens_orders_count > 0:
                print(f"[cleanup] Deleting {contact_lens_orders_count} contact lens orders...")
                db.execute(
                    text("DELETE FROM contact_lens_orders WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            orders_count = db.execute(
                select(func.count(Order.id))
                .where(Order.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if orders_count > 0:
                print(f"[cleanup] Deleting {orders_count} orders...")
                db.execute(
                    text("DELETE FROM orders WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            referrals_count = db.execute(
                select(func.count(Referral.id))
                .where(Referral.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if referrals_count > 0:
                print(f"[cleanup] Deleting {referrals_count} referrals...")
                db.execute(
                    text("DELETE FROM referrals WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            files_count = db.execute(
                select(func.count(File.id))
                .where(File.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if files_count > 0:
                print(f"[cleanup] Deleting {files_count} files...")
                db.execute(
                    text("DELETE FROM files WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            medical_logs_count = db.execute(
                select(func.count(MedicalLog.id))
                .where(MedicalLog.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if medical_logs_count > 0:
                print(f"[cleanup] Deleting {medical_logs_count} medical logs...")
                db.execute(
                    text("DELETE FROM medical_logs WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            appointments_count = db.execute(
                select(func.count(Appointment.id))
                .where(Appointment.client_id.in_(client_ids_list))
            ).scalar() or 0
            
            if appointments_count > 0:
                print(f"[cleanup] Deleting {appointments_count} appointments...")
                db.execute(
                    text("DELETE FROM appointments WHERE client_id = ANY(:client_ids)"),
                    {"client_ids": client_ids_list}
                )
                db.flush()
            
            if not keep_clients:
                print(f"[cleanup] Deleting {client_count} clients...")
                db.execute(
                    text("DELETE FROM clients WHERE clinic_id = :clinic_id"),
                    {"clinic_id": clinic_id}
                )
                db.flush()
            else:
                print(f"[cleanup] Skipping deletion of {client_count} clients (keep_clients=True)")
        
        families_count = db.execute(
            select(func.count(Family.id))
            .where(Family.clinic_id == clinic_id)
        ).scalar() or 0
        
        if not keep_clients:
            if families_count > 0:
                print(f"[cleanup] Deleting {families_count} families...")
                db.execute(
                    text("DELETE FROM families WHERE clinic_id = :clinic_id"),
                    {"clinic_id": clinic_id}
                )
                db.flush()
        else:
            if families_count > 0:
                print(f"[cleanup] Skipping deletion of {families_count} families (keep_clients=True)")
        
        default_layouts = db.execute(
            select(ExamLayout.id)
            .where(
                (ExamLayout.clinic_id == clinic_id) &
                (ExamLayout.name == "Default Migrated Layout")
            )
        ).scalars().all()
        
        if default_layouts:
            layout_ids = list(default_layouts)
            print(f"[cleanup] Deleting {len(layout_ids)} default exam layouts...")
            db.execute(
                text("DELETE FROM exam_layouts WHERE id = ANY(:layout_ids)"),
                {"layout_ids": layout_ids}
            )
            db.flush()
        
        db.commit()
        print(f"[cleanup] Cleanup completed in {time.time()-t0:.2f}s")
        clients_status = f"{client_count} clients (kept)" if keep_clients else f"{client_count} clients"
        families_status = f"{families_count} families (kept)" if keep_clients else f"{families_count} families"
        print(f"[cleanup] Deleted: {clients_status}, {families_status}, {exams_count} exams, {contact_lens_orders_count} contact lens orders")
        
    except Exception as e:
        db.rollback()
        print(f"[cleanup] Error during cleanup: {e}", flush=True)
        raise
    finally:
        if perf_mode:
            try:
                db.execute(text("SET session_replication_role = origin"))
                db.execute(text("SET synchronous_commit TO ON"))
                db.commit()
                print("[cleanup] Restored Postgres settings")
            except Exception as e:
                print(f"[cleanup] Failed to restore settings: {e}")
        db.close()


def main():
    # Prefer ENV; fallback to new CSV folder under migration
    default_dir = os.environ.get(
        "LEGACY_CSV_DIR",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "csv_files_new")),
    )
    print(f"Using CSV directory: {default_dir}")
    
    company_id = int(os.environ["COMPANY_ID"]) if os.environ.get("COMPANY_ID") else None
    clinic_id = int(os.environ["CLINIC_ID"]) if os.environ.get("CLINIC_ID") else None
    
    if company_id is not None:
        print(f"Target company ID: {company_id}")
    if clinic_id is not None:
        print(f"Target clinic ID: {clinic_id}")
    if company_id is None and clinic_id is not None:
        print("Warning: CLINIC_ID specified without COMPANY_ID. Company will be auto-detected from clinic.")
    
    # Quick sanity: show row counts for key files
    for name in [
        "account.csv",
        "optic_device_data.csv",
        "optic_reference.csv",
        "optic_presc_prices.csv",
        "account_files.csv",
        "account_memos.csv",
        "diary_timetab.csv",
    ]:
        try:
            cnt = len(read_csv(default_dir, name))
        except Exception:
            cnt = -1
        print(f"{name}: {cnt} rows")
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
        if clinic_id is None:
            print("Error: CLINIC_ID is required for cleanup")
            sys.exit(1)
        keep_clients = os.environ.get("KEEP_CLIENTS", "0").lower() in ("1", "true", "yes", "y")
        if keep_clients:
            print(f"Running cleanup for clinic {clinic_id} (keeping clients)...")
        else:
            print(f"Running cleanup for clinic {clinic_id}...")
        cleanup_clinic_migration(clinic_id, company_id=company_id, keep_clients=keep_clients)
    else:
        migrate(default_dir, company_id=company_id, clinic_id=clinic_id)


if __name__ == "__main__":
    main()
