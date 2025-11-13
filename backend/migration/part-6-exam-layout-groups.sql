ALTER TABLE exam_layouts
    ADD COLUMN sort_index INTEGER NOT NULL DEFAULT 0;

ALTER TABLE exam_layouts
    ADD COLUMN parent_layout_id INTEGER
        REFERENCES exam_layouts(id)
        ON DELETE SET NULL;

ALTER TABLE exam_layouts
    ADD COLUMN is_group BOOLEAN NOT NULL DEFAULT FALSE;

WITH ranked_layouts AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY clinic_id
            ORDER BY created_at, id
        ) AS rn
    FROM exam_layouts
)
UPDATE exam_layouts AS e
SET sort_index = r.rn
FROM ranked_layouts AS r
WHERE e.id = r.id;

CREATE INDEX IF NOT EXISTS idx_exam_layouts_clinic_sort
    ON exam_layouts (clinic_id, sort_index);

CREATE INDEX IF NOT EXISTS idx_exam_layouts_parent
    ON exam_layouts (parent_layout_id);

ALTER TABLE exam_layouts
    ADD CONSTRAINT exam_layouts_no_self_ref CHECK (
        parent_layout_id IS NULL OR parent_layout_id <> id
    );

