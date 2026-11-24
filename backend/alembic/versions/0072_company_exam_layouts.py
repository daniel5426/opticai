"""Share exam layout definitions while keeping clinic activation.

Revision ID: 0072_company_exam_layouts
Revises: 0071_calendar_events
"""
from alembic import op
import sqlalchemy as sa

revision = "0072_company_exam_layouts"
down_revision = "0071_calendar_events"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("exam_layouts", sa.Column("company_id", sa.Integer()))
    op.add_column("exam_layouts", sa.Column("canonical_layout_id", sa.Integer()))
    op.create_foreign_key("fk_exam_layouts_company", "exam_layouts", "companies", ["company_id"], ["id"])
    op.create_foreign_key(
        "fk_exam_layouts_canonical", "exam_layouts", "exam_layouts",
        ["canonical_layout_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index("ix_exam_layouts_company_id", "exam_layouts", ["company_id"])
    op.create_index("ix_exam_layouts_canonical_layout_id", "exam_layouts", ["canonical_layout_id"])
    op.drop_constraint("exam_layouts_clinic_id_fkey", "exam_layouts", type_="foreignkey")
    op.create_foreign_key(
        "exam_layouts_clinic_id_fkey", "exam_layouts", "clinics", ["clinic_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_table(
        "exam_layout_clinic_activation",
        sa.Column("layout_id", sa.Integer(), sa.ForeignKey("exam_layouts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("clinic_id", sa.Integer(), sa.ForeignKey("clinics.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_exam_layout_clinic_activation_clinic_id", "exam_layout_clinic_activation", ["clinic_id"])
    op.execute("ALTER TABLE exam_layout_clinic_activation ENABLE ROW LEVEL SECURITY")
    op.execute("""
        UPDATE exam_layouts AS layout SET company_id = clinic.company_id
        FROM clinics AS clinic WHERE clinic.id = layout.clinic_id
    """)
    # Share only interchangeable seeded copies. Keep their rows so saved layout
    # URLs can still resolve. Customized copies and the entire hierarchy survive.
    op.execute("""
        WITH seeded AS (
            SELECT id, min(id) OVER (
                PARTITION BY company_id, seed_key, seed_version, name, layout_data,
                             type, is_default, appointment_duration, appointment_color
            ) AS canonical_id
            FROM exam_layouts AS layout
            WHERE company_id IS NOT NULL AND is_seeded_default AND seed_key IS NOT NULL
              AND parent_layout_id IS NULL AND NOT coalesce(is_group, false)
              AND NOT EXISTS (SELECT 1 FROM exam_layouts WHERE parent_layout_id = layout.id)
        )
        UPDATE exam_layouts AS layout SET canonical_layout_id = seeded.canonical_id
        FROM seeded WHERE layout.id = seeded.id AND seeded.id <> seeded.canonical_id
    """)
    op.execute("""
        INSERT INTO exam_layout_clinic_activation (layout_id, clinic_id, is_active)
        SELECT canonical_layout_id, clinic_id, coalesce(is_active, false)
        FROM exam_layouts WHERE canonical_layout_id IS NOT NULL
    """)
    op.execute("""
        UPDATE exam_layout_instances AS instance SET layout_id = layout.canonical_layout_id
        FROM exam_layouts AS layout, optical_exams AS exam
        WHERE instance.layout_id = layout.id AND layout.canonical_layout_id IS NOT NULL
          AND exam.id = instance.exam_id AND exam.company_id = layout.company_id
    """)
    op.execute("""
        UPDATE appointments AS appointment SET exam_layout_id = layout.canonical_layout_id
        FROM exam_layouts AS layout
        WHERE appointment.exam_layout_id = layout.id AND layout.canonical_layout_id IS NOT NULL
          AND appointment.company_id = layout.company_id
    """)


def downgrade():
    raise RuntimeError("Company-wide layouts require a compatible forward repair.")
